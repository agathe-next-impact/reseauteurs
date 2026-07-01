import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { stripe } from './stripe'
import { hashUserId } from './audit'
import { sendEmail } from './email-sender'
import {
  stripeMisconfigAlertEmail,
  groupePalierUpgradeOwnerEmail,
  groupePalierUpgradeMemberEmail,
  groupePalierDowngradeOwnerEmail,
  groupePalierDowngradeMemberEmail,
} from './emails'
import { CONTACT_EMAIL } from './site'
import type { User } from '../payload-types'

export type Palier = '0' | '5' | '10' | '15'

type SyncFailureReason =
  | 'sub_not_updatable'
  | 'coupon_invalid'
  | 'resource_missing'
  | 'api_error'
  | 'unknown'

function classifyStripeError(err: unknown): {
  reason: SyncFailureReason
  code?: string
  message: string
} {
  if (err && typeof err === 'object') {
    const e = err as Stripe.errors.StripeError & { code?: string; param?: string }
    const code = typeof e.code === 'string' ? e.code : undefined
    const message = typeof e.message === 'string' ? e.message : String(err)
    if (code === 'resource_missing') {
      // param === 'coupon' → le coupon configure dans l'env n'existe pas dans
      // l'account Stripe cible (frequemment : env vars test vs live decalees).
      // Autre param → la subscription a disparu.
      return { reason: e.param === 'coupon' ? 'coupon_invalid' : 'resource_missing', code, message }
    }
    if (code === 'subscription_canceled' || /canceled subscription/i.test(message)) {
      return { reason: 'sub_not_updatable', code, message }
    }
    return { reason: 'api_error', code, message }
  }
  return { reason: 'unknown', message: String(err) }
}

// Etats Stripe pour lesquels un `subscriptions.update` est refuse d'office.
// On ne retente pas sur ces subs — le membre n'est plus payant de facto.
const NON_UPDATABLE_SUB_STATUSES = new Set<Stripe.Subscription.Status>([
  'canceled',
  'incomplete_expired',
])

async function alertAdminStripeMisconfig(
  payload: Payload,
  groupeId: string | number,
  details: { couponId: string; stripeCode?: string; stripeMessage: string },
): Promise<void> {
  // L'email stripeMisconfigAlertEmail attend un contexte "utilisateur" ; on
  // reutilise la meme shape en detournant les champs (userId = groupe, priceId
  // = couponId) pour eviter d'ajouter un 2e template pour le meme cas.
  try {
    await sendEmail({
      payload,
      kind: 'admin-alert',
      to: CONTACT_EMAIL,
      subject: 'Panorama Pub — Coupon groupe Stripe invalide',
      html: stripeMisconfigAlertEmail({
        userId: `groupe:${groupeId}`,
        stripeCustomerId: '—',
        subscriptionId: details.stripeCode ?? '—',
        priceId: `${details.couponId} (${details.stripeMessage})`,
      }),
      skipBlacklistCheck: true,
    })
  } catch (err) {
    console.error('[groupes] alertAdminStripeMisconfig failed:', err)
  }
}

/**
 * Resolve the env coupon ID for a given palier.
 * Returns null for palier '0' (no coupon).
 */
export function couponIdForPalier(palier: Palier): string | null {
  switch (palier) {
    case '5':
      return process.env.STRIPE_COUPON_5_ID || null
    case '10':
      return process.env.STRIPE_COUPON_10_ID || null
    case '15':
      return process.env.STRIPE_COUPON_15_ID || null
    case '0':
    default:
      return null
  }
}

/**
 * Counts the Infinite members of a groupe and determines the discount tier
 * that applies. Premium and Gratuit members are intentionally excluded :
 * seul l'engagement Infinite (219 EUR/an) declenche le palier mutualise.
 *
 * Tiers:
 *   < 3   infinite members → palier '0'  (no discount)
 *   3-4   infinite members → palier '5'  (5%)
 *   5-9   infinite members → palier '10' (10%)
 *   ≥ 10  infinite members → palier '15' (15%)
 */
