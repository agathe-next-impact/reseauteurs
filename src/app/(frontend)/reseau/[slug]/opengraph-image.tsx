/**
 * Image OpenGraph d'une fiche réseau (/reseau/<slug>/opengraph-image).
 *
 * Aperçu de partage propre à CE réseau : logo + nom + échelle + ville + description.
 * Généré via la convention Next `opengraph-image` (métadonnée de page en
 * `ogImageFromRoute`, donc pas de double og:image).
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card'
import { SITE_NAME } from '@/lib/site'
import type { Media, Reseau } from '@/types/reseauteurs-domain'

export const runtime = 'nodejs'
export const revalidate = 300
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = `Réseau d'affaires — ${SITE_NAME}`

const NIVEAU_LABEL: Record<string, string> = {
  local: 'Réseau local',
  regional: 'Réseau régional',
  national: 'Réseau national',
  international: 'Réseau international',
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseaux',
    where: { and: [{ slug: { equals: slug } }, { statut: { equals: 'publiee' } }] },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const r = docs[0] as Reseau | undefined

  if (!r) {
    return renderOgCard({ eyebrow: "Réseau d'affaires", title: SITE_NAME, accent: '#3E7CA6' })
  }

  const logo = r.logo as Media | null | undefined
  const logoUrl = logo?.sizes?.card?.url ?? logo?.sizes?.thumbnail?.url ?? logo?.url ?? null

  const echelle = (r.niveau && NIVEAU_LABEL[r.niveau]) || "Réseau d'affaires"
  const subtitle = [echelle, r.ville].filter(Boolean).join(' · ')

  const meta: string[] = []
  if (r.description) meta.push(r.description)

  return renderOgCard({
    eyebrow: "Réseau d'affaires",
    title: r.nom,
    subtitle: subtitle || null,
    meta,
    imageUrl: logoUrl,
    imageShape: 'rounded',
    accent: '#3E7CA6',
    fallbackInitials: r.nom?.[0] ?? 'R',
  })
}
