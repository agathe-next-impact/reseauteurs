/**
 * Layout dashboard RÉSEAUTEURS.
 * Commun aux rôles réseauteur, organisateur et admin.
 * Auth vérifiée côté serveur (Payload JWT). Rôle dérivé du freshUser.
 * ADR-0012 : isNational dérivé du niveau du réseau possédé (pas de 4e rôle).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import DashboardSidebarReseauteurs from '@/components/dashboard/DashboardSidebarReseauteurs'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  // 4 rôles (ADR-0013) : le partenaire a son propre menu (fiche partenaire, factures) —
  // le rabattre sur « réseauteur » masquait sa fiche dans l'espace perso (bug 2026-07-16).
  const role: 'reseauteur' | 'organisateur' | 'partenaire' | 'admin' =
    (freshUser.role as string) === 'organisateur' ? 'organisateur'
    : (freshUser.role as string) === 'admin' ? 'admin'
    : (freshUser.role as string) === 'partenaire' ? 'partenaire'
    : 'reseauteur'

  const displayName: string =
    (freshUser.nomSociete as string | undefined) || (freshUser.email as string | undefined) || 'Mon compte'

  // ADR-0012 : national dérivé du niveau du réseau possédé (Q1 — pas de 4e rôle)
  let isNational = false
  if (role === 'organisateur') {
    const { totalDocs } = await payload.find({
      collection: 'reseaux',
      where: {
        and: [
          { user: { equals: freshUser.id } },
          { niveau: { not_equals: 'local' } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    isNational = totalDocs > 0
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <DashboardSidebarReseauteurs role={role} displayName={displayName} isNational={isNational} />
      <main className="flex-1 bg-[#faf9f5]/50 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
