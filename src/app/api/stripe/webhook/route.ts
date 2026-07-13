/**
 * POST /api/stripe/webhook
 *
 * Webhook Stripe recalibré sur les 2 produits B2B (ADR-0012 §3).
 * L'événement Premium ponctuel est SUPPRIMÉ (ADR-0012).
 * Idempotent (clé sur stripe-events.eventId — contrainte UNIQUE DB).
 * Signature HMAC vérifiée avant tout traitement.
 *
 * Produits gérés :
 *   - reseau_partenaire    : Subscription nationale → national.partenaire / national.palier / partenaireExpireAt
 *   - partenaire_annonceur : Subscription → partenaire.statut / abonnementExpireAt
 *   - reseauteur_plus      : Subscription → users.plusActif / plusExpireAt (ADR-0013)
 *   - licences_pack        : Checkout one-shot → création licences-packs + code (ADR-0013)
 *
 * Events traités :
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *   - customer.updated (sync billing organisateur)
 */
import { NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import {
  stripe,
  getSubscriptionPeriodEnd,
  resolveProduitFromMetadata,
  getPalierFromPriceId,
} from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { logPlanChange } from '@/lib/audit'
import { sendEmail } from '@/lib/email-sender'
import {
  subscriptionConfirmationEmail,
  subscriptionCanceledEmail,
  paymentFailedEmail,
  plusActiveEmail,
  plusExpireEmail,
  packAcheteEmail,
} from '@/lib/emails'
import { PACKS_LICENCES } from '@/lib/stripe'
import type Stripe from 'stripe'

// ─────────────────────────────────────────────────────────────────
// Idempotence DB
// ─────────────────────────────────────────────────────────────────

async function markEventSeen(
  payload: Payload,
  eventId: string,
  type: string,
): Promise<'new' | 'duplicate'> {
  try {
    await payload.create({
      collection: 'stripe-events',
      data: { eventId, type },
      overrideAccess: true,
    })
    return 'new'
  } catch (err) {
    if (isUniqueConstraintError(err)) return 'duplicate'
    throw err
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown> & { cause?: unknown; message?: unknown }
  if (e.code === '23505') return true
  if (typeof e.message === 'string' && /duplicate key|unique constraint/i.test(e.message)) {
    return true
  }
  if (e.cause && typeof e.cause === 'object') {
    const cause = e.cause as Record<string, unknown> & { code?: unknown; message?: unknown }
    if (cause.code === '23505') return true
    if (
      typeof cause.message === 'string' &&
      /duplicate key|unique constraint/i.test(cause.message)
    ) {
      return true
    }
  }
  return false
}

// ─────────────────────────────────────────────────────────────────
// Helpers billing
// ─────────────────────────────────────────────────────────────────

function extractBillingPatch(source: {
  address?: Stripe.Address | null
  name?: string | null
  tax_ids?:
    | { data?: Array<{ type: string; value: string }> }
    | Array<{ type: string; value: string }>
    | null
}): {
  billingAddress: Record<string, string | null> | null
  vatNumber: string | null
  raisonSocialeFacturation?: string
} {
  const addr = source.address
  const billingAddress = addr
    ? {
        line1: addr.line1 ?? null,
        line2: addr.line2 ?? null,
        postal_code: addr.postal_code ?? null,
        city: addr.city ?? null,
        state: addr.state ?? null,
        country: addr.country ?? null,
      }
    : null
  const taxIdsArr = Array.isArray(source.tax_ids)
    ? source.tax_ids
    : (source.tax_ids?.data ?? [])
  const vatNumber = taxIdsArr.find((t) => t.type === 'eu_vat')?.value ?? null
  return {
    billingAddress,
    vatNumber,
    ...(source.name ? { raisonSocialeFacturation: source.name } : {}),
  }
}

/**
 * Dérive le palier depuis une subscription Stripe.
 * Priorité : priceId de l'item (source de vérité env) > metadata.palier (fallback).
 */
function resolvePalierFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  const priceId = subscription.items?.data?.[0]?.price?.id
  if (priceId) {
    const fromPrice = getPalierFromPriceId(priceId)
    if (fromPrice) return fromPrice
  }
  // Fallback : palier stocké dans les metadata (set lors du checkout)
  const palierFromMeta = (subscription.metadata as Record<string, string | undefined> | undefined)?.palier
  return palierFromMeta ?? null
}

// ─────────────────────────────────────────────────────────────────
// Handlers métier
// ─────────────────────────────────────────────────────────────────

/**
 * Active le statut partenaire d'un réseau NATIONAL.
 * Pose partenaire=true, palier (dérivé du priceId ou metadata), stripeSubscriptionId,
 * partenaireExpireAt.
 *
 * Invariant ADR-0012 §3 : significatif UNIQUEMENT sur les réseaux niveau='national'.
 * Sur un local, ces champs sont inertes (jamais écrits par les webhooks).
 *
 * Appelé sur checkout.session.completed (type=reseau_partenaire)
 * et sur customer.subscription.updated (status=active).
 */
async function activerReseauPartenaire(
  payload: Payload,
  reseauId: string | number,
  subscription: Stripe.Subscription,
): Promise<void> {
  // Vérification de sécurité : n'écrire que sur un réseau NATIONAL
  const reseau = await payload.findByID({
    collection: 'reseaux',
    id: reseauId,
    depth: 0,
    overrideAccess: true,
  })
  const niveau = (reseau as unknown as Record<string, unknown>).niveau as string | null | undefined
  if (niveau === 'local') {
    console.error(
      `[stripe-webhook] activerReseauPartenaire: réseau ${reseauId} est un chapitre local, ` +
        'ignoré (abonnement significatif sur une tête de réseau uniquement — ADR-0012 §3).',
    )
    return
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription)
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null
  const palier = resolvePalierFromSubscription(subscription)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.update as any)({
    collection: 'reseaux',
    id: reseauId,
    data: {
      partenaire: true,
      stripeSubscriptionId: subscription.id,
      ...(expiresAt ? { partenaireExpireAt: expiresAt } : {}),
      // palier dérivé du priceId — peut être absent si les env vars ne sont pas configurées
      ...(palier ? { palier } : {}),
    },
    overrideAccess: true,
    context: { webhookTrusted: true },
  })
}

