/** Escape user-supplied strings before embedding in HTML email templates. */
export function esc(text: string | null | undefined): string {
  if (text == null) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
