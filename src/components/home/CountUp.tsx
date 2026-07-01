'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Compteur animé : compte de 0 à `value` quand il entre dans le viewport.
 * Respecte `prefers-reduced-motion` (affiche directement la valeur finale).
 */
export default function CountUp({
  value,
  duration = 1500,
  suffix = '',
  prefix = '',
  className = '',
}: {
  value: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const started = useRef(false)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            io.disconnect()
            if (reduce) {
              setDisplay(value)
              return
            }
            const start = performance.now()
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / duration)
              const eased = 1 - Math.pow(1 - p, 3)
              setDisplay(Math.round(value * eased))
              if (p < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        }
      },
      { threshold: 0.45 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString('fr-FR')}
      {suffix}
    </span>
  )
}
