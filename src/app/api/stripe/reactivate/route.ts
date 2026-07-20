/**
 * POST /api/stripe/reactivate
 *
 * Réactive le renouvellement automatique d'un abonnement programmé à annulation
 * (cancel_at_period_end = true → false).
 *
 * Généralisé aux 3 produits (ADR-0016) via resolveAbonnement :
 *   - réseauteur Plus (users), organisateur → réseau national (reseaux),
 *     partenaire annonceur (partenaires).
 * Autorisation : garantie par construction — resolveAbonnement ne résout que le
 * porteur du caller.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe, getSubscriptionPeriodEnd } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { logPlanChange } from '@/lib/audit'
import { sendEmail } from '@/lib/email-sender'
import { subscriptionReactivatedEmail } from '@/lib/emails'
import { resolveAbonnement } from '@/lib/abonnement'
import type Stripe from 'stripe'

export async function POST() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { success: allowed } = rateLimit(`stripe-reactivate:${user.id}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  const ctx = await resolveAbonnement(freshUser as never, payload)
  if (!ctx || !ctx.subscriptionId) {
    return NextResponse.json(
      { error: 'Aucun abonnement à réactiver.' },
      { status: 400 },
    )
  }

  const subId = ctx.subscriptionId

  let existingSub: Stripe.Subscription
  try {
    existingSub = await stripe.subscriptions.retrieve(subId)
  } catch (err) {
    console.error('[stripe/reactivate] retrieve failed:', err)
    return NextResponse.json({ error: 'Abonnement introuvable côté Stripe.' }, { status: 500 })
  }

  if (existingSub.status === 'canceled' || existingSub.status === 'incomplete_expired') {
    return NextResponse.json(
      {
        error: 'L\'abonnement est déjà résilié — souscrivez à nouveau pour le réactiver.',
        code: 'already_canceled',
      },
      { status: 409 },
    )
  }

  if (!existingSub.cancel_at_period_end) {
    return NextResponse.json(
      { error: 'Le renouvellement automatique est déjà actif.', code: 'not_pending' },
      { status: 409 },
    )
  }

  try {
    const updatedSub = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: false,
    })

    await logPlanChange(payload, {
      userId: user.id,
      oldPlan: ctx.produit,
      newPlan: ctx.produit,
      reason: 'reactivate_requested',
      extra: { subscriptionId: subId, porteur: ctx.porteur ?? undefined },
    })

    // Email de confirmation.
    const periodEnd = getSubscriptionPeriodEnd(updatedSub)
    const nextRenewalDateISO = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : ctx.expireAt ?? new Date().toISOString()

    await sendEmail({
      payload,
      kind: 'subscription-reactivated',
      to: freshUser.email,
      subject: 'RÉSEAUTEURS — Abonnement réactivé',
      html: subscriptionReactivatedEmail((freshUser.nomSociete as string) ?? '', {
        planLabel: ctx.label,
        nextRenewalDateISO,
        nextRenewalAmountCents: 0, // Montant géré côté Stripe
      }),
      userId: freshUser.id,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[stripe/reactivate] Erreur:', err)
    return NextResponse.json({ error: 'Erreur lors de la réactivation' }, { status: 500 })
  }
}
