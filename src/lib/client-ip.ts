/**
 * Extract the real client IP from a request in order of trust.
 *
 * On Vercel, `x-vercel-forwarded-for` is appended by the edge after any
 * client-controlled `x-forwarded-for`, so it is the only header that can be
 * trusted for rate limiting. `x-forwarded-for` comes last because its first
 * value is entirely client-controlled and trivially spoofable.
 */
export function getClientIp(headers: Headers | Request['headers']): string {
  const read = (name: string): string | null => {
    const value = typeof (headers as Headers).get === 'function'
      ? (headers as Headers).get(name)
      : null
    if (!value) return null
    const first = value.split(',')[0]?.trim()
    return first || null
  }

  return (
    read('x-vercel-forwarded-for') ??
    read('cf-connecting-ip') ??
    read('x-real-ip') ??
    read('x-forwarded-for') ??
    'unknown'
  )
}
