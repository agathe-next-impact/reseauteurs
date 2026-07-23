'use client'

/**
 * MapReseaux — Carte des réseaux locaux (ADR-0006, ADR-0012).
 *
 * Marqueur = un réseau local (groupe/section rattaché à un national).
 * Position : centroïde de la ville du groupe (donnée publique).
 *
 * INVARIANT ADR-0012 : les réseaux nationaux ne sont JAMAIS des marqueurs
 * (pas de point unique — on les présente en annuaire / page dédiée).
 *
 * Clustering avec compteurs côté MapLibre GL JS.
 * Filtres : réseau national parent / ville.
 * Au clic d'un marqueur → SlideOverReseau (preview) → lien /reseau/:slug (fiche SSR).
 *
 * Mobile : carte plein écran + bottom-sheet draggable (DESIGN.md §6).
 * Performance : requêtes bornées par bbox + filtres via /api/geo/reseaux, jamais de chargement global.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre'
import type { GeoJSONSource } from 'maplibre-gl'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { TooltipInfo } from '@/types/map'
import { MAP_COLORS } from '@/lib/maplibre/config'
import FiltresReseaux, {
  type ReseauFilters,
  emptyReseauFilters,
  type NationalLite,
} from '@/components/filters/FiltresReseaux'

const SlideOverReseau = dynamic(() => import('@/components/slideover/SlideOverReseau'), {
  ssr: false,
})
import MapContainerLibre from '@/components/map/MapContainerLibre'
import MapPopupLibre from '@/components/map/MapPopupLibre'
import MapLegend from '@/components/map/MapLegend'
import MapResultsList, { type MapListItem } from '@/components/map/MapResultsList'

/** Durée de debounce pour le refetch sur déplacement carte (ms) */
const MAP_MOVE_DEBOUNCE = 400

// ── Expressions MapLibre — couleur des clusters (paliers d'aplats unis) ────
const clusterCircleColor = [
  'step',
  ['get', 'point_count'],
  MAP_COLORS.reseau,  // 1–19 : bleu médian
  20, '#2E6389',      // 20–49
  50, '#012A4A',      // 50+ : navy
]

interface MapReseauxProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  nationals: NationalLite[]
  /** Bascule annuaire/carte (rendue dans la barre de navigation supérieure). */
  toolbar?: React.ReactNode
}

