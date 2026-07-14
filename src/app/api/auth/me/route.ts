/**
 * GET /api/auth/me — état d'authentification du visiteur (per-user, non caché).
 *
 * Permet aux pages `(frontend)` de rester ISR/statiques : l'état auth de la nav
 * (email, nomSociete, rôle) est hydraté côté client via AuthProvider au lieu d'être
 * résolu dans le Server Component racine (ce qui basculait TOUTES les routes en
 * rendu dynamique — audit perf P1). Aucune donnée sensible : juste de quoi afficher
 * le menu compte.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) return NextResponse.json({ user: null })

  // Rôle de navigation (mapping historique : partenaire retombe sur reseauteur côté nav).
  const r = user.role as string
  const role: 'reseauteur' | 'organisateur' | 'admin' =
    r === 'organisateur' ? 'organisateur' : r === 'admin' ? 'admin' : 'reseauteur'

  return NextResponse.json({
    user: { email: user.email ?? '', nomSociete: (user.nomSociete as string) ?? '', role },
  })
}
