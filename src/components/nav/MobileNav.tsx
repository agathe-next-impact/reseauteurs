'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, MapPin, Calendar, LogIn, UserPlus, LayoutDashboard, LogOut, Loader2 } from 'lucide-react'
import { NAV_ITEMS, filterNavItems } from '@/components/dashboard/nav-items'

interface MobileNavProps {
  user: { email: string; nomSociete: string } | null
  plan?: 'gratuit' | 'premium' | 'infinite'
  role?: 'fournisseur' | 'organisateur' | 'admin'
}

export default function MobileNav({ user, plan = 'gratuit', role = 'fournisseur' }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pathname = usePathname()
  const router = useRouter()

  const close = useCallback(() => setOpen(false), [])

  const dashboardItems = user ? filterNavItems(NAV_ITEMS, plan, role) : []

  // Fermeture du drawer sur navigation via adjust-state-while-rendering
  // (react.dev) plutot qu'un useEffect([pathname]) — evite le render
  // supplementaire qu'un setState-in-effect declencherait à chaque nav.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (open) setOpen(false)
  }

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  async function handleLogout() {
    await fetch('/api/users/logout', { method: 'POST' })
    close()
    startTransition(() => {
      if (pathname?.startsWith('/dashboard')) {
        router.push('/')
      }
      router.refresh()
    })
  }

  const isActive = (href: string) => pathname === href
  const isDashboardActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href) ?? false

  return (
    <>
      {/* Mobile header icons — visible only on mobile */}
      <div className="sm:hidden flex items-center gap-1 -mr-2">
        {user ? (
          <>
            <Link
              href="/dashboard"
              className="p-3 rounded-lg text-text-medium hover:text-primary hover:bg-primary-light/50 transition-colors"
              aria-label="Mon espace"
            >
              <LayoutDashboard size={20} />
            </Link>
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="p-3 rounded-lg text-text-medium hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Déconnexion"
            >
              {isPending ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="p-3 rounded-lg text-text-medium hover:text-primary hover:bg-primary-light/50 transition-colors"
              aria-label="Connexion"
            >
              <LogIn size={20} />
            </Link>
            <Link
              href="/inscription"
              className="p-3 rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors"
              aria-label="Inscription"
            >
              <UserPlus size={20} />
            </Link>
          </>
        )}
        <button
          className="p-2.5 rounded-lg text-text-medium hover:text-text-dark hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Drawer overlay + panel */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-9990">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={close}
            aria-hidden
          />

          {/* Slide-in panel */}
          <nav
            className="absolute top-0 right-0 bottom-0 w-[280px] bg-white shadow-2xl flex flex-col animate-[slideLeft_200ms_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="text-sm font-semibold text-text-dark">Menu</span>
              <button
                onClick={close}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer"
                aria-label="Fermer le menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 py-3 overflow-y-auto">
              <Link
                href="/revendeurs"
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium no-underline transition-colors ${
                  isActive('/revendeurs')
                    ? 'bg-primary-light/50 text-primary border-r-2 border-primary'
                    : 'text-text-medium hover:bg-gray-50 hover:text-text-dark'
                }`}
              >
                <MapPin size={18} />
                Revendeurs
              </Link>

              <Link
                href="/evenements"
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium no-underline transition-colors ${
                  isActive('/evenements')
                    ? 'bg-primary-light/50 text-primary border-r-2 border-primary'
                    : 'text-text-medium hover:bg-gray-50 hover:text-text-dark'
                }`}
              >
                <Calendar size={18} />
                Événements
              </Link>

              {/* Dashboard section — only when authenticated & on /dashboard/* */}
              {dashboardItems.length > 0 && (
                <div className="mt-2 pt-3 border-t border-gray-100">
                  <p className="px-5 pb-2 text-sm font-semibold text-text-light uppercase tracking-wider">
                    Tableau de bord
                  </p>
                  {dashboardItems.map((item) => {
                    const Icon = item.icon
                    const active = isDashboardActive(item.href)
                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium no-underline transition-colors ${
                          active
                            ? 'bg-primary-light/50 text-primary border-r-2 border-primary'
                            : 'text-text-medium hover:bg-gray-50 hover:text-text-dark'
                        }`}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Auth section */}
            <div className="border-t border-gray-100 p-4">
              {user ? (
                <div className="space-y-1">
                  <button
                    onClick={handleLogout}
                    disabled={isPending}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-light hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-medium no-underline hover:bg-gray-50 hover:text-text-dark transition-colors"
                  >
                    <LogIn size={18} />
                    Connexion
                  </Link>
                  <Link
                    href="/inscription"
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-full bg-primary text-white text-sm font-medium no-underline hover:bg-primary/80 transition-colors"
                  >
                    <UserPlus size={18} />
                    Inscription
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
