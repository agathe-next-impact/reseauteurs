'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// event/fournisseur sont poses par les slideovers via history.replaceState — pas un changement de contenu principal
const IGNORED_PARAMS = ['event', 'fournisseur'] as const

export default function ScrollToTop() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const relevantKey = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    IGNORED_PARAMS.forEach((k) => params.delete(k))
    params.sort()
    return params.toString()
  }, [searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash) return

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

    document.querySelectorAll<HTMLElement>('main').forEach((el) => {
      el.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
  }, [pathname, relevantKey])

  return null
}
