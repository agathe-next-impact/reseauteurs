// @ts-nocheck — types en attente de generate:types + versions MapLibre (map-engineer)
'use client'

/**
 * MapEvenementsReseauteurs — Carte des événements business (ADR-0006, ADR-0011, ADR-0012).
 *
 * Marqueur = un événement (position = adresse du lieu — donnée publique).
 * ADR-0012 : un seul type de marqueur événement (l'événement Premium est supprimé).
 *
 * Filtres : réseau / ville / date (pas de métier/badge — ce sont des filtres réseauteurs).
 * S'inscrire = lien externe vers le site du réseau (RÉSEAUTEURS n'organise pas).
 *
 * Mobile : carte plein écran + bottom-sheet slide-over (DESIGN.md §6).
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { List, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { TooltipInfo } from '@/types/map'
import { MAP_COLORS } from '@/lib/maplibre/config'
import FiltresEvenementsReseauteurs, {
  type EvenementFiltersNew,
  emptyFiltersNew,
  type ReseauLiteFilter,
} from '@/components/filters/FiltresEvenementsReseauteurs'

const SlideOverEvenementNew = dynamic(
  () => import('@/components/slideover/SlideOverEvenementNew'),
  { ssr: false },
)
import MapContainerLibre from '@/components/map/MapContainerLibre'
import MapPopupLibre from '@/components/map/MapPopupLibre'
import MapLegend from '@/components/map/MapLegend'
import MapResultsList, { type MapListItem } from '@/components/map/MapResultsList'

const MAP_MOVE_DEBOUNCE = 500

// ── Expressions MapLibre pour les clusters d'événements ─────────────────────
const clusterCircleColor = [
  'step',
  ['get', 'point_count'],
  MAP_COLORS.evenement,  // 1–9 points : navy
  10, '#1a3d8f',         // 10–29
  30, '#16284f',         // 30+
]

interface MapEvenementsReseauteursProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  reseaux: ReseauLiteFilter[]
  /** Bascule agenda/carte (rendue dans la barre de navigation supérieure). */
  toolbar?: React.ReactNode
}

