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
      // threshold: 0 — IMPÉRATIF, ne pas remonter. Un seuil en ratio de surface est
      // INATTEIGNABLE pour un bloc plus haut que `viewport / seuil` : avec l'ancien
      // 0.14, la grille de /evenements?vue=agenda (7418 px en 1 colonne, mobile 844 px)
      // plafonnait à 0.114, `isIntersecting` ne basculait jamais, et les 24 cartes
      // restaient à opacity 0 même après avoir fait défiler toute la page.
      // C'est `rootMargin` qui porte le retard d'apparition (bloc entré de 8 % dans
      // l'écran), pas le seuil — le rendu perçu des blocs courts est inchangé.
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
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
