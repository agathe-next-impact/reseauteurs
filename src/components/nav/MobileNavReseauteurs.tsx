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
            className="p-2.5 rounded-lg text-[#4E5155] hover:text-[#035AA6] hover:bg-[#A9C9E4]/30 transition-colors"
            aria-label="Mon espace"
          >
            <LayoutDashboard size={20} />
          </Link>
        ) : (
          <Link
            href="/inscription"
            className="p-2.5 rounded-full bg-[#035AA6] text-white text-sm font-semibold hover:bg-[#02467F] transition-colors no-underline"
          >
            S&apos;inscrire
          </Link>
        )}
        <button
          className="p-2.5 rounded-lg text-[#4E5155] hover:text-[#1D1E21] hover:bg-[#E9E9EA] transition-colors cursor-pointer"
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
            className="absolute top-0 right-0 bottom-0 w-[280px] bg-white border-l border-[#DFE0E1] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DFE0E1]">
              <span className="text-sm font-bold text-[#012A4A]">Menu</span>
              <button
                onClick={close}
                className="p-2.5 rounded-md hover:bg-[#E9E9EA] text-[#6E7175] cursor-pointer"
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
                      ? 'bg-[#A9C9E4]/30 text-[#035AA6] border-r-2 border-[#035AA6]'
                      : 'text-[#4E5155] hover:bg-[#E9E9EA] hover:text-[#1D1E21]'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-[#DFE0E1] p-4">
              {user ? (
                <div className="space-y-1">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium text-[#4E5155] hover:bg-[#E9E9EA] hover:text-[#1D1E21] no-underline transition-colors"
                  >
                    <LayoutDashboard size={18} />
                    Mon espace
                  </Link>
                  <button
                    onClick={handleLogout}
                    disabled={isPending}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium text-[#6E7175] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium text-[#4E5155] no-underline hover:bg-[#E9E9EA] hover:text-[#1D1E21] transition-colors"
                  >
                    <LogIn size={18} />
                    Connexion
                  </Link>
                  <Link
                    href="/inscription"
                    className="flex items-center justify-center gap-2 w-full p-2.5 rounded-full bg-[#035AA6] text-white text-sm font-semibold no-underline hover:bg-[#02467F] transition-colors"
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
