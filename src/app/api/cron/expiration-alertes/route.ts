/**
 * GET /api/cron/expiration-alertes
 *
 * Alertes J-30 et J-7 avant expiration des abonnements B2B (ADR-0011).
 *
 * Deux collections surveillées :
 *   1. reseaux   : partenaire=true et partenaireExpireAt dans [J-30 ; J-7]
 *   2. partenaires : statut=actif et abonnementExpireAt dans [J-30 ; J-7]
 *
 * Les flags j30Sent / j7Sent sont sur le user (organisateur) pour les réseaux,
 * et directement dans le contexte sans flag DB pour les partenaires (simple).
 *
 * Flag remis à false à chaque renouvellement (webhook subscription.updated).
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { expirationWarningEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'
import { withDbRetry } from '@/lib/db-retry'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const now = new Date()
  let sent = 0

  for (const daysLeft of [30, 7]) {
    const flagField = daysLeft === 30 ? 'j30Sent' : 'j7Sent'
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + daysLeft)

    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // ── Réseaux partenaires (alerte via le user organisateur)
    const { docs: reseauxExpiring } = await withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: {
            and: [
              { partenaire: { equals: true } },
              { partenaireExpireAt: { greater_than_equal: startOfDay.toISOString() } },
              { partenaireExpireAt: { less_than_equal: endOfDay.toISOString() } },
            ],
          },
          depth: 1,
          limit: 0,
          overrideAccess: true,
        }),
      { label: `cron/expiration-alertes:reseaux J-${daysLeft}` },
    )

    for (const reseau of reseauxExpiring) {
      const userRel = (reseau as Record<string, unknown>).user
      const userId =
        typeof userRel === 'object' && userRel !== null
          ? (userRel as { id: number | string }).id
          : (userRel as number | string | null | undefined)

      if (!userId) continue

      try {
        const owner = await payload.findByID({
          collection: 'users',
          id: userId as number | string,
          overrideAccess: true,
        })

        // Vérification flag (évite les doublons sur ce cycle)
        const alerts = (owner as Record<string, unknown>).expirationAlerts as
          | Record<string, boolean>
          | undefined
        if (alerts?.[flagField] === true) continue

        const result = await sendEmail({
          payload,
          kind: 'expiration-warning',
          to: owner.email,
          subject: `RÉSEAUTEURS — Votre abonnement réseau partenaire expire dans ${daysLeft} jours`,
          html: expirationWarningEmail(
            owner.nomSociete ?? ((reseau as Record<string, unknown>).nom as string ?? ''),
            daysLeft,
            'Réseau partenaire',
          ),
          userId: owner.id,
        })

        if (result.sent) {
          sent++
          try {
            await payload.update({
              collection: 'users',
              id: owner.id,
              data: {
                expirationAlerts: {
                  ...(alerts ?? {}),
                  [flagField]: true,
                },
              },
              overrideAccess: true,
            })
          } catch (err) {
            console.error(
              `[cron/expiration-alertes] Flag ${flagField} update failed for user ${owner.id}:`,
              err,
            )
          }
        }
      } catch (err) {
        console.error(
          `[cron/expiration-alertes] Failed for reseau ${(reseau as Record<string, unknown>).id}:`,
          err,
        )
      }
    }

    // ── Partenaires annonceurs
    const { docs: partenairesExpiring } = await withDbRetry(
      () =>
        payload.find({
          collection: 'partenaires',
          where: {
            and: [
              { statut: { equals: 'actif' } },
              { abonnementExpireAt: { greater_than_equal: startOfDay.toISOString() } },
              { abonnementExpireAt: { less_than_equal: endOfDay.toISOString() } },
            ],
          },
          limit: 0,
          overrideAccess: true,
        }),
      { label: `cron/expiration-alertes:partenaires J-${daysLeft}` },
    )

    for (const partenaire of partenairesExpiring) {
      // Pour les partenaires, on notifie l'email de contact admin (CONTACT_EMAIL)
      // car ils n'ont pas de compte utilisateur en V1.
      try {
        const { CONTACT_EMAIL } = await import('@/lib/site')
        const result = await sendEmail({
          payload,
          kind: 'expiration-warning',
          to: CONTACT_EMAIL,
          subject: `RÉSEAUTEURS — Partenaire annonceur "${(partenaire as Record<string, unknown>).nom}" expire dans ${daysLeft} jours`,
          html: expirationWarningEmail(
            (partenaire as Record<string, unknown>).nom as string ?? 'Partenaire',
            daysLeft,
            'Partenaire annonceur',
          ),
          skipBlacklistCheck: true,
        })
        if (result.sent) sent++
      } catch (err) {
        console.error(
          `[cron/expiration-alertes] Failed for partenaire ${(partenaire as Record<string, unknown>).id}:`,
          err,
        )
      }
    }
  }

  return NextResponse.json({ sent })
}