export async function calculerPalierGroupe(
  payload: Payload,
  groupeId: string | number,
): Promise<{ palier: Palier; membresPayants: number }> {
  const { totalDocs: membresPayants } = await payload.count({
    collection: 'users',
    where: {
      and: [
        { groupe: { equals: groupeId } },
        { plan: { equals: 'infinite' } },
      ],
    },
    overrideAccess: true,
  })

  return { palier: palierFromCount(membresPayants), membresPayants }
}

function palierFromCount(membresPayants: number): Palier {
  if (membresPayants >= 10) return '15'
  if (membresPayants >= 5) return '10'
  if (membresPayants >= 3) return '5'
  return '0'
}

/**
 * Projects the palier a groupe would reach if the given user were an Infinite
 * member. Used at checkout time to apply the right coupon on the first billing
 * cycle, before the webhook bumps the palier. Only callers passing an Infinite
 * checkout should use this — Premium checkouts must NOT bump the palier.
 *
 * Returns the existing palier if the user is already counted as Infinite.
 */
export async function palierProjeteAvecUtilisateurPayant(
  payload: Payload,
  groupeId: string | number,
  userId: string | number,
): Promise<{ palier: Palier; couponId: string | null }> {
  const { membresPayants } = await calculerPalierGroupe(payload, groupeId)

  // Check if the user is already counted (already in groupe + already infinite).
  const { totalDocs: alreadyCounted } = await payload.count({
    collection: 'users',
    where: {
      and: [
        { id: { equals: userId } },
        { groupe: { equals: groupeId } },
        { plan: { equals: 'infinite' } },
      ],
    },
    overrideAccess: true,
  })

  const projected = alreadyCounted > 0 ? membresPayants : membresPayants + 1
  const palier = palierFromCount(projected)
  return { palier, couponId: couponIdForPalier(palier) }
}

/**
 * Notifie l'owner et chaque autre membre payant qu'une transition de palier
 * vient d'avoir lieu. Appele apres la persistance du nouveau palier en DB :
 * si Resend echoue, le garde-fou idempotence (`palierActuel === nouveauPalier`)
 * empechera tout doublon au prochain trigger.
 */
async function sendPalierTransitionEmails(
  payload: Payload,
  args: {
    groupeNom: string
    ownerId: number | string
    payingMembers: User[]
    ancienPalier: Palier
    nouveauPalier: Palier
  },
): Promise<void> {
  const { groupeNom, ownerId, payingMembers, ancienPalier, nouveauPalier } = args
  const direction: 'upgrade' | 'downgrade' =
    parseInt(nouveauPalier, 10) > parseInt(ancienPalier, 10) ? 'upgrade' : 'downgrade'

  const ownerIdStr = String(ownerId)
  const owner = payingMembers.find((m) => String(m.id) === ownerIdStr)
  const otherMembers = payingMembers.filter((m) => String(m.id) !== ownerIdStr)

  if (owner) {
    const html =
      direction === 'upgrade'
        ? groupePalierUpgradeOwnerEmail(
            owner.nomSociete,
            groupeNom,
            ancienPalier,
            nouveauPalier,
            payingMembers.length,
          )
        : groupePalierDowngradeOwnerEmail(
            owner.nomSociete,
            groupeNom,
            ancienPalier,
            nouveauPalier,
            payingMembers.length,
          )
    const subject =
      direction === 'upgrade'
        ? `Panorama Pub — Votre groupe atteint un nouveau palier de reduction`
        : `Panorama Pub — Le palier de votre groupe a evolue`
    try {
      await sendEmail({
        payload,
        kind: direction === 'upgrade' ? 'groupe-palier-upgrade-owner' : 'groupe-palier-downgrade-owner',
        to: owner.email,
        subject,
        html,
        userId: owner.id,
      })
    } catch (err) {
      console.error(`[groupes] palier ${direction} email to owner ${owner.id} failed:`, err)
    }
  }

  for (const member of otherMembers) {
    const html =
      direction === 'upgrade'
        ? groupePalierUpgradeMemberEmail(member.nomSociete, groupeNom, ancienPalier, nouveauPalier)
        : groupePalierDowngradeMemberEmail(member.nomSociete, groupeNom, ancienPalier, nouveauPalier)
    const subject =
      direction === 'upgrade'
        ? `Panorama Pub — Nouvelle reduction sur votre abonnement`
        : `Panorama Pub — La reduction de votre groupe a evolue`
    try {
      await sendEmail({
        payload,
        kind: direction === 'upgrade' ? 'groupe-palier-upgrade-member' : 'groupe-palier-downgrade-member',
        to: member.email,
        subject,
        html,
        userId: member.id,
      })
    } catch (err) {
      console.error(`[groupes] palier ${direction} email to member ${member.id} failed:`, err)
    }
  }
}

