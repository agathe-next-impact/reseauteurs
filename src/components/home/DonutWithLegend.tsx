'use client'

import { useState } from 'react'
import DonutChart, { type DonutSegment } from './DonutChart'

/**
 * Donut + légende interactive : le survol d'une ligne de légende ou d'un
 * segment met les deux en surbrillance (état partagé).
 */
export default function DonutWithLegend({
  segments,
  centerValue,
  centerLabel,
  size = 208,
  thickness = 24,
  total,
}: {
  segments: DonutSegment[]
  centerValue: string
  centerLabel: string
  size?: number
  thickness?: number
  /** Total pour le calcul des pourcentages de la légende. */
  total?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const sum = total ?? (segments.reduce((s, x) => s + x.value, 0) || 1)

  return (
    <div className="rsn-donut-block">
      <DonutChart
        segments={segments}
        size={size}
        thickness={thickness}
        centerValue={centerValue}
        centerLabel={centerLabel}
        onActiveChange={setActive}
      />
      <ul className="rsn-legend" role="list">
        {segments.map((seg, i) => {
          const pct = Math.round((seg.value / sum) * 100)
          return (
            <li
              key={i}
              className={`rsn-legend-item ${active === i ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="rsn-legend-dot" style={{ background: seg.color }} />
              <span className="rsn-legend-name">{seg.label}</span>
              <span className="rsn-legend-val">
                {seg.value.toLocaleString('fr-FR')}
                <em>{pct}%</em>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
