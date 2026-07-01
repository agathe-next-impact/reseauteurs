/**
 * Page « Réseaux » — /reseaux
 *
 * ADR-0012 §7 : landing page self-canonical (même composant que /reseauteurs, entité présélectionnée = réseaux).
 * - Bascule entité : /reseauteurs ↔ /reseaux.
 * - Bascule vue : ?vue=annuaire (défaut) | carte.
 *
 * Vue annuaire : **réseaux NATIONAUX** (logo + compteurs agrégés SSR = somme des locaux — Q7 ADR-0012).
 *                Recherche par nom. Filtre par national (dans la carte, piloté par MapReseauxLoader).
 * Vue carte    : **réseaux LOCAUX** via MapReseauxLoader. Nationaux = filtre dans le panneau de la carte.
 *
 * Canonical : /reseaux (seo-canonical, sans params).
 */
import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Network, Users, Calendar } from 'lucide-react'
import { buildTogglePageMetadata } from '@/lib/seo-canonical'
import { withDbRetry } from '@/lib/db-retry'
import { BadgePartenaire } from '@/components/ui/BadgeReseauteur'
import { toFeatureCollection, toFeature } from '@/lib/geojson'
import { SITE_NAME } from '@/lib/site'
import type { Metadata } from 'next'
import type { Reseau, Media } from '@/types/reseauteurs-domain'
import type { Where } from 'payload'
import type { NationalLite } from '@/components/filters/FiltresReseaux'
import EntiteVueToggle from '@/components/explore/EntiteVueToggle'
import MapReseauxLoader from '@/components/maps/MapReseauxLoader'
import ReseauxSearch from '@/components/search/ReseauxSearch'

export const revalidate = 120

export async function generateMetadata(): Promise<Metadata> {
  return buildTogglePageMetadata('/reseaux', {
    title: `Réseaux d'affaires — BNI, DCF, CJD et tous les réseaux | ${SITE_NAME}`,
    description:
      'Tous les réseaux d\'affaires et leurs chapitres locaux sur RÉSEAUTEURS : BNI, DCF, CJD, Dynabuy, Rotary, CPME… Explorez en annuaire ou sur la carte.',
  })
}

interface SearchParams {
  vue?: string
  q?: string
  page?: string
}

const PAGE_SIZE = 24

