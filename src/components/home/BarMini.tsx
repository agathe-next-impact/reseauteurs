'use client'

import { useEffect, useRef, useState } from 'react'

export type BarDatum = { label: string; value: number; color?: string; sublabel?: string }

/**
 * Histogramme léger (divs animées) — grandit à l'entrée dans le viewport.
 * Micro-interaction : survol d'une colonne → surbrillance + tooltip valeur.
 * Respecte `prefers-reduced-motion` (pas de transition).
 */
export default function BarMini({
  bars,
  height = 150,
  color = '#2563EB',
  valueSuffix = '',
  className = '',
}: {
  bars: BarDatum[]
  height?: number
  color?: string
  valueSuffix?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  const [reduce, setReduce] = useState(false)

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

  const max = Math.max(...bars.map((b) => b.value), 1)

  return (
    <div ref={ref} className={`rsn-bars ${className}`} style={{ height }}>
      {bars.map((b, i) => {
        const pct = (b.value / max) * 100
        return (
          <div key={i} className="rsn-bar-col">
            <div className="rsn-bar-track">
              <span className="rsn-bar-tip">
                {b.value.toLocaleString('fr-FR')}
                {valueSuffix}
              </span>
              <div
                className="rsn-bar-fill"
                style={{
                  height: inView ? `${Math.max(pct, 2)}%` : '0%',
                  background: b.color ?? color,
                  transition: reduce ? 'none' : `height .85s cubic-bezier(.22,.7,.2,1) ${i * 70}ms`,
                }}
              />
            </div>
            <span className="rsn-bar-label" title={b.label}>
              {b.label}
            </span>
            {b.sublabel && <span className="rsn-bar-sublabel">{b.sublabel}</span>}
          </div>
        )
      })}
    </div>
  )
}
