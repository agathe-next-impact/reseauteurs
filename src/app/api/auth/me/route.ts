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
import type { DashboardRole } from '@/lib/dashboard-nav'

export async function GET() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) return NextResponse.json({ user: null })

  // Les 4 rôles (ADR-0013) : le menu mobile affiche la navigation de l'espace membre,
  // qui diffère par rôle — rabattre `partenaire` sur `reseauteur` (mapping historique)
  // lui montrait « Mon profil / Participations » au lieu de « Ma fiche partenaire ».
  const r = user.role as string
  const role: DashboardRole =
    r === 'organisateur' ? 'organisateur'
    : r === 'admin' ? 'admin'
    : r === 'partenaire' ? 'partenaire'
    : 'reseauteur'

  // ADR-0012 : national dérivé du niveau du réseau possédé (jamais déclaré par le client).
  let isNational = false
  if (role === 'organisateur') {
    const { totalDocs } = await payload.find({
      collection: 'reseaux',
      where: {
        and: [{ user: { equals: user.id } }, { niveau: { not_equals: 'local' } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    isNational = totalDocs > 0
  }

  return NextResponse.json({
    user: {
      email: user.email ?? '',
      nomSociete: (user.nomSociete as string) ?? '',
      role,
      isNational,
    },
  })
}
