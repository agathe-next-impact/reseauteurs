import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from './access'
import { stripe } from '../lib/stripe'

/**
 * Generates a random affiliation code: GRP-XXXXXX (6 alphanumeric uppercase chars).
 */
function generateGroupCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `GRP-${suffix}`
}

export const Groupes: CollectionConfig = {
  slug: 'groupes',
  admin: {
    group: 'Abonnement',
    useAsTitle: 'nom',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Owner OR member (the current user's `groupe` field points to this doc),
      // et toujours filtrer les groupes soft-delete pour les non-admins.
      const userGroupeId =
        typeof user.groupe === 'object' && user.groupe !== null
          ? (user.groupe as { id: string | number }).id
          : (user.groupe as string | number | null | undefined)
      const orClauses: Where[] = [
        { owner: { equals: user.id } },
      ]
      if (userGroupeId) {
        orClauses.push({ id: { equals: userGroupeId } })
      }
      const andClauses: Where[] = [
        { or: orClauses },
        { deletedAt: { exists: false } },
      ]
      return { and: andClauses }
    },
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (operation === 'create' && data && !data.code) {
          // Generate a unique code (retry on collision)
          let code = generateGroupCode()
          let attempts = 0
          while (attempts < 5) {
            const existing = await req.payload.find({
              collection: 'groupes',
              where: { code: { equals: code } },
              limit: 1,
              overrideAccess: true,
            })
            if (existing.docs.length === 0) break
            code = generateGroupCode()
            attempts++
          }
          data.code = code
        }
        return data
      },
    ],
    beforeDelete: [
      // Interdit le hard-delete d'un groupe avec membres encore rattaches.
      // Sans ce garde-fou, supprimer un groupe via /admin laisserait des
      // users.groupe pointant sur un id mort + leurs coupons Stripe persistants
      // (jamais re-synchronises faute de groupe a recalculer). La voie propre
      // est le soft-delete (`deletedAt`) — soit via API leave quand le dernier
      // membre part, soit en mettant deletedAt manuellement et en detachant
      // les membres avant de supprimer.
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.count({
          collection: 'users',
          where: { groupe: { equals: id } },
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer ce groupe : ${totalDocs} membre(s) y sont encore rattaches. Detachez-les d'abord (ou utilisez le soft-delete via deletedAt).`,
          )
        }
      },
    ],
    afterChange: [
      // Filet pour les editions /admin sur la collection Groupes :
      //   - Soft-delete via deletedAt manuel : detache tous les membres et
      //     purge leurs coupons Stripe (sinon ils gardent une remise sur un
      //     groupe mort jusqu'au prochain trigger metier).
      //   - Edition manuelle de palierActuel ou stripeCouponId : recalc force
      //     la coherence avec le compteur d'Infinite reel (le palier est une
      //     valeur derivee, pas une source de verite).
      // Skippe les writes initiees par recalculerEtAppliquerPalier elle-meme
      // (context.skipPalierRecalcHook), sinon boucle infinie.
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update') return
        const ctx = req.context as Record<string, unknown> | undefined
        if (ctx?.skipPalierRecalcHook === true) return

        const wasDeleted = Boolean(previousDoc?.deletedAt)
        const isDeleted = Boolean(doc.deletedAt)
        const justSoftDeleted = !wasDeleted && isDeleted

        if (justSoftDeleted) {
          // Purge tous les membres : strip coupon Stripe puis detache. On passe
          // webhookTrusted aux user.update pour eviter que Users.afterChange ne
          // declenche un recalc sur un groupe mort (gaspille des appels Stripe
          // et envoie des emails de transition de palier intermediaires).
          try {
            const { docs: members } = await req.payload.find({
              collection: 'users',
              where: { groupe: { equals: doc.id } },
              limit: 0,
              overrideAccess: true,
            })
            for (const member of members) {
              const subId = member.stripeSubscriptionId as string | null | undefined
              if (subId) {
                try {
                  await stripe.subscriptions.update(subId, { discounts: [] })
                } catch (err) {
                  // Strip best-effort : sub canceled / disparue cote Stripe ne
                  // bloque pas le detach (le member n'a plus de remise active
                  // de toute facon dans ces cas).
                  console.error(
                    `[Groupes afterChange] strip coupon failed for member ${member.id} sub ${subId}:`,
                    err,
                  )
                }
              }
              try {
                await req.payload.update({
                  collection: 'users',
                  id: member.id,
                  data: { groupe: null },
                  overrideAccess: true,
                  context: { webhookTrusted: true },
                })
              } catch (err) {
                console.error(
                  `[Groupes afterChange] detach member ${member.id} failed:`,
                  err,
                )
              }
            }
          } catch (err) {
            console.error(
              `[Groupes afterChange] soft-delete cleanup failed for groupe ${doc.id}:`,
              err,
            )
          }
          return
        }

        // Hors soft-delete : si l'admin a edite palier ou coupon, on
        // re-synchronise sur la realite metier (count des Infinite). Le recalc
        // ecrira a nouveau via skipPalierRecalcHook, evitant la boucle.
        const palierChanged = previousDoc?.palierActuel !== doc.palierActuel
        const couponChanged = previousDoc?.stripeCouponId !== doc.stripeCouponId
        if (palierChanged || couponChanged) {
          try {
            const { recalculerEtAppliquerPalier } = await import('../lib/groupes')
            await recalculerEtAppliquerPalier(req.payload, doc.id)
          } catch (err) {
            console.error(
              `[Groupes afterChange] recalc palier failed for groupe ${doc.id}:`,
              err,
            )
          }
        }
      },
    ],
  },
  fields: [
    {
      name: 'nom',
      type: 'text',
      required: true,
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Code d\'affiliation pour rejoindre le groupe (auto-genere)',
        readOnly: true,
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'palierActuel',
      type: 'select',
      options: [
        { label: '0%', value: '0' },
        { label: '5%', value: '5' },
        { label: '10%', value: '10' },
        { label: '15%', value: '15' },
      ],
      defaultValue: '0',
      required: true,
      access: {
        update: isAdmin,
      },
      admin: {
        description: 'Palier de reduction actif (calcule automatiquement)',
      },
    },
    {
      name: 'stripeCouponId',
      type: 'text',
      access: {
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'ID du coupon Stripe applique au groupe',
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      index: true,
      access: {
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Soft-delete : un groupe deletedAt != null n\'est plus joignable par code et n\'apparait plus pour ses membres. Conservation pour audit.',
      },
    },
  ],
}
