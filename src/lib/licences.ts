/**
 * lib/licences.ts — Activation d'une licence Réseauteur Plus par code promo (ADR-0013 §3, P2.A).
 *
 * TRANSACTION ATOMIQUE (SELECT … FOR UPDATE) — invariants garantis même en concurrence :
 *   - pas de sur-allocation du quota (le pack est verrouillé pendant l'activation) ;
 *   - une seule activation par utilisateur (double garde : vérif applicative + index unique DB) ;
 *   - le passage en Plus (users.plus_*) est écrit dans LA MÊME transaction que l'activation.
 *
 * Appelé par la route POST /api/licences/activer (jamais par le client directement).
 */
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

export interface ActivationResult {
  ok: boolean
  /** Message FR affichable en cas de refus. */
  raison?: string
  /** En cas de succès : infos pour l'UI/email. */
  pack?: { id: number; partenaireNom: string | null; expireAt: string | null }
}

interface DrizzleTx {
  execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
}
interface DrizzleWithTx extends DrizzleTx {
  transaction: <T>(fn: (tx: DrizzleTx) => Promise<T>) => Promise<T>
}

export async function activerLicence(
  payload: Payload,
  userId: number | string,
  codeInput: string,
): Promise<ActivationResult> {
  const code = String(codeInput ?? '').trim().toUpperCase()
  if (!/^RSN-[2-9A-Z]{8}$/.test(code)) {
    return { ok: false, raison: 'Code invalide. Vérifiez le format (RSN-XXXXXXXX).' }
  }

  const drizzle = payload.db.drizzle as unknown as DrizzleWithTx

  try {
    return await drizzle.transaction(async (tx) => {
      // 1. Verrouille le pack (FOR UPDATE) — sérialise les activations concurrentes.
      const packRes = await tx.execute(sql`
        SELECT p.id, p.quota, p.quota_utilise, p.statut, p.expire_at, p.partenaire_id, pa.nom AS partenaire_nom
          FROM licences_packs p
          LEFT JOIN partenaires pa ON pa.id = p.partenaire_id
         WHERE p.code = ${code}
         FOR UPDATE OF p
      `.inlineParams())
      const pack = packRes.rows[0]
      if (!pack) return { ok: false, raison: 'Code inconnu. Vérifiez auprès de votre partenaire.' }

      const statut = String(pack.statut)
      const expireAt = pack.expire_at ? new Date(String(pack.expire_at)) : null
      const quota = Number(pack.quota)
      const utilise = Number(pack.quota_utilise ?? 0)

      if (statut === 'expire' || (expireAt && expireAt.getTime() <= Date.now())) {
        return { ok: false, raison: 'Ce code a expiré. Rapprochez-vous de votre partenaire.' }
      }
      if (statut === 'epuise' || utilise >= quota) {
        return { ok: false, raison: 'Toutes les licences de ce pack ont déjà été activées.' }
      }

      // 2. L'utilisateur : rôle réseauteur + pas déjà Plus par licence/abonnement.
      const userRes = await tx.execute(sql`
        SELECT id, role, plus_actif FROM users WHERE id = ${Number(userId)} FOR UPDATE
      `.inlineParams())
      const user = userRes.rows[0]
      if (!user) return { ok: false, raison: 'Compte introuvable.' }
      if (String(user.role) !== 'reseauteur') {
        return { ok: false, raison: 'Les licences Plus sont réservées aux comptes réseauteurs.' }
      }
      if (user.plus_actif === true) {
        return { ok: false, raison: 'Votre compte est déjà Réseauteur Plus.' }
      }
      const dejaActive = await tx.execute(sql`
        SELECT id FROM licences_activations WHERE user_id = ${Number(userId)} LIMIT 1
      `.inlineParams())
      if (dejaActive.rows.length > 0) {
        return { ok: false, raison: 'Vous avez déjà activé une licence avec ce compte.' }
      }

      // 3. Activation + décrément + passage en Plus — atomiques.
      await tx.execute(sql`
        INSERT INTO licences_activations (pack_id, user_id, active_at)
        VALUES (${Number(pack.id)}, ${Number(userId)}, now())
      `.inlineParams())
      await tx.execute(sql`
        UPDATE licences_packs
           SET quota_utilise = quota_utilise + 1,
               statut = CASE WHEN quota_utilise + 1 >= quota THEN 'epuise'::enum_licences_packs_statut ELSE statut END,
               updated_at = now()
         WHERE id = ${Number(pack.id)}
      `.inlineParams())
      await tx.execute(sql`
        UPDATE users
           SET plus_actif = true,
               plus_source = 'licence',
               plus_licence_pack_id = ${Number(pack.id)},
               plus_expire_at = ${expireAt ? expireAt.toISOString() : null},
               updated_at = now()
         WHERE id = ${Number(userId)}
      `.inlineParams())

      return {
        ok: true,
        pack: {
          id: Number(pack.id),
          partenaireNom: (pack.partenaire_nom as string | null) ?? null,
          expireAt: expireAt ? expireAt.toISOString() : null,
        },
      }
    })
  } catch (err) {
    // Course parfaite sur l'index unique (2 requêtes simultanées du même user) → message propre.
    const msg = err instanceof Error ? err.message : String(err)
    if (/licences_activations_user_idx|duplicate key/i.test(msg)) {
      return { ok: false, raison: 'Vous avez déjà activé une licence avec ce compte.' }
    }
    console.error('[licences] activation failed:', err)
    return { ok: false, raison: 'Erreur lors de l\'activation. Réessayez.' }
  }
}

/**
 * Désactive les Plus issus d'un pack (expiration/révocation — cron P2.A, gate P0 D4).
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