/**
 * Désactive le statut partenaire d'un réseau national (expiration ou annulation).
 */
async function desactiverReseauPartenaire(
  payload: Payload,
  reseauId: string | number,
): Promise<void> {
  await payload.update({
    collection: 'reseaux',
    id: reseauId,
    data: { partenaire: false },
    overrideAccess: true,
    context: { webhookTrusted: true },
  })
}

/**
 * Active le statut d'un partenaire annonceur.
 */
async function activerPartenaireAnnonceur(
  payload: Payload,
  partenaireId: string | number,
  subscription: Stripe.Subscription,
): Promise<void> {
  const periodEnd = getSubscriptionPeriodEnd(subscription)
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

  await payload.update({
    collection: 'partenaires',
    id: partenaireId,
    data: {
      statut: 'actif',
      stripeSubscriptionId: subscription.id,
      ...(expiresAt ? { abonnementExpireAt: expiresAt } : {}),
    },
    overrideAccess: true,
  })
}

/**
 * Désactive un partenaire annonceur.
 */
async function desactiverPartenaireAnnonceur(
  payload: Payload,
  partenaireId: string | number,
): Promise<void> {
  await payload.update({
    collection: 'partenaires',
    id: partenaireId,
    data: { statut: 'expire' },
    overrideAccess: true,
  })
}

// ─────────────────────────────────────────────────────────────────
// Réseauteur Plus + packs de licences (ADR-0013 P2.A)
// ─────────────────────────────────────────────────────────────────

/**
 * Active le Plus d'un réseauteur (abonnement individuel).
 * plusExpireAt = fin de période Stripe (renouvellement → refresh au prochain event).
 */
