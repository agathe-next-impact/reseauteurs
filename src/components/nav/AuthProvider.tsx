'use client'

/**
 * AuthProvider — contexte d'auth hydraté côté client (audit perf P1).
 *
 * Récupère l'état de session UNE fois via GET /api/auth/me, pour que la nav
 * (AuthNav, MobileNavReseauteurs, FooterReseauteurs) n'oblige plus le layout racine
 * à appeler headers()/payload.auth() — ce qui rendait toute route `(frontend)`
 * dynamique et annulait l'ISR. Le HTML statique montre l'état déconnecté ; le client
 * bascule sur l'état réel après montage.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DashboardRole } from '@/lib/dashboard-nav'

export interface AuthUser {
  email: string
  nomSociete: string
  role: DashboardRole
  /** Organisateur d'une tête de réseau (dérivé côté serveur) — débloque « Mes groupes ». */
  isNational?: boolean
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive) setState({ user: (j?.user as AuthUser | null) ?? null, loading: false })
      })
      .catch(() => {
        if (alive) setState({ user: null, loading: false })
      })
    return () => {
      alive = false
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
