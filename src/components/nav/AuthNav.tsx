'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui'
import { useAuth } from './AuthProvider'

export default function AuthNav() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [isPending, setIsPending] = useState(false)

  async function handleLogout() {
    setIsPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST' })
    } catch {
      // Even if the network request errors, force the hard nav so the user
      // ends up in a consistent client-side state.
    }
    // Hard navigation to flush the stale payload-token cookie and force a
    // fresh render of (frontend)/layout.tsx — a soft router.push() reuses
    // the layout RSC computed pre-logout, leaving AuthNav in connected mode.
    const target = pathname?.startsWith('/dashboard') ? '/' : pathname || '/'
    window.location.assign(target)
  }

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="text-text-medium no-underline hover:text-text-dark transition-colors"
        >
          Connexion
        </Link>
        <Link href="/inscription">
          <Button variant="primary" size="md">
            Inscription
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/dashboard"
        className="text-text-medium no-underline hover:text-text-dark transition-colors"
      >
        Mon espace
      </Link>
      <button
        onClick={handleLogout}
        disabled={isPending}
        className="bg-transparent border-none text-text-light cursor-pointer p-0 hover:text-text-dark transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        Déconnexion
      </button>
    </div>
  )
}
