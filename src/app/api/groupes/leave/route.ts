import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { recalculerEtAppliquerPalier } from '@/lib/groupes'
import { groupeLeftOwnerEmail, groupeOwnershipTransferredEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'
import { hashUserId } from '@/lib/audit'

export async function POST(request: Request) {
  // Rate limit: 10 req/min/IP
  const ip = getClientIp(request.headers)
  const { success: allowed } = rateLimit(`groupes-leave:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // Read fresh user from DB
  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  // Capture the groupeId BEFORE detaching
  const groupeRel = freshUser.groupe
  const groupeId =
    typeof groupeRel === 'object' && groupeRel !== null
      ? (groupeRel as { id: number | string }).id
      : (groupeRel as number | string | null | undefined)

  if (!groupeId) {
    return NextResponse.json({ error: 'Vous n\'appartenez a aucun groupe' }, { status: 400 })
  }

  try {
    // 1. Detach the user from the groupe
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { groupe: null },
      overrideAccess: true,
    })

    // 2. Strip any Stripe coupon currently attached to the user's subscription
    const subId = freshUser.stripeSubscriptionId as string | null | undefined
    if (subId) {
      try {
        // discounts: [] removes any active coupon (modern replacement for `coupon: ''`)
        await stripe.subscriptions.update(subId, { discounts: [] })
      } catch (err) {
        console.error(
          `[groupes/leave] Failed to remove coupon on subscription ${subId}:`,
          err,
        )
      }
    }

    // 3a. Audit-log RGPD : trace persistante du depart (palier avant le recalc).
    try {
      await payload.create({
        collection: 'audit-logs',
        data: {
          type: 'groupe_left',
          userIdHash: hashUserId(user.id),
          metadata: {
            groupeId: String(groupeId),
          },
        },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[groupes/leave] audit-log groupe_left failed:', err)
    }

    // 3. Determine ownership transfer / group deletion BEFORE recalculating
    const groupe = await payload.findByID({
      collection: 'groupes',
      id: groupeId,
      overrideAccess: true,
    })
    const ownerRel = groupe.owner
    const ownerId =
      typeof ownerRel === 'object' && ownerRel !== null
        ? (ownerRel as { id: number | string }).id
        : (ownerRel as number | string | null | undefined)
    const wasOwner = ownerId != null && Number(ownerId) === Number(user.id)

    // Track which user id to notify after the palier is recalculated.
    // - Regular member → notify the existing owner (group-left-owner).
    // - Owner quitted with transfer → notify new owner (group-ownership-transferred).
    // - Owner quitted with no remaining member → group deleted, no email.
    let notifyOwnerId: number | string | null = null
    let ownershipTransferred = false

    if (wasOwner) {
      const { docs: remainingMembers } = await payload.find({
        collection: 'users',
        where: {
          and: [
            { groupe: { equals: groupeId } },
            { id: { not_equals: user.id } },
          ],
        },
        sort: 'createdAt',
        limit: 1,
        overrideAccess: true,
      })

      if (remainingMembers.length === 0) {
        // Owner + dernier membre : on hard-delete le groupe. Un soft-delete
        // (deletedAt) laissait owner_id pointer sur le user qui s'en va, et la
        // FK ON DELETE SET NULL sur owner_id (NOT NULL en DB) bloquait ensuite
        // toute suppression de compte (Postgres 23502). L'audit log
        // 'groupe_soft_deleted' est conserve (valeur d'enum reutilisee) pour
        // tracer l'evenement.
        try {
          await payload.create({
            collection: 'audit-logs',
            data: {
              type: 'groupe_soft_deleted',
              userIdHash: hashUserId(user.id),
              metadata: {
                groupeId: String(groupeId),
                groupeNom: groupe.nom,
                groupeCode: groupe.code,
                reason: 'last_member_left',
                hardDeleted: true,
              },
            },
            overrideAccess: true,
          })
        } catch (err) {
          console.error('[groupes/leave] audit-log groupe_soft_deleted failed:', err)
        }
        await payload.delete({
          collection: 'groupes',
          id: groupeId,
          overrideAccess: true,
        })
        return NextResponse.json({ left: true, groupeDeleted: true })
      }

      // Transfer ownership to the oldest remaining member
      await payload.update({
        collection: 'groupes',
        id: groupeId,
        data: { owner: remainingMembers[0].id },
        overrideAccess: true,
      })
      notifyOwnerId = remainingMembers[0].id
      ownershipTransferred = true
      try {
        await payload.create({
          collection: 'audit-logs',
          data: {
            type: 'groupe_ownership_transferred',
            userIdHash: hashUserId(user.id),
            metadata: {
              groupeId: String(groupeId),
              newOwnerHash: hashUserId(remainingMembers[0].id),
              reason: 'previous_owner_left',
            },
          },
          overrideAccess: true,
        })
      } catch (err) {
        console.error('[groupes/leave] audit-log groupe_ownership_transferred failed:', err)
      }
    } else if (ownerId != null) {
      notifyOwnerId = ownerId
    }

    // 4. Recalculate palier for remaining members (and sync coupons)
    await recalculerEtAppliquerPalier(payload, groupeId)

    // 5. Notify the (possibly new) owner
    if (notifyOwnerId != null) {
      try {
        const [owner, refreshed] = await Promise.all([
          payload.findByID({ collection: 'users', id: notifyOwnerId, overrideAccess: true }),
          payload.findByID({ collection: 'groupes', id: groupeId, overrideAccess: true }),
        ])
        if (ownershipTransferred) {
          await sendEmail({
            payload,
            kind: 'group-left-owner',
            to: owner.email,
            subject: `Panorama Pub — Vous etes desormais proprietaire de ${refreshed.nom}`,
            html: groupeOwnershipTransferredEmail(
              owner.nomSociete,
              freshUser.nomSociete,
              refreshed.nom,
              refreshed.code,
              String(refreshed.palierActuel ?? '0'),
            ),
            userId: owner.id,
          })
        } else {
          await sendEmail({
            payload,
            kind: 'group-left-owner',
            to: owner.email,
            subject: `Panorama Pub — ${freshUser.nomSociete} a quitte votre groupe`,
            html: groupeLeftOwnerEmail(
              owner.nomSociete,
              freshUser.nomSociete,
              String(refreshed.palierActuel ?? '0'),
            ),
            userId: owner.id,
          })
        }
      } catch (err) {
        console.error('[groupes/leave] Failed to notify owner:', err)
      }
    }

    return NextResponse.json({ left: true, groupeDeleted: false })
  } catch (err) {
    console.error('[groupes/leave] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur lors du depart du groupe' },
      { status: 500 },
    )
  }
}
