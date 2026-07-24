/**
 * Image OpenGraph d'une fiche événement (/evenement/<slug>/opengraph-image).
 *
 * Aperçu de partage propre à CET événement : visuel + titre + date + lieu + réseau.
 * Généré via la convention Next `opengraph-image` (métadonnée de page en
 * `ogImageFromRoute`, donc pas de double og:image).
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card'
import { SITE_NAME } from '@/lib/site'
import type { Media, EvenementRsn, Reseau } from '@/types/reseauteurs-domain'

export const runtime = 'nodejs'
export const revalidate = 300
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = `Événement networking — ${SITE_NAME}`

function dateLongFR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'evenements',
    where: { and: [{ slug: { equals: slug } }, { statut: { equals: 'publie' } }] },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const e = docs[0] as EvenementRsn | undefined

  if (!e) {
    return renderOgCard({ eyebrow: 'Événement', title: SITE_NAME, accent: '#8A6D0B' })
  }

  const image = e.image as Media | null | undefined
  const imageUrl = image?.sizes?.card?.url ?? image?.url ?? null
  const reseau = typeof e.reseau === 'object' ? (e.reseau as Reseau | null) : null

  const lieu = [e.lieuVille, e.lieuDepartement ? `(${e.lieuDepartement})` : null]
    .filter(Boolean)
    .join(' ')
  const subtitle = [dateLongFR(e.dateDebut), lieu].filter(Boolean).join(' · ')

  const meta: string[] = []
  if (reseau?.nom) meta.push(`Organisé par ${reseau.nom}`)
  meta.push(e.gratuit === false && e.tarif ? `Payant · ${e.tarif}` : 'Entrée gratuite')

  return renderOgCard({
    eyebrow: 'Événement',
    title: e.titre,
    subtitle: subtitle || null,
    meta,
    imageUrl,
    imageShape: 'rounded',
    accent: '#8A6D0B',
    fallbackInitials: e.titre?.[0] ?? 'É',
  })
}
