/**
 * Validate a user-provided URL before rendering it as an href.
 *
 * Fields like `siteWeb`, `boutiqueEnLigne`, `lienDevis`, `lienInscription`
 * are validated at write time (URL constructor + http/https check) but an
 * admin could still save a `javascript:` or `data:` URL via the Payload
 * admin panel or a future bypass. Rendering these as `href={raw}` would
 * execute arbitrary JS on click. This helper is the last-line defense.
 *
 * Returns the URL if it parses and uses an allowed scheme, otherwise null.
 * Callers should fall back to `'#'` or omit the anchor when null.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}