export default function MapReseaux({
  initialData,
  initialSlug,
  nationals,
  toolbar,
}: MapReseauxProps) {
  const mapRef = useRef<MapRef | null>(null)

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReseauFilters>(emptyReseauFilters)
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
    return [filters.national, filters.ville.trim()].filter(Boolean).length
  }, [filters])

  const sourceData = useMemo(() => geojsonData as GeoJSON.FeatureCollection, [geojsonData])

  // Filtre MapLibre de sélection (anneau sur le marqueur actif)
  const selectedFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], selectedSlug ?? ''],
    [selectedSlug],
  )

  // Filtre de survol (surbrillance depuis la colonne de résultats)
  const hoveredFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], hoveredSlug ?? ''],
    [hoveredSlug],
  )

  // IDs des couches interactives (clic + hover)
  const interactiveLayerIds = useMemo(
    () => ['reseaux-clusters', 'reseaux-points'],
    [],
  )

  // ── Colonne de résultats synchronisée (Lot C) ───────────────────────
  const resultItems = useMemo((): MapListItem[] => {
    return geojsonData.features
      .filter((f) => f.properties?.slug)
      .map((f) => {
        const props = f.properties as Record<string, unknown>
        return {
          id: props.slug as string,
          title: (props.nom as string | null | undefined) ?? 'Réseau',
          meta: (props.ville as string | null | undefined) ?? null,
          accent: MAP_COLORS.reseau,
        }
      })
  }, [geojsonData])

  // ── Handlers carte ──────────────────────────────────────────────────
  const handleLoad = useCallback((e: MapEvent) => {
    const map = e.target
    // Attend le premier rendu complet pour masquer l'overlay de chargement
    map.once('idle', () => setMapReady(true))
  }, [])

  const handleClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0]
    if (!feature) return

    const layerId = feature.layer?.id

    // Clic sur un cluster → zoom + expansion
    if (layerId === 'reseaux-clusters') {
      const map = mapRef.current?.getMap()
      if (!map) return
      const source = map.getSource('reseaux-locaux') as GeoJSONSource | undefined
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

    // Clic sur un marqueur individuel → ouvre la preview
    if (layerId === 'reseaux-points') {
      const slug = feature.properties?.slug as string | undefined
      if (slug) {
        setSelectedSlug(slug)
        window.history.replaceState(
          null,
          '',
          `/reseaux?res=${encodeURIComponent(slug)}`,
        )
      }
    }
  }, [])

  // ── Sélection depuis la colonne de résultats (Lot C) ────────────────
  const handleSelectFromList = useCallback((slug: string) => {
    setSelectedSlug(slug)
    window.history.replaceState(null, '', `/reseaux?res=${encodeURIComponent(slug)}`)

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
    if (!feature || feature.layer?.id !== 'reseaux-points') return
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    setTooltip({
      longitude: coords[0],
      latitude: coords[1],
      title: (feature.properties?.nom as string | undefined) ?? 'Réseau',
      subtitle: (feature.properties?.ville as string | undefined) ?? undefined,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCursor('auto')
    setTooltip(null)
  }, [])

  // ── Refetch sur déplacement carte (bbox + filtres actifs) ───────────
  const fetchWithBbox = useCallback(
    async (f: ReseauFilters) => {
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
      if (f.national) params.set('national', f.national)
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
        const res = await fetch(`/api/geo/reseaux?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Geo reseaux: ${res.status}`)
        const json = (await res.json()) as GeoJSONFeatureCollection
        // Limiter le cache à 20 entrées (LRU basique)
        if (cacheRef.current.size >= 20) {
          cacheRef.current.delete(cacheRef.current.keys().next().value!)
        }
        cacheRef.current.set(cacheKey, json)
        setGeojsonData(json)
        setResultCount(json.features.length)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[MapReseaux] fetchWithBbox error:', err)
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
    (f: ReseauFilters) => {
      setFilters(f)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchWithBbox(f), MAP_MOVE_DEBOUNCE)
    },
    [fetchWithBbox],
  )

  const handleClose = useCallback(() => {
    setSelectedSlug(null)
    window.history.replaceState(null, '', '/reseaux')
  }, [])

  // Au 1er idle : recharge le viewport RÉEL via l'API bbox (le dataset SSR n'est qu'une amorce).
  useEffect(() => {
    if (mapReady && !didInitialFetch.current) {
      didInitialFetch.current = true
      fetchWithBbox(filters)
    }
  }, [mapReady, fetchWithBbox, filters])

  // Nettoyage des timers et requêtes en vol
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem-1px-var(--ir-bottomnav-h))]" aria-label="Carte des réseaux locaux">
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
            {listOpen ? 'Masquer le panneau' : 'Panneau'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative isolate">
        {/* Overlay de chargement initial — masqué dès que la carte est prête */}
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
                className="w-2.5 h-2.5 rounded-full bg-[#3E7CA6]"
                style={{ animation: `dotBounce 1.4s ease-in-out ${i * 0.16}s infinite` }}
              />
            ))}
          </div>
        </div>

        {/* Indicateur de refetch (déplacement / changement de filtre) */}
        {fetching && (
          <div
            className="absolute inset-0 z-[600] bg-white/30 flex items-start justify-center pt-4 pointer-events-none"
            aria-hidden="true"
          >
            <div className="bg-white rounded-full px-3 py-1 border border-[#DFE0E1] text-xs text-[#3E7CA6] font-medium flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#3E7CA6] animate-pulse" />
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
              id="reseaux-locaux"
              type="geojson"
              data={sourceData}
              cluster
              clusterMaxZoom={13}
              clusterRadius={40}
            >
              {/* Cercles des clusters — aplat uni par palier de densité */}
              <Layer
                id="reseaux-clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': clusterCircleColor as unknown as string,
                  'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    18,     // < 20 points
                    20, 24, // 20–49
                    50, 30, // 50+
                  ] as unknown as number,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />

              {/* Compteurs des clusters */}
              <Layer
                id="reseaux-cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 12,
                } as unknown as Record<string, unknown>}
                paint={{ 'text-color': '#ffffff' }}
              />

              {/* Marqueurs individuels — cercle violet (un seul type, ADR-0012) */}
              <Layer
                id="reseaux-points"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': MAP_COLORS.reseau,
                  'circle-radius': 9,
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />

              {/* Surbrillance au survol (depuis la colonne de résultats) */}
              <Layer
                id="reseaux-hover"
                type="circle"
                filter={hoveredFilter as unknown as boolean}
                paint={{
                  'circle-color': 'transparent',
                  'circle-radius': 13,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': MAP_COLORS.reseau,
                }}
              />

              {/* Anneau de sélection (marqueur actif) */}
              <Layer
                id="reseaux-selected"
                type="circle"
                filter={selectedFilter as unknown as boolean}
                paint={{
                  'circle-color': 'transparent',
                  'circle-radius': 15,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': MAP_COLORS.reseau,
                }}
              />
            </Source>
          )}

          {/* Tooltip au survol d'un marqueur */}
          {tooltip && (
            <MapPopupLibre
              longitude={tooltip.longitude}
              latitude={tooltip.latitude}
              onClose={() => setTooltip(null)}
              closeButton={false}
              offset={12}
              className="map-tooltip"
            >
              <div>
                <strong className="text-sm">{tooltip.title}</strong>
                {tooltip.subtitle && (
                  <div className="text-xs text-[#6E7175] mt-0.5">{tooltip.subtitle}</div>
                )}
              </div>
            </MapPopupLibre>
          )}
        </MapContainerLibre>

        {/* État vide : aucune donnée dans la zone visible */}
        {mapReady && !fetching && geojsonData.features.length === 0 && (
          <div className="rsn-map-empty" role="status">
            <p>Aucun réseau dans cette zone.</p>
          </div>
        )}

        {/* Légende du marqueur réseau */}
        <MapLegend
          title="Carte"
          items={[{ label: 'Réseau local', color: MAP_COLORS.reseau }]}
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
                  <span className="rsn-acc-label">Filtres</span>
                  {activeCount > 0 && (
                    <span className="rsn-map-topbar-btn-badge">{activeCount}</span>
                  )}
                </button>
                {filtersOpen && (
                  <div className="rsn-acc-filters-body">
                    <FiltresReseaux
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      resultCount={resultCount}
                      nationals={nationals}
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
                  <span className="rsn-acc-label">Résultats</span>
                  <span className="rsn-acc-count">
                    {resultCount}
                    {resultCount > 100 ? ' · zoomez' : ''}
                  </span>
                </button>
                {resultsOpen && (
                  <MapResultsList
                    items={resultItems}
                    selectedId={selectedSlug}
                    total={resultCount}
                    onSelect={handleSelectFromList}
                    onHover={handleHoverFromList}
                    entityLabel="réseau"
                    emptyLabel="Aucun réseau dans cette zone."
                    hideHead
                  />
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Panneau de détail (slide-over desktop + bottom-sheet mobile) */}
      <SlideOverReseau slug={selectedSlug} onClose={handleClose} />
    </div>
  )
}