/**
 * Recalculates the palier for a groupe and synchronises Stripe coupons
 * across every paying member's active subscription.
 *
 * Atomicite best-effort :
 *   1. Calcul du palier cible (calculerPalierGroupe)
 *   2. Si inchange → no-op
 *   3. Application du coupon Stripe a TOUS les membres payants
 *   4. Si succes complet → update DB (palier + stripeCouponId)
 *   5. Si echec partiel → audit-log groupe_sync_failed, DB inchangee
 *      (le prochain trigger retentera puisque palier DB != palier cible).
 *
 * L'ordre Stripe-avant-DB garantit que la DB ne ment jamais sur un palier
 * non-applique cote Stripe. Les operations Stripe sont idempotentes : si
 * un membre a deja le bon coupon, re-l'appliquer est un no-op sans cout.
 */
export async function recalculerEtAppliquerPalier(
  payload: Payload,
  groupeId: string | number,
): Promise<void> {
  const groupe = await payload.findByID({
    collection: 'groupes',
    id: groupeId,
    overrideAccess: true,
  })

  const { palier: nouveauPalier } = await calculerPalierGroupe(payload, groupeId)
  const ancienPalier = (groupe.palierActuel as Palier) || '0'

  if (nouveauPalier === ancienPalier) return

  const nouveauCouponId = couponIdForPalier(nouveauPalier)

  // 0. Pre-valider le coupon une seule fois. Si l'env var pointe sur un coupon
  // inexistant (ex. test vs live), on evite N x 400 en boucle ET on alerte.
  if (nouveauCouponId) {
    try {
      await stripe.coupons.retrieve(nouveauCouponId)
    } catch (err) {
      const classified = classifyStripeError(err)
      console.error(
        `[groupes] coupon ${nouveauCouponId} not retrievable (palier ${nouveauPalier}):`,
        classified.code,
        classified.message,
      )
      await alertAdminStripeMisconfig(payload, groupeId, {
        couponId: nouveauCouponId,
        stripeCode: classified.code,
        stripeMessage: classified.message,
      })
      try {
        await payload.create({
          collection: 'audit-logs',
          data: {
            type: 'groupe_sync_failed',
            userIdHash: hashUserId(groupeId),
            metadata: {
              groupeId: String(groupeId),
              targetPalier: nouveauPalier,
              ancienPalier,
              reason: 'coupon_invalid',
              couponId: nouveauCouponId,
              stripeCode: classified.code ?? null,
              stripeMessage: classified.message,
            },
          },
          overrideAccess: true,
        })
      } catch (auditErr) {
        console.error('[groupes] audit-log groupe_sync_failed (coupon_invalid) failed:', auditErr)
      }
      return
    }
  }

  // 1. Collecter les membres Infinite a synchroniser. Le coupon ne s'applique
  // qu'aux abonnements Infinite : Premium et Gratuit ne sont jamais sync.
  const { docs: payingMembers } = await payload.find({
    collection: 'users',
    where: {
      and: [
        { groupe: { equals: groupeId } },
        { plan: { equals: 'infinite' } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })

  // 1b. Collecter les membres non-Infinite (Premium/Gratuit) encore dans le
  // groupe avec une sub Stripe active. Cas d'usage : un membre Infinite qui
  // downgrade en Premium reste attache au groupe ; sans ce strip explicite,
  // sa sub Premium garde le coupon recu quand il etait Infinite (fait baisser
  // sa facture de 99 EUR au lieu d'etre payee plein pot, alors meme que le
  // palier groupe vient de tomber a 0). Ces membres ne sont jamais comptes
  // dans le palier — on les visite uniquement pour purger leurs coupons.
  const { docs: nonInfiniteMembersWithSub } = await payload.find({
    collection: 'users',
    where: {
      and: [
        { groupe: { equals: groupeId } },
        { plan: { not_equals: 'infinite' } },
        { stripeSubscriptionId: { exists: true } },
        { stripeSubscriptionId: { not_equals: '' } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })

  // 2. Appliquer les coupons Stripe. Stripe avant DB : si Stripe echoue pour
  // certains membres, on ne veut PAS ecrire un palier en DB qui ne refleterait
  // pas l'etat reel. Les appels Stripe sont idempotents → ok de re-tenter.
  //
  // Une "non-updatable sub" (canceled / incomplete_expired) n'est PAS un echec
  // reel : le membre n'est plus payant, il n'a pas besoin du coupon. On skip.
  // Idem pour `resource_missing` : la sub a disparu cote Stripe (cas frequent
  // en dev/seed avec des subs factices, ou en prod si Stripe a deja purge une
  // sub canceled depuis longtemps). Sans ce skip, un seul stripeSubscriptionId
  // stale parmi les membres Infinite bloquait l'ecriture du palier en DB et
  // empechait toute transition (le bump 2→3 restait coince sur palier 0).
  const failedMemberIds: (number | string)[] = []
  const failuresByReason: Record<string, number> = {}
  for (const member of payingMembers) {
    const subId = member.stripeSubscriptionId as string | null | undefined
    if (!subId) continue
    try {
      // Retrieve avant update : si la sub est canceled cote Stripe (mais le
      // plan DB n'a pas encore ete aligne par le webhook), on evite un 400
      // "canceled subscription" previsible et bruyant dans les logs.
      const sub = await stripe.subscriptions.retrieve(subId)
      if (NON_UPDATABLE_SUB_STATUSES.has(sub.status)) {
        console.info(
          `[groupes] skip non-updatable sub ${subId} (member ${member.id}, status ${sub.status})`,
        )
        continue
      }
      if (nouveauCouponId) {
        await stripe.subscriptions.update(subId, {
          discounts: [{ coupon: nouveauCouponId }],
        })
      } else {
        await stripe.subscriptions.update(subId, { discounts: [] })
      }
    } catch (err) {
      const classified = classifyStripeError(err)
      if (classified.reason === 'resource_missing') {
        console.info(
          `[groupes] skip missing sub ${subId} (member ${member.id}) — stale stripeSubscriptionId`,
        )
        continue
      }
      failuresByReason[classified.reason] = (failuresByReason[classified.reason] ?? 0) + 1
      failedMemberIds.push(member.id)
      console.error(
        `[groupes] Failed to sync coupon on subscription ${subId} (member ${member.id}) reason=${classified.reason} code=${classified.code ?? '—'}: ${classified.message}`,
      )
    }
  }

  // 2b. Purger le coupon residuel sur les subs Premium/Gratuit du groupe.
  // Uniquement un strip — jamais d'application d'un coupon de groupe sur un
  // membre non-Infinite (regle metier : le palier ne se calcule que sur les
  // Infinite, donc seuls les Infinite en beneficient).
  //
  // Les echecs ici NE BLOQUENT PAS l'ecriture DB du palier : le palier reflete
  // les Infinite, qui sont tous a jour si la boucle 2 a reussi. Un coupon
  // residuel sur un Premium est un effet de bord (sur-remise sur sa facture)
  // qui ne contredit pas le palier. Si on remontait ces echecs dans
  // failedMemberIds, un membre Premium avec un stripeSubscriptionId stale
  // (sub canceled side-Stripe mais champ DB non purge) bloquerait le palier
  // a 0 indefiniment — ce qui empechait la 3e adhesion de bumper a 5%.
  // resource_missing est attendu (sub disparue cote Stripe) → log info, pas
  // d'alerte. Les autres erreurs sont logguees en error mais non bloquantes.
  for (const member of nonInfiniteMembersWithSub) {
    const subId = member.stripeSubscriptionId as string | null | undefined
    if (!subId) continue
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      if (NON_UPDATABLE_SUB_STATUSES.has(sub.status)) {
        console.info(
          `[groupes] skip non-updatable sub ${subId} (non-infinite member ${member.id}, status ${sub.status})`,
        )
        continue
      }
      // Pas de discount actif → no-op cote Stripe, evite un appel inutile.
      const hasDiscount = Array.isArray(sub.discounts) && sub.discounts.length > 0
      if (!hasDiscount) continue
      await stripe.subscriptions.update(subId, { discounts: [] })
    } catch (err) {
      const classified = classifyStripeError(err)
      if (classified.reason === 'resource_missing') {
        // Sub disparue cote Stripe : le champ DB est stale, rien a purger.
        console.info(
          `[groupes] non-infinite member ${member.id} sub ${subId} missing on Stripe — skipped`,
        )
        continue
      }
      console.error(
        `[groupes] Failed to strip residual coupon on subscription ${subId} (non-infinite member ${member.id}) reason=${classified.reason} code=${classified.code ?? '—'}: ${classified.message} — non-blocking`,
      )
    }
  }

  // 3. Decision : update DB si et seulement si tous les membres ont ete sync.
  if (failedMemberIds.length === 0) {
    await payload.update({
      collection: 'groupes',
      id: groupeId,
      data: {
        palierActuel: nouveauPalier,
        stripeCouponId: nouveauCouponId ?? '',
      },
      overrideAccess: true,
      // Skippe le hook Groupes.afterChange : sans ca, l'ecriture du palier
      // ici relancerait l'afterChange qui rappellerait recalculerEtAppliquerPalier
      // → boucle. Le hook ne doit recalc que sur les editions hors-recalc.
      context: { skipPalierRecalcHook: true },
    })

    // 3b. Notifier owner + membres payants. Best-effort, non-bloquant : le palier
    // est deja applique cote DB et Stripe, l'email est purement informatif.
    try {
      const ownerId =
        typeof groupe.owner === 'object' && groupe.owner !== null
          ? (groupe.owner as { id: number | string }).id
          : (groupe.owner as number | string)
      await sendPalierTransitionEmails(payload, {
        groupeNom: groupe.nom,
        ownerId,
        payingMembers,
        ancienPalier,
        nouveauPalier,
      })
    } catch (err) {
      console.error('[groupes] sendPalierTransitionEmails failed (non-blocking):', err)
    }
    return
  }

  // 4. Echec partiel : audit-log pour remediation + permettre le retry.
  // Le prochain appel comparera a nouveau ancienPalier (inchange) a target
  // et retentera Stripe sur tous les membres — idempotent, pas de cout.
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'groupe_sync_failed',
        userIdHash: hashUserId(groupeId),
        metadata: {
          groupeId: String(groupeId),
          targetPalier: nouveauPalier,
          ancienPalier,
          failedMemberIds: failedMemberIds.map(String),
          failuresByReason,
        },
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[groupes] audit-log groupe_sync_failed creation failed:', err)
  }
}
