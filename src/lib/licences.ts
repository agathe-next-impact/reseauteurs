/**
 * lib/licences.ts — [LEGACY — ADR-0015 (2026-07-17)]
 *
 * L'achat de packs de licences par les partenaires et l'activation par code promo
 * sont SUPPRIMÉS (`activerLicence` retirée, route /api/licences/activer en 410).
 * Ne reste que `desactiverPlusDuPack`, utilisée par le cron expiration-plus pour
 * éteindre proprement les Plus issus des licences DÉJÀ activées (données legacy —
 * collections licences-packs/licences-activations conservées dormantes en DB).
 */
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

interface DrizzleTx {
  execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
}

/**
 * Désactive les Plus issus d'un pack (expiration — cron expiration-plus).
 * Ne touche pas aux Plus par abonnement.
 */
export async function desactiverPlusDuPack(
  payload: Payload,
  packId: number | string,
): Promise<number> {
  const drizzle = payload.db.drizzle as unknown as DrizzleTx
  const res = await drizzle.execute(sql`
    UPDATE users
       SET plus_actif = false, updated_at = now()
     WHERE plus_licence_pack_id = ${Number(packId)}
       AND plus_source = 'licence'
       AND plus_actif = true
    RETURNING id
  `.inlineParams())
  return res.rows.length
}
