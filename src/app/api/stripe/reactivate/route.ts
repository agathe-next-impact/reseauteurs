/**
 * POST /api/stripe/reactivate
 *
 * Réactive le renouvellement automatique d'un abonnement réseau partenaire
 * programmé à annulation (cancel_at_period_end = true).
 * Autorisation : organisateur propriétaire du réseau.
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

  if (freshUser.role !== 'organisateur' && freshUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Seul un organisateur peut réactiver un abonnement réseau partenaire.' },
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
      { error: 'Aucun abonnement réseau partenaire trouvé.' },
      { status: 400 },
    )
  }

  const subId = reseau.stripeSubscriptionId as string

  try {
    const updatedSub = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: false,
    })

    await logPlanChange(payload, {
      userId: user.id,
      oldPlan: 'reseau_partenaire',
      newPlan: 'reseau_partenaire',
      reason: 'reactivate_requested',
      extra: { subscriptionId: subId, reseauId: String(reseau.id) },
    })

    // Email de confirmation
    const periodEnd = getSubscriptionPeriodEnd(updatedSub)
    const nextRenewalDateISO = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : (reseau.partenaireExpireAt as string | undefined) ?? new Date().toISOString()

    await sendEmail({
      payload,
      kind: 'subscription-reactivated',
      to: freshUser.email,
      subject: 'RÉSEAUTEURS — Abonnement réseau partenaire réactivé',
      html: subscriptionReactivatedEmail(freshUser.nomSociete ?? '', {
        planLabel: 'Réseau partenaire',
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
