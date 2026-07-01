import type { Payload, Where } from 'payload'
import { recalculerEtAppliquerPalier } from './groupes'
import { sendEmail } from './email-sender'
import { groupeAutoLeftDowngradeEmail, groupeOwnershipTransferredEmail } from './emails'
import { hashUserId } from './audit'

/**
 * Champs Premium+ (inclut Infinite) sur la fiche fournisseur. Vides au passage
 * a gratuit — sans ca, la fiche publique afficherait encore le contenu paye
 * apres la fin d'abonnement. Les hooks afterDelete/afterChange de la collection
 * Media purgent les blobs Vercel orphelins automatiquement.
 */
const PREMIUM_FOURNISSEUR_FIELDS_TO_CLEAR: Record<string, null | [] | ''> = {
  adresse: '',
  codePostal: '',
  siteWeb: '',
  boutiqueEnLigne: '',
  lienDevis: '',
  emailContact: '',
  telephone: '',
  description: '',
  descriptionRSE: '',
  videoYoutube: '',
  banniere: null,
  activitesSecondaires: [],
  labelsRSE: [],
  reseauxSociaux: [],
  illustrations: [],
  offresEmploi: [],
}

/**
 * Limite mots description Premium (aligne sur DESCRIPTION_WORD_LIMITS.premium
 * dans Fournisseurs.ts). Si la description Infinite > 100 mots, on la vide
 * plutot que de la tronquer — couper au milieu d'une phrase est pire que rien.
 */
const PREMIUM_DESCRIPTION_WORD_LIMIT = 100

/**
 * Limite illustrations Premium (aligne sur ILLUSTRATIONS_LIMITS.premium).
 */
const PREMIUM_ILLUSTRATIONS_LIMIT = 1

function countWords(text: string): number {
  const matches = text.match(/\p{L}+(?:[''\-]\p{L}+)*/gu)
  return matches ? matches.length : 0
}

/**
 * Downgrade un user selon le targetLevel.
 *
 *  - 'gratuit' (defaut) : plan → gratuit, stripeSubscriptionId et
 *    planExpiresAt reinitialises, TOUS les champs Premium+ de la fiche
 *    sont vides. Utilise par le webhook subscription.canceled/deleted et
 *    par le cron downgrade-expires.
 *
 *  - 'premium' : le user change de plan sans quitter le payant. On ne
 *    touche PAS a user.plan / stripeSubscriptionId / planExpiresAt (le
 *    webhook customer.subscription.updated le fait apres le subscriptions.update
 *    Stripe). On nettoie uniquement les contenus Infinite-only : videoYoutube,
 *    description si > 100 mots, illustrations au-dela de 1. On archive les
 *    evenements actifs du user — Premium ne donne pas le droit d'en creer.
 */
export async function downgradeUserAndClearFields(
  payload: Payload,
  userId: number | string,
  options: {
    targetLevel?: 'gratuit' | 'premium'
    /**
     * Skippe le `recalculerEtAppliquerPalier` interne au downgrade. Reserve
     * aux callers en batch (cron) qui dedup les groupeIds et font UN recalc
     * unique par groupe a la fin du batch — sinon N users d'un meme groupe
     * declenchent N transitions intermediaires d'emails palier.
     */
    skipGroupePalierRecalc?: boolean
  } = {},
): Promise<void> {
  const targetLevel = options.targetLevel ?? 'gratuit'
  if (targetLevel === 'gratuit') {
    await downgradeToGratuit(payload, userId, {
      skipGroupePalierRecalc: options.skipGroupePalierRecalc ?? false,
    })
    return
  }
  await downgradeToPremium(payload, userId)
}

