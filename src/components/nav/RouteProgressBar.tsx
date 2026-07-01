'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Sleek top progress bar triggered on route changes (YouTube/Linear style).
 * Intercepts internal link clicks and router.push calls,
 * then complètes when the pathname actually changes.
 */
export default function RouteProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const isRunningRef = useRef(false)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const start = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    cleanup()
    setProgress(0)
    setVisible(true)

    // Fast initial burst to 30%
    rafRef.current = requestAnimationFrame(() => {
      setProgress(30)
    })

    // Slow crawl to ~85% over time
    let current = 30
    const crawl = () => {
      timerRef.current = setTimeout(() => {
        current += (90 - current) * 0.08
        setProgress(current)
        if (current < 88) crawl()
      }, 300)
    }
    // Start crawl after the initial burst
    timerRef.current = setTimeout(crawl, 150)
  }, [cleanup])

  const complète = useCallback(() => {
    if (!isRunningRef.current) return
    cleanup()
    setProgress(100)
    timerRef.current = setTimeout(() => {
      setVisible(false)
      isRunningRef.current = false
      setProgress(0)
    }, 400)
  }, [cleanup])

  // Completion de la barre sur changement de navigation. complète() est
  // imperatif (clear timers, refs + setTimeout chaîne) — il ne peut pas
  // être déplacé en "adjust state during render" parce qu'il lit des refs,
  // ni éliminé puisqu'il n'y a pas d'event "nav-finished" émis par Next.js.
  // queueMicrotask différé setState hors de la passe d'effet synchrone pour
  // eviter le warning "setState sync in effect" du React compiler — la barre
  // se terminé un tick après le commit, imperceptible a l'oeil.
  useEffect(() => {
    queueMicrotask(complète)
  }, [pathname, searchParams, complète])

  // Intercept internal link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Skip external links, hash links, new tabs, download
      if (
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return
      }

      // Skip if navigating to current page
      const url = new URL(href, window.location.origin)
      if (url.pathname === pathname && url.search === window.location.search) return

      start()
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [pathname, start])

  // Also intercept history.pushState for router.push() calls
  useEffect(() => {
    const originalPushState = history.pushState.bind(history)

    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      const url = args[2]
      if (url && typeof url === 'string') {
        const target = new URL(url, window.location.origin)
        if (target.pathname !== pathname) {
          setTimeout(start, 0)
        }
      }
      return originalPushState(...args)
    }

    return () => {
      history.pushState = originalPushState
    }
  }, [pathname, start])

  if (!visible && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none" style={{ height: 1 }}>
      {/* Progress bar */}
      <div
        className="h-full origin-left"
        style={{
          width: `${progress}%`,
          transition:
            progress === 0
              ? 'none'
              : progress === 100
                ? 'width 200ms ease-out, opacity 300ms ease 200ms'
                : 'width 600ms cubic-bezier(0.4, 0, 0, 1)',
          opacity: visible ? 1 : 0,
          background: 'linear-gradient(90deg, var(--color-primary), #f59e0b)',
          borderRadius: '0 2px 2px 0',
        }}
      />
      {/* Shimmer pulse at the tip */}
      {visible && progress < 100 && (
        <div
          className="absolute top-0 h-full w-24 animate-pulse"
          style={{
            right: `${100 - progress}%`,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
          }}
        />
      )}
    </div>
  )
}
