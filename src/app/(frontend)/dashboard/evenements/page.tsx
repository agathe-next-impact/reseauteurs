/**
 * /dashboard/evenements — Gestion des événements (organisateur).
 *
 * ADR-0012 :
 *   - National : événements du national + de ses groupes locaux (umbrella peutGererReseau).
 *   - Local délégué : événements de son groupe uniquement.
 *
 * Gate de publication : abonnement partenaire du national effectif — source DB,
 * jamais le client (peutPublierEvenement).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { Calendar, Lock, AlertCircle } from 'lucide-react'
import { EvenementsManager } from '../(organisateur)/reseau/EvenementsManager'
import { peutPublierEvenement, type ReseauForHierarchy } from '@/lib/reseau-hierarchie'
import Reveal from '@/components/home/Reveal'

export const metadata = {
  title: 'Mes événements — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function DashboardEvenementsPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  if (freshUser.role === 'reseauteur') redirect('/dashboard/profil')
  if (freshUser.role === 'admin') redirect('/admin')

  // Réseau de l'organisateur (depth 1 : parent populé pour le gate hiérarchique)
  const { docs: reseauxDocs } = await payload.find({
    collection: 'reseaux',
    where: { user: { equals: user.id } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const reseau = (reseauxDocs[0] as unknown as Record<string, unknown> | undefined) ?? null

  // Aucun réseau associé → message dédié sur /dashboard/reseau
  if (!reseau) redirect('/dashboard/reseau')

  const estLocal = reseau.niveau === 'local'

  // Périmètre : national → ses événements + ceux de ses groupes (umbrella) ; local → les siens
  let reseauIds: Array<string | number> = [reseau.id as string | number]
  if (!estLocal) {
    const { docs: locauxDocs } = await payload.find({
      collection: 'reseaux',
      where: { parent: { equals: reseau.id as string | number } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    reseauIds = [...reseauIds, ...locauxDocs.map((l) => l.id)]
  }

  // depth 1 : popule `image` (aperçu du visuel dans le formulaire d'édition)
  const { docs: evenements, totalDocs: totalEvenements } = await payload.find({
    collection: 'evenements',
    where: { reseau: { in: reseauIds } },
    limit: 100,
    sort: '-dateDebut',
    depth: 1,
    overrideAccess: true,
  })

  // Catégories (select requis du formulaire — type_id NOT NULL)
  const { docs: typesDocs } = await payload.find({
    collection: 'types-evenement',
    limit: 50,
    sort: 'ordre',
    depth: 0,
    overrideAccess: true,
  })
  const types = typesDocs.map((t) => ({
    id: t.id as number,
    label: ((t as { label?: string }).label as string) ?? String(t.id),
  }))

  // Gate serveur : le national effectif doit être partenaire (ADR-0012)
  const peutPublier = peutPublierEvenement(reseau as unknown as ReseauForHierarchy)

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <Reveal>
          <p className="rsn-eyebrow mb-2">Espace connecté</p>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
              <Calendar size={20} aria-hidden />
              Mes événements
            </h1>
            <Link
              href="/dashboard/reseau"
              className="text-sm text-[#71717a] hover:text-[#18181b] no-underline transition-colors"
            >
              ← Mon réseau
            </Link>
          </div>
        </Reveal>

        {/* Gate abonnement */}
        {!peutPublier && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Abonnement requis</p>
                {estLocal ? (
                  <p className="text-xs text-amber-700">
                    La publication d&apos;événements nécessite que votre réseau national soit partenaire.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-amber-700 mb-3">
                      Pour publier des événements sur la carte, votre réseau doit avoir un abonnement actif.
                    </p>
                    <Link
                      href="/dashboard/abonnement"
                      className="inline-flex items-center gap-1.5 text-xs bg-[#f5851f] text-white hover:bg-[#e07518] px-4 py-2 rounded-xl font-semibold transition-colors no-underline"
                    >
                      Souscrire un abonnement →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Gestion des événements */}
        <div className="rsn-card rounded-2xl">
          <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
              <Calendar size={14} aria-hidden />
              Événements
              <span className="text-[#a1a1aa] font-normal">({totalEvenements})</span>
            </h2>
            {!peutPublier && (
              <span className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                <Lock size={13} aria-hidden />
                Abonnement requis
              </span>
            )}
          </div>
          {!peutPublier ? (
            <div className="p-8 text-center">
              <AlertCircle size={28} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
              <p className="text-sm text-[#71717a]">
                La publication d&apos;événements est réservée aux réseaux partenaires.
              </p>
            </div>
          ) : (
            <EvenementsManager evenements={evenements as unknown as Record<string, unknown>[]} types={types} />
          )}
        </div>
      </div>
    </div>
  )
}
