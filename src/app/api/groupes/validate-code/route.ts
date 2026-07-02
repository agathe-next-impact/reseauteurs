import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { palierProjeteAvecUtilisateurPayant } from '@/lib/groupes'
import { stripe } from '@/lib/stripe'

const bodySchema = z.object({
  code: z.string().min(1).max(64),
})

/**
 * POST /api/groupes/validate-code { code: string }
 *
 * Endpoint utilitaire pour valider un code AVANT que l'user ne lance un
 * checkout vers Infinite. Deux types reconnus :
 *
 *   1. Code d'affiliation de groupe (GRP-XXXXXX) — palier projete renvoye
 *      pour permettre au front d'afficher le tarif final reduit.
 *   2. Code promotionnel Stripe (ex. INFINITE25) — checks reproduits cote
 *      serveur : actif, non expire, applicable au product Infinite,
 *      max_redemptions non epuise.
 *
 * On essaie d'abord la table `groupes` (codes internes, validation rapide
 * en DB) ; si pas de match, fallback Stripe. Renvoie une union discriminee
 * via `type: 'groupe' | 'stripe'`.
 *
 * Refuse si :
 *   - user non authentifie (401)
 *   - user organisateur saisissant un code GRP-XXXXXX (403) : la mutualisation
 *     groupe est reservee aux fournisseurs (les codes Stripe restent OK)
 *   - user deja dans un groupe saisissant un code GRP-XXXXXX (400) : il faut
 *     d'abord quitter ; ne bloque PAS un code Stripe (il serait de toute
 *     facon ignore au checkout, voir guard cote /api/stripe/checkout)
 *   - code introuvable cote groupes ET cote Stripe (404)
 */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const { success: allowed } = rateLimit(`groupes-validate:${ip}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  const codeNormalized = parsed.data.code.trim().toUpperCase()

  // 1. Tentative groupe : on essaye toujours en premier, les codes GRP-XXXXXX
  // ne collident pas avec les codes promo Stripe (preffixe + nommage controles
  // cote serveur a la creation).
  const { docs } = await payload.find({
    collection: 'groupes',
    where: {
      and: [
        { code: { equals: codeNormalized } },
        { deletedAt: { exists: false } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const groupe = docs[0]

  if (groupe) {
    // Garde-fous specifiques aux codes de groupe : un organisateur ou un user
    // deja en groupe ne doit pas pouvoir activer la mutualisation, meme via
    // ce flow. Pour les codes Stripe, ces contraintes ne s'appliquent pas.
    if (freshUser.role === 'organisateur') {
      return NextResponse.json(
        { error: 'Les comptes organisateurs ne peuvent pas rejoindre un groupe' },
        { status: 403 },
      )
    }
    if (freshUser.groupe) {
      return NextResponse.json(
        { error: 'Vous appartenez deja a un groupe' },
        { status: 400 },
      )
    }

    // Palier projete : palier qu'aurait le groupe si l'user devenait Infinite
    // membre. Sert au front pour afficher le tarif reduit avant souscription.
    const projected = await palierProjeteAvecUtilisateurPayant(
      payload,
      groupe.id,
      user.id,
    )

    return NextResponse.json({
      valid: true,
      type: 'groupe' as const,
      nom: groupe.nom,
      code: groupe.code,
      palierActuel: groupe.palierActuel ?? '0',
      palierProjete: projected.palier,
      reductionPct: Number(projected.palier),
    })
  }

  // 2. Fallback Stripe : tentative de resolution comme code promo. Si l'user
  // est deja membre d'un groupe, le coupon de groupe s'appliquera au checkout
  // et masquera/ecrasera un code Stripe — on renvoie tout de meme 404 ici
  // pour rester coherent (le champ n'est de toute facon pas affiche dans la
  // modale pour les users en groupe).
  if (freshUser.groupe) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 404 })
  }

  try {
    const { data: promoCodes } = await stripe.promotionCodes.list({
      code: codeNormalized,
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon.applies_to'],
    })
    const promo = promoCodes[0]
    if (!promo) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 404 })
    }

    // Checks reproduits cote serveur (Stripe revalide tout au checkout, mais
    // mieux vaut echouer ici pour eviter un toast vert puis erreur Stripe).
    const now = Math.floor(Date.now() / 1000)
    if (promo.expires_at && promo.expires_at < now) {
      return NextResponse.json({ error: 'Code promotionnel expire' }, { status: 404 })
    }
    if (
      typeof promo.max_redemptions === 'number' &&
      promo.times_redeemed >= promo.max_redemptions
    ) {
      return NextResponse.json(
        { error: 'Ce code promotionnel a atteint son nombre maximum d\'utilisations' },
        { status: 404 },
      )
    }

    // `promotion.coupon` est expandu via le parametre expand ci-dessus, donc
    // c'est toujours un objet Coupon ici (pas un string id ni null).
    const coupon = promo.promotion.coupon
    if (!coupon || typeof coupon === 'string') {
      return NextResponse.json({ error: 'Code promotionnel invalide' }, { status: 404 })
    }
    if (!coupon.valid) {
      return NextResponse.json({ error: 'Code promotionnel invalide' }, { status: 404 })
    }
    // NB : l'ancien produit « Infinite » (modèle PanoramaPub) est caduc (ADR-0011),
    // on ne vérifie donc plus la restriction produit `applies_to` ici. Stripe
    // revalide de toute façon entièrement le coupon au moment du checkout.

    // Calcul de la reduction projetee pour afficher le tarif dans l'UI.
    let reductionPct = 0
    let reductionLabel = ''
    if (typeof coupon.percent_off === 'number' && coupon.percent_off > 0) {
      reductionPct = coupon.percent_off
      reductionLabel = `-${coupon.percent_off}%`
    } else if (typeof coupon.amount_off === 'number' && coupon.amount_off > 0) {
      reductionLabel = `-${(coupon.amount_off / 100).toFixed(2)} EUR`
    }

    return NextResponse.json({
      valid: true,
      type: 'stripe' as const,
      code: promo.code,
      promotionCodeId: promo.id,
      reductionPct,
      reductionLabel,
      couponName: coupon.name ?? null,
    })
  } catch (err) {
    console.error('[validate-code] Stripe lookup failed:', err)
    return NextResponse.json({ error: 'Code invalide' }, { status: 404 })
  }
}
