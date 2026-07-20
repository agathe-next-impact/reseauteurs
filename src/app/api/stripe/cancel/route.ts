/**
 * POST /api/stripe/cancel
 *
 * Annule l'abonnement du user courant À LA FIN de la période en cours
 * (cancel_at_period_end = true). L'accès est conservé jusqu'à l'échéance ;
 * le webhook customer.subscription.updated/deleted retirera le drapeau en DB.
 *
 * Généralisé aux 3 produits (ADR-0016) via resolveAbonnement :
 *   - réseauteur Plus (users), organisateur → réseau national (reseaux),
 *     partenaire annonceur (partenaires).
 * Autorisation : garantie par construction — resolveAbonnement ne résout que le
 * porteur du caller, donc on n'agit jamais sur l'abonnement d'un tiers.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe, getSubscriptionPeriodEnd } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { logPlanChange } from '@/lib/audit'
import { sendEmail } from '@/lib/email-sender'
import { subscriptionCancelScheduledEmail } from '@/lib/emails'
import { resolveAbonnement } from '@/lib/abonnement'
import type Stripe from 'stripe'

export async function POST() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { success: allowed } = rateLimit(`stripe-cancel:${user.id}`, {
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
  if (!ctx) {
    return NextResponse.json(
      { error: 'Aucun abonnement gérable pour ce compte.' },
      { status: 403 },
    )
  }

  // Plus obtenu par licence (legacy ADR-0015) : pas d'abonnement Stripe à annuler.
  if (ctx.produit === 'reseauteur_plus' && ctx.source === 'licence') {
    return NextResponse.json(
      { error: 'Votre accès Plus provient d\'une licence — il n\'y a pas d\'abonnement à annuler.' },
      { status: 400 },
    )
  }

  if (!ctx.subscriptionId) {
    return NextResponse.json(
      { error: 'Aucun abonnement actif à annuler.' },
      { status: 400 },
    )
  }

  const subId = ctx.subscriptionId

  let existingSub: Stripe.Subscription
  try {
    existingSub = await stripe.subscriptions.retrieve(subId)
  } catch (err) {
    console.error('[stripe/cancel] retrieve failed:', err)
    return NextResponse.json({ error: 'Abonnement introuvable côté Stripe.' }, { status: 500 })
  }

  if (existingSub.status === 'canceled' || existingSub.status === 'incomplete_expired') {
    return NextResponse.json(
      { error: 'L\'abonnement est déjà annulé.', code: 'already_canceled' },
      { status: 409 },
    )
  }

  if (existingSub.cancel_at_period_end) {
    return NextResponse.json(
      { error: 'L\'abonnement est déjà programmé pour annulation.', code: 'cancel_already_pending' },
      { status: 409 },
    )
  }

  try {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true })

    await logPlanChange(payload, {
      userId: user.id,
      oldPlan: ctx.produit,
      newPlan: ctx.produit,
      reason: 'cancel_requested',
      extra: { subscriptionId: subId, porteur: ctx.porteur ?? undefined },
    })

    // Email de confirmation d'annulation programmée.
    const periodEnd = getSubscriptionPeriodEnd(existingSub)
    const endDateISO =
      ctx.expireAt ?? (periodEnd ? new Date(periodEnd * 1000).toISOString() : null)
    if (endDateISO) {
      await sendEmail({
        payload,
        kind: 'subscription-cancel-scheduled',
        to: freshUser.email,
        subject: 'RÉSEAUTEURS — Annulation de votre abonnement programmée',
        html: subscriptionCancelScheduledEmail((freshUser.nomSociete as string) ?? '', {
          planLabel: ctx.label,
          endDateISO,
        }),
        userId: freshUser.id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[stripe/cancel] Erreur:', err)
    return NextResponse.json({ error: 'Erreur lors de l\'annulation' }, { status: 500 })
  }
}