export default async function ReseauxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const vue = sp.vue === 'carte' ? 'carte' : 'annuaire'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const payload = await getPayload({ config })

  // ─── VUE CARTE ─────────────────────────────────────────────────────────────
  // Marqueurs = réseaux LOCAUX ; nationaux = filtre dans MapReseauxLoader
  if (vue === 'carte') {
    const [{ docs: locauxDocs }, { docs: nationalsDocs }] = await Promise.all([
      withDbRetry(
        () =>
          payload.find({
            collection: 'reseaux',
            where: {
              and: [
                { statut: { equals: 'publiee' } },
                { niveau: { equals: 'local' } },
                { latitude: { exists: true } },
                { longitude: { exists: true } },
              ],
            } as Where,
            depth: 0,
            limit: 5000,
            overrideAccess: true,
            select: {
              slug: true,
              nom: true,
              ville: true,
              latitude: true,
              longitude: true,
              parent: true,
            } as Record<string, boolean>,
          }),
        { label: 'reseaux-carte:locaux' },
      ),
      withDbRetry(
        () =>
          payload.find({
            collection: 'reseaux',
            where: {
              and: [
                { statut: { equals: 'publiee' } },
                { niveau: { equals: 'national' } },
              ],
            } as Where,
            depth: 0,
            limit: 500,
            sort: 'nom',
            overrideAccess: true,
            select: { id: true, slug: true, nom: true } as Record<string, boolean>,
          }),
        { label: 'reseaux-carte:nationals' },
      ),
    ])

    const features = locauxDocs
      .filter((doc) => doc.latitude != null && doc.longitude != null)
      .map((doc) => {
        const parentId =
          typeof doc.parent === 'object'
            ? ((doc.parent as unknown as Record<string, unknown>)?.id ?? null)
            : (doc.parent ?? null)
        return toFeature(doc.longitude as number, doc.latitude as number, {
          slug: (doc.slug as string | null | undefined) ?? null,
          nom: (doc.nom as string | undefined) ?? '',
          ville: (doc.ville as string | null | undefined) ?? null,
          parentId: parentId != null ? String(parentId) : null,
        })
      })

    const initialData = toFeatureCollection(features)

    const nationals: NationalLite[] = nationalsDocs.map((n) => ({
      id: n.id as number,
      slug: (n.slug as string) ?? '',
      nom: (n.nom as string) ?? '',
    }))

    return (
      <div className="relative">
        {/* Toggle flottant au-dessus de la carte */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[801] bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-[#e4e4e7] px-3 py-2">
          <Suspense fallback={null}>
            <EntiteVueToggle entite="reseaux" vue="carte" />
          </Suspense>
        </div>
        <MapReseauxLoader initialData={initialData} initialSlug={null} nationals={nationals} />
      </div>
    )
  }

  // ─── VUE ANNUAIRE (défaut) ──────────────────────────────────────────────────
  // Affiche les NATIONAUX + compteurs agrégés (somme des locaux — Q7 ADR-0012)
  const whereNationaux: Where = {
    and: [
      { statut: { equals: 'publiee' } },
      { niveau: { equals: 'national' } },
      ...(sp.q ? [{ nom: { contains: sp.q } } as Where] : []),
    ],
  }

  const [{ docs: nationauxRaw, totalDocs, totalPages }, { docs: locauxRaw }] = await Promise.all([
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: whereNationaux,
          depth: 1,
          limit: PAGE_SIZE,
          page,
          sort: '-partenaire,nom',
          overrideAccess: true,
        }),
      { label: 'reseaux-annuaire:nationals' },
    ),
    // Charge tous les locaux pour agréger les compteurs (Q7 : calcul SSR, pas de hook stocké)
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
          limit: 10000,
          overrideAccess: true,
          select: {
            parent: true,
            nbReseauteurs: true,
            nbEvenements: true,
          } as Record<string, boolean>,
        }),
      { label: 'reseaux-annuaire:locaux-count' },
    ),
  ])

  // Agrégation SSR : compteurs par national (Q7)
  type AggEntry = { nbReseauteurs: number; nbEvenements: number; nbLocaux: number }
  const aggregates: Record<string, AggEntry> = {}
  for (const local of locauxRaw) {
    const pid =
      typeof local.parent === 'object'
        ? ((local.parent as unknown as Record<string, unknown>)?.id ?? null)
        : (local.parent ?? null)
    if (!pid) continue
    const key = String(pid)
    if (!aggregates[key]) aggregates[key] = { nbReseauteurs: 0, nbEvenements: 0, nbLocaux: 0 }
    aggregates[key].nbReseauteurs += (local.nbReseauteurs as number | null | undefined) ?? 0
    aggregates[key].nbEvenements += (local.nbEvenements as number | null | undefined) ?? 0
    aggregates[key].nbLocaux += 1
  }

  const nationaux = nationauxRaw as Reseau[]

  return (
    <div className="bg-[#faf9f5] min-h-screen">
      {/* Barre de navigation entité + vue */}
      <div className="bg-white border-b border-[#e4e4e7] px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <Suspense fallback={null}>
          <EntiteVueToggle entite="reseaux" vue="annuaire" />
        </Suspense>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#16284f] mb-1 flex items-center gap-2">
            <Network size={22} className="text-[#f5851f]" aria-hidden />
            Réseaux d&apos;affaires
          </h1>
          <p className="text-sm text-[#71717a]">
            {totalDocs > 0
              ? `${totalDocs.toLocaleString('fr-FR')} réseau${totalDocs > 1 ? 'x' : ''} national${totalDocs > 1 ? 'aux' : ''} référencé${totalDocs > 1 ? 's' : ''}`
              : 'Aucun réseau pour l\'instant'}
          </p>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6">
          <Suspense fallback={null}>
            <ReseauxSearch initialValue={sp.q ?? ''} />
          </Suspense>
        </div>

        {/* Grille des nationaux */}
        {nationaux.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#e4e4e7] p-12 text-center">
            <Network size={32} className="text-[#d4d4d8] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#52525b] mb-2">
              Aucun réseau ne correspond à cette recherche
            </p>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              role="list"
              aria-label="Réseaux d'affaires"
            >
              {nationaux.map((r) => {
                const logoMedia = r.logo as Media | null | undefined
                const logoUrl = logoMedia?.sizes?.card?.url ?? logoMedia?.url
                const agg = aggregates[String(r.id)] ?? {
                  nbReseauteurs: 0,
                  nbEvenements: 0,
                  nbLocaux: 0,
                }

                return (
                  <article key={r.id} role="listitem">
                    <Link
                      href={`/reseau/${r.slug}`}
                      className={`flex flex-col gap-4 p-5 bg-white rounded-2xl border hover:shadow-md hover:-translate-y-0.5 transition-all no-underline h-full group ${r.partenaire ? 'border-[#f5851f]/40' : 'border-[#e4e4e7]'}`}
                    >
                      <div className="flex items-start gap-3">
                        {logoUrl ? (
                          <Image
                            src={logoUrl}
                            alt={`Logo ${r.nom}`}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-xl object-contain border border-[#e4e4e7] bg-white p-0.5 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#ffedd5]/50 flex items-center justify-center text-[#f5851f] font-bold shrink-0" aria-hidden>
                            <Network size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#16284f] group-hover:text-[#2563EB] transition-colors truncate leading-tight">
                            {r.nom}
                          </p>
                          {r.partenaire && <BadgePartenaire className="mt-1" />}
                        </div>
                      </div>

                      {r.description && (
                        <p className="text-xs text-[#52525b] leading-relaxed line-clamp-2">
                          {r.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-auto pt-1">
                        <span className="flex items-center gap-1 text-xs text-[#71717a]">
                          <Users size={11} className="text-[#2563EB]" aria-hidden />
                          {agg.nbReseauteurs} réseauteur{agg.nbReseauteurs !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#71717a]">
                          <Calendar size={11} className="text-[#0284c7]" aria-hidden />
                          {agg.nbEvenements} événement{agg.nbEvenements !== 1 ? 's' : ''}
                        </span>
                        {agg.nbLocaux > 0 && (
                          <span className="flex items-center gap-1 text-xs text-[#71717a]">
                            <Network size={11} className="text-[#a855f7]" aria-hidden />
                            {agg.nbLocaux} chapitre{agg.nbLocaux !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </Link>
                  </article>
                )
              })}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/reseaux?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}
                    className="px-4 py-2 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#f5851f] hover:text-[#f5851f] no-underline transition-colors"
                    aria-label="Page précédente"
                  >
                    ← Précédente
                  </Link>
                )}
                <span className="text-sm text-[#71717a]">Page {page} / {totalPages}</span>
                {page < totalPages && (
                  <Link
                    href={`/reseaux?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}
                    className="px-4 py-2 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#f5851f] hover:text-[#f5851f] no-underline transition-colors"
                    aria-label="Page suivante"
                  >
                    Suivante →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}