async function downgradeToGratuit(
  payload: Payload,
  userId: number | string,
  opts: { skipGroupePalierRecalc: boolean } = { skipGroupePalierRecalc: false },
): Promise<void> {
  // Capture le groupe AVANT detach pour recalculer le palier apres et notifier
  // l'utilisateur. La regle metier "Infinite-only pour rejoindre" implique
  // qu'un user gratuit ne doit pas rester dans un groupe : il ne contribue
  // plus au palier et l'UI dashboard groupe afficherait un etat orphelin.
  let attachedGroupeId: number | string | null = null
  let groupeNom: string | null = null
  let userEmail: string | null = null
  let userNomSociete: string | null = null
  try {
    const u = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 1,
    })
    userEmail = u.email ?? null
    userNomSociete = u.nomSociete ?? null
    const groupeRel = u.groupe
    if (groupeRel) {
      if (typeof groupeRel === 'object' && groupeRel !== null) {
        attachedGroupeId = (groupeRel as { id: number | string }).id
        groupeNom = (groupeRel as { nom?: string }).nom ?? null
      } else {
        attachedGroupeId = groupeRel as number | string
      }
    }
  } catch (err) {
    console.error(`[plan-downgrade] Failed to read user ${userId} pre-downgrade:`, err)
  }

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      plan: 'gratuit',
      stripeSubscriptionId: null,
      planExpiresAt: null,
      // Detach du groupe : un compte gratuit ne peut pas rester membre.
      ...(attachedGroupeId ? { groupe: null } : {}),
    },
    overrideAccess: true,
    context: { webhookTrusted: true },
  })

  // Recalcul du palier apres detach + notification du user. Best-effort, non
  // bloquant : la mutation user est deja faite, ces side-effects sont du
  // confort. recalculerEtAppliquerPalier est idempotent.
  if (attachedGroupeId) {
    // Si le user etait owner du groupe, on doit gerer l'ownership : soit
    // soft-delete (groupe vide), soit transfert au plus ancien membre. Sans
    // ca, le groupe reste avec un owner qui n'en est plus membre — la regle
    // metier (owner ⊂ membres) est rompue.
    try {
      const groupeBefore = await payload.findByID({
        collection: 'groupes',
        id: attachedGroupeId,
        overrideAccess: true,
      })
      const ownerRel = groupeBefore.owner
      const ownerId =
        typeof ownerRel === 'object' && ownerRel !== null
          ? (ownerRel as { id: number | string }).id
          : (ownerRel as number | string | null | undefined)
      const wasOwner = ownerId != null && String(ownerId) === String(userId)

      if (wasOwner && !groupeBefore.deletedAt) {
        const { docs: remainingMembers } = await payload.find({
          collection: 'users',
          where: { groupe: { equals: attachedGroupeId } },
          sort: 'createdAt',
          limit: 1,
          overrideAccess: true,
        })

        if (remainingMembers.length === 0) {
          // Aucun membre restant → soft-delete pour preserver l'audit trail
          // sans laisser un code GRP-XXX joignable pour rejoindre un groupe
          // mort. Symetrique du cas leave/route.ts:107-133.
          const deletedAt = new Date().toISOString()
          await payload.update({
            collection: 'groupes',
            id: attachedGroupeId,
            data: { deletedAt },
            overrideAccess: true,
          })
          try {
            await payload.create({
              collection: 'audit-logs',
              data: {
                type: 'groupe_soft_deleted',
                userIdHash: hashUserId(userId),
                metadata: {
                  groupeId: String(attachedGroupeId),
                  groupeNom: groupeBefore.nom,
                  groupeCode: groupeBefore.code,
                  reason: 'owner_downgraded_no_members',
                },
              },
              overrideAccess: true,
            })
          } catch (err) {
            console.error(
              '[plan-downgrade] audit-log groupe_soft_deleted failed:',
              err,
            )
          }
        } else {
          // Transfert d'ownership au plus ancien membre restant (logique
          // alignee sur leave/route.ts:135-141).
          const newOwner = remainingMembers[0]
          await payload.update({
            collection: 'groupes',
            id: attachedGroupeId,
            data: { owner: newOwner.id },
            overrideAccess: true,
          })
          try {
            await payload.create({
              collection: 'audit-logs',
              data: {
                type: 'groupe_ownership_transferred',
                userIdHash: hashUserId(userId),
                metadata: {
                  groupeId: String(attachedGroupeId),
                  newOwnerHash: hashUserId(newOwner.id),
                  reason: 'previous_owner_downgraded',
                },
              },
              overrideAccess: true,
            })
          } catch (err) {
            console.error(
              '[plan-downgrade] audit-log groupe_ownership_transferred failed:',
              err,
            )
          }
          try {
            const refreshed = await payload.findByID({
              collection: 'groupes',
              id: attachedGroupeId,
              overrideAccess: true,
            })
            await sendEmail({
              payload,
              kind: 'group-left-owner',
              to: newOwner.email,
              subject: `Panorama Pub — Vous etes desormais proprietaire de ${refreshed.nom}`,
              html: groupeOwnershipTransferredEmail(
                newOwner.nomSociete ?? '',
                userNomSociete ?? '',
                refreshed.nom,
                refreshed.code,
                String(refreshed.palierActuel ?? '0'),
              ),
              userId: newOwner.id,
            })
          } catch (err) {
            console.error('[plan-downgrade] ownership transfer email failed:', err)
          }
        }
      }
    } catch (err) {
      console.error(
        `[plan-downgrade] ownership handling failed for groupe ${attachedGroupeId}:`,
        err,
      )
    }

    if (!opts.skipGroupePalierRecalc) {
      try {
        await recalculerEtAppliquerPalier(payload, attachedGroupeId)
      } catch (err) {
        console.error(
          `[plan-downgrade] recalc palier failed for groupe ${attachedGroupeId}:`,
          err,
        )
      }
    }
    if (userEmail && userNomSociete && groupeNom) {
      try {
        await sendEmail({
          payload,
          kind: 'groupe-auto-left-downgrade',
          to: userEmail,
          subject: `Panorama Pub — Vous avez quitte le groupe ${groupeNom}`,
          html: groupeAutoLeftDowngradeEmail(userNomSociete, groupeNom),
          userId,
        })
      } catch (err) {
        console.error(`[plan-downgrade] auto-left email failed for user ${userId}:`, err)
      }
    }
  }

  try {
    const { docs } = await payload.find({
      collection: 'fournisseurs',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const fiche = docs[0]
    if (fiche) {
      await payload.update({
        collection: 'fournisseurs',
        id: fiche.id,
        data: PREMIUM_FOURNISSEUR_FIELDS_TO_CLEAR as Record<string, unknown>,
        overrideAccess: true,
      })
    }
  } catch (err) {
    console.error(`[plan-downgrade] Failed to clear premium fields for user ${userId}:`, err)
  }
}

async function downgradeToPremium(payload: Payload, userId: number | string): Promise<void> {
  // Fiche : nettoyer videoYoutube, description si > limite Premium, illustrations > 1.
  // On garde banniere, logo, labelsRSE, reseauxSociaux, descriptionRSE, adresse...
  // ces champs sont deja accessibles en Premium.
  let ficheId: number | string | null = null
  try {
    const { docs } = await payload.find({
      collection: 'fournisseurs',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const fiche = docs[0]
    if (fiche) {
      ficheId = fiche.id
      const updates: Record<string, unknown> = { videoYoutube: '', offresEmploi: [] }

      if (typeof fiche.description === 'string' && fiche.description.length > 0) {
        if (countWords(fiche.description) > PREMIUM_DESCRIPTION_WORD_LIMIT) {
          updates.description = ''
        }
      }

      if (Array.isArray(fiche.illustrations) && fiche.illustrations.length > PREMIUM_ILLUSTRATIONS_LIMIT) {
        updates.illustrations = fiche.illustrations.slice(0, PREMIUM_ILLUSTRATIONS_LIMIT)
      }

      await payload.update({
        collection: 'fournisseurs',
        id: fiche.id,
        data: updates,
        overrideAccess: true,
      })
    }
  } catch (err) {
    console.error(`[plan-downgrade] Failed to clear infinite-only fields for user ${userId}:`, err)
  }

  // Archiver les evenements actifs du user. Premium ne donne pas le droit de
  // creer des evenements ; les laisser publies enfreindrait le gating.
  try {
    let orgId: number | string | null = null
    try {
      const { docs: orgDocs } = await payload.find({
        collection: 'organisateurs-evenements',
        where: { user: { equals: userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      orgId = orgDocs[0]?.id ?? null
    } catch {
      // Pas de fiche organisateur pour ce user — normal pour un fournisseur.
    }

    const orConditions: Where[] = []
    if (ficheId) orConditions.push({ fournisseur: { equals: ficheId } })
    if (orgId) orConditions.push({ organisateurExterne: { equals: orgId } })

    if (orConditions.length > 0) {
      await payload.update({
        collection: 'evenements',
        where: {
          and: [
            { statut: { not_equals: 'archive' } },
            { or: orConditions },
          ],
        },
        data: { statut: 'archive' },
        overrideAccess: true,
      })
    }
  } catch (err) {
    console.error(`[plan-downgrade] Failed to archive events for user ${userId}:`, err)
  }
}
