/**
 * Page « Réseauteurs » — /reseauteurs
 *
 * ADR-0012 §7 : landing page self-canonical.
 * - Bascule entité : /reseauteurs ↔ /reseaux (navigation entre deux pages).
 * - Bascule vue : ?vue=annuaire (défaut) | carte — synchronisée avec l'URL.
 * - Filtres : nom, ville, dept, région, badge, réseau, secteur — profonds-linkables.
 *
 * Vue annuaire : filtre + grille de cartes profil.
 * Vue carte    : MapReseauteursLoader (même data que /carte/reseauteurs) avec toggle overlay.
 *
 * Canonical : /reseauteurs — les params ?vue/filtres ne sont PAS canonicalisés (seo-canonical).
 */
import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Users, MapPin } from 'lucide-react'
import { buildTogglePageMetadata } from '@/lib/seo-canonical'
import { withDbRetry } from '@/lib/db-retry'
import { BadgeReseauteur } from '@/components/ui/BadgeReseauteur'
import { ReseauteursFilters } from '@/components/search/ReseauteursFilters'
import { toFeatureCollection, toFeature } from '@/lib/geojson'
import { SITE_NAME } from '@/lib/site'
import type { Metadata } from 'next'
import type { Reseauteur, Media, Reseau, Categorie } from '@/types/reseauteurs-domain'
import type { Where } from 'payload'
import type { CategoryLite, ReseauLite } from '@/components/filters/FiltresReseauteurs'
import EntiteVueToggle from '@/components/explore/EntiteVueToggle'
import MapReseauteursLoader from '@/components/maps/MapReseauteursLoader'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return buildTogglePageMetadata('/reseauteurs', {
    title: `Réseauteurs — Annuaire et carte du networking | ${SITE_NAME}`,
    description:
      'Trouvez les professionnels du networking près de chez vous : entrepreneurs, dirigeants, indépendants par ville, secteur, réseau ou badge.',
  })
}

interface SearchParams {
  vue?: string
  q?: string
  ville?: string
  departement?: string
  region?: string
  badge?: string
  reseau?: string
  secteur?: string
  page?: string
}

const PAGE_SIZE = 24

function buildWhere(sp: SearchParams): Where {
  const conditions: Where[] = [{ statut: { equals: 'valide' } }]

  if (sp.q) {
    conditions.push({
      or: [
        { prenom: { contains: sp.q } },
        { nom: { contains: sp.q } },
        { entreprise: { contains: sp.q } },
        { fonction: { contains: sp.q } },
      ],
    } as Where)
  }
  if (sp.ville) conditions.push({ ville: { contains: sp.ville } })
  if (sp.departement) conditions.push({ departement: { contains: sp.departement } })
  if (sp.region) conditions.push({ region: { contains: sp.region } })
  if (sp.badge) conditions.push({ badge: { equals: sp.badge } })
  if (sp.secteur) conditions.push({ secteur: { equals: sp.secteur } })

  return { and: conditions }
}

