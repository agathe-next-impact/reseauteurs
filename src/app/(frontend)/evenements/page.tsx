/**
 * Page « Événements » — /evenements
 *
 * ADR-0012 §7 : landing page self-canonical.
 * - Bascule vue : ?vue=carte (défaut) | agenda.
 * - Filtres : réseau (slug), ville, date — deep-linkables.
 * - ADR-0012 : suppression de l'événement Premium — aucun marqueur/badge Premium.
 *
 * Vue agenda : grille d'événements filtrée.
 * Vue carte  : MapEvenementsReseauteursLoader avec toggle overlay.
 *
 * Canonical : /evenements (seo-canonical, sans params).
 */
import { Suspense } from 'react'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, ExternalLink } from 'lucide-react'
import { buildTogglePageMetadata } from '@/lib/seo-canonical'
import { withDbRetry } from '@/lib/db-retry'
import { toFeatureCollection, toFeature } from '@/lib/geojson'
import { todayParisDateString } from '@/lib/dates'
import { SITE_NAME } from '@/lib/site'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { EvenementRsn as Evenement, Media, Reseau } from '@/types/reseauteurs-domain'
import type { Where } from 'payload'
import type { ReseauLiteFilter } from '@/components/filters/FiltresEvenementsReseauteurs'
import EntiteVueToggle from '@/components/explore/EntiteVueToggle'
import MapEvenementsReseauteursLoader from '@/components/maps/MapEvenementsReseauteursLoader'
import EvenementsClientFilters from '@/components/search/EvenementsClientFilters'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return buildTogglePageMetadata('/evenements', {
    title: `Événements networking — Agenda et carte des rendez-vous business | ${SITE_NAME}`,
    description:
      'Trouvez les prochains événements de networking près de chez vous : afterworks, petits-déjeuners, conférences par ville, réseau et date.',
  })
}

interface SearchParams {
  vue?: string
  ville?: string
  departement?: string
  type?: string
  tarification?: string
  reseau?: string
  dateDebut?: string
  dateFin?: string
  /** @deprecated alias historique — conservé pour les liens existants */
  date?: string
  page?: string
}

const PAGE_SIZE = 24

/** Borne de l'amorce SSR de la carte — la carte recharge par bbox au-delà. */
const CARTE_SSR_LIMIT = 800

/**
 * Amorce SSR de la vue carte (vue France, aucun filtre) — identique pour tous les
 * visiteurs. La page est rendue dynamiquement (searchParams) : sans ce cache, chaque
 * affichage payait 3 requêtes Neon séquentielles avant le premier octet (audit perf
 * cartes H1). `initialComplete` indique au client si le refetch bbox est nécessaire.
 */
