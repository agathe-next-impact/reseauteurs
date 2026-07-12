/**
 * GET /api/evenements/public/v2/:slug
 *
 * Endpoint public pour la preview et le détail d'un événement (modèle RÉSEAUTEURS).
 * Nouveau endpoint — distinct de /api/evenements/public/:slug (ancien modèle PanoramaPub).
 *
 * Retourne les champs nécessaires à la carte et à la fiche publique /evenement/:slug.
 * Le bouton « S'inscrire » utilise lienInscription (lien externe vers le réseau).
 * RÉSEAUTEURS ne gère PAS l'inscription (ADR-0011 §1).
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { todayParisDateString } from '@/lib/dates'

export const revalidate = 300

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!slug) {
    return NextResponse.json({ error: 'Slug manquant' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  let doc: Record<string, unknown> | null = null
  try {
    if (/^\d+$/.test(slug)) {
      const found = await payload.findByID({
        collection: 'evenements',
        id: slug,
        depth: 2,
        overrideAccess: true,
      })
      doc = found as unknown as Record<string, unknown>
    } else {
      const { docs } = await payload.find({
        collection: 'evenements',
        where: { slug: { equals: slug } },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      })
      doc = (docs[0] ?? null) as unknown as Record<string, unknown>
    }
  } catch {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  if (!doc || doc['statut'] !== 'publie') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  type MediaLite = {
    id: number | string
    url?: string | null
    alt?: string | null
    sizes?: Record<string, { url?: string | null } | undefined>
  }
  type ReseauLite = {
    id: number | string
    slug?: string | null
    nom?: string | null
    siteWeb?: string | null
    logo?: MediaLite | null
  }
  type TypeLite = { id: number | string; label?: string | null; value?: string | null; couleur?: string | null }

  const pickMedia = (m: unknown): MediaLite | null =>
    m && typeof m === 'object' ? (m as MediaLite) : null

  const image = pickMedia(doc['image'])
  const reseau = doc['reseau'] as ReseauLite | null | undefined
  // ADR-0013 : organisateur réseauteur (XOR avec reseau)
  const organisateurRz = doc['organisateurReseauteur'] as
    | { id: number | string; slug?: string | null; prenom?: string | null; nom?: string | null; ville?: string | null; photo?: MediaLite | null }
    | null
    | undefined
  const organisateurPhoto =
    organisateurRz && typeof organisateurRz === 'object' ? pickMedia(organisateurRz.photo) : null
  const typeDoc = doc['type'] as TypeLite | null | undefined
  const reseauLogo = reseau ? pickMedia(reseau.logo) : null

  // Vérifier si l'événement est passé (pour afficher un badge "terminé")
  const dateDebut = doc['dateDebut'] ? new Date(doc['dateDebut'] as string) : null
  const dateFin = doc['dateFin'] ? new Date(doc['dateFin'] as string) : null
  const today = new Date(`${todayParisDateString()}T00:00:00.000Z`)
  const isPast = dateFin ? dateFin < today : dateDebut ? dateDebut < today : false

  const sanitized = {
    id: doc['id'],
    slug: (doc['slug'] as string | null | undefined) ?? null,
    titre: (doc['titre'] as string | undefined) ?? '',
    description: (doc['description'] as string | null | undefined) ?? null,
    dateDebut: (doc['dateDebut'] as string | undefined) ?? null,
    dateFin: (doc['dateFin'] as string | null | undefined) ?? null,
    isPast,
    lieuNom: (doc['lieuNom'] as string | null | undefined) ?? null,
    lieuAdresse: (doc['lieuAdresse'] as string | null | undefined) ?? null,
    lieuCodePostal: (doc['lieuCodePostal'] as string | null | undefined) ?? null,
    lieuVille: (doc['lieuVille'] as string | undefined) ?? null,
    lieuLatitude: (doc['lieuLatitude'] as number | null | undefined) ?? null,
    lieuLongitude: (doc['lieuLongitude'] as number | null | undefined) ?? null,
    // CTA d'inscription : lien externe vers le réseau
    lienInscription: (doc['lienInscription'] as string | null | undefined) ?? null,
    // Premium
    premium: (doc['premium'] as boolean | undefined) === true,
    // Image de l'événement
    image: image
      ? {
          url: image.url ?? null,
          cardUrl: image.sizes?.['card']?.url ?? image.url ?? null,
          alt: image.alt ?? null,
        }
      : null,
    // Réseau organisateur
    reseau: reseau
      ? {
          id: reseau.id,
          slug: reseau.slug ?? null,
          nom: reseau.nom ?? null,
          siteWeb: reseau.siteWeb ?? null,
          logoUrl:
            reseauLogo?.sizes?.['thumbnail']?.url ?? reseauLogo?.url ?? null,
        }
      : null,
    // Organisateur réseauteur (ADR-0013 — exclusif avec reseau)
    organisateurReseauteur:
      organisateurRz && typeof organisateurRz === 'object'
        ? {
            id: organisateurRz.id,
            slug: organisateurRz.slug ?? null,
            prenom: organisateurRz.prenom ?? null,
            nom: organisateurRz.nom ?? null,
            ville: organisateurRz.ville ?? null,
            photoUrl: organisateurPhoto?.sizes?.['thumbnail']?.url ?? organisateurPhoto?.url ?? null,
          }
        : null,
    // Type / catégorie
    type: typeDoc
      ? {
          id: typeDoc.id,
          label: typeDoc.label ?? null,
          value: typeDoc.value ?? null,
          couleur: typeDoc.couleur ?? null,
        }
      : null,
  }

  return NextResponse.json(sanitized, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
