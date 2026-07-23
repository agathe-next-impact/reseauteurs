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
import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Network, Users, Calendar } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { buildTogglePageMetadata } from '@/lib/seo-canonical'
import { withDbRetry } from '@/lib/db-retry'
import { BadgePartenaire } from '@/components/ui/BadgeReseauteur'
import { ContactChips } from '@/components/fiche/ContactChips'
import { toFeatureCollection, toFeature } from '@/lib/geojson'
import { SITE_NAME } from '@/lib/site'
import type { Metadata } from 'next'
import type { Reseau, Media } from '@/types/reseauteurs-domain'
import type { Where } from 'payload'
import type { NationalLite } from '@/components/filters/FiltresReseaux'
import EntiteVueToggle from '@/components/explore/EntiteVueToggle'
import MapReseauxLoader from '@/components/maps/MapReseauxLoader'
import ReseauxSearch from '@/components/search/ReseauxSearch'
import CTAInscrireReseau from '@/components/cta/CTAInscrireReseau'

export const revalidate = 120

export async function generateMetadata(): Promise<Metadata> {
  return buildTogglePageMetadata('/reseaux', {
    title: `Réseaux d'affaires — BNI, DCF, CJD et tous les réseaux | ${SITE_NAME}`,
    description:
      'Tous les réseaux d\'affaires et leurs groupes locaux sur RÉSEAUTEURS : BNI, DCF, CJD, Dynabuy, Rotary, CPME… Explorez en annuaire ou sur la carte.',
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
            limit: 1500, // SSR borné — la carte recharge par bbox sur déplacement
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
                { niveau: { not_equals: 'local' } },
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
      <MapReseauxLoader
        initialData={initialData}
        initialSlug={null}
        nationals={nationals}
        toolbar={
          <Suspense fallback={null}>
            <EntiteVueToggle entite="reseaux" vue="carte" />
          </Suspense>
        }
      />
    )
  }

  // ─── VUE ANNUAIRE (défaut) ──────────────────────────────────────────────────
  // Affiche les NATIONAUX + compteurs agrégés (somme des locaux — Q7 ADR-0012)
  const whereNationaux: Where = {
    and: [
      { statut: { equals: 'publiee' } },
      { niveau: { not_equals: 'local' } },
      ...(sp.q ? [{ nom: { contains: sp.q } } as Where] : []),
    ],
  }

  const { docs: nationauxRaw, totalDocs, totalPages } = await withDbRetry(
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
  )

  const nationaux = nationauxRaw as Reseau[]

  // Agrégation SSR des compteurs des groupes locaux (Q7) — SQL GROUP BY borné aux
  // têtes de la PAGE COURANTE (remplace un fetch-all `limit: 10000` + somme JS).
  type AggEntry = { nbReseauteurs: number; nbEvenements: number; nbLocaux: number }
  const aggregates: Record<string, AggEntry> = {}
  const nationalIds = nationaux.map((n) => Number(n.id)).filter((n) => Number.isFinite(n))
  if (nationalIds.length > 0) {
    const drizzle = payload.db.drizzle as unknown as {
      execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
    }
    const res = await withDbRetry(
      () =>
        drizzle.execute(sql`
          SELECT parent_id,
                 COUNT(*)::int                        AS nb_locaux,
                 COALESCE(SUM(nb_reseauteurs), 0)::int AS nb_reseauteurs,
                 COALESCE(SUM(nb_evenements), 0)::int  AS nb_evenements
            FROM reseaux
           WHERE statut = 'publiee' AND niveau = 'local' AND parent_id IN ${nationalIds}
           GROUP BY parent_id
        `.inlineParams()),
      { label: 'reseaux-annuaire:agg' },
    )
    for (const row of res.rows) {
      aggregates[String(row.parent_id)] = {
        nbReseauteurs: Number(row.nb_reseauteurs) || 0,
        nbEvenements: Number(row.nb_evenements) || 0,
        nbLocaux: Number(row.nb_locaux) || 0,
      }
    }
  }

  return (
    <div className="rsn-page min-h-screen">
      {/* Barre de navigation entité + vue */}
      <div className="bg-white border-b border-[#DFE0E1] px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <Suspense fallback={null}>
          <EntiteVueToggle entite="reseaux" vue="annuaire" />
        </Suspense>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* En-tête */}
        <Reveal className="mb-6">
          <p className="rsn-eyebrow rsn-pagehead-eyebrow--orange mb-2">
            <Network size={13} aria-hidden />
            Annuaire des réseaux
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#012A4A] mb-1">
            Réseaux d&apos;affaires
          </h1>
          <p className="text-sm text-[#6E7175]">
            {totalDocs > 0
              ? `${totalDocs.toLocaleString('fr-FR')} réseau${totalDocs > 1 ? 'x' : ''} ${totalDocs > 1 ? 'nationaux' : 'national'} référencé${totalDocs > 1 ? 's' : ''}`
              : 'Aucun réseau pour l\'instant'}
          </p>
        </Reveal>

        {/* Barre de recherche */}
        <div className="mb-6">
          <Suspense fallback={null}>
            <ReseauxSearch initialValue={sp.q ?? ''} />
          </Suspense>
        </div>

        {/* Grille des nationaux */}
        {nationaux.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#DFE0E1] p-12 text-center">
            <Network size={32} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#4E5155] mb-2">
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
                  <article
                    key={r.id}
                    role="listitem"
                    // Le cadre porte le style de carte (et non le <Link>) : les coordonnées
                    // restent DANS la carte tout en étant des liens frères — un <a> dans
                    // un <a> est invalide.
                    className={`flex flex-col bg-white border rsn-lift h-full group ${r.partenaire ? 'border-[#F5E050]/40' : 'border-[#DFE0E1]'}`}
                  >
                    <Link
                      href={`/reseau/${r.slug}`}
                      className="flex flex-col gap-4 p-5 pb-0 no-underline flex-1"
                    >
                      <div className="flex items-start gap-3">
                        {logoUrl ? (
                          <Image
                            src={logoUrl}
                            alt={`Logo ${r.nom}`}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-xl object-contain border border-[#DFE0E1] bg-white p-0.5 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center text-[#8A6D0B] font-bold shrink-0" aria-hidden>
                            <Network size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#012A4A] group-hover:text-[#035AA6] transition-colors truncate leading-tight">
                            {r.nom}
                          </p>
                          {r.partenaire && <BadgePartenaire className="mt-1" />}
                        </div>
                      </div>

                      {r.description && (
                        <p className="text-xs text-[#4E5155] leading-relaxed line-clamp-2">
                          {r.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-auto pt-1">
                        <span className="flex items-center gap-1 text-xs text-[#6E7175]">
                          <Users size={11} className="text-[#035AA6]" aria-hidden />
                          {agg.nbReseauteurs} réseauteur{agg.nbReseauteurs !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#6E7175]">
                          <Calendar size={11} className="text-[#8A6D0B]" aria-hidden />
                          {agg.nbEvenements} événement{agg.nbEvenements !== 1 ? 's' : ''}
                        </span>
                        {agg.nbLocaux > 0 && (
                          <span className="flex items-center gap-1 text-xs text-[#6E7175]">
                            <Network size={11} className="text-[#3E7CA6]" aria-hidden />
                            {agg.nbLocaux} groupe{agg.nbLocaux !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </Link>
                    {/* Coordonnées — hors du <Link> (pas d'<a> imbriqué) */}
                    <ContactChips
                      email={r.emailContact}
                      telephone={r.telephone}
                      site={r.siteWeb}
                      entityName={r.nom}
                      className="px-5 pt-3 pb-5"
                    />
                  </article>
                )
              })}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/reseaux?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}
                    className="p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:border-[#F5E050] hover:text-[#8A6D0B] no-underline transition-colors"
                    aria-label="Page précédente"
                  >
                    ← Précédente
                  </Link>
                )}
                <span className="text-sm text-[#6E7175]">Page {page} / {totalPages}</span>
                {page < totalPages && (
                  <Link
                    href={`/reseaux?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}
                    className="p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:border-[#F5E050] hover:text-[#8A6D0B] no-underline transition-colors"
                    aria-label="Page suivante"
                  >
                    Suivante →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}

        {/* Référencer un réseau absent de l'annuaire — affiché aussi quand la
            recherche ne renvoie rien : c'est précisément là qu'on le cherche. */}
        <Reveal>
          <div className="mt-12 border-t border-[#DFE0E1] pt-8">
            <CTAInscrireReseau />
          </div>
        </Reveal>
      </div>
    </div>
  )
}