const getCarteEvenementsInitial = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const todayStart = new Date(`${todayParisDateString()}T00:00:00.000Z`)

    const [evenementsRes, { docs: reseauxDocs }] = await Promise.all([
      withDbRetry(
        () =>
          payload.find({
            collection: 'evenements',
            where: {
              and: [
                { statut: { equals: 'publie' } },
                { lieuLatitude: { exists: true } },
                { lieuLongitude: { exists: true } },
                {
                  or: [
                    { dateFin: { greater_than_equal: todayStart.toISOString() } },
                    {
                      and: [
                        { dateFin: { exists: false } },
                        { dateDebut: { greater_than_equal: todayStart.toISOString() } },
                      ],
                    },
                  ],
                },
              ],
            },
            depth: 1,
            // Ne rapatrie que nom+slug du réseau organisateur (le doc complet
            // — présentation, fonctionnement… — alourdissait chaque événement).
            // Réseauteur organisateur réduit au slug : seul le discriminant compte.
            populate: { reseaux: { nom: true, slug: true }, reseauteurs: { slug: true } },
            limit: CARTE_SSR_LIMIT,
            overrideAccess: true,
            select: {
              slug: true,
              titre: true,
              dateDebut: true,
              dateFin: true,
              lieuVille: true,
              lieuLatitude: true,
              lieuLongitude: true,
              lienInscription: true,
              reseau: true,
              organisateurReseauteur: true,
            } as Record<string, boolean>,
          }),
        { label: 'evenements-carte:find' },
      ),
      withDbRetry(
        () =>
          payload.find({
            collection: 'reseaux',
            where: { statut: { equals: 'publiee' } },
            select: { nom: true, slug: true } as Record<string, boolean>,
            depth: 0,
            limit: 200,
            sort: 'nom',
            overrideAccess: true,
          }),
        { label: 'evenements-carte:reseaux' },
      ),
    ])

    type ReseauLiteDoc = { id: number | string; slug?: string | null; nom?: string | null }

    const features = evenementsRes.docs
      .filter((doc) => doc.lieuLatitude != null && doc.lieuLongitude != null)
      .map((doc) => {
        const reseauDoc = doc.reseau as ReseauLiteDoc | null | undefined
        return toFeature(doc.lieuLongitude as number, doc.lieuLatitude as number, {
          slug: doc.slug ?? null,
          titre: (doc.titre as string | undefined) ?? null,
          dateDebut: (doc.dateDebut as string | undefined) ?? null,
          lieuVille: (doc.lieuVille as string | undefined) ?? null,
          lienInscription: (doc.lienInscription as string | null | undefined) ?? null,
          reseauNom: reseauDoc?.nom ?? null,
          reseauSlug: reseauDoc?.slug ?? null,
          // Discriminant XOR (ADR-0013) : couleur du marqueur réseau vs réseauteur Plus
          organisateur: doc.organisateurReseauteur != null ? 'reseauteur' : 'reseau',
        })
      })

    const reseauxFiltres: ReseauLiteFilter[] = reseauxDocs.map((r) => ({
      id: r.id as number,
      slug: (r.slug as string) ?? '',
      nom: (r.nom as string) ?? '',
    }))

    return {
      initialData: toFeatureCollection(features),
      reseauxFiltres,
      initialComplete: evenementsRes.totalDocs <= CARTE_SSR_LIMIT,
    }
  },
  ['carte-evenements-initial'],
  { revalidate: 120 },
)

function buildAgendaWhere(sp: SearchParams, reseauId?: number | null): Where {
  const conditions: Where[] = [{ statut: { equals: 'publie' } }]
  if (sp.ville) conditions.push({ lieuVille: { contains: sp.ville } })
  // Filtres spec 2026-07-13 : département, type (par slug de `types-evenement`), gratuit/payant
  if (sp.departement) conditions.push({ lieuDepartement: { contains: sp.departement } })
  if (sp.type) conditions.push({ 'type.value': { equals: sp.type } })
  if (sp.tarification === 'gratuit') conditions.push({ gratuit: { equals: true } })
  if (sp.tarification === 'payant') conditions.push({ gratuit: { equals: false } })
  // Filtre réseau poussé en SQL (id résolu depuis le slug) — la pagination reste exacte.
  // reseauId === -1 : slug fourni mais inconnu → aucun résultat (au lieu de filtrer en JS après coup).
  if (reseauId != null) conditions.push({ reseau: { equals: reseauId } })

  const start = sp.dateDebut ?? sp.date
  if (start) {
    conditions.push({ dateDebut: { greater_than_equal: new Date(start).toISOString() } })
  } else {
    conditions.push({ dateDebut: { greater_than_equal: new Date().toISOString() } })
  }
  if (sp.dateFin) {
    const end = new Date(sp.dateFin)
    end.setHours(23, 59, 59, 999)
    conditions.push({ dateDebut: { less_than_equal: end.toISOString() } })
  }
  return { and: conditions }
}