async function activerReseauteurPlus(
  payload: Payload,
  userId: string | number,
  subscription: Stripe.Subscription,
): Promise<void> {
  const periodEnd = getSubscriptionPeriodEnd(subscription)
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      plusActif: true,
      plusSource: 'abonnement',
      ...(expiresAt ? { plusExpireAt: expiresAt } : {}),
    },
    overrideAccess: true,
    context: { webhookTrusted: true },
  })
}

/** Désactive le Plus d'un réseauteur (annulation/impayé/fin d'abonnement). */
async function desactiverReseauteurPlus(
  payload: Payload,
  userId: string | number,
): Promise<void> {
  await payload.update({
    collection: 'users',
    id: userId,
    data: { plusActif: false },
    overrideAccess: true,
    context: { webhookTrusted: true },
  })
}

/** Retrouve le user d'une subscription Plus via son customer Stripe (fallback metadata absente). */
async function findUserByCustomerId(
  payload: Payload,
  customerId: string,
): Promise<{ id: number | string; email?: string; nomSociete?: string | null } | null> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { stripeCustomerId: { equals: customerId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return (docs[0] as { id: number | string; email?: string; nomSociete?: string | null } | undefined) ?? null
}

/**
 * Crée le pack de licences après paiement (Checkout one-shot — gate P0 D3).
 * IDEMPOTENT : clé sur stripeCheckoutSessionId (retry webhook → pas de doublon).
 * Quota réconcilié SERVEUR depuis la taille (jamais confiance à la metadata seule).
 * Expiration alignée sur l'abonnement annonceur du partenaire (gate P0 D4) — sinon +1 an.
 */
async function creerPackLicences(
  payload: Payload,
  session: Stripe.Checkout.Session,
): Promise<{ id: number | string; code?: string | null } | null> {
  const partenaireId = session.metadata?.partenaireId
  const taille = session.metadata?.taille
  if (!partenaireId || !taille) {
    console.error('[stripe-webhook] licences_pack: metadata incomplète', session.metadata)
    return null
  }

  const packCfg = PACKS_LICENCES[taille]
  if (!packCfg) {
    console.error(`[stripe-webhook] licences_pack: taille inconnue "${taille}"`)
    return null
  }

  // Idempotence : un pack par session de paiement.
  const { docs: existing } = await payload.find({
    collection: 'licences-packs',
    where: { stripeCheckoutSessionId: { equals: session.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (existing.length > 0) {
    return existing[0] as { id: number | string; code?: string | null }
  }

  // Expiration alignée sur l'abonnement annonceur (D4) ; défaut +1 an.
  const partenaire = await payload.findByID({
    collection: 'partenaires',
    id: partenaireId,
    depth: 0,
    overrideAccess: true,
  })
  const abonnementExpireAt = (partenaire as unknown as { abonnementExpireAt?: string | null })
    ?.abonnementExpireAt
  const expireAt =
    abonnementExpireAt && new Date(abonnementExpireAt).getTime() > Date.now()
      ? abonnementExpireAt
      : new Date(Date.now() + 365 * 86400e3).toISOString()

  const pack = await payload.create({
    collection: 'licences-packs',
    data: {
      partenaire: Number(partenaireId),
      quota: packCfg.quota,
      quotaUtilise: 0,
      statut: 'actif',
      expireAt,
      stripeCheckoutSessionId: session.id,
    },
    overrideAccess: true,
  })
  return pack as { id: number | string; code?: string | null }
}

// ─────────────────────────────────────────────────────────────────
// Recherche d'entité depuis subscriptionId
// ─────────────────────────────────────────────────────────────────

async function findReseauBySubscriptionId(
  payload: Payload,
  subscriptionId: string,
): Promise<{ id: number | string } | null> {
  const { docs } = await payload.find({
    collection: 'reseaux',
    where: { stripeSubscriptionId: { equals: subscriptionId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return (docs[0] as { id: number | string } | undefined) ?? null
}

async function findPartenaireBySubscriptionId(
  payload: Payload,
  subscriptionId: string,
): Promise<{ id: number | string; statut?: string } | null> {
  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { stripeSubscriptionId: { equals: subscriptionId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return (docs[0] as { id: number | string; statut?: string } | undefined) ?? null
}

// ─────────────────────────────────────────────────────────────────
// Route principale
// ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('[stripe-webhook] Signature invalide:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  // Rate limit après vérification HMAC — protège contre les bursts d'events légitimes
  const { success: allowed } = rateLimit(`stripe-webhook:${event.type}`, {
    limit: 100,
    windowMs: 60_000,
  })
  if (!allowed) {
    console.warn(`[stripe-webhook] rate limit hit for ${event.type}`)
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const payload = await getPayload({ config })

  // Idempotence persistante via stripe-events (UNIQUE eventId)
  let seen: 'new' | 'duplicate'
  try {
    seen = await markEventSeen(payload, event.id, event.type)
  } catch (err) {
    console.error('[stripe-webhook] markEventSeen failed (non-unique error):', err)
    return NextResponse.json(
      { error: 'Échec persistance idempotence — retry' },
      { status: 500 },
    )
  }
  if (seen === 'duplicate') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  switch (event.type) {
    // ────────────────────────────────────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const produit = resolveProduitFromMetadata(session.metadata)

      if (!produit) {
        // Event d'un checkout non géré (test, ancien flux evenement_premium retiré) → ignore
        console.warn(
          `[stripe-webhook] checkout.session.completed: type inconnu metadata=`,
          session.metadata,
        )
        break
      }

      // ── 1. Réseau national partenaire
      if (produit === 'reseauPartenaire') {
        const reseauId = session.metadata?.reseauId
        const userId = session.metadata?.userId
        if (!reseauId) {
          console.error('[stripe-webhook] reseau_partenaire: reseauId absent dans metadata')
          break
        }

        const subscriptionId = session.subscription as string | null
        if (!subscriptionId) {
          console.error('[stripe-webhook] reseau_partenaire: subscriptionId absent')
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await activerReseauPartenaire(payload, reseauId, subscription)

        // Sync billing info sur le user-organisateur
        if (userId) {
          const customerDetails = session.customer_details
          const billingPatch = extractBillingPatch({
            address: customerDetails?.address,
            name: customerDetails?.name,
            // TaxId[] from Stripe Checkout — compatible with extractBillingPatch
            tax_ids: (customerDetails?.tax_ids ?? []) as Array<{ type: string; value: string }>,
          })
          try {
            await payload.update({
              collection: 'users',
              id: Number(userId),
              data: {
                stripeCustomerId: session.customer as string,
                // Reset alertes expiration pour le nouveau cycle
                expirationAlerts: { j30Sent: false, j7Sent: false },
                ...(billingPatch.billingAddress
                  ? { billingAddress: billingPatch.billingAddress }
                  : {}),
                ...(billingPatch.vatNumber ? { vatNumber: billingPatch.vatNumber } : {}),
                ...(billingPatch.raisonSocialeFacturation
                  ? { raisonSocialeFacturation: billingPatch.raisonSocialeFacturation }
                  : {}),
              },
              overrideAccess: true,
              context: { webhookTrusted: true },
            })
          } catch (err) {
            console.error('[stripe-webhook] Sync billing user failed (non-blocking):', err)
          }

          // Email de confirmation
          try {
            const owner = await payload.findByID({
              collection: 'users',
              id: Number(userId),
              overrideAccess: true,
            })
            await sendEmail({
              payload,
              kind: 'subscription-confirmation',
              to: owner.email,
              subject: 'RÉSEAUTEURS — Abonnement réseau partenaire activé',
              html: subscriptionConfirmationEmail('Réseau national partenaire', owner.nomSociete ?? ''),
              userId: owner.id,
            })
          } catch (err) {
            console.error('[stripe-webhook] Email confirmation reseau partenaire failed:', err)
          }
        }

        try {
          await logPlanChange(payload, {
            userId: userId ? Number(userId) : 0,
            oldPlan: null,
            newPlan: 'reseau_partenaire',
            reason: 'checkout_completed',
            extra: { subscriptionId, reseauId },
          })
        } catch {
          /* audit non bloquant */
        }
      }

      // ── 2. Partenaire annonceur
      else if (produit === 'partenaireAnnonceur') {
        const partenaireId = session.metadata?.partenaireId
        if (!partenaireId) {
          console.error('[stripe-webhook] partenaire_annonceur: partenaireId absent dans metadata')
          break
        }

        const subscriptionId = session.subscription as string | null
        if (!subscriptionId) {
          console.error('[stripe-webhook] partenaire_annonceur: subscriptionId absent')
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await activerPartenaireAnnonceur(payload, partenaireId, subscription)
      }

      // ── 3. Réseauteur Plus (ADR-0013)
      else if (produit === 'reseauteurPlus') {
        const userId = session.metadata?.userId
        const subscriptionId = session.subscription as string | null
        if (!userId || !subscriptionId) {
          console.error('[stripe-webhook] reseauteur_plus: userId/subscriptionId absent')
          break
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await activerReseauteurPlus(payload, Number(userId), subscription)

        try {
          const owner = await payload.findByID({
            collection: 'users',
            id: Number(userId),
            overrideAccess: true,
          })
          await sendEmail({
            payload,
            kind: 'plus-active',
            to: owner.email,
            subject: 'RÉSEAUTEURS — Bienvenue en Réseauteur Plus',
            html: plusActiveEmail(owner.nomSociete ?? ''),
            userId: owner.id,
          })
        } catch (err) {
          console.error('[stripe-webhook] Email plus-active failed:', err)
        }

        try {
          await logPlanChange(payload, {
            userId: Number(userId),
            oldPlan: null,
            newPlan: 'reseauteur_plus',
            reason: 'checkout_completed',
            extra: { subscriptionId },
          })
        } catch { /* audit non bloquant */ }
      }

      // ── 4. Pack de licences Plus (ADR-0013 — Checkout one-shot)
      else if (produit === 'licencesPack') {
        const pack = await creerPackLicences(payload, session)
        if (pack) {
          // Email au partenaire : code à diffuser — non bloquant.
          try {
            const partenaireId = session.metadata?.partenaireId
            const partenaire = partenaireId
              ? await payload.findByID({
                  collection: 'partenaires',
                  id: partenaireId,
                  depth: 1,
                  overrideAccess: true,
                })
              : null
            const ownerRel = (partenaire as unknown as { user?: { id?: number | string; email?: string; nomSociete?: string | null } | number | null })?.user
            const owner = ownerRel && typeof ownerRel === 'object' ? ownerRel : null
            if (owner?.email) {
              const quota = Number(session.metadata?.quota ?? 0)
              await sendEmail({
                payload,
                kind: 'pack-achete',
                to: owner.email,
                subject: 'RÉSEAUTEURS — Votre pack de licences Plus est actif',
                html: packAcheteEmail(
                  (partenaire?.nom as string) ?? '',
                  pack.code ?? '',
                  quota,
                ),
                userId: owner.id,
                skipBlacklistCheck: true,
              })
            }
          } catch (err) {
            console.error('[stripe-webhook] Email pack-achete failed:', err)
          }
        }
      }

      break
    }

    // ────────────────────────────────────────────────────────────────────────
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const subMetadata = subscription.metadata ?? {}
      const produit = resolveProduitFromMetadata(subMetadata)

      if (produit === 'reseauPartenaire') {
        // Chercher le réseau par subscriptionId (plus fiable que la metadata seule)
        let reseauId: string | number | undefined =
          (subMetadata as Record<string, string | undefined>).reseauId

        if (!reseauId) {
          const reseau = await findReseauBySubscriptionId(payload, subscription.id)
          if (reseau) reseauId = reseau.id
        }

        if (!reseauId) {
          console.warn(
            `[stripe-webhook] subscription.updated reseau_partenaire: réseau introuvable sub=${subscription.id}`,
          )
          break
        }

        if (subscription.status === 'active') {
          await activerReseauPartenaire(payload, reseauId, subscription)

          // Reset alertes expiration si renouvellement (palier peut avoir changé)
          const userId = (subMetadata as Record<string, string | undefined>).userId
          if (userId) {
            try {
              await payload.update({
                collection: 'users',
                id: Number(userId),
                data: { expirationAlerts: { j30Sent: false, j7Sent: false } },
                overrideAccess: true,
                context: { webhookTrusted: true },
              })
            } catch {
              /* non bloquant */
            }
          }
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          await desactiverReseauPartenaire(payload, reseauId)

          // Email annulation
          const userId = (subMetadata as Record<string, string | undefined>).userId
          if (userId) {
            try {
              const owner = await payload.findByID({
                collection: 'users',
                id: Number(userId),
                overrideAccess: true,
              })
              await sendEmail({
                payload,
                kind: 'subscription-canceled',
                to: owner.email,
                subject: 'RÉSEAUTEURS — Votre abonnement réseau partenaire a été annulé',
                html: subscriptionCanceledEmail(
                  owner.nomSociete ?? '',
                  new Date().toLocaleDateString('fr-FR'),
                ),
                userId: owner.id,
              })
            } catch (err) {
              console.error('[stripe-webhook] Email annulation reseau failed:', err)
            }
          }
        } else if (subscription.status === 'past_due') {
          // Smart Retries Stripe en cours — on n'annule pas encore
          const userId = (subMetadata as Record<string, string | undefined>).userId
          if (userId) {
            try {
              const owner = await payload.findByID({
                collection: 'users',
                id: Number(userId),
                overrideAccess: true,
              })
              await sendEmail({
                payload,
                kind: 'payment-failed',
                to: owner.email,
                subject: 'RÉSEAUTEURS — Échec de paiement — abonnement réseau partenaire',
                html: paymentFailedEmail(owner.nomSociete ?? ''),
                userId: owner.id,
              })
            } catch (err) {
              console.error('[stripe-webhook] Email payment-failed reseau failed:', err)
            }
          }
        }
      } else if (produit === 'partenaireAnnonceur') {
        let partenaireId: string | number | undefined =
          (subMetadata as Record<string, string | undefined>).partenaireId

        if (!partenaireId) {
          const partenaire = await findPartenaireBySubscriptionId(payload, subscription.id)
          if (partenaire) partenaireId = partenaire.id
        }

        if (!partenaireId) {
          console.warn(
            `[stripe-webhook] subscription.updated partenaire_annonceur: partenaire introuvable sub=${subscription.id}`,
          )
          break
        }

        if (subscription.status === 'active') {
          await activerPartenaireAnnonceur(payload, partenaireId, subscription)
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          await desactiverPartenaireAnnonceur(payload, partenaireId)
        }
      } else if (produit === 'reseauteurPlus') {
        // ADR-0013 : cycle de vie de l'abonnement Plus.
        let userId: string | number | undefined =
          (subMetadata as Record<string, string | undefined>).userId
        let owner: { id: number | string; email?: string; nomSociete?: string | null } | null = null
        if (!userId) {
          owner = await findUserByCustomerId(payload, String(subscription.customer))
          if (owner) userId = owner.id
        }
        if (!userId) {
          console.warn(`[stripe-webhook] subscription.updated reseauteur_plus: user introuvable sub=${subscription.id}`)
          break
        }

        if (subscription.status === 'active') {
          await activerReseauteurPlus(payload, userId, subscription)
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          await desactiverReseauteurPlus(payload, userId)
          try {
            if (!owner) {
              owner = (await payload.findByID({
                collection: 'users',
                id: userId,
                overrideAccess: true,
              })) as unknown as { id: number | string; email?: string; nomSociete?: string | null }
            }
            if (owner?.email) {
              await sendEmail({
                payload,
                kind: 'plus-expire',
                to: owner.email,
                subject: 'RÉSEAUTEURS — Votre abonnement Réseauteur Plus a pris fin',
                html: plusExpireEmail(owner.nomSociete ?? ''),
                userId: owner.id,
              })
            }
          } catch (err) {
            console.error('[stripe-webhook] Email plus-expire failed:', err)
          }
        }
      } else {
        // Subscription non gérée (groupes dormants, ancien flux PanoramaPub, evenement_premium retiré)
        // On ignore silencieusement pour éviter les faux positifs.
        console.info(
          `[stripe-webhook] subscription.updated: type non géré sub=${subscription.id} metadata=`,
          subMetadata,
        )
      }

      break
    }

    // ────────────────────────────────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const subMetadata = subscription.metadata ?? {}
      const produit = resolveProduitFromMetadata(subMetadata)

      if (produit === 'reseauPartenaire') {
        let reseauId: string | number | undefined =
          (subMetadata as Record<string, string | undefined>).reseauId
        if (!reseauId) {
          const reseau = await findReseauBySubscriptionId(payload, subscription.id)
          if (reseau) reseauId = reseau.id
        }
        if (reseauId) {
          await desactiverReseauPartenaire(payload, reseauId)
          try {
            await logPlanChange(payload, {
              userId: 0,
              oldPlan: 'reseau_partenaire',
              newPlan: null,
              reason: 'subscription_deleted',
              extra: { subscriptionId: subscription.id, reseauId: String(reseauId) },
            })
          } catch {
            /* audit non bloquant */
          }
        }
      } else if (produit === 'partenaireAnnonceur') {
        let partenaireId: string | number | undefined =
          (subMetadata as Record<string, string | undefined>).partenaireId
        if (!partenaireId) {
          const partenaire = await findPartenaireBySubscriptionId(payload, subscription.id)
          if (partenaire) partenaireId = partenaire.id
        }
        if (partenaireId) {
          await desactiverPartenaireAnnonceur(payload, partenaireId)
        }
      } else if (produit === 'reseauteurPlus') {
        // ADR-0013 : fin d'abonnement Plus.
        let userId: string | number | undefined =
          (subMetadata as Record<string, string | undefined>).userId
        if (!userId) {
          const owner = await findUserByCustomerId(payload, String(subscription.customer))
          if (owner) userId = owner.id
        }
        if (userId) {
          await desactiverReseauteurPlus(payload, userId)
        }
      }

      break
    }

    // ────────────────────────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // Retrouver l'organisateur ou l'admin associé
      const { docs } = await payload.find({
        collection: 'users',
        where: { stripeCustomerId: { equals: customerId } },
        limit: 1,
        overrideAccess: true,
      })

      if (docs.length > 0) {
        const owner = docs[0]
        try {
          await sendEmail({
            payload,
            kind: 'payment-failed',
            to: owner.email,
            subject: 'RÉSEAUTEURS — Échec de paiement',
            html: paymentFailedEmail(owner.nomSociete ?? ''),
            userId: owner.id,
          })
        } catch (err) {
          console.error('[stripe-webhook] payment-failed email failed:', err)
        }
      }

      break
    }

    // ────────────────────────────────────────────────────────────────────────
    // Sync billing info quand l'organisateur modifie son profil Stripe Portal
    case 'customer.updated': {
      const stub = event.data.object as Stripe.Customer
      const fullCustomer = await stripe.customers.retrieve(stub.id, {
        expand: ['tax_ids'],
      })
      if ((fullCustomer as { deleted?: boolean }).deleted) break

      const { docs } = await payload.find({
        collection: 'users',
        where: { stripeCustomerId: { equals: stub.id } },
        limit: 1,
        overrideAccess: true,
      })
      if (docs.length === 0) break

      const patch = extractBillingPatch({
        address: (fullCustomer as Stripe.Customer).address,
        name: (fullCustomer as Stripe.Customer).name,
        tax_ids: (
          fullCustomer as Stripe.Customer & {
            tax_ids?: { data: Array<{ type: string; value: string }> }
          }
        ).tax_ids,
      })

      await payload.update({
        collection: 'users',
        id: docs[0].id,
        data: {
          billingAddress: patch.billingAddress,
          vatNumber: patch.vatNumber,
          ...(patch.raisonSocialeFacturation
            ? { raisonSocialeFacturation: patch.raisonSocialeFacturation }
            : {}),
        },
        overrideAccess: true,
        context: { webhookTrusted: true },
      })

      break
    }

    // ────────────────────────────────────────────────────────────────────────
    // Events non gérés — ignore silencieusement (Stripe envoie beaucoup d'events)
    default: {
      break
    }
  }

  return NextResponse.json({ received: true })
}
