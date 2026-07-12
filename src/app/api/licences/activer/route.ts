/**
 * POST /api/licences/activer — active une licence Réseauteur Plus via code promo (ADR-0013 P2.A).
 *
 * Body : { code: string }
 * Auth : compte réseauteur connecté. Rate-limité (anti brute-force sur les codes).
 * Toute la logique (quota, unicité, passage Plus) est atomique — lib/licences.ts.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { activerLicence } from '@/lib/licences'
import { sendEmail } from '@/lib/email-sender'
import { licenceActiveeEmail } from '@/lib/emails'

const bodySchema = z.object({ code: z.string().min(4).max(20) })

export async function POST(request: Request) {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Anti brute-force : 5 tentatives / minute / compte.
  const { success: allowed } = rateLimit(`licence-activer:${user.id}`, {
    limit: 5,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans une minute.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Code manquant ou invalide.' }, { status: 400 })
  }

  const result = await activerLicence(payload, user.id, parsed.data.code)
  if (!result.ok) {
    return NextResponse.json({ error: result.raison ?? 'Activation refusée.' }, { status: 400 })
  }

  // Email de confirmation — non bloquant.
  try {
    await sendEmail({
      payload,
      kind: 'licence-activee',
      to: user.email,
      subject: 'RÉSEAUTEURS — Votre licence Réseauteur Plus est activée',
      html: licenceActiveeEmail(
        (user.nomSociete as string) ?? '',
        result.pack?.partenaireNom ?? null,
        result.pack?.expireAt ?? null,
      ),
      userId: user.id,
    })
  } catch (err) {
    console.error('[licences/activer] email failed (non-blocking):', err)
  }

  return NextResponse.json({
    ok: true,
    partenaire: result.pack?.partenaireNom ?? null,
    expireAt: result.pack?.expireAt ?? null,
  })
}