export default function MapEvenementsReseauteurs({
  initialData,
  initialSlug,
  reseaux,
  toolbar,
}: MapEvenementsReseauteursProps) {
  const mapRef = useRef<MapRef | null>(null)

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [filters, setFilters] = useState<EvenementFiltersNew>(emptyFiltersNew)
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
      selectedReseaux.length +
      [filters.ville.trim(), filters.dateDebut, filters.dateFin].filter(Boolean).length
    )
  }, [filters])

  const sourceData = useMemo(() => geojsonData as GeoJSON.FeatureCollection, [geojsonData])

  const selectedFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], selectedSlug ?? ''],
    [selectedSlug],
  )

  // Filtre de survol (surbrillance depuis la colonne de résultats)
  const hoveredFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], hoveredSlug ?? ''],
    [hoveredSlug],
  )

  // ADR-0012 : un seul type de marqueur — plus de couche premium séparée
  const interactiveLayerIds = useMemo(
    () => ['evenements-clusters', 'evenements-points'],
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
          title: (props.titre as string | null | undefined) ?? 'Événement',
          meta: (props.lieuVille as string | null | undefined) ?? null,
        }
      })
  }, [geojsonData])

  // ── Handlers ────────────────────────────────────────────────────────
  const handleLoad = useCallback((e: MapEvent) => {
    const map = e.target
    map.once('idle', () => setMapReady(true))
  }, [])

  const handleClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0]
    if (!feature) return

    const layerId = feature.layer?.id

    if (layerId === 'evenements-clusters') {
      const map = mapRef.current?.getMap()
      if (!map) return
      const source = map.getSource('evenements') as {
        getClusterExpansionZoom: (
          clusterId: number,
          cb: (err: unknown, zoom: number | null) => void,
        ) => void
      }
      const clusterId = feature.properties?.cluster_id as number
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        })
      })
      return
    }

    if (layerId === 'evenements-points') {
      const slug = feature.properties?.slug as string | undefined
      if (slug) {
        setSelectedSlug(slug)
        window.history.replaceState(
          null,
          '',
          `/carte/evenements?e=${encodeURIComponent(slug)}`,
        )
      }
    }
  }, [])

  // ── Sélection depuis la colonne de résultats (Lot C) ────────────────
  const handleSelectFromList = useCallback((slug: string) => {
    setSelectedSlug(slug)
    window.history.replaceState(null, '', `/carte/evenements?e=${encodeURIComponent(slug)}`)

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
    if (!feature || feature.layer?.id !== 'evenements-points') return
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    const titre = (feature.properties?.titre as string | undefined) ?? 'Événement'
    const ville = (feature.properties?.lieuVille as string | undefined) ?? undefined
    setTooltip({
      longitude: coords[0],
      latitude: coords[1],
      title: titre,
      subtitle: ville,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCursor('auto')
    setTooltip(null)
  }, [])

  // ── Refetch sur déplacement carte (bbox) ────────────────────────────
  const fetchWithBbox = useCallback(
    async (f: EvenementFiltersNew) => {
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
      if (f.reseau) params.set('reseau', f.reseau)
      if (f.ville.trim()) params.set('ville', f.ville.trim())
      if (f.dateDebut) params.set('dateDebut', f.dateDebut)
      if (f.dateFin) params.set('dateFin', f.dateFin)

      const cacheKey = params.toString()
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setGeojsonData(cached)
        setResultCount(cached.features.length)
        return
      }

      setFetching(true)
      try {
        const res = await fetch(`/api/geo/evenements?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Geo evenements: ${res.status}`)
        const json = await res.json() as GeoJSONFeatureCollection
        if (cacheRef.current.size >= 20) {
          cacheRef.current.delete(cacheRef.current.keys().next().value!)
        }
        cacheRef.current.set(cacheKey, json)
        setGeojsonData(json)
        setResultCount(json.features.length)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[MapEvenementsReseauteurs] fetchWithBbox error:', err)
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
    (f: EvenementFiltersNew) => {
      setFilters(f)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchWithBbox(f), MAP_MOVE_DEBOUNCE)
    },
    [fetchWithBbox],
  )

  const handleClose = useCallback(() => {
    setSelectedSlug(null)
    window.history.replaceState(null, '', '/carte/evenements')
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem-1px)]" aria-label="Carte des événements">
      {/* Barre de navigation supérieure : bascule vue + affichage du panneau */}
      <div className="rsn-map-topbar">
        <div className="rsn-map-topbar-start">{toolbar}</div>
        <div className="rsn-map-topbar-end">
          <button
            type="button"
            className={`rsn-map-topbar-btn hidden lg:inline-flex${listOpen ? ' is-active' : ''}`}
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
                className="w-2.5 h-2.5 rounded-full bg-[#16284f]"
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
            <div className="bg-white rounded-full px-3 py-1 shadow text-xs text-[#16284f] font-medium flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#16284f] animate-pulse" />
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
              id="evenements"
              type="geojson"
              data={sourceData}
              cluster
              clusterMaxZoom={13}
              clusterRadius={40}
            >
              {/* Cercles des clusters */}
              <Layer
                id="evenements-clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': clusterCircleColor as unknown as string,
                  'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    18,
                    10, 24,
                    30, 30,
                  ] as unknown as number,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />
              {/* Compteurs des clusters */}
              <Layer
                id="evenements-cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 12,
                } as unknown as Record<string, unknown>}
                paint={{ 'text-color': '#ffffff' }}
              />

              {/* Marqueurs individuels — navy (un seul type, ADR-0012) */}
              <Layer
                id="evenements-points"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': MAP_COLORS.evenement,
                  'circle-radius': 9,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />

              {/* Surbrillance au survol (depuis la colonne de résultats) */}
              <Layer
                id="evenements-hover"
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
                id="evenements-selected"
                type="circle"
                filter={selectedFilter as unknown as boolean}
                paint={{
                  'circle-color': 'transparent',
                  'circle-radius': 16,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': MAP_COLORS.evenement,
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
              offset={14}
              className="map-tooltip"
            >
              <div>
                <strong className="text-sm block">{tooltip.title}</strong>
                {tooltip.subtitle && (
                  <div className="text-xs text-[#71717a] mt-0.5">{tooltip.subtitle}</div>
                )}
              </div>
            </MapPopupLibre>
          )}
        </MapContainerLibre>

        {/* État vide : aucune donnée dans la zone visible */}
        {mapReady && !fetching && geojsonData.features.length === 0 && (
          <div className="rsn-map-empty" role="status">
            <p>Aucun événement dans cette zone.</p>
          </div>
        )}

        {/* Légende du marqueur événement */}
        <MapLegend
          title="Carte"
          items={[{ label: 'Événement business', color: MAP_COLORS.evenement }]}
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
                    <FiltresEvenementsReseauteurs
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      resultCount={resultCount}
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
                    entityLabel="événement"
                    emptyLabel="Aucun événement dans cette zone."
                    hideHead
                  />
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Panneau de détail (slide-over + bottom-sheet mobile) */}
      <SlideOverEvenementNew slug={selectedSlug} onClose={handleClose} />
    </div>
  )
}
