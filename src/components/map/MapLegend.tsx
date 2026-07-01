'use client'

/**
 * MapLegend — légende repliable de la carte (theme-adaptative).
 * Explique le code couleur des marqueurs (ex. badges réseauteur) et,
 * optionnellement, la logique des clusters. Repliée par défaut sur mobile.
 */

import { useState } from 'react'
import { Info, ChevronDown } from 'lucide-react'

export interface LegendItem {
  label: string
  color: string
  /** Forme de la pastille : 'dot' (rond) par défaut. */
  ring?: boolean
}

export default function MapLegend({
  title = 'Légende',
  items,
  note,
}: {
  title?: string
  items: LegendItem[]
  note?: string
}) {
  // Repliée par défaut (allègement visuel) — un clic sur « Légende » la déploie.
  const [open, setOpen] = useState(false)

  return (
    <div className={`rsn-map-legend ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="rsn-map-legend-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Info size={13} aria-hidden />
        <span>{title}</span>
        <ChevronDown size={14} aria-hidden className="rsn-map-legend-chevron" />
      </button>
      {open && (
        <div className="rsn-map-legend-body">
          <ul className="rsn-map-legend-list">
            {items.map((it) => (
              <li key={it.label} className="rsn-map-legend-item">
                <span
                  className={`rsn-map-legend-dot ${it.ring ? 'is-ring' : ''}`}
                  style={it.ring ? { borderColor: it.color } : { background: it.color }}
                />
                {it.label}
              </li>
            ))}
          </ul>
          {note && <p className="rsn-map-legend-note">{note}</p>}
        </div>
      )}
    </div>
  )
}
