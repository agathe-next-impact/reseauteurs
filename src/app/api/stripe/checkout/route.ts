/**
 * POST /api/stripe/checkout
 *
 * Route unifiée pour les 2 produits B2B (ADR-0012 §3).
 * L'événement Premium ponctuel est SUPPRIMÉ (ADR-0012).
 *
 * Détermine le flux via le paramètre `type` :
 *   - reseau_partenaire    : Subscription nationale par palier → national.partenaire = true
 *   - partenaire_annonceur : Subscription (admin only) → partenaire.statut = actif
 *
 * Autorisation stricte (vérifié serveur) :
 *   - reseau_partenaire    : organisateur propriétaire d'un réseau NATIONAL
 *   - partenaire_annonceur : admin uniquement
 *
 * Le webhook checkout.session.completed pose les drapeaux en DB — jamais le client.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { stripe, PALIERS_NATIONAL, PACKS_LICENCES, PRODUITS } from '@/lib/stripe'
import { SITE_URL } from '@/lib/site'
import { rateLimit } from '@/lib/rate-limit'

const PALIERS_VALIDES = Object.keys(PALIERS_NATIONAL) as [string, ...string[]]

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reseau_partenaire'),
    reseauId: z.string().min(1),
    /** Palier d'abonnement national. Défaut : 'starter'. */
    palier: z.enum(PALIERS_VALIDES as unknown as [string, ...string[]]).optional().default('starter'),
  }),
  z.object({
    type: z.literal('partenaire_annonceur'),
    partenaireId: z.string().min(1),
  }),
  // ADR-0013 : abonnement Réseauteur Plus (Subscription 39 € HT/an — gate P0 D2).
  z.object({
    type: z.literal('reseauteur_plus'),
  }),
  // ADR-0013 : pack de licences Plus (Checkout one-shot — gate P0 D3).
  z.object({
    type: z.literal('licences_pack'),
    partenaireId: z.string().min(1),
    taille: z.enum(['10', '50', '100']),
  }),
])