export default async function EvenementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  // Vue par défaut = carte (URL sans param). L'agenda reste accessible via ?vue=agenda.
  const vue = sp.vue === 'agenda' ? 'agenda' : 'carte'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))

  // ─── VUE CARTE ─────────────────────────────────────────────────────────────
  // ADR-0012 : un seul type de marqueur (Premium supprimé). Données servies depuis
  // le cache (unstable_cache, revalidate 120 s) : aucune requête DB sur le chemin
  // critique du rendu.
  if (vue === 'carte') {
    const { initialData, reseauxFiltres, initialComplete } = await getCarteEvenementsInitial()

    return (
      <MapEvenementsReseauteursLoader
        initialData={initialData}
        initialSlug={null}
        initialComplete={initialComplete}
        reseaux={reseauxFiltres}
        toolbar={
          <Suspense fallback={null}>
            <EntiteVueToggle entite="evenements" vue="carte" />
          </Suspense>
        }
      />
    )
  }

  // ─── VUE AGENDA ─────────────────────────────────────────────────────────────
  const payload = await getPayload({ config })

  // Référentiels des filtres en parallèle : réseaux + types d'événement (spec 2026-07-13)
  const [{ docs: reseauxDocs }, { docs: typesDocs }] = await Promise.all([
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: { statut: { equals: 'publiee' } },
          select: { nom: true, slug: true } as Record<string, boolean>,
          depth: 0,
          limit: 200,
          sort: 'nom',
          overrideAccess: true,
        }),
      { label: 'evenements:find reseaux' },
    ),
    withDbRetry(
      () =>
        payload.find({
          collection: 'types-evenement',
          select: { label: true, value: true } as Record<string, boolean>,
          depth: 0,
          limit: 50,
          sort: 'ordre',
          overrideAccess: true,
        }),
      { label: 'evenements:find types' },
    ),
  ])

  const reseauxListe = (reseauxDocs as Reseau[]).map((r) => ({ slug: r.slug ?? '', nom: r.nom }))
  const reseauxFiltres: ReseauLiteFilter[] = reseauxDocs.map((r) => ({
    id: r.id as number,
    slug: (r.slug as string) ?? '',
    nom: (r.nom as string) ?? '',
  }))
  const typesListe = typesDocs.map((t) => ({
    value: (t.value as string) ?? '',
    label: (t.label as string) ?? '',
  })).filter((t) => t.value && t.label)

  // Slug réseau → id (résolu depuis les réseaux déjà chargés) ; -1 si slug inconnu.
  const reseauId = sp.reseau
    ? (reseauxFiltres.find((r) => r.slug === sp.reseau)?.id ?? -1)
    : null
  const where = buildAgendaWhere(sp, reseauId)

  const { docs: evenements, totalDocs, totalPages } = await withDbRetry(
    () =>
      payload.find({
        collection: 'evenements',
        where,
        depth: 1,
        limit: PAGE_SIZE,
        page,
        sort: 'dateDebut',
        overrideAccess: true,
      }),
    { label: 'evenements-agenda:find' },
  )

  const docs = evenements as Evenement[]

  return (
    <div className="rsn-page min-h-screen">
      {/* Barre de navigation + vue */}
      <div className="bg-white border-b border-[#DFE0E1] px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <Suspense fallback={null}>
          <EntiteVueToggle entite="evenements" vue="agenda" />
        </Suspense>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* En-tête */}
        <Reveal className="mb-6">
          <p className="rsn-eyebrow mb-2 text-[#8A6D0B]">
            <Calendar size={13} aria-hidden />
            Agenda des événements
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#012A4A] mb-1">
            Événements
          </h1>
          <p className="text-sm text-[#6E7175]">
            {totalDocs > 0
              ? `${totalDocs.toLocaleString('fr-FR')} événement${totalDocs > 1 ? 's' : ''} à venir`
              : 'Aucun événement pour l\'instant'}
          </p>
        </Reveal>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filtres */}
          <aside className="lg:w-64 shrink-0" aria-label="Filtres événements">
            <Suspense
              fallback={
                <div className="h-48 rounded-2xl bg-white border border-[#DFE0E1] animate-pulse" />
              }
            >
              <EvenementsClientFilters reseaux={reseauxListe} types={typesListe} />
            </Suspense>
          </aside>

          {/* Résultats */}
          <section className="flex-1 min-w-0" aria-label="Événements">
            {docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#DFE0E1] p-12 text-center">
                <Calendar size={32} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
                <p className="text-sm font-medium text-[#4E5155] mb-2">
                  Aucun événement ne correspond à ces critères
                </p>
                <p className="text-sm text-[#6E7175]">
                  Les événements à venir apparaîtront ici. Revenez bientôt !
                </p>
              </div>
            ) : (
              <>
                <Reveal>
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                    role="list"
                    aria-label="Liste des événements"
                  >
                    {docs.map((ev) => {
                      const imageMedia = ev.image as Media | null | undefined
                      const imageUrl = imageMedia?.sizes?.thumbnail?.url ?? imageMedia?.url
                      const reseau = ev.reseau as Reseau | null | undefined
                      // ADR-0013 : organisateur réseauteur (XOR avec reseau)
                      const orgRz =
                        typeof ev.organisateurReseauteur === 'object' && ev.organisateurReseauteur !== null
                          ? (ev.organisateurReseauteur as { slug?: string | null; prenom?: string; nom?: string })
                          : null
                      const dateStr = new Date(ev.dateDebut).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })

                      let lienSafe: string | null = null
                      if (ev.lienInscription) {
                        try {
                          const u = new URL(ev.lienInscription)
                          if (u.protocol === 'https:' || u.protocol === 'http:')
                            lienSafe = ev.lienInscription
                        } catch { /* ignore */ }
                      }

                      return (
                        <article
                          key={ev.id}
                          role="listitem"
                          className="bg-white rounded-2xl border border-[#DFE0E1] overflow-hidden rsn-lift"
                        >
                          {imageUrl ? (
                            <Link
                              href={`/evenement/${ev.slug}`}
                              className="block aspect-[2/1] overflow-hidden"
                              tabIndex={-1}
                              aria-hidden
                            >
                              <Image
                                src={imageUrl}
                                alt={`Bannière ${ev.titre}`}
                                width={400}
                                height={200}
                                className="w-full h-full object-cover"
                              />
                            </Link>
                          ) : (
                            <div
                              className="aspect-[2/1] bg-[#FBF4D3]"
                              aria-hidden
                            />
                          )}
                          <div className="p-4 flex flex-col gap-2">
                            <Link
                              href={`/evenement/${ev.slug}`}
                              className="text-sm font-bold text-[#012A4A] hover:text-[#8A6D0B] no-underline transition-colors leading-tight line-clamp-2"
                            >
                              {ev.titre}
                            </Link>
                            <div className="flex items-center gap-1.5 text-xs text-[#6E7175]">
                              <Calendar size={11} aria-hidden />
                              <time dateTime={ev.dateDebut}>{dateStr}</time>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-[#6E7175]">
                              <MapPin size={11} aria-hidden />
                              {ev.lieuVille}
                            </div>
                            {/* Ligne organisateur — accent par type (ADR-0013) :
                                navy = réseau · orange = réseauteur Plus (mêmes couleurs que la carte) */}
                            {reseau && (
                              <Link
                                href={`/reseau/${reseau.slug}`}
                                className="inline-flex items-center gap-1.5 text-xs text-[#4E5155] hover:text-[#8A6D0B] no-underline transition-colors font-medium"
                              >
                                <span className="w-2 h-2 rounded-full bg-[#012A4A] shrink-0" aria-hidden />
                                {reseau.nom}
                              </Link>
                            )}
                            {!reseau && orgRz && (
                              <Link
                                href={`/reseauteur/${orgRz.slug}`}
                                className="inline-flex items-center gap-1.5 text-xs text-[#8A6D0B] hover:text-[#6E5608] no-underline transition-colors font-medium"
                              >
                                <span className="w-2 h-2 rounded-full bg-[#F5E050] shrink-0" aria-hidden />
                                Par {orgRz.prenom} {orgRz.nom}
                              </Link>
                            )}
                            {lienSafe && (
                              <a
                                href={lienSafe}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A6D0B] hover:text-[#6E5608] no-underline transition-colors"
                                aria-label={`S'inscrire à ${ev.titre} (lien externe)`}
                              >
                                <ExternalLink size={11} aria-hidden />
                                S&apos;inscrire
                              </a>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </Reveal>

                {totalPages > 1 && (
                  <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                    {page > 1 && (
                      <Link
                        href={`/evenements?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}
                        className="p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:border-[#8A6D0B] hover:text-[#8A6D0B] no-underline transition-colors"
                        aria-label="Page précédente"
                      >
                        ← Précédente
                      </Link>
                    )}
                    <span className="text-sm text-[#6E7175]">Page {page} / {totalPages}</span>
                    {page < totalPages && (
                      <Link
                        href={`/evenements?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}
                        className="p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:border-[#8A6D0B] hover:text-[#8A6D0B] no-underline transition-colors"
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
