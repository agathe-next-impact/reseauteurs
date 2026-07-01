import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Media, CategoriesActivite } from '@/payload-types'

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
  const { docs } = await payload.find({
    collection: 'organisateurs-evenements',
    where: {
      and: [{ slug: { equals: slug } }, { statut: { equals: 'publiee' } }],
    },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  const doc = docs[0]
  if (!doc) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  // Upcoming published events by this organizer
  const { docs: evDocs } = await payload.find({
    collection: 'evenements',
    where: {
      and: [
        { statut: { equals: 'publie' } },
        { or: [{ visible: { equals: true } }, { visible: { exists: false } }] },
        { organisateurExterne: { equals: doc.id } },
        {
          or: [
            { dateFin: { greater_than_equal: new Date().toISOString() } },
            {
              and: [
                { dateFin: { exists: false } },
                { dateDebut: { greater_than_equal: new Date().toISOString() } },
              ],
            },
          ],
        },
      ],
    },
    sort: 'dateDebut',
    limit: 50,
    depth: 1,
    select: {
      titre: true,
      dateDebut: true,
      dateFin: true,
      lieuVille: true,
      type: true,
    },
    overrideAccess: true,
  })

  const pickMedia = (m: unknown) => {
    if (!m || typeof m !== 'object') return null
    const media = m as Media
    return {
      id: media.id,
      url: media.url,
      alt: media.alt,
      sizes: media.sizes
        ? {
            thumbnail: media.sizes.thumbnail ? { url: media.sizes.thumbnail.url } : undefined,
            card: media.sizes.card ? { url: media.sizes.card.url } : undefined,
            full: media.sizes.full ? { url: media.sizes.full.url } : undefined,
          }
        : undefined,
    }
  }

  const activites = (doc.activites ?? []) as CategoriesActivite[]

  const sanitized = {
    id: doc.id,
    slug: doc.slug,
    nom: doc.nom,
    ville: doc.ville ?? null,
    adresse: doc.adresse ?? null,
    codePostal: doc.codePostal ?? null,
    telephone: doc.telephone ?? null,
    siteWeb: doc.siteWeb ?? null,
    emailContact: doc.emailContact ?? null,
    description: doc.description ?? null,
    videoYoutube: doc.videoYoutube ?? null,
    reseauxSociaux: (doc.reseauxSociaux ?? []).map((s) => ({
      plateforme: s.plateforme,
      url: s.url,
    })),
    activites: activites.map((c) => ({
      id: c.id,
      label: c.label,
      value: c.value,
      couleur: c.couleur,
    })),
    banniere: pickMedia(doc.banniere),
    logo: pickMedia(doc.logo),
    illustrations: (doc.illustrations ?? []).map((item) => ({
      id: item.id,
      image: pickMedia(item.image),
    })),
    evenements: evDocs.map((ev) => ({
      id: ev.id,
      titre: ev.titre,
      dateDebut: ev.dateDebut,
      dateFin: ev.dateFin ?? null,
      lieuVille: ev.lieuVille,
      type: ev.type && typeof ev.type === 'object'
        ? { value: (ev.type as { value: string }).value, label: (ev.type as { label: string }).label, couleur: (ev.type as { couleur: string }).couleur }
        : null,
    })),
  }

  return NextResponse.json(sanitized, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60' },
  })
}
