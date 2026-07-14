import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { recalculerEtAppliquerPalier } from '@/lib/groupes'

/**
 * GET /api/cron/retry-groupe-sync
 *
 * Rescanne les audit-logs `groupe_sync_failed` des 7 derniers jours et retente
 * la sync du palier. Utile quand :
 *   - Une panne Stripe transitoire a laisse des subs sans coupon aligne.
 *   - Un coupon env var etait misconfig et a ete corrige entre-temps.
 *
 * `recalculerEtAppliquerPalier` est idempotent : si le palier DB est deja
 * aligne sur la cible, c'est un no-op silencieux. Si la sync reussit cette
 * fois, la DB est mise a jour et l'audit-log reste comme trace historique.
 *
 * Guard via CRON_SECRET (header Authorization: Bearer ...).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { docs: logs } = await payload.find({
    collection: 'audit-logs',
    where: {
      and: [
        { type: { equals: 'groupe_sync_failed' } },
        { createdAt: { greater_than_equal: sevenDaysAgo } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  })

  // Deduplique par groupeId — si le meme groupe a 5 logs sur la semaine,
  // une seule tentative de sync suffit (l'etat Stripe n'a qu'une verite
  // actuelle, pas besoin de rejouer chaque echec historique).
  const groupeIds = new Set<string>()
  for (const log of logs) {
    const metadata = (log.metadata ?? {}) as { groupeId?: string | number }
    if (metadata.groupeId != null) groupeIds.add(String(metadata.groupeId))
  }

  let retried = 0
  let errors = 0
  for (const groupeIdStr of groupeIds) {
    // groupeId peut avoir ete stringifie ("42") alors que la collection
    // l'attend en number — on laisse Payload resoudre via le findByID en
    // interne.
    try {
      await recalculerEtAppliquerPalier(payload, groupeIdStr)
      retried++
    } catch (err) {
      errors++
      console.error(`[cron/retry-groupe-sync] groupe ${groupeIdStr} failed:`, err)
    }
  }

  return NextResponse.json({ inspected: groupeIds.size, retried, errors })
}
