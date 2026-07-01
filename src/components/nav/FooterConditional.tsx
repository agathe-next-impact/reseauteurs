'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

const HIDDEN_PATHS = ['/revendeurs', '/evenements']

export default function FooterConditional({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const pathname = usePathname()

  if (HIDDEN_PATHS.some((p) => pathname === p)) {
    return null
  }

  return <Footer isAuthenticated={isAuthenticated} />
}
