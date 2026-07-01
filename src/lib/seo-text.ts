const WHITESPACE_RE = /\s+/g
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const MARKDOWN_DECOR_RE = /[*_~`#>]+/g
const HTML_TAG_RE = /<[^>]*>/g

export function stripMarkdown(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(HTML_TAG_RE, ' ')
    .replace(MARKDOWN_LINK_RE, '$1')
    .replace(MARKDOWN_DECOR_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim()
}

export function truncate(input: string | null | undefined, max: number): string {
  if (!input) return ''
  const cleaned = input.replace(WHITESPACE_RE, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const sliced = cleaned.slice(0, max - 1)
  const lastSpace = sliced.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced
  return `${base.replace(/[.,;:!?\s]+$/, '')}…`
}

export function truncateTitle(input: string | null | undefined, max = 60): string {
  return truncate(input, max)
}

export function truncateDescription(input: string | null | undefined, max = 160): string {
  return truncate(stripMarkdown(input), max)
}

export function joinNonEmpty(separator: string, parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(separator)
}
