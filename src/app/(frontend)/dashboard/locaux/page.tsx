/**
 * Dashboard — Gestion des groupes locaux (/dashboard/locaux)
 *
 * Réservé aux organisateurs qui possèdent un réseau national.
 * Les délégués (locaux seulement) sont redirigés vers /dashboard/reseau.
 * Les réseauteurs et admins sont redirigés.
 *
 * ══ POINTS D'INSERTION accounts-and-billing (vague 3) ══════════════════════
 * 1. Bouton « Créer un groupe » : remplacer par <CreerLocalButton reseauNationalId={...} />
 *    → la Server Action `createLocalReseau` doit vérifier `peutCreerLocal(user)` (gate serveur)
 *    → si capacité dépassée : message FR + lien portail Stripe (monter de palier)
 *    → si non abonné : message FR + lien abonnement
 * 2. Délégation d'un local à un compte organisateur : admin-only (Q2) — pas de self-serve.
 *    Afficher en lecture le statut de délégation (local.user !== nationalUser.id).
 * ════════════════════════════════════════════════════════════════════════════
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import Image from 'next/image'
import {
  Network,
  MapPin,
  Users,
  Calendar,
  ExternalLink,
  Lock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import type { Media } from '@/types/reseauteurs-domain'
import { CreerLocalButton } from '@/components/billing/CreerLocalButton'
import { maxLocaux } from '@/lib/reseau-hierarchie'
import Reveal from '@/components/home/Reveal'

export const metadata = {
  title: 'Mes groupes locaux — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function DashboardLocauxPage() {
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

  // Vérifier que l'utilisateur est national
  const { docs: nationauxDocs } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        { user: { equals: user.id } },
        { niveau: { not_equals: 'local' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const national = (nationauxDocs[0] as unknown as Record<string, unknown> | undefined) ?? null

  if (!national) {
    // Délégué local → rediriger vers la gestion de son local
    redirect('/dashboard/reseau')
  }

  const estPartenaire = Boolean(national.partenaire)

  // Groupes locaux du national
  const { docs: locauxDocs, totalDocs: totalLocaux } = await payload.find({
    collection: 'reseaux',
    where: { parent: { equals: national.id as string | number } },
    limit: 200,
    sort: 'nom',
    depth: 0,
    overrideAccess: true,
  })

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <Reveal>
        <p className="rsn-eyebrow mb-2">Espace connecté</p>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2">
            <Network size={20} className="text-[#3E7CA6]" aria-hidden />
            Mes groupes locaux
          </h1>
          <Link
            href="/dashboard/reseau"
            className="text-sm text-[#6E7175] hover:text-[#1D1E21] no-underline transition-colors"
          >
            ← Mon réseau national
          </Link>
        </div>
      </Reveal>

      {/* Réseau national de référence */}
      <div className="rsn-card rounded-2xl p-4 flex items-center gap-3">
        <Building2Small />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#6E7175]">Réseau national</p>
          <p className="font-bold text-[#012A4A] truncate">{national.nom as string}</p>
        </div>
        <div className="shrink-0 text-xs">
          {estPartenaire ? (
            <span className="text-green-700 flex items-center gap-1 font-medium">
              <CheckCircle size={13} aria-hidden />
              Abonné
            </span>
          ) : (
            <span className="text-amber-700 flex items-center gap-1">
              <AlertCircle size={13} aria-hidden />
              Non abonné
            </span>
          )}
        </div>
      </div>

      {/* Gate abonnement */}
      {!estPartenaire && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Abonnement requis</p>
              <p className="text-xs text-amber-700 mb-3">
                Pour créer des groupes locaux et leur permettre de publier des événements, votre réseau national doit avoir un abonnement actif.
              </p>
              <Link
                href="/dashboard/reseau"
                className="inline-flex items-center gap-1.5 text-xs bg-[#F5E050] text-[#012A4A] hover:bg-[#E3CB2E] p-2.5 rounded-xl font-semibold transition-colors no-underline"
              >
                Souscrire un abonnement →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Liste des groupes */}
      <div className="rsn-card rounded-2xl">
        <div className="px-6 py-4 border-b border-[#DFE0E1] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1D1E21] flex items-center gap-1.5">
            <Network size={14} className="text-[#3E7CA6]" aria-hidden />
            Groupes
            <span className="text-[#999A9D] font-normal">({totalLocaux})</span>
          </h2>
          {/* E2.A — accounts-and-billing : CreerLocalButton avec gate palier serveur */}
          {estPartenaire && maxLocaux(national.palier as string | null) === 0 ? (
            // ADR-0014 : palier « fiche » — publication de la fiche seulement
            <span className="flex items-center gap-1.5 text-xs text-[#999A9D]">
              <Lock size={13} aria-hidden />
              Palier fiche — montez de palier pour créer des groupes
            </span>
          ) : estPartenaire ? (
            <CreerLocalButton reseauNationalId={national.id as string | number} />
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#999A9D]">
              <Lock size={13} aria-hidden />
              Abonnement requis
            </span>
          )}
        </div>

        {locauxDocs.length === 0 ? (
          <div className="p-12 text-center">
            <Network size={36} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#4E5155] mb-2">Aucun groupe local</p>
            {estPartenaire ? (
              <p className="text-sm text-[#6E7175]">
                Créez votre premier groupe local pour structurer la présence régionale de votre réseau.
              </p>
            ) : (
              <p className="text-sm text-[#6E7175]">
                Souscrivez un abonnement pour créer des groupes locaux.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#DFE0E1]">
            {(locauxDocs as unknown as Record<string, unknown>[]).map((local) => {
              const logoMedia = local.logo as Media | null | undefined
              const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url

              // Statut de délégation : si local.user !== national.user → délégué
              const isDelegue =
                local.user !== null &&
                local.user !== undefined &&
                local.user !== (national.user as unknown)

              return (
                <div key={local.id as string} className="flex items-center gap-3 px-6 py-4">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={`Logo ${local.nom as string}`}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-xl object-contain border border-[#DFE0E1] shrink-0"
                    />
                  ) : (
                    <div className="flex items-center justify-center text-[#3E7CA6] shrink-0" aria-hidden>
                      <Network size={16} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1D1E21] truncate">
                      {local.nom as string}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {(local.ville as string | null | undefined) && (
                        <p className="text-xs text-[#6E7175] flex items-center gap-1">
                          <MapPin size={10} aria-hidden />
                          {local.ville as string}
                        </p>
                      )}
                      <p className="text-xs text-[#6E7175] flex items-center gap-1">
                        <Users size={10} aria-hidden />
                        {(local.nbReseauteurs as number | null) ?? 0} membres
                      </p>
                      <p className="text-xs text-[#6E7175] flex items-center gap-1">
                        <Calendar size={10} aria-hidden />
                        {(local.nbEvenements as number | null) ?? 0} événements
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    {/* Statut de délégation (lecture seule — Q2 : réassignation admin uniquement) */}
                    {isDelegue && (
                      <span className="text-xs text-[#6E7175] bg-[#E9E9EA] px-2 py-0.5 rounded-full">
                        Délégué
                      </span>
                    )}
                    {!!local.slug && (
                      <Link
                        href={`/reseau/${local.slug as string}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#035AA6] hover:text-[#02467F] transition-colors"
                        aria-label={`Voir la fiche de ${local.nom as string}`}
                      >
                        <ExternalLink size={14} aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      </div>
    </div>
  )
}

// Petit composant interne pour l'icône bâtiment
function Building2Small() {
  return (
    <div className="flex items-center justify-center text-[#035AA6] shrink-0" aria-hidden>
      <Network size={18} />
    </div>
  )
}
