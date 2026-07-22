'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Courbe de tendance SVG (aire + ligne) avec tracé animé au scroll.
 * - La ligne se dessine (stroke-dashoffset) et l'aire apparaît en fondu.
 * La longueur du tracé est calculée mathématiquement (somme des segments),
 * sans mesure DOM. Respecte `prefers-reduced-motion`.
 */
export default function TrendArea({
  data,
  width = 520,
  height = 180,
  color = '#035AA6',
  className = '',
  showDots = true,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
  showDots?: boolean
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [inView, setInView] = useState(false)
  const [reduce, setReduce] = useState(false)

  const pad = 8
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const stepX = (width - pad * 2) / Math.max(data.length - 1, 1)

  const points = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (height - pad * 2) * (1 - (v - min) / range)
    return [x, y] as const
  })

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L${(pad + (data.length - 1) * stepX).toFixed(1)} ${height - pad} L${pad} ${height - pad} Z`

  // Longueur du tracé = somme des distances euclidiennes (aucune mesure DOM).
  const pathLength = points.reduce((sum, [x, y], i) => {
    if (i === 0) return 0
    const [px, py] = points[i - 1]
    return sum + Math.hypot(x - px, y - py)
  }, 0)

  useEffect(() => {
    const el = svgRef.current
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

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={`rsn-trend ${className}`}
      role="img"
      aria-label="Tendance de croissance de la communauté"
      preserveAspectRatio="none"
    >
      <path
        d={areaPath}
        fill={color}
        fillOpacity={0.16}
        style={{
          opacity: inView ? 1 : 0,
          transition: reduce ? 'none' : 'opacity .9s ease .3s',
        }}
      />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLength || 1000,
          strokeDashoffset: inView ? 0 : pathLength || 1000,
          transition: reduce ? 'none' : 'stroke-dashoffset 1.2s cubic-bezier(.4,.1,.2,1)',
        }}
      />
      {showDots &&
        points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={color}
            style={{
              opacity: inView ? 1 : 0,
              transition: reduce ? 'none' : `opacity .3s ease ${0.6 + i * 0.08}s`,
            }}
          />
        ))}
    </svg>
  )
}