export async function POST(request: Request) {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Rate limit par user (10 sessions checkout/min)
  const { success: allowed } = rateLimit(`stripe-checkout:${user.id}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.issues },
      { status: 400 },
    )
  }

  // Lecture fraîche du user (JWT peut être périmé)
  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  try {
    switch (parsed.data.type) {
      // ──────────────────────────────────────────────────────────────────────
      // 1. RÉSEAU NATIONAL PARTENAIRE — Subscription par palier (ADR-0012 §3 Q5)
      // ──────────────────────────────────────────────────────────────────────
      case 'reseau_partenaire': {
        if (freshUser.role !== 'organisateur' && freshUser.role !== 'admin') {
          return NextResponse.json(
            { error: "Seul un compte organisateur peut souscrire l'abonnement réseau partenaire." },
            { status: 403 },
          )
        }

        const { reseauId, palier } = parsed.data

        // Vérification ownership : l'organisateur doit posséder ce réseau
        const reseau = await payload.findByID({
          collection: 'reseaux',
          id: reseauId,
          depth: 0,
          overrideAccess: true,
        })

        if (!reseau) {
          return NextResponse.json({ error: 'Réseau introuvable' }, { status: 404 })
        }

        // Invariant ADR-0012 §3 : l'abonnement est posé sur une TÊTE de réseau (non-local).
        const niveauReseau = (reseau as unknown as Record<string, unknown>).niveau as string | null | undefined
        if (niveauReseau === 'local') {
          return NextResponse.json(
            {
              error: "L'abonnement réseau ne peut être souscrit que sur une tête de réseau (régional/national/international). " +
                     'Les groupes locaux bénéficient de l\'abonnement de leur tête de réseau parent.',
            },
            { status: 400 },
          )
        }

        const ownerId =
          typeof reseau.user === 'object' && reseau.user !== null
            ? (reseau.user as { id: number | string }).id
            : (reseau.user as number | string | null | undefined)

        if (freshUser.role !== 'admin' && Number(ownerId) !== Number(freshUser.id)) {
          return NextResponse.json(
            { error: 'Vous ne pouvez gérer que votre propre réseau national.' },
            { status: 403 },
          )
        }

        // Résolution du priceId depuis le palier sélectionné
        const priceId = PALIERS_NATIONAL[palier]?.priceId
        if (!priceId) {
          const envVar = `STRIPE_PRICE_NATIONAL_${palier.toUpperCase()}`
          console.error(`[stripe/checkout] ${envVar} non configuré`)
          return NextResponse.json(
            {
              error: 'Configuration Stripe incomplète pour ce palier. Contactez l\'administrateur.',
              // TODO : renseigner les variables STRIPE_PRICE_NATIONAL_STARTER/GROWTH/ENTERPRISE
              //        avec les IDs de prix réels fournis par le product owner.
            },
            { status: 500 },
          )
        }

        // Garde anti-double-checkout : si une subscription active existe déjà sur ce réseau
        const stripeSubId = (reseau as unknown as Record<string, unknown>).stripeSubscriptionId as string | null | undefined
        if (stripeSubId) {
          try {
            const existingSub = await stripe.subscriptions.retrieve(stripeSubId)
            if (existingSub.status === 'active' || existingSub.status === 'trialing') {
              return NextResponse.json(
                {
                  error: 'Ce réseau a déjà un abonnement partenaire actif. Gérez-le via le portail client.',
                  code: 'already_active',
                },
                { status: 409 },
              )
            }
          } catch {
            // Subscription introuvable côté Stripe → on laisse créer une nouvelle
          }
        }

        // Création ou récupération du customer Stripe pour l'organisateur
        let customerId = freshUser.stripeCustomerId as string | undefined
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: freshUser.email,
            name: (freshUser.nomSociete as string) || undefined,
            metadata: { userId: String(freshUser.id) },
          })
          customerId = customer.id
          await payload.update({
            collection: 'users',
            id: freshUser.id,
            data: { stripeCustomerId: customerId },
            overrideAccess: true,
            context: { webhookTrusted: true },
          })
        }

        const palierLabel = PALIERS_NATIONAL[palier]?.label ?? palier

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          billing_address_collection: 'required',
          customer_update: { address: 'auto', name: 'auto' },
          subscription_data: {
            description: `Abonnement réseau national partenaire ${palierLabel} — RÉSEAUTEURS`,
            metadata: {
              type: 'reseau_partenaire',
              reseauId: String(reseauId),
              userId: String(freshUser.id),
              palier,
            },
          },
          allow_promotion_codes: true,
          metadata: {
            type: 'reseau_partenaire',
            reseauId: String(reseauId),
            userId: String(freshUser.id),
            palier,
          },
          success_url: `${SITE_URL}/dashboard/reseau?checkout=success`,
          cancel_url: `${SITE_URL}/dashboard/reseau?checkout=cancel`,
        })

        return NextResponse.json({ url: session.url })
      }

      // ──────────────────────────────────────────────────────────────────────
      // 2. PARTENAIRE ANNONCEUR — Subscription (admin only en V1)
      // ──────────────────────────────────────────────────────────────────────
      case 'partenaire_annonceur': {
        const { partenaireId } = parsed.data

        const partenaire = await payload.findByID({
          collection: 'partenaires',
          id: partenaireId,
          depth: 0,
          overrideAccess: true,
        })

        if (!partenaire) {
          return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
        }

        // Autorisation : admin OU propriétaire de la fiche partenaire (self-service).
        const ownerId =
          typeof partenaire.user === 'object' && partenaire.user !== null
            ? (partenaire.user as { id: number | string }).id
            : (partenaire.user as number | string | null | undefined)
        if (freshUser.role !== 'admin' && Number(ownerId) !== Number(freshUser.id)) {
          return NextResponse.json(
            { error: 'Vous ne pouvez gérer que votre propre abonnement partenaire.' },
            { status: 403 },
          )
        }

        const priceId = process.env.STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID
        if (!priceId) {
          console.error('[stripe/checkout] STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID non configuré')
          return NextResponse.json(
            { error: 'Configuration Stripe incomplète.' },
            { status: 500 },
          )
        }

        // Customer Stripe rattaché au partenaire (via stripeCustomerId sur la collection)
        let customerId = (partenaire as unknown as Record<string, unknown>).stripeCustomerId as string | undefined
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: freshUser.email,
            name: (partenaire.nom as string) || undefined,
            metadata: { partenaireId: String(partenaireId), userId: String(freshUser.id) },
          })
          customerId = customer.id
          await payload.update({
            collection: 'partenaires',
            id: partenaireId,
            data: { stripeCustomerId: customerId },
            overrideAccess: true,
          })
        }

        // Miroir sur le user : le portail Stripe lit user.stripeCustomerId.
        if (freshUser.stripeCustomerId !== customerId) {
          await payload.update({
            collection: 'users',
            id: freshUser.id,
            data: { stripeCustomerId: customerId },
            overrideAccess: true,
            context: { webhookTrusted: true },
          })
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          automatic_tax: { enabled: true },
          billing_address_collection: 'required',
          subscription_data: {
            description: `Abonnement partenaire annonceur — RÉSEAUTEURS`,
            metadata: {
              type: 'partenaire_annonceur',
              partenaireId: String(partenaireId),
            },
          },
          metadata: {
            type: 'partenaire_annonceur',
            partenaireId: String(partenaireId),
          },
          success_url: `${SITE_URL}/dashboard/partenaire?checkout=success`,
          cancel_url: `${SITE_URL}/dashboard/partenaire?checkout=cancel`,
        })

        return NextResponse.json({ url: session.url })
      }

      // ──────────────────────────────────────────────────────────────────────
      // 3. RÉSEAUTEUR PLUS — Subscription individuelle (ADR-0013, gate P0 D2)
      // ──────────────────────────────────────────────────────────────────────
      case 'reseauteur_plus': {
        if (freshUser.role !== 'reseauteur') {
          return NextResponse.json(
            { error: 'L\'abonnement Réseauteur Plus est réservé aux comptes réseauteurs.' },
            { status: 403 },
          )
        }

        // Déjà Plus (abonnement ou licence) → pas de double souscription.
        if ((freshUser as unknown as { plusActif?: boolean }).plusActif === true) {
          return NextResponse.json(
            { error: 'Votre compte est déjà Réseauteur Plus.', code: 'already_active' },
            { status: 409 },
          )
        }

        const priceId = PRODUITS.reseauteurPlus.priceId
        if (!priceId) {
          console.error('[stripe/checkout] STRIPE_PLUS_PRICE_ID non configuré')
          return NextResponse.json({ error: 'Configuration Stripe incomplète.' }, { status: 500 })
        }

        let customerId = freshUser.stripeCustomerId as string | undefined
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: freshUser.email,
            name: (freshUser.nomSociete as string) || undefined,
            metadata: { userId: String(freshUser.id) },
          })
          customerId = customer.id
          await payload.update({
            collection: 'users',
            id: freshUser.id,
            data: { stripeCustomerId: customerId },
            overrideAccess: true,
            context: { webhookTrusted: true },
          })
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          automatic_tax: { enabled: true },
          billing_address_collection: 'required',
          customer_update: { address: 'auto', name: 'auto' },
          subscription_data: {
            description: 'Abonnement Réseauteur Plus — RÉSEAUTEURS',
            metadata: { type: 'reseauteur_plus', userId: String(freshUser.id) },
          },
          allow_promotion_codes: true,
          metadata: { type: 'reseauteur_plus', userId: String(freshUser.id) },
          success_url: `${SITE_URL}/dashboard/plus?checkout=success`,
          cancel_url: `${SITE_URL}/dashboard/plus?checkout=cancel`,
        })

        return NextResponse.json({ url: session.url })
      }

      // ──────────────────────────────────────────────────────────────────────
      // 4. PACK DE LICENCES PLUS — Checkout one-shot (ADR-0013, gate P0 D3)
      // ──────────────────────────────────────────────────────────────────────
      case 'licences_pack': {
        const { partenaireId, taille } = parsed.data

        const partenaire = await payload.findByID({
          collection: 'partenaires',
          id: partenaireId,
          depth: 0,
          overrideAccess: true,
        })
        if (!partenaire) {
          return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
        }

        // Autorisation : admin OU propriétaire de la fiche partenaire.
        const packOwnerId =
          typeof partenaire.user === 'object' && partenaire.user !== null
            ? (partenaire.user as { id: number | string }).id
            : (partenaire.user as number | string | null | undefined)
        if (freshUser.role !== 'admin' && Number(packOwnerId) !== Number(freshUser.id)) {
          return NextResponse.json(
            { error: 'Vous ne pouvez acheter des licences que pour votre propre fiche partenaire.' },
            { status: 403 },
          )
        }

        const packCfg = PACKS_LICENCES[taille]
        const priceId = packCfg?.priceId
        if (!priceId) {
          console.error(`[stripe/checkout] STRIPE_PACK_${taille}_PRICE_ID non configuré`)
          return NextResponse.json({ error: 'Configuration Stripe incomplète pour ce pack.' }, { status: 500 })
        }

        let customerId = (partenaire as unknown as Record<string, unknown>).stripeCustomerId as string | undefined
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: freshUser.email,
            name: (partenaire.nom as string) || undefined,
            metadata: { partenaireId: String(partenaireId), userId: String(freshUser.id) },
          })
          customerId = customer.id
          await payload.update({
            collection: 'partenaires',
            id: partenaireId,
            data: { stripeCustomerId: customerId },
            overrideAccess: true,
          })
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'payment',
          line_items: [{ price: priceId, quantity: 1 }],
          automatic_tax: { enabled: true },
          billing_address_collection: 'required',
          customer_update: { address: 'auto', name: 'auto' },
          metadata: {
            type: 'licences_pack',
            partenaireId: String(partenaireId),
            taille,
            quota: String(packCfg.quota),
          },
          success_url: `${SITE_URL}/dashboard/partenaire?pack=success`,
          cancel_url: `${SITE_URL}/dashboard/partenaire?pack=cancel`,
        })

        return NextResponse.json({ url: session.url })
      }
    }
  } catch (err) {
    console.error('[stripe/checkout] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la session de paiement' },
      { status: 500 },
    )
  }
}
