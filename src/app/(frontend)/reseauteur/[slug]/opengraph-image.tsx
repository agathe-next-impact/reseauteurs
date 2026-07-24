/**
 * Image OpenGraph d'une fiche réseauteur (/reseauteur/<slug>/opengraph-image).
 *
 * Aperçu de partage propre à CETTE fiche : photo + nom + fonction/entreprise + ville.
 * RGPD : ne reprend que des champs déjà publics sur la fiche (jamais tél./email).
 * Généré via la convention Next `opengraph-image` — la métadonnée de la page omet
 * volontairement `openGraph.images` (buildMetadata `ogImageFromRoute`) pour laisser
 * cette image être l'unique source.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card'
import { SITE_NAME } from '@/lib/site'
import type { Media, Reseauteur, Categorie } from '@/types/reseauteurs-domain'

export const runtime = 'nodejs'
export const revalidate = 300
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = `Fiche réseauteur — ${SITE_NAME}`

const BADGE_LABEL: Record<string, string> = {
  bronze: 'Badge Bronze',
  argent: 'Badge Argent',
  gold: 'Badge Gold',
  platinum: 'Badge Platinum',
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { and: [{ slug: { equals: slug } }, { statut: { equals: 'valide' } }] },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const r = docs[0] as Reseauteur | undefined

  // Repli branché si la fiche a disparu entre la génération et la requête.
  if (!r) {
    return renderOgCard({ eyebrow: 'Réseauteur', title: SITE_NAME, accent: '#035AA6' })
  }

  const photo = r.photo as Media | null | undefined
  const photoUrl = photo?.sizes?.card?.url ?? photo?.url ?? null
  const secteur = typeof r.secteur === 'object' ? (r.secteur as Categorie | null) : null

  const subtitleParts = [r.fonction, r.entreprise].filter(Boolean) as string[]
  const meta: string[] = []
  if (r.ville) meta.push(r.departement ? `${r.ville} (${r.departement})` : r.ville)
  if (secteur?.label) meta.push(secteur.label)
  if (r.badge && BADGE_LABEL[r.badge]) meta.push(BADGE_LABEL[r.badge])

  return renderOgCard({
    eyebrow: 'Réseauteur',
    title: `${r.prenom} ${r.nom}`,
    subtitle: subtitleParts.join(' · ') || null,
    meta,
    imageUrl: photoUrl,
    imageShape: 'circle',
    accent: '#035AA6',
    fallbackInitials: `${r.prenom?.[0] ?? ''}${r.nom?.[0] ?? ''}`,
  })
}
