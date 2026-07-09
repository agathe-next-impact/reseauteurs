/**
 * Espace partenaire — /dashboard/partenaire
 *
 * Le partenaire (role 'partenaire') édite sa fiche (nom, logo, lien, description),
 * son offre réservée aux réseauteurs, et gère son abonnement (activer / portail Stripe).
 * La fiche n'est publique (bandeau home + /partenaires + fiche perso) que si l'abonnement
 * est actif (statut posé par le webhook Stripe).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { PartenaireForm } from './PartenaireForm'
import type { Partenaire, Media } from '@/types/reseauteurs-domain'

export const metadata = {
  title: 'Mon espace partenaire | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function PartenaireDashboardPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
  if (freshUser.role === 'admin') redirect('/admin')
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role !== 'partenaire') redirect('/dashboard/profil')

  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { user: { equals: user.id } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const partenaire = docs[0] as Partenaire | undefined
  if (!partenaire) redirect('/dashboard')

  const logoMedia = partenaire.logo as Media | null | undefined
  const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url ?? null
  const offre = (partenaire.offre as { titre?: string | null; description?: string | null; lien?: string | null } | null | undefined) ?? null

  const serialized = {
    id: partenaire.id as number,
    slug: partenaire.slug ?? null,
    nom: partenaire.nom ?? '',
    lien: partenaire.lien ?? '',
    description: partenaire.description ?? '',
    logoUrl,
    statut: (partenaire.statut as 'actif' | 'expire') ?? 'expire',
    abonnementExpireAt: (partenaire as { abonnementExpireAt?: string | null }).abonnementExpireAt ?? null,
    offreTitre: offre?.titre ?? '',
    offreDescription: offre?.description ?? '',
    offreLien: offre?.lien ?? '',
  }

  return <PartenaireForm partenaire={serialized} />
}
