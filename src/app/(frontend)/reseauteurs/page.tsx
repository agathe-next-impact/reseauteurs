/**
 * Page « Réseauteurs » — /reseauteurs
 *
 * ADR-0012 §7 : landing page self-canonical.
 * - Bascule entité : /reseauteurs ↔ /reseaux (navigation entre deux pages).
 * - Bascule vue : ?vue=carte (défaut) | annuaire — synchronisée avec l'URL.
 * - Filtres : nom, ville, dept, région, badge, réseau, secteur — profonds-linkables.
 *
 * Vue annuaire : filtre + grille de cartes profil.
 * Vue carte    : MapReseauteursLoader (même data que /carte/reseauteurs) avec toggle overlay.
 *
 * Canonical : /reseauteurs — les params ?vue/filtres ne sont PAS canonicalisés (seo-canonical).
 */
import { Suspense } from 'react'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
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
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { Reseauteur, Media, Categorie } from '@/types/reseauteurs-domain'
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

/** Borne de l'amorce SSR de la carte — la carte recharge par bbox au-delà. */
const CARTE_SSR_LIMIT = 1500

/**
 * Amorce SSR de la vue carte (vue France, aucun filtre) — identique pour tous les
 * visiteurs. La page est rendue dynamiquement (searchParams) : sans ce cache, chaque
 * affichage payait 3 requêtes Neon avant le premier octet (audit perf cartes H1).
 * `initialComplete` indique au client si le refetch bbox initial est nécessaire.
 */
const getCarteReseauteursInitial = unstable_cache(
  async () => {
    const payload = await getPayload({ config })

    const [reseauteursRes, { docs: categoriesDocs }, { docs: reseauxDocs }] =
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
              limit: CARTE_SSR_LIMIT,
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

    const features = reseauteursRes.docs
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

    const categories: CategoryLite[] = categoriesDocs.map((c) => ({
      id: c.id as number,
      value: (c.value as string) ?? '',
      label: (c.label as string) ?? '',
      couleur: (c.couleur as string | null | undefined) ?? null,
    }))

    const reseaux: ReseauLite[] = reseauxDocs.map((r) => ({
      id: r.id as number,
      slug: (r.slug as string) ?? '',
      nom: (r.nom as string) ?? '',
    }))

    return {
      initialData: toFeatureCollection(features),
      categories,
      reseaux,
      initialComplete: reseauteursRes.totalDocs <= CARTE_SSR_LIMIT,
    }
  },
  ['carte-reseauteurs-initial'],
  { revalidate: 120 },
)

function buildWhere(sp: SearchParams, reseauFilterIds?: number[] | null): Where {
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
  // Filtre réseau : réseauteurs fréquentant l'un des groupes ciblés (résolu côté page,
  // le slug pouvant désigner un groupe local OU une tête → ses groupes). Liste vide
  // (slug inconnu / tête sans groupe) → sentinelle -1 pour garantir zéro résultat.
  if (reseauFilterIds) {
    conditions.push({ reseauxFrequentes: { in: reseauFilterIds.length ? reseauFilterIds : [-1] } } as Where)
  }

  return { and: conditions }
}

export default async function ReseauteursPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  // Vue par défaut = carte (URL sans param). L'annuaire reste accessible via ?vue=annuaire.
  const vue = sp.vue === 'annuaire' ? 'annuaire' : 'carte'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))

  // ─── VUE CARTE ─────────────────────────────────────────────────────────────
  // Données servies depuis le cache (unstable_cache, revalidate 120 s) : aucune
  // requête DB sur le chemin critique du rendu.
  if (vue === 'carte') {
    const { initialData, categories, reseaux, initialComplete } =
      await getCarteReseauteursInitial()

    return (
      <MapReseauteursLoader
        initialData={initialData}
        initialSlug={null}
        initialComplete={initialComplete}
        categories={categories}
        reseaux={reseaux}
        toolbar={
          <Suspense fallback={null}>
            <EntiteVueToggle entite="reseauteurs" vue="carte" />
          </Suspense>
        }
      />
    )
  }

  // ─── VUE ANNUAIRE ───────────────────────────────────────────────────────────
  const payload = await getPayload({ config })

  // Référentiels des filtres en parallèle : catégories (secteur) + réseaux
  // (têtes + groupes publiés).
  const [{ docs: categories }, { docs: reseauxFiltreDocs }] = await Promise.all([
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
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: { statut: { equals: 'publiee' } } as Where,
          select: { slug: true, nom: true } as Record<string, boolean>,
          depth: 0,
          limit: 500,
          sort: 'nom',
          overrideAccess: true,
        }),
      { label: 'reseauteurs-annuaire:reseaux' },
    ),
  ])

  const categoriesListe = (categories as Categorie[]).map((c) => ({ id: c.id, label: c.label ?? '' }))
  const reseauxListe = reseauxFiltreDocs
    .map((r) => ({ slug: (r.slug as string) ?? '', nom: (r.nom as string) ?? '' }))
    .filter((r) => r.slug)

  // Résolution du filtre réseau : un réseauteur fréquente des GROUPES locaux.
  // slug local → ce groupe ; slug tête → ses groupes ; slug inconnu → aucun résultat.
  let reseauFilterIds: number[] | null = null
  if (sp.reseau) {
    const { docs: rsel } = await payload.find({
      collection: 'reseaux',
      where: { slug: { equals: sp.reseau } } as Where,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: { niveau: true } as Record<string, boolean>,
    })
    const r = rsel[0]
    if (!r) {
      reseauFilterIds = []
    } else if ((r.niveau as string) === 'local') {
      reseauFilterIds = [Number(r.id)]
    } else {
      const { docs: locaux } = await payload.find({
        collection: 'reseaux',
        where: { and: [{ parent: { equals: r.id } }, { niveau: { equals: 'local' } }] } as Where,
        depth: 0,
        limit: 500,
        overrideAccess: true,
        select: { id: true } as Record<string, boolean>,
      })
      reseauFilterIds = [Number(r.id), ...locaux.map((l) => Number(l.id))]
    }
  }

  const where = buildWhere(sp, reseauFilterIds)

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

  const docs = reseauteursRaw as Reseauteur[]

  return (
    <div className="rsn-page min-h-screen">
      {/* Barre de navigation entité + vue */}
      <div className="bg-white border-b border-[#e4e4e7] px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <Suspense fallback={null}>
          <EntiteVueToggle entite="reseauteurs" vue="annuaire" />
        </Suspense>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* En-tête */}
        <Reveal className="mb-6">
          <p className="rsn-eyebrow mb-2">
            <Users size={13} aria-hidden />
            Annuaire des réseauteurs
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#16284f] mb-1">
            Réseauteurs
          </h1>
          <p className="text-sm text-[#71717a]">
            {totalDocs > 0
              ? `${totalDocs.toLocaleString('fr-FR')} réseauteur${totalDocs > 1 ? 's' : ''} référencé${totalDocs > 1 ? 's' : ''}`
              : 'Aucun réseauteur pour l\'instant'}
          </p>
        </Reveal>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Panneau filtres */}
          <aside className="lg:w-64 shrink-0" aria-label="Filtres de recherche">
            <Suspense
              fallback={
                <div className="h-64 rounded-2xl bg-white border border-[#e4e4e7] animate-pulse" />
              }
            >
              <ReseauteursFilters categories={categoriesListe} reseaux={reseauxListe} />
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
                <Reveal>
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
                            className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-[#e4e4e7] hover:border-[#2563EB]/30 no-underline h-full group rsn-lift"
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
                </Reveal>

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
