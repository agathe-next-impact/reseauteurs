'use client'

import { useEffect, useRef, useState } from 'react'

export type DonutSegment = { label: string; value: number; color: string }

/**
 * Anneau (donut) SVG animé.
 * - Draw-in progressif au scroll (stroke-dashoffset), staggeré par segment.
 * - Micro-interaction : survol d'un segment → mise en avant + le centre
 *   affiche sa valeur/label.
 * Décoratif : le nombre central reste lisible même sans JS.
 */
export default function DonutChart({
  segments,
  size = 208,
  thickness = 24,
  centerValue,
  centerLabel,
  onActiveChange,
  className = '',
}: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerValue?: string
  centerLabel?: string
  onActiveChange?: (index: number | null) => void
  className?: string
}) {
  const ref = useRef<SVGSVGElement | null>(null)
  const [inView, setInView] = useState(false)
  const [reduce, setReduce] = useState(false)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            setInView(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const setActiveSafe = (i: number | null) => {
    setActive(i)
    onActiveChange?.(i)
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  // startFrac calculé sans réassignation (immutabilité en rendu ; n ≤ 6).
  const arcs = segments.map((seg, i) => {
    const before = segments.slice(0, i).reduce((sum, s) => sum + s.value, 0)
    return { seg, frac: seg.value / total, startFrac: before / total }
  })

  const activeSeg = active != null ? segments[active] : null

  return (
    <div className={`rsn-donut ${className}`} style={{ width: size, height: size }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={
          centerLabel && centerValue ? `${centerLabel} : ${centerValue}` : 'Répartition par segment'
        }
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(var(--ir-line-rgb),0.10)"
          strokeWidth={thickness}
        />
        {arcs.map(({ seg, frac, startFrac }, i) => {
          const len = frac * circ
          const dashOffset = inView ? circ - len : circ
          const rotation = -90 + startFrac * 360
          const dimmed = active != null && active !== i
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={active === i ? thickness + 3 : thickness}
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              transform={`rotate(${rotation} ${cx} ${cy})`}
              style={{
                transition: reduce
                  ? 'stroke-width .2s ease, opacity .2s ease'
                  : `stroke-dashoffset .9s cubic-bezier(.22,.7,.2,1) ${i * 90}ms, stroke-width .2s ease, opacity .2s ease`,
                opacity: dimmed ? 0.32 : 1,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setActiveSafe(i)}
              onMouseLeave={() => setActiveSafe(null)}
            />
          )
        })}
      </svg>
      <div className="rsn-donut-center" aria-hidden>
        <span className="rsn-donut-value">
          {activeSeg ? activeSeg.value.toLocaleString('fr-FR') : centerValue}
        </span>
        <span className="rsn-donut-label">{activeSeg ? activeSeg.label : centerLabel}</span>
      </div>
    </div>
  )
}
