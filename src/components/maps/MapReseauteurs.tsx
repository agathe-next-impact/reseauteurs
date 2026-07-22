'use client'

/**
 * MapReseauteurs — Carte des réseauteurs (ADR-0006, ADR-0011).
 *
 * Marqueur = une personne (position au niveau ville/commune — RGPD ADR-0011 §7).
 * Clustering avec compteurs côté MapLibre GL JS.
 * Filtres : secteur / réseau / badge / ville.
 * Pas d'axe date (un réseauteur est persistant — DESIGN.md §6).
 *
 * Mobile : carte plein écran + bottom-sheet slide-over (pattern DESIGN.md §6).
 * Performance : requêtes bornées par bbox, MAX_RESULTS = 3000.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { List, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre'
import type { GeoJSONSource } from 'maplibre-gl'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { TooltipInfo } from '@/types/map'
import { MAP_COLORS, BADGE_MARKER_COLORS, BADGE_MARKER_FALLBACK } from '@/lib/maplibre/config'
import FiltresReseauteurs, {
  type ReseauteurFilters,
  emptyFilters,
  type CategoryLite,
  type ReseauLite,
} from '@/components/filters/FiltresReseauteurs'

const SlideOverReseauteur = dynamic(() => import('@/components/slideover/SlideOverReseauteur'), {
  ssr: false,
})
import MapContainerLibre from '@/components/map/MapContainerLibre'
import MapPopupLibre from '@/components/map/MapPopupLibre'
import MapLegend from '@/components/map/MapLegend'
import MapResultsList, { type MapListItem } from '@/components/map/MapResultsList'

/** Durée de debounce pour le refetch sur déplacement carte (ms) */
const MAP_MOVE_DEBOUNCE = 500

// ── Expressions MapLibre pour les couleurs de cluster ──────────────────────
const clusterCircleColor = [
  'step',
  ['get', 'point_count'],
  MAP_COLORS.primary,          // 1–19 points
  20, '#02467F',               // 20–49
  50, '#01365F',               // 50+
]

// ── Expression MapLibre `match` pour la couleur des marqueurs par badge ────
const badgeCircleColor = [
  'match',
  ['get', 'badge'],
  ...BADGE_MARKER_COLORS.flatMap((b) => [b.value, b.color]),
  BADGE_MARKER_FALLBACK,
]

/** Table de correspondance badge → { color, label } pour la colonne de résultats. */
const BADGE_LOOKUP = new Map<string, (typeof BADGE_MARKER_COLORS)[number]>(
  BADGE_MARKER_COLORS.map((b) => [b.value, b]),
)

interface MapReseauteursProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  /** true si l'amorce SSR contient TOUS les points (pas tronquée par la limite SSR) :
   *  le refetch bbox initial est alors inutile — il n'a lieu qu'au premier déplacement/filtre. */
  initialComplete?: boolean
  categories: CategoryLite[]
  reseaux: ReseauLite[]
  /** Bascule annuaire/carte (rendue dans la barre de navigation supérieure). */
  toolbar?: React.ReactNode
}

