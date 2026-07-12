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
import { LicencesSection, type PackLite } from './LicencesSection'
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

  // Packs de licences Plus du partenaire (ADR-0013 P2.B)
  const { docs: packDocs } = await payload.find({
    collection: 'licences-packs',
    where: { partenaire: { equals: partenaire.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  const packs: PackLite[] = packDocs.map((p) => ({
    id: p.id as number,
    code: (p.code as string | null) ?? null,
    quota: Number(p.quota ?? 0),
    quotaUtilise: Number(p.quotaUtilise ?? 0),
    statut: (p.statut as PackLite['statut']) ?? 'actif',
    expireAt: (p.expireAt as string | null) ?? null,
  }))

  return (
    <>
      <PartenaireForm partenaire={serialized} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-10 -mt-2">
        <LicencesSection
          partenaireId={partenaire.id as number}
          packs={packs}
          abonnementActif={serialized.statut === 'actif'}
        />
      </div>
    </>
  )
}
