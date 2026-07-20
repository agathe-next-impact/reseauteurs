/**
 * POST /api/stripe/change-palier
 *
 * Change le palier d'abonnement d'un réseau national partenaire EN NATIF (sans passer
 * par le portail Stripe) : swap du price de la subscription + proration immédiate.
 * Le webhook customer.subscription.updated (status=active) repose `palier` /
 * `partenaireExpireAt` en DB — jamais le client (invariant §11).
 *
 * Autorisation : organisateur/admin ; resolveAbonnement ne résout que le réseau national
 * du caller (ownership par construction).
 *
 * Garde anti-downgrade : on refuse un palier dont la capacité (maxLocaux) est inférieure
 * au nombre de groupes locaux déjà possédés — sinon on créerait des locaux « en trop ».
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { stripe, PALIERS_NATIONAL } from '@/lib/stripe'
import { maxLocaux } from '@/lib/reseau-hierarchie'
import { rateLimit } from '@/lib/rate-limit'
import { logPlanChange } from '@/lib/audit'
import { resolveAbonnement } from '@/lib/abonnement'

const PALIERS_VALIDES = Object.keys(PALIERS_NATIONAL) as [string, ...string[]]

const bodySchema = z.object({
  palier: z.enum(PALIERS_VALIDES as unknown as [string, ...string[]]),
})

export async function POST(request: Request) {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { success: allowed } = rateLimit(`stripe-change-palier:${user.id}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Palier invalide' }, { status: 400 })
  }
  const { palier } = parsed.data

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  const ctx = await resolveAbonnement(freshUser as never, payload)
  if (!ctx || ctx.produit !== 'reseau_partenaire' || !ctx.supportsPalier) {
    return NextResponse.json(
      { error: 'Le changement de palier est réservé aux réseaux nationaux partenaires.' },
      { status: 403 },
    )
  }
  if (!ctx.subscriptionId) {
    return NextResponse.json(
      { error: 'Aucun abonnement actif — souscrivez d\'abord un palier.' },
      { status: 400 },
    )
  }
  if (ctx.palier === palier) {
    return NextResponse.json(
      { error: 'Vous êtes déjà sur ce palier.', code: 'same_palier' },
      { status: 409 },
    )
  }

  const newPriceId = PALIERS_NATIONAL[palier]?.priceId
  if (!newPriceId) {
    console.error(`[stripe/change-palier] STRIPE_PRICE_NATIONAL_${palier.toUpperCase()} non configuré`)
    return NextResponse.json(
      { error: 'Configuration Stripe incomplète pour ce palier. Contactez l\'administrateur.' },
      { status: 500 },
    )
  }

  // Garde anti-downgrade : la nouvelle capacité doit couvrir les locaux déjà possédés.
  const { totalDocs: nbLocaux } = await payload.find({
    collection: 'reseaux',
    where: { and: [{ user: { equals: user.id } }, { niveau: { equals: 'local' } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  const capaciteCible = maxLocaux(palier)
  if (nbLocaux > capaciteCible) {
    return NextResponse.json(
      {
        error:
          `Ce palier autorise ${capaciteCible === 999 ? 'un nombre illimité de' : capaciteCible} ` +
          `groupes locaux, mais vous en possédez déjà ${nbLocaux}. ` +
          'Supprimez des groupes ou choisissez un palier supérieur.',
        code: 'downgrade_blocked',
      },
      { status: 409 },
    )
  }

  try {
    const sub = await stripe.subscriptions.retrieve(ctx.subscriptionId)
    const itemId = sub.items?.data?.[0]?.id
    if (!itemId) {
      return NextResponse.json({ error: 'Abonnement Stripe invalide.' }, { status: 500 })
    }

    await stripe.subscriptions.update(ctx.subscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
      metadata: { ...(sub.metadata ?? {}), palier },
    })

    await logPlanChange(payload, {
      userId: user.id,
      oldPlan: ctx.palier ?? 'reseau_partenaire',
      newPlan: palier,
      reason: 'subscription_updated',
      extra: { subscriptionId: ctx.subscriptionId, reseauId: ctx.reseauId },
    })

    // Le webhook customer.subscription.updated repose palier/partenaireExpireAt en DB.
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[stripe/change-palier] Erreur:', err)
    return NextResponse.json({ error: 'Erreur lors du changement de palier' }, { status: 500 })
  }
}
