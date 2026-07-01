/**
 * Retry leger autour des requetes Postgres sur erreurs de connexion
 * transitoires (Neon serverless coupe les sockets idle, le pool `pg` peut
 * tenter une query sur une socket morte avant de la retirer du pool).
 *
 * Symptomes observes en prod (logs Vercel 2026-04-25) :
 *   - Error: Connection terminated unexpectedly
 *   - Error: Connection terminated due to connection timeout
 *
 * A reserver aux operations idempotentes (reads, ou writes sans effet
 * de bord externe). Ne pas wrapper un appel Stripe, un envoi d'email,
 * ou une operation a effet de bord non-idempotent.
 */

const CONNECTION_ERROR_NEEDLES = [
  'Connection terminated',
  'connection timeout',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
] as const

function isConnectionError(err: unknown): boolean {
  if (!err) return false
  const seen = new Set<unknown>()
  const stack: unknown[] = [err]
  while (stack.length > 0) {
    const e = stack.pop()
    if (!e || seen.has(e)) continue
    seen.add(e)
    const obj = e as { message?: unknown; code?: unknown; cause?: unknown }
    if (typeof obj.message === 'string') {
      const msg = obj.message
      if (CONNECTION_ERROR_NEEDLES.some((needle) => msg.includes(needle))) return true
    }
    if (typeof obj.code === 'string' && CONNECTION_ERROR_NEEDLES.includes(obj.code as never)) {
      return true
    }
    if (obj.cause) stack.push(obj.cause)
  }
  return false
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 1,
    delayMs = 300,
    label,
  }: { retries?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === retries || !isConnectionError(err)) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[db-retry] connection error on ${label ?? 'query'} (attempt ${attempt + 1}/${
          retries + 1
        }), retrying in ${delayMs}ms: ${msg}`,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastErr
}