export default function MapReseauteurs({
  initialData,
  initialSlug,
  initialComplete = false,
  categories,
  reseaux,
  toolbar,
}: MapReseauteursProps) {
  const mapRef = useRef<MapRef | null>(null)

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReseauteurFilters>(emptyFilters)
  const [fetching, setFetching] = useState(false)
  const [geojsonData, setGeojsonData] = useState<GeoJSONFeatureCollection>(initialData)
  const [resultCount, setResultCount] = useState(initialData.features.length)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [cursor, setCursor] = useState('auto')
  const [mapReady, setMapReady] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(true)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didInitialFetch = useRef(false)
  const cacheRef = useRef<Map<string, GeoJSONFeatureCollection>>(new Map())
  const geojsonDataRef = useRef(geojsonData)
  geojsonDataRef.current = geojsonData

  // Nombre de filtres actifs (badge sur le bouton Filtres)
  const activeCount = useMemo(() => {
    const selectedReseaux = filters.reseau
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return (
      [filters.ville.trim(), filters.secteur, filters.badge].filter(Boolean).length +
      selectedReseaux.length
    )
  }, [filters])

  const sourceData = useMemo(() => geojsonData as GeoJSON.FeatureCollection, [geojsonData])

  // Filtre de sélection (marqueur actif)
  const selectedFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], selectedSlug ?? ''],
    [selectedSlug],
  )

  // Filtre de survol (surbrillance depuis la colonne de résultats)
  const hoveredFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], hoveredSlug ?? ''],
    [hoveredSlug],
  )

  const interactiveLayerIds = useMemo(
    () => ['reseauteurs-clusters', 'reseauteurs-points'],
    [],
  )

  // ── Colonne de résultats synchronisée (Lot C) ───────────────────────
  const resultItems = useMemo((): MapListItem[] => {
    return geojsonData.features
      .filter((f) => f.properties?.slug)
      .map((f) => {
        const props = f.properties as Record<string, unknown>
        const slug = props.slug as string
        const prenom = (props.prenom as string | null | undefined) ?? ''
        const nom = (props.nom as string | null | undefined) ?? ''
        const title = [prenom, nom].filter(Boolean).join(' ') || 'Réseauteur'
        const fonction = (props.fonction as string | null | undefined) ?? null
        const entreprise = (props.entreprise as string | null | undefined) ?? null
        const badge = (props.badge as string | null | undefined) ?? null
        const badgeInfo = badge ? BADGE_LOOKUP.get(badge) : undefined

        return {
          id: slug,
          title,
          subtitle: fonction || entreprise,
          meta: (props.ville as string | null | undefined) ?? null,
          accent: badgeInfo?.color ?? BADGE_MARKER_FALLBACK,
          accentLabel: badgeInfo?.label,
        }
      })
  }, [geojsonData])

  // ── Handlers carte ──────────────────────────────────────────────────
  const handleLoad = useCallback((_e: MapEvent) => {
    // Prêt dès `load` (style chargé) : les marqueurs s'affichent pendant que les
    // tuiles arrivent. Attendre `idle` (= toutes les tuiles) retardait tout le
    // premier rendu de plusieurs secondes sur connexion lente.
    setMapReady(true)
  }, [])

  const handleClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0]
    if (!feature) return

    const layerId = feature.layer?.id

    if (layerId === 'reseauteurs-clusters') {
      const map = mapRef.current?.getMap()
      if (!map) return
      const source = map.getSource('reseauteurs') as GeoJSONSource | undefined
      if (!source) return
      const clusterId = feature.properties?.cluster_id as number
      // maplibre-gl 5.x : getClusterExpansionZoom renvoie une Promise (l'ancienne
      // signature callback est ignoree silencieusement -> le cluster ne zoomait plus).
      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          if (zoom == null) return
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          })
        })
        .catch(() => {})
      return
    }

    if (layerId === 'reseauteurs-points') {
      const slug = feature.properties?.slug as string | undefined
      if (slug) {
        setSelectedSlug(slug)
        window.history.replaceState(
          null,
          '',
          `/carte/reseauteurs?r=${encodeURIComponent(slug)}`,
        )
      }
    }
  }, [])

  // ── Sélection depuis la colonne de résultats (Lot C) ────────────────
  const handleSelectFromList = useCallback((slug: string) => {
    setSelectedSlug(slug)
    window.history.replaceState(null, '', `/carte/reseauteurs?r=${encodeURIComponent(slug)}`)

    const match = geojsonDataRef.current.features.find(
      (f) => f.properties?.slug === slug,
    )
    if (match) {
      const map = mapRef.current?.getMap()
      const coords = (match.geometry as GeoJSON.Point).coordinates as [number, number]
      const currentZoom = map?.getZoom() ?? 12
      map?.flyTo({ center: coords, zoom: Math.max(currentZoom, 12), duration: 700 })
    }
  }, [])

  const handleHoverFromList = useCallback((slug: string | null) => {
    setHoveredSlug(slug)
  }, [])

  const handleMouseEnter = useCallback((e: MapMouseEvent) => {
    setCursor('pointer')
    const feature = e.features?.[0]
    if (!feature || feature.layer?.id !== 'reseauteurs-points') return
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    setTooltip({
      longitude: coords[0],
      latitude: coords[1],
      title:
        [
          feature.properties?.prenom as string | undefined,
          feature.properties?.nom as string | undefined,
        ]
          .filter(Boolean)
          .join(' ') || 'Réseauteur',
      subtitle: (feature.properties?.ville as string | undefined) ?? undefined,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCursor('auto')
    setTooltip(null)
  }, [])

  // ── Refetch sur déplacement carte (bbox) ────────────────────────────
  const fetchWithBbox = useCallback(
    async (f: ReseauteurFilters) => {
      const map = mapRef.current?.getMap()
      const bounds = map?.getBounds()

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const params = new URLSearchParams()
      if (bounds) {
        params.set('sw_lng', String(bounds.getWest()))
        params.set('sw_lat', String(bounds.getSouth()))
        params.set('ne_lng', String(bounds.getEast()))
        params.set('ne_lat', String(bounds.getNorth()))
      }
      if (f.secteur) params.set('secteur', f.secteur)
      if (f.reseau) params.set('reseau', f.reseau)
      if (f.badge) params.set('badge', f.badge)
      if (f.ville.trim()) params.set('ville', f.ville.trim())

      const cacheKey = params.toString()
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setGeojsonData(cached)
        setResultCount(cached.features.length)
        return
      }

      setFetching(true)
      try {
        const res = await fetch(`/api/geo/reseauteurs?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Geo reseauteurs: ${res.status}`)
        const json = await res.json() as GeoJSONFeatureCollection
        // Limiter la taille du cache (20 entrées max)
        if (cacheRef.current.size >= 20) {
          cacheRef.current.delete(cacheRef.current.keys().next().value!)
        }
        cacheRef.current.set(cacheKey, json)
        setGeojsonData(json)
        setResultCount(json.features.length)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[MapReseauteurs] fetchWithBbox error:', err)
      } finally {
        setFetching(false)
      }
    },
    [],
  )

  const handleMoveEnd = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchWithBbox(filters), MAP_MOVE_DEBOUNCE)
  }, [fetchWithBbox, filters])

  const handleFilterChange = useCallback(
    (f: ReseauteurFilters) => {
      setFilters(f)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchWithBbox(f), MAP_MOVE_DEBOUNCE)
    },
    [fetchWithBbox],
  )

  const handleClose = useCallback(() => {
    setSelectedSlug(null)
    window.history.replaceState(null, '', '/carte/reseauteurs')
  }, [])

  // Refetch bbox initial UNIQUEMENT si l'amorce SSR est tronquée (initialComplete=false).
  // Sinon les données du viewport France sont déjà là : re-télécharger la même chose
  // doublait le coût de chaque chargement de page (audit perf cartes H2).
  useEffect(() => {
    if (mapReady && !didInitialFetch.current) {
      didInitialFetch.current = true
      if (!initialComplete) fetchWithBbox(filters)
    }
  }, [mapReady, initialComplete, fetchWithBbox, filters])

  // Nettoyage des timers
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem-1px)]" aria-label="Carte des réseauteurs">
      {/* Barre de navigation supérieure : bascule vue + affichage du panneau */}
      <div className="rsn-map-topbar">
        <div className="rsn-map-topbar-start">{toolbar}</div>
        <div className="rsn-map-topbar-end">
          <button
            type="button"
            className={`rsn-map-topbar-btn rsn-map-panel-toggle${listOpen ? ' is-active' : ''}`}
            onClick={() => setListOpen((v) => !v)}
            aria-pressed={listOpen}
            aria-label={listOpen ? 'Masquer le panneau' : 'Afficher le panneau'}
          >
            <List size={15} />
            {listOpen ? 'Masquer le panneau' : 'Panneau'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative isolate">
        {/* Overlay de chargement initial */}
        <div
          className={`absolute inset-0 z-[700] bg-white flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
            mapReady ? 'opacity-0' : 'opacity-100'
          }`}
          onTransitionEnd={(e) => {
            if (mapReady) (e.currentTarget as HTMLElement).style.display = 'none'
          }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-[#035AA6]"
                style={{ animation: `dotBounce 1.4s ease-in-out ${i * 0.16}s infinite` }}
              />
            ))}
          </div>
        </div>

        {/* Indicateur de refetch */}
        {fetching && (
          <div
            className="absolute inset-0 z-[600] bg-white/30 flex items-start justify-center pt-4 pointer-events-none"
            aria-hidden="true"
          >
            <div className="bg-white rounded-full px-3 py-1 border border-[#DFE0E1] text-xs text-[#035AA6] font-medium flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#035AA6] animate-pulse" />
              Mise à jour...
            </div>
          </div>
        )}

        {/* Carte MapLibre */}
        <MapContainerLibre
          mapRef={mapRef}
          interactiveLayerIds={interactiveLayerIds}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onLoad={handleLoad}
          onMoveEnd={handleMoveEnd}
          cursor={cursor}
        >
          {mapReady && (
            <Source
              id="reseauteurs"
              type="geojson"
              data={sourceData}
              cluster
              clusterMaxZoom={13}
              clusterRadius={40}
            >
              {/* Cercles des clusters */}
              <Layer
                id="reseauteurs-clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': clusterCircleColor as unknown as string,
                  'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    18,   // < 20
                    20, 24, // 20–49
                    50, 30, // 50+
                  ] as unknown as number,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />
              {/* Compteurs des clusters */}
              <Layer
                id="reseauteurs-cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 12,
                } as unknown as Record<string, unknown>}
                paint={{ 'text-color': '#ffffff' }}
              />
              {/* Marqueurs individuels — couleur par badge réseauteur */}
              <Layer
                id="reseauteurs-points"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': badgeCircleColor as unknown as string,
                  'circle-radius': 9,
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />
              {/* Surbrillance au survol (depuis la colonne de résultats) */}
              <Layer
                id="reseauteurs-hover"
                type="circle"
                filter={hoveredFilter as unknown as boolean}
                paint={{
                  'circle-color': 'transparent',
                  'circle-radius': 13,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': MAP_COLORS.primary,
                }}
              />
              {/* Anneau de sélection */}
              <Layer
                id="reseauteurs-selected"
                type="circle"
                filter={selectedFilter as unknown as boolean}
                paint={{
                  'circle-color': 'transparent',
                  'circle-radius': 15,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': MAP_COLORS.primary,
                }}
              />
            </Source>
          )}

          {/* Tooltip au survol */}
          {tooltip && (
            <MapPopupLibre
              longitude={tooltip.longitude}
              latitude={tooltip.latitude}
              onClose={() => setTooltip(null)}
              closeButton={false}
              offset={12}
              className="map-tooltip"
            >
              <div className="flex items-center gap-2">
                {tooltip.logoUrl && (
                  <img
                    src={tooltip.logoUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full object-cover shrink-0"
                  />
                )}
                <div>
                  <strong className="text-sm">{tooltip.title}</strong>
                  {tooltip.subtitle && (
                    <div className="text-xs text-[#6E7175] mt-0.5">{tooltip.subtitle}</div>
                  )}
                </div>
              </div>
            </MapPopupLibre>
          )}
        </MapContainerLibre>

        {/* État vide : aucune donnée dans la zone visible */}
        {mapReady && !fetching && geojsonData.features.length === 0 && (
          <div className="rsn-map-empty" role="status">
            <p>Aucun réseauteur dans cette zone.</p>
            <Link href="/inscription">Créer mon profil</Link>
          </div>
        )}

        {/* Légende du code couleur des marqueurs (badge) */}
        <MapLegend
          title="Badge réseauteur"
          items={BADGE_MARKER_COLORS.map((b) => ({ label: b.label, color: b.color }))}
          note="Selon le nombre d'événements fréquentés par mois."
        />
      </div>

      {/* Rail droit (desktop) : accordéon Filtres + Résultats */}
      {listOpen && (
        <div className="rsn-map-rail">
          <div className="rsn-rail-accordion">
            {/* Section Filtres */}
            <section className="rsn-acc rsn-acc-filters">
              <button
                type="button"
                className="rsn-acc-head"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={15} aria-hidden />
                <span className="rsn-acc-label">Filtres</span>
                {activeCount > 0 && (
                  <span className="rsn-map-topbar-btn-badge">{activeCount}</span>
                )}
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={`rsn-acc-chevron${filtersOpen ? ' is-open' : ''}`}
                />
              </button>
              {filtersOpen && (
                <div className="rsn-acc-filters-body">
                  <FiltresReseauteurs
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    resultCount={resultCount}
                    categories={categories}
                    reseaux={reseaux}
                  />
                </div>
              )}
            </section>

            {/* Section Résultats */}
            <section className={`rsn-acc rsn-acc-results${resultsOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="rsn-acc-head"
                onClick={() => setResultsOpen((v) => !v)}
                aria-expanded={resultsOpen}
              >
                <List size={15} aria-hidden />
                <span className="rsn-acc-label">Résultats</span>
                <span className="rsn-acc-count">
                  {resultCount}
                  {resultCount > 100 ? ' · zoomez' : ''}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={`rsn-acc-chevron${resultsOpen ? ' is-open' : ''}`}
                />
              </button>
              {resultsOpen && (
                <MapResultsList
                  items={resultItems}
                  selectedId={selectedSlug}
                  total={resultCount}
                  onSelect={handleSelectFromList}
                  onHover={handleHoverFromList}
                  entityLabel="réseauteur"
                  emptyLabel="Aucun réseauteur dans cette zone."
                  hideHead
                />
              )}
            </section>
          </div>
        </div>
      )}
      </div>

      {/* Panneau de détail (slide-over + bottom-sheet mobile) */}
      <SlideOverReseauteur slug={selectedSlug} onClose={handleClose} />
    </div>
  )
}
