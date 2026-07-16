'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { CalendarPlus } from 'lucide-react'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { CategoryOption } from '@/lib/categories'

interface AgendaViewProps {
  data: GeoJSONFeatureCollection
  onEventClick: (eventId: string) => void
  typesEvenement: CategoryOption[]
}

const INITIAL_MONTHS = 3
const LOAD_MORE_COUNT = 3

function groupByMonth(features: GeoJSONFeatureCollection['features']) {
  const groups: Record<string, typeof features> = {}

  for (const feature of features) {
    const date = new Date(feature.properties.dateDebut as string)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(feature)
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const [year, month] = key.split('-')
      const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
      return {
        label,
        items: items.sort((a, b) =>
          (a.properties.dateDebut as string).localeCompare(b.properties.dateDebut as string),
        ),
      }
    })
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

export default function AgendaView({ data, onEventClick, typesEvenement }: AgendaViewProps) {
  const groups = groupByMonth(data.features)
  const [visibleCount, setVisibleCount] = useState(INITIAL_MONTHS)
  // "Adjust state while rendering" (react.dev) : reset du compteur de mois
  // visibles quand le jeu de données change (ex: changement de filtre parent).
  // Remplace un useEffect([data]) qui déclenchait une passe de render
  // supplementaire à chaque changement.
  const [prevData, setPrevData] = useState(data)
  if (data !== prevData) {
    setPrevData(data)
    setVisibleCount(INITIAL_MONTHS)
  }
  const sentinelRef = useRef<HTMLDivElement>(null)

  const typeLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of typesEvenement) map[t.value] = t.label
    return map
  }, [typesEvenement])

  // Load more months when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || visibleCount >= groups.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, groups.length))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, groups.length])

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-text-light text-sm">
        Aucun événement à venir.
      </div>
    )
  }

  const visibleGroups = groups.slice(0, visibleCount)

  return (
    <div className="p-4 overflow-y-auto h-full">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          {/* Sticky month header */}
          <h3 className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm text-sm font-semibold text-text-medium capitalize border-b border-border py-2.5 px-1 mt-6 first:mt-0 mb-3">
            {group.label}
          </h3>

          <div className="space-y-2">
            {group.items.map((feature) => {
              const p = feature.properties
              const type = p.type as string
              const borderColor = (p.typeCouleur as string) ?? '#6b7280'

              return (
                <div
                  key={p.id as string}
                  className="flex items-stretch bg-white border border-gray-200 rounded-lg overflow-hidden hover:-translate-y-px transition-all duration-150 group"
                >
                  {/* Left color border */}
                  <div
                    className="w-1 shrink-0"
                    style={{ background: borderColor }}
                    aria-hidden="true"
                  />

                  {/* Card content button */}
                  <button
                    className="flex-1 flex items-start gap-3 p-3 text-left bg-transparent border-none cursor-pointer"
                    onClick={() => onEventClick(String(p.slug ?? p.id))}
                  >
                    {/* Date badge */}
                    <div className="shrink-0 w-14 text-center bg-blue-50 text-primary text-sm font-semibold py-1.5 px-1 rounded">
                      {formatDateShort(p.dateDebut as string)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-sm font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
                          style={{ background: borderColor }}
                        >
                          {(p.typeLabel as string) ?? typeLabels[type] ?? type}
                        </span>
                      </div>
                      <strong className="text-sm text-text-dark truncate">{p.titre as string}</strong>
                      <span className="text-sm text-text-light">
                        {String(p.lieuVille)}
                        {p.fournisseurNom ? (
                          <>
                            {' · '}
                            <a
                              href={`/revendeurs/${String(p.fournisseurSlug)}`}
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {String(p.fournisseurNom)}
                            </a>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </button>

                  {/* iCal button */}
                  <a
                    href={`/api/ical/${p.id}`}
                    className="shrink-0 self-center mr-3 flex items-center gap-1 px-2.5 py-1.5 text-sm font-semibold text-primary bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    title="Ajouter au calendrier"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CalendarPlus size={13} />
                    iCal
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Sentinel for infinite scroll */}
      {visibleCount < groups.length && (
        <div ref={sentinelRef} className="py-8 text-center text-text-light text-sm">
          Chargement...
        </div>
      )}
    </div>
  )
}
