'use client'

/**
 * MapResultsList — colonne de résultats synchronisée avec la carte (DESIGN.md §6).
 *
 * - Desktop : colonne latérale scrollable, une ligne par résultat visible.
 * - Survol d'une ligne → `onHover(id)` (la carte met le marqueur en surbrillance).
 * - Clic → `onSelect(id)` (ouvre l'aperçu + recentre la carte).
 * - La ligne du résultat actif défile automatiquement dans la vue.
 * - Navigable au clavier (les marqueurs <canvas> ne le sont pas) → gain a11y.
 *
 * Générique : chaque carte passe des `items` déjà normalisés.
 */

import { useEffect, useRef } from 'react'
/** Nombre max de lignes rendues dans le DOM (perf) — le total réel reste affiché. */
const MAX_VISIBLE_ROWS = 100

export interface MapListItem {
  id: string
  title: string
  subtitle?: string | null
  /** Métadonnée courte (ville, date…). */
  meta?: string | null
  /** Couleur d'accent (badge, entité) affichée en pastille. */
  accent?: string | null
  /** Libellé de la pastille d'accent (ex. « Gold »). */
  accentLabel?: string | null
  imageUrl?: string | null
}

export default function MapResultsList({
  items,
  selectedId,
  total,
  onSelect,
  onHover,
  entityLabel = 'résultat',
  emptyLabel = 'Aucun résultat dans cette zone.',
  hideHead = false,
}: {
  items: MapListItem[]
  selectedId?: string | null
  /** Total réel (peut dépasser items.length si plafonné). */
  total?: number
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
  entityLabel?: string
  emptyLabel?: string
  /** Masque l'en-tête interne (compteur) — utile quand un conteneur l'affiche déjà. */
  hideHead?: boolean
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  const count = total ?? items.length
  // On ne rend que les premières lignes (perf) ; le compteur reflète le total réel.
  const visible = items.slice(0, MAX_VISIBLE_ROWS)
  const capped = count > visible.length

  return (
    <aside className="rsn-map-list" aria-label={`Liste des résultats (${count})`}>
      {!hideHead && (
        <div className="rsn-map-list-head">
          <span className="rsn-map-list-count">
            {count.toLocaleString('fr-FR')} {entityLabel}
            {count !== 1 ? 's' : ''}
          </span>
          {capped && <span className="rsn-map-list-capped">Zoomez pour affiner</span>}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rsn-map-list-empty">{emptyLabel}</div>
      ) : (
        <ul className="rsn-map-list-scroll" role="list">
          {visible.map((it) => {
            const active = it.id === selectedId
            return (
              <li key={it.id}>
                <button
                  ref={active ? activeRef : undefined}
                  type="button"
                  className={`rsn-map-row ${active ? 'is-active' : ''}`}
                  onClick={() => onSelect(it.id)}
                  onMouseEnter={() => onHover?.(it.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onFocus={() => onHover?.(it.id)}
                  onBlur={() => onHover?.(null)}
                  aria-current={active ? 'true' : undefined}
                >
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className="rsn-map-row-img" />
                  ) : (
                    <span
                      className="rsn-map-row-dot"
                      style={{ background: it.accent ?? '#035AA6' }}
                      aria-hidden
                    />
                  )}
                  <span className="rsn-map-row-body">
                    <span className="rsn-map-row-title">{it.title}</span>
                    {it.subtitle && <span className="rsn-map-row-sub">{it.subtitle}</span>}
                    {it.meta && (
                      <span className="rsn-map-row-meta">
                        {it.meta}
                      </span>
                    )}
                  </span>
                  {it.accentLabel && (
                    <span
                      className="rsn-map-row-badge"
                      style={{ color: it.accent ?? undefined, borderColor: it.accent ?? undefined }}
                    >
                      {it.accentLabel}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
