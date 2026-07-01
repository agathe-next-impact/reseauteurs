import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { SITE_URL } from '@/lib/site'
import { stripe } from '@/lib/stripe'
import { hashUserId } from '@/lib/audit'

function hashToken(raw: string): string {
  const secret = process.env.PAYLOAD_SECRET || ''
  return crypto.createHash('sha256').update(`${raw}:${secret}`).digest('hex')
}

function redirect(status: 'success' | 'expired' | 'taken' | 'error') {
  return NextResponse.redirect(`${SITE_URL}/dashboard/compte?email=${status}`, { status: 303 })
}

/**
 * GET /api/account/confirm-email-change?token=XXX
 *
 * Point de chute du lien envoye a la nouvelle adresse par change-email. Aucun
 * auth cookie requis : le token est la preuve de controle de la nouvelle boite.
 *
 * En cas de succes, applique le changement via payload.update (le hook
 * afterChange de Users envoie ensuite les 2 notifs aux adresses avant/apres)
 * puis synchronise l'email sur le Customer Stripe si pertinent.
 */
export async function GET(request: Request) {
  const hdrs = await headers()
  const ip = getClientIp(hdrs)
  const { success: allowed } = rateLimit(`confirm-email:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return redirect('error')
  }

  const url = new URL(request.url)
  const rawToken = url.searchParams.get('token')
  if (!rawToken || rawToken.length !== 64) {
    return redirect('error')
  }

  const payload = await getPayload({ config })
  const tokenHash = hashToken(rawToken)

  const { docs } = await payload.find({
    collection: 'users',
    where: {
      and: [
        { pendingEmailTokenHash: { equals: tokenHash } },
        { pendingEmailExpiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const target = docs[0]
  if (!target || !target.pendingEmail) {
    return redirect('expired')
  }

  const newEmail = (target.pendingEmail as string).toLowerCase()

  // Re-check unicite juste avant l'update : un autre user peut s'etre inscrit
  // avec cette adresse pendant les 24h du token.
  const { docs: conflicts } = await payload.find({
    collection: 'users',
    where: {
      and: [{ email: { equals: newEmail } }, { id: { not_equals: target.id } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (conflicts.length > 0) {
    // Cleanup : le lien est mort, on vide les pending fields pour que l'utilisateur
    // puisse retenter avec une autre adresse.
    try {
      await payload.update({
        collection: 'users',
        id: target.id,
        data: {
          pendingEmail: null,
          pendingEmailTokenHash: null,
          pendingEmailExpiresAt: null,
        },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[confirm-email-change] cleanup after conflict failed:', err)
    }
    return redirect('taken')
  }

  try {
    await payload.update({
      collection: 'users',
      id: target.id,
      data: {
        email: newEmail,
        pendingEmail: null,
        pendingEmailTokenHash: null,
        pendingEmailExpiresAt: null,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[confirm-email-change] update failed:', err)
    return redirect('error')
  }

  // Stripe sync best-effort : un echec Stripe ne doit pas empecher la
  // confirmation (l'email fonctionnel cote compte est deja applique).
  const stripeCustomerId = (target as { stripeCustomerId?: string | null }).stripeCustomerId
  if (stripeCustomerId) {
    try {
      await stripe.customers.update(stripeCustomerId, { email: newEmail })
    } catch (err) {
      console.error('[confirm-email-change] stripe sync failed:', err)
    }
  }

  // Audit RGPD : metadata ne contient JAMAIS l'email (PII). On se contente de
  // tracer qu'un changement a eu lieu — la notif email envoyee aux 2 adresses
  // par le hook Users sert deja de preuve cote utilisateur.
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'email_changed',
        userIdHash: hashUserId(target.id),
        metadata: {},
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[confirm-email-change] audit log failed:', err)
  }

  return redirect('success')
}
