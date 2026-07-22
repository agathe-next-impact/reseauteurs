/**
 * /dashboard/mes-reseaux — Réseaux locaux d'un réseauteur Plus (ADR-0014).
 *
 * Le réseauteur Plus crée et gère ses fiches de réseaux locaux :
 *   - affiliées à une tête de réseau existante (affiliation libre), ou
 *   - indépendantes (sans rattachement).
 * S'il ne trouve pas le réseau national voulu, un encadré lui permet de l'inviter
 * par email à créer son compte organisateur.
 *
 * Gate d'accès : Plus actif (statut lu FRAIS côté serveur — modèle mes-evenements).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { Network } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { estPlus } from '@/lib/acces-plus'
import { MAX_LOCAUX_PLUS } from '@/lib/reseau-hierarchie'
import { MesReseauxClient, type MonReseauLocal, type TeteLite } from './MesReseauxClient'

export const metadata = {
  title: 'Mes réseaux — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function MesReseauxPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
  if (freshUser.role === 'admin') redirect('/admin')
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role === 'partenaire') redirect('/dashboard/partenaire')

  const u = freshUser as unknown as { plusActif?: boolean; plusExpireAt?: string | null }
  const actif = estPlus({ id: freshUser.id, plusActif: u.plusActif, plusExpireAt: u.plusExpireAt })
  if (!actif) redirect('/dashboard/plus')

  // Réseaux locaux possédés (depth 1 : nom de la tête parente pour le badge « Affilié à »)
  const { docs: locauxDocs } = await payload.find({
    collection: 'reseaux',
    where: { and: [{ user: { equals: user.id } }, { niveau: { equals: 'local' } }] },
    depth: 1,
    limit: 20,
    sort: 'nom',
    overrideAccess: true,
  })
  const mesReseaux: MonReseauLocal[] = locauxDocs.map((r) => {
    const doc = r as unknown as Record<string, unknown>
    const parent = doc.parent
    return {
      id: doc.id as number,
      nom: (doc.nom as string) ?? '',
      ville: (doc.ville as string | null) ?? null,
      slug: (doc.slug as string | null) ?? null,
      description: (doc.description as string | null) ?? null,
      presentation: (doc.presentation as string | null) ?? null,
      siteWeb: (doc.siteWeb as string | null) ?? null,
      emailContact: (doc.emailContact as string | null) ?? null,
      telephone: (doc.telephone as string | null) ?? null,
      parentNom:
        typeof parent === 'object' && parent !== null
          ? (((parent as Record<string, unknown>).nom as string) ?? null)
          : null,
    }
  })

  // Têtes de réseau sélectionnables pour l'affiliation (publiées uniquement)
  const { docs: tetesDocs } = await payload.find({
    collection: 'reseaux',
    where: { and: [{ niveau: { not_equals: 'local' } }, { statut: { equals: 'publiee' } }] },
    depth: 0,
    limit: 500,
    sort: 'nom',
    overrideAccess: true,
    select: { nom: true, ville: true } as Record<string, boolean>,
  })
  const tetes: TeteLite[] = tetesDocs.map((t) => ({
    id: t.id as number,
    nom: ((t as { nom?: string }).nom as string) ?? String(t.id),
    ville: ((t as { ville?: string | null }).ville as string | null) ?? null,
  }))

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Reveal>
          <p className="rsn-eyebrow mb-2">Espace connecté</p>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2">
              <Network size={20} className="text-[#3E7CA6]" aria-hidden />
              Mes réseaux
            </h1>
            <Link
              href="/dashboard/mes-evenements"
              className="text-sm text-[#6E7175] hover:text-[#1D1E21] no-underline transition-colors"
            >
              Mes événements →
            </Link>
          </div>
          <p className="text-sm text-[#6E7175]">
            Créez jusqu&apos;à {MAX_LOCAUX_PLUS} fiches de réseaux locaux — affiliées à un réseau
            national ou indépendantes — et publiez leurs événements sur la carte.
          </p>
        </Reveal>

        <MesReseauxClient reseaux={mesReseaux} tetes={tetes} maxReseaux={MAX_LOCAUX_PLUS} />
      </div>
    </div>
  )
}
