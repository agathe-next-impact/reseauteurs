'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Users, Calendar, Network, Handshake, LogIn, UserPlus, LayoutDashboard, LogOut, Loader2 } from 'lucide-react'
import { useAuth } from './AuthProvider'

const NAV_LINKS = [
  { href: '/reseauteurs', label: 'Réseauteurs', icon: Users },
  { href: '/evenements', label: 'Événements', icon: Calendar },
  { href: '/reseaux', label: 'Réseaux', icon: Network },
  { href: '/partenaires', label: 'Entreprises', icon: Handshake },
]

export default function MobileNavReseauteurs() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const pathname = usePathname()
  const close = useCallback(() => setOpen(false), [])

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  async function handleLogout() {
    setIsPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST' })
    } catch { /* ignore */ }
    window.location.assign('/')
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/')

  return (
    <>
      <div className="lg:hidden flex items-center gap-1 -mr-1">
        {user ? (
          <Link
            href="/dashboard"
            className="p-2.5 rounded-lg text-[#52525b] hover:text-[#2563EB] hover:bg-[#bfdbfe]/30 transition-colors"
            aria-label="Mon espace"
          >
            <LayoutDashboard size={20} />
          </Link>
        ) : (
          <Link
            href="/inscription"
            className="px-3 py-1.5 rounded-full bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors no-underline"
          >
            S&apos;inscrire
          </Link>
        )}
        <button
          className="p-2.5 rounded-lg text-[#52525b] hover:text-[#18181b] hover:bg-[#f4f4f5] transition-colors cursor-pointer"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          <Menu size={22} />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-[9990]">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden />
          <nav
            className="absolute top-0 right-0 bottom-0 w-[280px] bg-white border-l border-[#e4e4e7] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e4e7]">
              <span className="text-sm font-bold text-[#16284f]">Menu</span>
              <button
                onClick={close}
                className="p-1.5 rounded-md hover:bg-[#f4f4f5] text-[#71717a] cursor-pointer"
                aria-label="Fermer le menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 py-3 overflow-y-auto">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-5 py-3 text-sm font-medium no-underline transition-colors ${
                    isActive(href)
                      ? 'bg-[#bfdbfe]/30 text-[#2563EB] border-r-2 border-[#2563EB]'
                      : 'text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-[#e4e4e7] p-4">
              {user ? (
                <div className="space-y-1">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b] no-underline transition-colors"
                  >
                    <LayoutDashboard size={18} />
                    Mon espace
                  </Link>
                  <button
                    onClick={handleLogout}
                    disabled={isPending}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#71717a] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#52525b] no-underline hover:bg-[#f4f4f5] hover:text-[#18181b] transition-colors"
                  >
                    <LogIn size={18} />
                    Connexion
                  </Link>
                  <Link
                    href="/inscription"
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-full bg-[#2563EB] text-white text-sm font-semibold no-underline hover:bg-[#1d4ed8] transition-colors"
                  >
                    <UserPlus size={18} />
                    Créer mon profil — gratuit
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
