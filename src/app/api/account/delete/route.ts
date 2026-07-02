/**
 * POST /api/account/delete
 *
 * Suppression de compte RÉSEAUTEURS (RGPD — droit à l'effacement).
 * Recalibré ADR-0011 : gère reseauteur ET organisateur.
 *
 * Pour un réseauteur : supprime son profil reseauteur (et purge la géoloc).
 * Pour un organisateur : annule l'abonnement Stripe, désactive le statut partenaire,
 *   conserve le réseau et les événements en mode orphelin (décision V1).
 *
 * Audit log RGPD conservé dans audit-logs (hash pseudonymisé).
 * La suppression est définitive — un email de confirmation est envoyé après la delete.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { accountDeletedEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'
import { hashUserId } from '@/lib/audit'

export async function POST() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { success: allowed } = rateLimit(`account-delete:${user.id}`, {
    limit: 3,
    windowMs: 3600_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de tentatives, réessayez plus tard' }, { status: 429 })
  }

  if (user.role === 'admin') {
    return NextResponse.json(
      { error: 'Les comptes admin ne peuvent pas être supprimés via cette interface.' },
      { status: 403 },
    )
  }

  try {
    const freshUser = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
    })

    const role = freshUser.role as string
    const hadSubscription = !!(freshUser as unknown as Record<string, unknown>).stripeSubscriptionId

    // ── 1. Annulation Stripe (si abonnement actif sur le compte organisateur)
    if (hadSubscription) {
      const subId = (freshUser as unknown as Record<string, unknown>).stripeSubscriptionId as string
      try {
        await stripe.subscriptions.update(subId, {
          metadata: { account_deletion: 'true' },
        })
      } catch { /* non bloquant */ }
      try {
        await stripe.subscriptions.cancel(subId)
      } catch { /* déjà annulé */ }
    }

    // ── 2. Suppression / orphelinage selon le rôle
    if (role === 'reseauteur') {
      // Supprime le profil réseauteur lié (purge géoloc, photo via afterDelete hook)
      const { docs: reseauteurDocs } = await payload.find({
        collection: 'reseauteurs',
        where: { user: { equals: user.id } },
        limit: 1,
        overrideAccess: true,
      })
      for (const r of reseauteurDocs) {
        await payload.delete({
          collection: 'reseauteurs',
          id: r.id,
          overrideAccess: true,
        })
      }
    } else if (role === 'organisateur') {
      // Orphelinage du réseau (retrait du user propriétaire + désactivation partenariat)
      // Décision V1 : on conserve le réseau et ses événements en mode importé
      // (données publiques utiles) — l'admin peut les supprimer si besoin.
      const { docs: reseauxDocs } = await payload.find({
        collection: 'reseaux',
        where: { user: { equals: user.id } },
        limit: 0,
        overrideAccess: true,
      })
      for (const reseau of reseauxDocs) {
        await payload.update({
          collection: 'reseaux',
          id: reseau.id,
          data: {
            user: null,
            partenaire: false,
            source: 'importe',
          } as Record<string, unknown>,
          overrideAccess: true,
          context: { webhookTrusted: true },
        })
      }
    }

    // ── 3. Audit log RGPD (pseudonymisé)
    try {
      await payload.create({
        collection: 'audit-logs',
        data: {
          type: 'account_deleted',
          userIdHash: hashUserId(user.id),
          metadata: {
            role,
            hadSubscription,
          },
        },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[account/delete] audit log failed (non-blocking):', err)
    }

    // ── 4. Suppression du user (les hooks Payload nettoient les media)
    const confirmationTo = freshUser.email
    const confirmationName = (freshUser as unknown as Record<string, unknown>).nomSociete as string ?? ''

    await payload.delete({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
    })

    // ── 5. Email de confirmation (après la delete pour cohérence)
    try {
      await sendEmail({
        payload,
        kind: 'account-deleted',
        to: confirmationTo,
        subject: 'RÉSEAUTEURS — Confirmation de suppression de votre compte',
        html: accountDeletedEmail(confirmationName, { hadSubscription }),
        skipBlacklistCheck: true,
      })
    } catch (err) {
      console.error('[account/delete] Post-delete email failed (non-blocking):', err)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account/delete] Erreur:', err instanceof Error ? err.stack : err)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte' },
      { status: 500 },
    )
  }
}
