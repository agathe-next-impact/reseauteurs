import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Fournisseur, TypesEvenement, CategoriesActivite } from '@/payload-types'

type OrganisateurExterne = {
  id: number
  nom: string
  slug?: string | null
  ville?: string | null
  siteWeb?: string | null
  emailContact?: string | null
}

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
  let doc
  try {
    // Retrocompat : accepte un id numerique (anciens bookmarks, deeplinks slideover).
    if (/^\d+$/.test(slug)) {
      doc = await payload.findByID({
        collection: 'evenements',
        id: slug,
        depth: 2,
        overrideAccess: true,
      })
    } else {
      const { docs } = await payload.find({
        collection: 'evenements',
        where: { slug: { equals: slug } },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      })
      doc = docs[0]
    }
  } catch {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  if (!doc || doc.statut !== 'publie' || (doc as { visible?: boolean }).visible === false) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  const typeDoc = doc.type as TypesEvenement | null
  const fournisseur = doc.fournisseur as Fournisseur | null
  const fournisseursAssocies = ((doc as { fournisseursAssocies?: Array<Fournisseur | number> }).fournisseursAssocies ?? [])
    .filter((f): f is Fournisseur => typeof f === 'object' && f !== null)
  const activites = ((doc as { activites?: Array<CategoriesActivite | number> }).activites ?? [])
    .filter((a): a is CategoriesActivite => typeof a === 'object' && a !== null)
  const organisateurExterne = (doc as { organisateurExterne?: OrganisateurExterne | number | null }).organisateurExterne
  const orgExt: OrganisateurExterne | null =
    organisateurExterne && typeof organisateurExterne === 'object' ? organisateurExterne : null

  type MediaLite = { id: number; url?: string | null; alt?: string | null; sizes?: Record<string, { url?: string | null }> }
  const pickMedia = (m: unknown): MediaLite | null => (m && typeof m === 'object' ? (m as MediaLite) : null)
  const banniere = pickMedia((doc as { banniere?: unknown }).banniere)
  const logo = pickMedia((doc as { logo?: unknown }).logo)
  const illustrations = (((doc as { illustrations?: Array<{ image: unknown; id?: string | null }> }).illustrations ?? [])
    .map((it) => ({ id: it.id ?? null, image: pickMedia(it.image) }))
    .filter((it): it is { id: string | null; image: MediaLite } => it.image !== null))

  const sanitized = {
    id: doc.id,
    slug: doc.slug ?? null,
    titre: doc.titre,
    type: typeDoc
      ? { id: typeDoc.id, label: typeDoc.label, value: typeDoc.value, couleur: typeDoc.couleur }
      : null,
    dateDebut: doc.dateDebut,
    dateFin: doc.dateFin ?? null,
    lieuNom: doc.lieuNom ?? null,
    lieuAdresse: doc.lieuAdresse ?? null,
    lieuCodePostal: doc.lieuCodePostal ?? null,
    lieuVille: doc.lieuVille ?? null,
    lieuLatitude: doc.lieuLatitude ?? null,
    lieuLongitude: doc.lieuLongitude ?? null,
    descriptionCourte: doc.descriptionCourte ?? null,
    lienInscription: doc.lienInscription ?? null,
    emailContact: doc.emailContact ?? null,
    fournisseur: fournisseur
      ? { id: fournisseur.id, slug: fournisseur.slug, raisonSociale: fournisseur.raisonSociale, ville: fournisseur.ville, logo: pickMedia((fournisseur as { logo?: unknown }).logo) }
      : null,
    fournisseursAssocies: fournisseursAssocies.map((f) => ({
      id: f.id,
      slug: f.slug,
      raisonSociale: f.raisonSociale,
      ville: f.ville,
    })),
    activites: activites.map((a) => ({
      id: a.id,
      label: a.label,
      value: a.value,
      couleur: a.couleur,
    })),
    organisateurExterne: orgExt
      ? { id: orgExt.id, nom: orgExt.nom, slug: orgExt.slug ?? null, ville: orgExt.ville ?? null, siteWeb: orgExt.siteWeb ?? null, emailContact: orgExt.emailContact ?? null, logo: pickMedia((orgExt as { logo?: unknown }).logo) }
      : null,
    participantsSignales: ((doc as { participantsSignales?: Array<Fournisseur | number> }).participantsSignales ?? [])
      .filter((f): f is Fournisseur => typeof f === 'object' && f !== null)
      .map((f) => ({
        id: f.id,
        slug: f.slug,
        raisonSociale: f.raisonSociale,
        ville: f.ville,
      })),
    banniere,
    logo,
    illustrations,
  }

  return NextResponse.json(sanitized, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60' },
  })
}
