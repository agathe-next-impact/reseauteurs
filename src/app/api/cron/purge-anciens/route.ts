import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/cron/purge-anciens
 *
 * Runs daily (03:00 UTC). Enforces the retention policy documented in
 * docs/rgpd-registre-traitements.md:
 *   - Delete archived events older than 24 months (evenements with statut=archive)
 *   - Delete audit logs older than 36 months (RGPD proof retention)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  const now = new Date()
  const months = (n: number) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - n)
    return d.toISOString()
  }

  const result = { evenementsDeleted: 0, auditLogsDeleted: 0 }

  // 1. Purge archived events > 24 months
  try {
    const { docs: stale } = await payload.find({
      collection: 'evenements',
      where: {
        and: [
          { statut: { equals: 'archive' } },
          { updatedAt: { less_than: months(24) } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    for (const evt of stale) {
      try {
        await payload.delete({
          collection: 'evenements',
          id: evt.id,
          overrideAccess: true,
        })
        result.evenementsDeleted++
      } catch (err) {
        console.error(`[cron purge-anciens] evenement ${evt.id}:`, err)
      }
    }
  } catch (err) {
    console.error('[cron purge-anciens] evenements query:', err)
  }

  // 2. Purge audit logs > 36 months
  try {
    const { docs: oldLogs } = await payload.find({
      collection: 'audit-logs',
      where: { createdAt: { less_than: months(36) } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    for (const log of oldLogs) {
      try {
        await payload.delete({
          collection: 'audit-logs',
          id: log.id,
          overrideAccess: true,
        })
        result.auditLogsDeleted++
      } catch (err) {
        console.error(`[cron purge-anciens] audit-log ${log.id}:`, err)
      }
    }
  } catch (err) {
    console.error('[cron purge-anciens] audit-logs query:', err)
  }

  return NextResponse.json(result)
}
