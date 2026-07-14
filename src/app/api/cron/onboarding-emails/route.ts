/**
 * GET /api/cron/onboarding-emails
 *
 * Séquence d'onboarding RÉSEAUTEURS (recalibré ADR-0011).
 *
 * Phase welcome (rattrapage) : users vérifiés sans welcome email.
 *   → Filtre roles : reseauteur OU organisateur (suppression du rôle 'fournisseur').
 *   → Template : welcome invitant à compléter le profil.
 *
 * Phases J+3 / J+7 / J+14 (marketing, opt-in requis) :
 *   → J+3 : reminder de complétion du profil réseauteur (si renseigné < 60%)
 *   → J+7 : info networking (contenu éditorial — plus d'upgrade-nudge payant côté réseauteur)
 *   → J+14 : (réservé future) — skippé silencieusement en V1
 *
 * NB : Les réseauteurs sont 100% gratuits (ADR-0011). Aucun email de conversion/upgrade
 * vers un plan payant ne doit être envoyé aux réseauteurs ou aux organisateurs.
 * Seuls les emails de bienvenue, de complétion et de contenu éditorial sont autorisés.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { welcomeEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'

// Plafond du rattrapage welcome par run
const WELCOME_BATCH_LIMIT = 100

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  const stats = {
    welcomeSent: 0,
    welcomeErrors: 0,
  }

  // ── Welcome rattrapage : users vérifiés il y a plus d'1h sans welcome envoyé.
  // Inclut réseauteurs ET organisateurs (tous gratuits côté plateforme).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  let welcomeStragglers: Record<string, unknown>[] = []
  try {
    const { docs } = await payload.find({
      collection: 'users',
      where: {
        and: [
          { role: { in: ['reseauteur', 'organisateur'] } },
          { _verified: { equals: true } },
          { 'onboardingEmails.welcomeSent': { not_equals: true } },
          { createdAt: { less_than: oneHourAgo } },
          { excludeFromOnboarding: { not_equals: true } },
        ],
      },
      limit: WELCOME_BATCH_LIMIT,
      sort: 'createdAt',
      overrideAccess: true,
    })
    welcomeStragglers = docs as unknown as Record<string, unknown>[]
  } catch (err) {
    console.error('[cron/onboarding-emails] welcome-rattrapage query failed:', err)
  }

  for (const user of welcomeStragglers) {
    try {
      const nomSociete = (user.nomSociete as string) ?? ''
      const result = await sendEmail({
        payload,
        kind: 'welcome',
        to: user.email as string,
        subject: 'Bienvenue sur RÉSEAUTEURS',
        html: welcomeEmail(nomSociete),
        userId: user.id as string | number,
      })
      if (result.sent) {
        stats.welcomeSent++
        await payload.update({
          collection: 'users',
          id: user.id as string | number,
          data: {
            onboardingEmails: {
              ...(user.onboardingEmails as object ?? {}),
              welcomeSent: true,
            },
          },
          overrideAccess: true,
        })
      } else if (result.error) {
        stats.welcomeErrors++
      }
    } catch (err) {
      stats.welcomeErrors++
      console.error(`[cron/onboarding-emails] welcome-rattrapage ${user.email}:`, err)
    }
  }

  // J+3 / J+7 / J+14 : non implémentés en V1 (contenu éditorial à définir).
  // Les templates PanoramaPub (upgradeNudgeEmail, groupLeverageEmail) sont caducs
  // et ne doivent PAS être envoyés aux réseauteurs — il n'y a pas de plan payant.

  return NextResponse.json({ stats })
}