export default async function ReseauteursPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const vue = sp.vue === 'carte' ? 'carte' : 'annuaire'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const payload = await getPayload({ config })

  // Données communes : réseaux locaux pour les filtres, catégories
  const [{ docs: reseaux }, { docs: categories }] = await Promise.all([
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: {
            and: [
              { statut: { equals: 'publiee' } },
              { niveau: { equals: 'local' } },
            ],
          } as Where,
          select: { nom: true, slug: true } as Record<string, boolean>,
          depth: 0,
          limit: 500,
          sort: 'nom',
          overrideAccess: true,
        }),
      { label: 'reseauteurs:find reseaux-locaux' },
    ),
    withDbRetry(
      () =>
        payload.find({
          collection: 'categories',
          depth: 0,
          limit: 100,
          overrideAccess: true,
        }),
      { label: 'reseauteurs:find categories' },
    ),
  ])

  const reseauxListe = (reseaux as Reseau[]).map((r) => ({ slug: r.slug ?? '', nom: r.nom }))
  const categoriesListe = (categories as Categorie[]).map((c) => ({ id: c.id, label: c.label ?? '' }))

  // ─── VUE CARTE ─────────────────────────────────────────────────────────────
  if (vue === 'carte') {
    const [{ docs: reseauteursDocs }, { docs: categoriesDocs }, { docs: reseauxDocs }] =
      await Promise.all([
        withDbRetry(
          () =>
            payload.find({
              collection: 'reseauteurs',
              where: {
                and: [
                  { statut: { equals: 'valide' } },
                  { latitude: { exists: true } },
                  { longitude: { exists: true } },
                ],
              },
              depth: 0,
              limit: 3000,
              overrideAccess: true,
              select: {
                slug: true,
                prenom: true,
                nom: true,
                entreprise: true,
                ville: true,
                badge: true,
                latitude: true,
                longitude: true,
              } as Record<string, boolean>,
            }),
          { label: 'reseauteurs-carte:find' },
        ),
        withDbRetry(
          () =>
            payload.find({
              collection: 'categories',
              depth: 0,
              limit: 100,
              sort: 'ordre',
              overrideAccess: true,
            }),
          { label: 'reseauteurs-carte:categories' },
        ),
        withDbRetry(
          () =>
            payload.find({
              collection: 'reseaux',
              where: {
                and: [
                  { statut: { equals: 'publiee' } },
                  { niveau: { equals: 'local' } },
                ],
              } as Where,
              depth: 0,
              limit: 500,
              sort: 'nom',
              overrideAccess: true,
              select: { id: true, slug: true, nom: true } as Record<string, boolean>,
            }),
          { label: 'reseauteurs-carte:reseaux' },
        ),
      ])

    const features = reseauteursDocs
      .filter((doc) => doc.latitude != null && doc.longitude != null)
      .map((doc) =>
        toFeature(doc.longitude as number, doc.latitude as number, {
          slug: doc.slug ?? null,
          prenom: (doc.prenom as string | undefined) ?? '',
          nom: (doc.nom as string | undefined) ?? '',
          entreprise: (doc.entreprise as string | null | undefined) ?? null,
          ville: (doc.ville as string | undefined) ?? '',
          badge: (doc.badge as string | null | undefined) ?? null,
        }),
      )
    const initialData = toFeatureCollection(features)

    const carteCategories: CategoryLite[] = categoriesDocs.map((c) => ({
      id: c.id as number,
      value: (c.value as string) ?? '',
      label: (c.label as string) ?? '',
      couleur: (c.couleur as string | null | undefined) ?? null,
    }))

    const carteReseaux: ReseauLite[] = reseauxDocs.map((r) => ({
      id: r.id as number,
      slug: (r.slug as string) ?? '',
      nom: (r.nom as string) ?? '',
    }))

    return (
      <div className="relative">
        {/* Toggle flottant au-dessus de la carte */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[801] bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-[#e4e4e7] px-3 py-2">
          <Suspense fallback={null}>
            <EntiteVueToggle entite="reseauteurs" vue="carte" />
          </Suspense>
        </div>
        <MapReseauteursLoader
          initialData={initialData}
          initialSlug={null}
          categories={carteCategories}
          reseaux={carteReseaux}
        />
      </div>
    )
  }

  // ─── VUE ANNUAIRE (défaut) ──────────────────────────────────────────────────
  const where = buildWhere(sp)

  const { docs: reseauteursRaw, totalDocs, totalPages } = await withDbRetry(
    () =>
      payload.find({
        collection: 'reseauteurs',
        where,
        depth: 1,
        limit: PAGE_SIZE,
        page,
        sort: '-createdAt',
        overrideAccess: true,
      }),
    { label: 'reseauteurs:find annuaire' },
  )

  const docs = sp.reseau
    ? (reseauteursRaw as Reseauteur[]).filter((r) => {
        const rels = r.reseauxFrequentes as Array<Reseau | number> | null | undefined
        return rels?.some((rel) => typeof rel === 'object' && rel.slug === sp.reseau)
      })
    : (reseauteursRaw as Reseauteur[])

  return (
    <div className="bg-[#faf9f5] min-h-screen">
      {/* Barre de navigation entité + vue */}
      <div className="bg-white border-b border-[#e4e4e7] px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <Suspense fallback={null}>
          <EntiteVueToggle entite="reseauteurs" vue="annuaire" />
        </Suspense>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#16284f] mb-1 flex items-center gap-2">
            <Users size={22} className="text-[#2563EB]" aria-hidden />
            Réseauteurs
          </h1>
          <p className="text-sm text-[#71717a]">
            {totalDocs > 0
              ? `${totalDocs.toLocaleString('fr-FR')} réseauteur${totalDocs > 1 ? 's' : ''} référencé${totalDocs > 1 ? 's' : ''}`
              : 'Aucun réseauteur pour l\'instant'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Panneau filtres */}
          <aside className="lg:w-64 shrink-0" aria-label="Filtres de recherche">
            <Suspense
              fallback={
                <div className="h-64 rounded-2xl bg-white border border-[#e4e4e7] animate-pulse" />
              }
            >
              <ReseauteursFilters reseaux={reseauxListe} categories={categoriesListe} />
            </Suspense>
          </aside>

          {/* Résultats */}
          <section className="flex-1 min-w-0" aria-label="Résultats de recherche">
            {docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#e4e4e7] p-12 text-center">
                <Users size={32} className="text-[#d4d4d8] mx-auto mb-4" aria-hidden />
                <p className="text-sm font-medium text-[#52525b] mb-2">
                  Aucun réseauteur ne correspond à ces critères
                </p>
                <p className="text-sm text-[#71717a] mb-4">
                  Vous êtes professionnel et vous réseautez ? Soyez le premier dans votre zone.
                </p>
                <Link
                  href="/inscription"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors no-underline"
                >
                  Créer mon profil — gratuit
                </Link>
              </div>
            ) : (
              <>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                  role="list"
                  aria-label="Liste des réseauteurs"
                >
                  {docs.map((r) => {
                    const photoMedia = r.photo as Media | null | undefined
                    const photoUrl = photoMedia?.sizes?.thumbnail?.url ?? photoMedia?.url
                    return (
                      <article key={r.id} role="listitem">
                        <Link
                          href={`/reseauteur/${r.slug}`}
                          className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-[#e4e4e7] hover:shadow-md hover:-translate-y-0.5 hover:border-[#2563EB]/30 transition-all no-underline h-full group"
                        >
                          <div className="flex items-start gap-3">
                            {photoUrl ? (
                              <Image
                                src={photoUrl}
                                alt={`Photo de profil de ${r.prenom} ${r.nom}`}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-xl object-cover border border-[#e4e4e7] shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-[#bfdbfe]/30 flex items-center justify-center text-[#2563EB] font-bold shrink-0" aria-hidden>
                                {r.prenom.charAt(0)}
                                {r.nom.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#16284f] leading-tight group-hover:text-[#2563EB] transition-colors">
                                {r.prenom} {r.nom}
                              </p>
                              {r.fonction && (
                                <p className="text-xs text-[#52525b] truncate">{r.fonction}</p>
                              )}
                              {r.entreprise && (
                                <p className="text-xs text-[#71717a] truncate">{r.entreprise}</p>
                              )}
                            </div>
                            {r.badge && <BadgeReseauteur badge={r.badge} size="sm" />}
                          </div>
                          {r.ville && (
                            <p className="text-xs text-[#71717a] flex items-center gap-1">
                              <MapPin size={11} aria-hidden />
                              {r.ville}
                              {r.departement ? `, ${r.departement}` : ''}
                            </p>
                          )}
                        </Link>
                      </article>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                    {page > 1 && (
                      <Link
                        href={`/reseauteurs?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}
                        className="px-4 py-2 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] no-underline transition-colors"
                        aria-label="Page précédente"
                      >
                        ← Précédente
                      </Link>
                    )}
                    <span className="text-sm text-[#71717a]">
                      Page {page} / {totalPages}
                    </span>
                    {page < totalPages && (
                      <Link
                        href={`/reseauteurs?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}
                        className="px-4 py-2 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] no-underline transition-colors"
                        aria-label="Page suivante"
                      >
                        Suivante →
                      </Link>
                    )}
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
