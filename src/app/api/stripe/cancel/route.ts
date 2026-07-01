/**
 * POST /api/stripe/cancel
 *
 * Annule l'abonnement réseau partenaire à la fin de la période en cours.
 * L'organisateur conserve le statut partenaire jusqu'à la date d'expiration.
 * Le webhook customer.subscription.updated (→ canceled) retire le drapeau en DB.
 *
 * Autorisation : organisateur propriétaire du réseau uniquement.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { logPlanChange } from '@/lib/audit'
import { sendEmail } from '@/lib/email-sender'
import { subscriptionCancelScheduledEmail } from '@/lib/emails'
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

  if (freshUser.role !== 'organisateur' && freshUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Seul un organisateur peut annuler un abonnement réseau partenaire.' },
      { status: 403 },
    )
  }

  // Récupère le réseau NATIONAL de l'organisateur (ADR-0012 : abonnement sur le national uniquement)
  const { docs: reseauxDocs } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        { user: { equals: user.id } },
        { niveau: { equals: 'national' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const reseau = reseauxDocs[0] as unknown as Record<string, unknown> | undefined

  if (!reseau?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: 'Aucun abonnement réseau partenaire actif.' },
      { status: 400 },
    )
  }

  const subId = reseau.stripeSubscriptionId as string

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
      oldPlan: 'reseau_partenaire',
      newPlan: 'reseau_partenaire',
      reason: 'cancel_requested',
      extra: { subscriptionId: subId, reseauId: String(reseau.id) },
    })

    // Email de confirmation d'annulation programmée
    const expireAt = reseau.partenaireExpireAt as string | null | undefined
    if (expireAt) {
      await sendEmail({
        payload,
        kind: 'subscription-cancel-scheduled',
        to: freshUser.email,
        subject: 'RÉSEAUTEURS — Annulation de votre abonnement partenaire programmée',
        html: subscriptionCancelScheduledEmail(freshUser.nomSociete ?? '', {
          planLabel: 'Réseau partenaire',
          endDateISO: expireAt,
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
