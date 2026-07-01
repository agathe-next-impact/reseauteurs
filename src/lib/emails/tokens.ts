import crypto from 'crypto'

/**
 * Durée de vie du token d'unsubscribe (secondes). Passe a 90 jours pour qu'un
 * ancien email transféré ne permette pas d'unsubscribe une victime
 * indefiniment. L'utilisateur peut toujours se désabonner depuis le dashboard.
 */
const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60

/**
 * Generate a durable HMAC-signed unsubscribe token for a user ID.
 * Format : {id}.{issuedAt}.{sig} ou issuedAt est un timestamp Unix (secondes).
 * Le token est vérifié par /api/emails/unsubscribe avant de flipper optInMarketing.
 *
 * Compat ascendante : verifyUnsubscribeToken accepté aussi le format historique
 * {id}.{sig} sans timestamp, avec une durée de grace d'un mois depuis deploy.
 */
export function generateUnsubscribeToken(userId: number | string): string {
  const secret = process.env.PAYLOAD_SECRET || ''
  const idStr = String(userId)
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = `${idStr}.${issuedAt}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${hmac}`
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split('.')
  const secret = process.env.PAYLOAD_SECRET || ''

  if (parts.length === 3) {
    const [idStr, issuedAtStr, sig] = parts
    if (!/^\d+$/.test(idStr) || !/^\d+$/.test(issuedAtStr)) return null
    const issuedAt = Number(issuedAtStr)
    const now = Math.floor(Date.now() / 1000)
    if (now - issuedAt > UNSUBSCRIBE_TOKEN_TTL_SECONDS) return null
    const expected = crypto.createHmac('sha256', secret).update(`${idStr}.${issuedAtStr}`).digest('base64url')
    if (sig.length !== expected.length) return null
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    } catch {
      return null
    }
    return idStr
  }

  if (parts.length === 2) {
    const [idStr, sig] = parts
    if (!/^\d+$/.test(idStr)) return null
    const expected = crypto.createHmac('sha256', secret).update(idStr).digest('base64url')
    if (sig.length !== expected.length) return null
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    } catch {
      return null
    }
    return idStr
  }

  return null
}
