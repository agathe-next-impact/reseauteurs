import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { rateLimit } from '@/lib/rate-limit'
import { logBlacklist } from '@/lib/audit'

/**
 * Resend webhook handler.
 *
 * Listens for hard-bounce and spam-complaint events and auto-blacklists the
 * recipient so `sendEmail()` stops firing to a dead address. Resend uses Svix
 * for signing (standard Webhooks convention):
 *   - svix-id        : unique delivery id (also part of the signed payload)
 *   - svix-timestamp : unix seconds
 *   - svix-signature : space-separated list of "v1,<base64>" pairs
 *
 * The signed string is `${svix_id}.${svix_timestamp}.${raw_body}` HMAC-SHA256'd
 * with the raw secret (base64-decoded after the `whsec_` prefix is stripped).
 *
 * Soft bounces are intentionally ignored — transient failures don't warrant
 * blacklisting, and Resend retries them automatically.
 */

const SIGNATURE_VERSION = 'v1'
// Reject replays older than 5 minutes. Matches Svix's default tolerance.
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000

function getSigningKey(): Buffer | null {
  const raw = process.env.RESEND_WEBHOOK_SECRET
  if (!raw) return null
  const stripped = raw.startsWith('whsec_') ? raw.slice('whsec_'.length) : raw
  try {
    return Buffer.from(stripped, 'base64')
  } catch {
    return null
  }
}

function verifySignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  key: Buffer,
): boolean {
  const signedPayload = `${svixId}.${svixTimestamp}.${body}`
  const expected = crypto.createHmac('sha256', key).update(signedPayload).digest('base64')

  // Header may contain multiple signatures (v1,<sig> v1,<sig>). Accept if any matches.
  const candidates = svixSignature.split(' ')
  for (const c of candidates) {
    const [version, sig] = c.split(',')
    if (version !== SIGNATURE_VERSION || !sig) continue
    if (sig.length !== expected.length) continue
    try {
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true
    } catch {
      // fall through
    }
  }
  return false
}

interface ResendEvent {
  type?: string
  data?: {
    email_id?: string
    to?: string[] | string
    from?: string
  }
}

function extractRecipient(event: ResendEvent): string | null {
  const to = event.data?.to
  if (Array.isArray(to)) return to[0] ?? null
  if (typeof to === 'string') return to
  return null
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success: allowed } = rateLimit(`resend-webhook:${ip}`, { limit: 60, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const key = getSigningKey()
  if (!key) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook non configure' }, { status: 500 })
  }

  const rawBody = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    // Diagnostic : Resend/Svix envoie TOUJOURS ces 3 headers. S'il en manque,
    // c'est soit une requete malicieuse, soit Resend a change ses conventions.
    console.warn(
      `[resend-webhook] 401 missing-headers id=${!!svixId} ts=${!!svixTimestamp} sig=${!!svixSignature}`,
    )
    return NextResponse.json({ error: 'Signature manquante' }, { status: 401 })
  }

  // Replay protection.
  const tsSec = parseInt(svixTimestamp, 10)
  if (!Number.isFinite(tsSec)) {
    console.warn(`[resend-webhook] 401 ts-invalid ts=${svixTimestamp}`)
    return NextResponse.json({ error: 'Timestamp invalide' }, { status: 401 })
  }
  const skew = Math.abs(Date.now() - tsSec * 1000)
  if (skew > MAX_TIMESTAMP_SKEW_MS) {
    console.warn(
      `[resend-webhook] 401 ts-skew skewMs=${skew} maxMs=${MAX_TIMESTAMP_SKEW_MS} ts=${svixTimestamp}`,
    )
    return NextResponse.json({ error: 'Timestamp hors tolerance' }, { status: 401 })
  }

  if (!verifySignature(rawBody, svixId, svixTimestamp, svixSignature, key)) {
    // Diagnostic sans fuite : on loggue la LONGUEUR des signatures et les 6
    // premiers chars de l'expected pour pouvoir correlation-comparer avec un
    // payload test genere a la main, sans exposer la signature reelle (serait
    // une fuite mineure mais evitable).
    const expected = crypto
      .createHmac('sha256', key)
      .update(`${svixId}.${svixTimestamp}.${rawBody}`)
      .digest('base64')
    const receivedFirst = svixSignature.split(' ')[0]?.slice(0, 12) ?? '—'
    console.warn(
      `[resend-webhook] 401 sig-invalid bodyLen=${rawBody.length} expectedHead=${expected.slice(0, 6)}… receivedHead=${receivedFirst}…`,
    )
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  let event: ResendEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const type = event.type
  // Only act on hard bounces and spam complaints. All other events (sent,
  // delivered, opened, clicked, delivery_delayed) are acked with 200.
  if (type !== 'email.bounced' && type !== 'email.complained') {
    return NextResponse.json({ ok: true, ignored: type })
  }

  const recipient = extractRecipient(event)
  if (!recipient) {
    return NextResponse.json({ ok: true, warning: 'no recipient' })
  }

  const reason = type === 'email.complained' ? 'complaint' : 'hard-bounce'

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: recipient } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = docs[0] as { id: number | string } | undefined
    if (!user) {
      // Unknown recipient (e.g. group invite sent to a non-member). Ack silently.
      return NextResponse.json({ ok: true, warning: 'user not found' })
    }
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        emailBlacklisted: true,
        emailBlacklistedReason: reason,
        emailBlacklistedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    // Audit RGPD : tracer chaque blacklist pour pouvoir auditer les decisions
    // qui silencient un compte (et permettre un unblacklist motive plus tard).
    await logBlacklist(payload, {
      userId: user.id,
      reason,
      source: 'resend-webhook',
      extra: { svixId },
    })
    console.info(`[resend-webhook] blacklisted userId=${user.id} reason=${reason}`)
    return NextResponse.json({ ok: true, blacklisted: true, reason })
  } catch (err) {
    console.error('[resend-webhook] update failed:', err)
    return NextResponse.json({ error: 'Echec de traitement' }, { status: 500 })
  }
}
