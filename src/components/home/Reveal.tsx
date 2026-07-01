'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Révèle son contenu en fondu + translation quand il entre dans le viewport.
 *
 * Progressive enhancement : sans JS, le contenu est visible par défaut
 * (la classe `.js-ready` posée sur <html> active seulement l'état masqué).
 * `prefers-reduced-motion` est géré en CSS (styles.css) : les utilisateurs
 * concernés voient le contenu sans transition.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  once = true,
}: {
  children: ReactNode
  className?: string
  /** Décalage d'entrée en ms (pour effet cascade). */
  delay?: number
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) io.disconnect()
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [once])

  return (
    <div
      ref={ref}
      className={`rsn-reveal ${shown ? 'is-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
