import React from 'react'

// JSON.stringify n'echappe pas '<' ni U+2028/U+2029. Sans cet escape, un texte
// utilisateur contenant '</script>' fermerait le bloc inline et permettrait une
// stored XSS sur les pages publiques (fiches, evenements, organisateurs).
const LS_RE = new RegExp('\\u2028', 'g')
const PS_RE = new RegExp('\\u2029', 'g')

function safeJsonLd(entry: unknown): string {
  return JSON.stringify(entry)
    .replace(/</g, '\\u003c')
    .replace(LS_RE, '\\u2028')
    .replace(PS_RE, '\\u2029')
}

export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  const payload = Array.isArray(data) ? data : [data]
  return (
    <>
      {payload.map((entry, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(entry) }}
        />
      ))}
    </>
  )
}
