'use client'

/**
 * FooterAccountLink — lien « Mon espace » du pied de page, affiché seulement si connecté.
 * Îlot client (useAuth) pour garder FooterReseauteurs statique (Server Component) — audit perf P1.
 */
import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function FooterAccountLink() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <li>
      <Link href="/dashboard" className="text-[#6E7175] hover:text-[#035AA6] no-underline transition-colors">
        Mon espace
      </Link>
    </li>
  )
}
