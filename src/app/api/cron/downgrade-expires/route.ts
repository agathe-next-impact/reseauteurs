/**
 * GET /api/cron/downgrade-expires
 *
 * Cron quotidien (02:00 UTC) — Recalibré sur les 3 produits B2B (ADR-0011).
 *
 * Traite deux collections :
 *   1. reseaux   : partenaire=true et partenaireExpireAt < now → partenaire=false
 *   2. partenaires : statut=actif et abonnementExpireAt < now → statut=expire
 *
 * L'ancien downgrade users (plan=gratuit) est caduc — pas de palier réseauteur.
 * Les groupes restent dormants (ADR-0009).
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendEmail } from '@/lib/email-sender'
import { planDowngradedEmail } from '@/lib/emails'

const PAGE_SIZE = 500

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const now = new Date().toISOString()

  let reseauxDowngraded = 0
  let partenairesDowngraded = 0

  // ────────────────────────────────────────────────────────────────────────
  // 1. Réseaux partenaires expirés
  // ────────────────────────────────────────────────────────────────────────
  while (true) {
    const { docs: expiredReseaux } = await payload.find({
      collection: 'reseaux',
      where: {
        and: [
          { partenaire: { equals: true } },
          { partenaireExpireAt: { less_than: now } },
        ],
      },
      limit: PAGE_SIZE,
      page: 1,
      depth: 1, // pour accéder au user de l'organisateur
      overrideAccess: true,
    })

    if (expiredReseaux.length === 0) break

    for (const reseau of expiredReseaux) {
      try {
        await payload.update({
          collection: 'reseaux',
          id: reseau.id,
          data: { partenaire: false },
          overrideAccess: true,
          context: { webhookTrusted: true },
        })
        reseauxDowngraded++

        // Notifie l'organisateur si son user est lié
        const userRel = (reseau as Record<string, unknown>).user
        const userId =
          typeof userRel === 'object' && userRel !== null
            ? (userRel as { id: number | string }).id
            : (userRel as number | string | null | undefined)

        if (userId) {
          try {
            const owner = await payload.findByID({
              collection: 'users',
              id: userId as number | string,
              overrideAccess: true,
            })
            await sendEmail({
              payload,
              kind: 'plan-downgraded',
              to: owner.email,
              subject: 'RÉSEAUTEURS — Votre abonnement réseau partenaire a expiré',
              html: planDowngradedEmail(
                owner.nomSociete ?? (reseau as Record<string, unknown>).nom as string ?? '',
                'Réseau partenaire',
              ),
              userId: owner.id,
            })
          } catch (err) {
            console.error(`[cron/downgrade-expires] Email notification failed for reseau ${reseau.id}:`, err)
          }
        }
      } catch (err) {
        console.error(`[cron/downgrade-expires] Failed for reseau ${reseau.id}:`, err)
      }
    }

    if (expiredReseaux.length < PAGE_SIZE) break
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. Partenaires annonceurs expirés
  // ────────────────────────────────────────────────────────────────────────
  while (true) {
    const { docs: expiredPartenaires } = await payload.find({
      collection: 'partenaires',
      where: {
        and: [
          { statut: { equals: 'actif' } },
          { abonnementExpireAt: { less_than: now } },
        ],
      },
      limit: PAGE_SIZE,
      page: 1,
      overrideAccess: true,
    })

    if (expiredPartenaires.length === 0) break

    for (const partenaire of expiredPartenaires) {
      try {
        await payload.update({
          collection: 'partenaires',
          id: partenaire.id,
          data: { statut: 'expire' },
          overrideAccess: true,
        })
        partenairesDowngraded++
      } catch (err) {
        console.error(`[cron/downgrade-expires] Failed for partenaire ${partenaire.id}:`, err)
      }
    }

    if (expiredPartenaires.length < PAGE_SIZE) break
  }

  console.log(
    `[cron/downgrade-expires] Réseaux downgraded: ${reseauxDowngraded}, Partenaires downgraded: ${partenairesDowngraded}`,
  )

  return NextResponse.json({ reseauxDowngraded, partenairesDowngraded })
}
