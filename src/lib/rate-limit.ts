/**
 * Sliding-window rate limiter pour environnements serverless.
 *
 * LIMITATIONS CONNUES (defense en profondeur, PAS protection primaire) :
 *
 * 1. Non partage entre instances.
 *    Le store est un Map local a chaque lambda Vercel. Sous charge, Vercel
 *    spawn N instances, et un attaquant atteint effectivement limit * N
 *    requetes/min. Ne compter sur ce module ni pour des seuils serres ni
 *    pour bloquer des attaques distribuees.
 *
 * 2. Eviction non-LRU a 10 000 entrees.
 *    Quand le store depasse MAX_STORE_SIZE, on supprime les cles dans
 *    l'ordre d'insertion (pas LRU). Un attaquant qui forge des cles uniques
 *    (IP rotate, userId fabriques en mode dev) peut evacuer les entrees
 *    legitimes.
 *
 * 3. Reset a chaque cold start.
 *    Au demarrage d'une nouvelle lambda, le compteur repart a zero.
 *
 * GARDES FOUS PRIMAIRES (a respecter independamment de ce rate limit) :
 *   - Stripe webhook : HMAC signature (constructEvent) + idempotence DB
 *     via UNIQUE(eventId) dans la collection stripe-events.
 *   - Stripe checkout : guard anti double-checkout business side
 *     (checkout/route.ts refuse si stripeSubscriptionId actif) — cf AUD-007.
 *   - Routes dashboard : auth middleware (cookie payload-token) + access
 *     control Payload avec getFreshUser().
 *   - Creation de fiche : contrainte UNIQUE(user_id) cote DB dans la
 *     collection fournisseurs + canCreateFiche() dans les hooks.
 *   - Groupes : owner check au niveau des collections Payload.
 *
 * A migrer vers Upstash Redis ou une table Postgres dediee si le trafic
 * devient significatif ou si des ratelimits serres sont attendus.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up stale entries periodically to avoid memory leaks
const CLEANUP_INTERVAL = 60_000
const MAX_STORE_SIZE = 10_000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs * 2
  for (const [key, entry] of store) {
    // Remove entries where all timestamps are expired
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      store.delete(key)
    }
  }
  // Hard cap to prevent unbounded memory growth
  if (store.size > MAX_STORE_SIZE) {
    const keysToDelete = Array.from(store.keys()).slice(0, store.size - MAX_STORE_SIZE)
    for (const key of keysToDelete) store.delete(key)
  }
}

export function rateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): { success: boolean; remaining: number } {
  cleanup(windowMs)

  const now = Date.now()
  const windowStart = now - windowMs
  const entry = store.get(key)

  if (!entry) {
    store.set(key, { timestamps: [now] })
    return { success: true, remaining: limit - 1 }
  }

  // Sliding window: keep only timestamps within the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)
  entry.timestamps.push(now)

  if (entry.timestamps.length > limit) {
    return { success: false, remaining: 0 }
  }

  return { success: true, remaining: limit - entry.timestamps.length }
}
