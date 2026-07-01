import crypto from 'crypto'
import type { Payload } from 'payload'

/**
 * Hash d'un userId pour l'anonymisation RGPD dans audit-logs.
 * Utilise PAYLOAD_SECRET comme sel (invariant dans le temps pour pouvoir
 * grouper les evenements d'un meme user ex. en debug, sans stocker l'id brut).
 */
export function hashUserId(userId: number | string): string {
  const secret = process.env.PAYLOAD_SECRET || ''
  return crypto.createHash('sha256').update(`${userId}:${secret}`).digest('hex')
}

export type PlanChangeReason =
  | 'checkout_completed'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'subscription_deleted'
  | 'expired_cron'
  | 'cancel_requested'
  | 'reactivate_requested'

/**
 * Ecrit un audit-log type plan_changed. Non-bloquant : toute erreur est
 * logguee sans remonter a l'appelant (un echec d'audit ne doit pas rater
 * la mise a jour du plan elle-meme).
 */
export async function logPlanChange(
  payload: Payload,
  params: {
    userId: number | string
    oldPlan: string | null | undefined
    newPlan: string | null | undefined
    reason: PlanChangeReason
    extra?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'plan_changed',
        userIdHash: hashUserId(params.userId),
        metadata: {
          oldPlan: params.oldPlan ?? null,
          newPlan: params.newPlan ?? null,
          reason: params.reason,
          ...(params.extra ?? {}),
        },
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[audit] logPlanChange failed:', err)
  }
}

export type BlacklistReason = 'hard-bounce' | 'complaint'
export type BlacklistSource = 'resend-webhook' | 'backfill-script' | 'admin-manual'

/**
 * Ecrit un audit-log type email_blacklisted. Non-bloquant. Trace RGPD pour
 * une decision impactante : le user ne recoit plus aucun mail (sauf chemins
 * critiques avec skipBlacklistCheck) tant que le flag n'est pas remis a false.
 */
export async function logBlacklist(
  payload: Payload,
  params: {
    userId: number | string
    reason: BlacklistReason
    source: BlacklistSource
    extra?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'email_blacklisted',
        userIdHash: hashUserId(params.userId),
        metadata: {
          reason: params.reason,
          source: params.source,
          ...(params.extra ?? {}),
        },
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[audit] logBlacklist failed:', err)
  }
}
