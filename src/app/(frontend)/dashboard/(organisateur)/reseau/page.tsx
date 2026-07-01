/**
 * Dashboard organisateur — Réseau, événements, abonnement.
 *
 * ADR-0012 : deux cas selon la propriété du compte organisateur :
 *
 * 1. **National** (user possède un réseau `niveau=national`) :
 *    - Fiche du national + abonnement
 *    - Gestion des chapitres locaux (liste + point d'insertion `accounts-and-billing`)
 *    - Événements (nationaux + locaux visibles grâce à `peutGererReseau` umbrella)
 *
 * 2. **Local délégué** (user possède uniquement un réseau `niveau=local`) :
 *    - Fiche du local uniquement + ses événements
 *    - Pas de création de local ni d'abonnement (visible en lecture)
 *
 * Premium supprimé (ADR-0012) — la mécanique Stripe/abonnement/paliers est gérée
 * par `accounts-and-billing` (vague 3). Points d'insertion marqués clairement.
 *
 * Auth + rôle vérifiés côté serveur. Statut partenaire = DB (jamais client).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import Image from 'next/image'
import {
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  Mail,
  Phone,
  MapPin,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Network,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { FicheReseauForm } from './FicheReseauForm'
import { EvenementsManager } from './EvenementsManager'
import { CheckoutPartenaireButton, PortalButton } from './CheckoutButtons'
import { BadgePartenaire } from '@/components/ui/BadgeReseauteur'
import { AbonnementNationalStatus } from '@/components/billing/AbonnementNationalStatus'
import type { Reseau, Media } from '@/types/reseauteurs-domain'

export const metadata = {
  title: 'Mon réseau — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function DashboardReseauPage() {
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

  // ─── Déterminer national ou local délégué ──────────────────────────────────
  const { docs: nationauxDocs } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        { user: { equals: user.id } },
        { niveau: { equals: 'national' } },
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const national = (nationauxDocs[0] as unknown as Record<string, unknown> | undefined) ?? null

  if (national) {
    // ─── VUE NATIONALE ─────────────────────────────────────────────────────
    return (
      <NationalDashboard
        national={national}
        userId={user.id as string | number}
      />
    )
  }

  // ─── VUE LOCAL DÉLÉGUÉ ──────────────────────────────────────────────────
  const { docs: locauxDocs } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        { user: { equals: user.id } },
        { niveau: { equals: 'local' } },
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const local = (locauxDocs[0] as unknown as Record<string, unknown> | undefined) ?? null

  if (!local) {
    // Aucun réseau associé (signup en cours ou anomalie)
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
        <Building2 size={48} className="text-[#d4d4d8] mx-auto mb-4" aria-hidden />
        <p className="text-sm font-medium text-[#52525b] mb-2">Aucun réseau associé</p>
        <p className="text-sm text-[#71717a] mb-6">
          Votre compte organisateur n&apos;est pas encore rattaché à un réseau. Contactez-nous pour configurer votre espace.
        </p>
        <a
          href={`mailto:contact@reseauteurs.fr?subject=Rattachement réseau — ${freshUser.email as string}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
        >
          <Mail size={15} />
          Contacter le support
        </a>
      </div>
    )
  }

  return <LocalDashboard local={local} />
}

// ─── Dashboard national ─────────────────────────────────────────────────────

async function NationalDashboard({
  national,
  userId,
}: {
  national: Record<string, unknown>
  userId: string | number
}) {
  const payload = await getPayload({ config })

  // Chapitres locaux du national
  const { docs: locauxDocs, totalDocs: totalLocaux } = await payload.find({
    collection: 'reseaux',
    where: { parent: { equals: national.id as string | number } },
    limit: 50,
    sort: 'nom',
    depth: 0,
    overrideAccess: true,
  })

  // Événements du national ET de ses locaux (umbrella — peutGererReseau)
  const localIds = locauxDocs.map((l) => l.id)
  const reseauIds = [national.id as string | number, ...localIds]

  const { docs: evenements, totalDocs: totalEvenements } = await payload.find({
    collection: 'evenements',
    where: {
      and: [
        { statut: { equals: 'publie' } },
        { reseau: { in: reseauIds } },
      ],
    },
    limit: 50,
    sort: '-dateDebut',
    depth: 1,
    overrideAccess: true,
  })

  const estPartenaire = Boolean(national.partenaire)
  const expireAt = national.partenaireExpireAt as string | null | undefined
  const logoMedia = national.logo as Media | null | undefined
  const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url

  const partenaireExpireDisplay = expireAt
    ? new Date(expireAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#16284f] flex items-center gap-2">
          <Building2 size={20} aria-hidden />
          Mon réseau national
        </h1>
        {!!national.slug && (
          <Link
            href={`/reseau/${national.slug as string}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#2563EB] hover:text-[#1d4ed8] font-medium no-underline transition-colors flex items-center gap-1"
          >
            Voir la fiche publique
            <ExternalLink size={12} aria-hidden />
          </Link>
        )}
      </div>

      {/* Résumé national */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7] p-5">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`Logo ${national.nom as string}`}
              width={48}
              height={48}
              className="w-11 h-11 rounded-lg object-contain border border-[#e4e4e7] bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-[#ffedd5]/40 flex items-center justify-center text-[#f5851f] shrink-0" aria-hidden>
              <Building2 size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[#16284f]">{national.nom as string}</p>
              {estPartenaire && <BadgePartenaire />}
            </div>
            <p className="text-xs text-[#a855f7] font-medium mt-0.5">Réseau national</p>
          </div>
          <div className="shrink-0 flex gap-3 text-xs text-[#71717a]">
            <span className="flex items-center gap-1">
              <Network size={11} className="text-[#a855f7]" aria-hidden />
              {totalLocaux} chapitre{totalLocaux !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={11} aria-hidden />
              {totalEvenements} événement{totalEvenements !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Statut abonnement national (E2.A — accounts-and-billing) */}
      <AbonnementNationalStatus
        national={national}
        nbLocaux={totalLocaux}
      />

      {/* Édition fiche nationale */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7]">
        <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Globe size={14} aria-hidden />
            Informations du réseau
          </h2>
          <div className="flex gap-3 text-xs text-[#71717a]">
            {(national.siteWeb as string | null | undefined) && (
              <a href={national.siteWeb as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#2563EB] transition-colors">
                <Globe size={11} />
                Site
              </a>
            )}
            {(national.emailContact as string | null | undefined) && (
              <a href={`mailto:${national.emailContact as string}`} className="flex items-center gap-1 hover:text-[#2563EB] transition-colors">
                <Mail size={11} />
                Email
              </a>
            )}
            {(national.telephone as string | null | undefined) && (
              <a href={`tel:${national.telephone as string}`} className="flex items-center gap-1 hover:text-[#2563EB] transition-colors">
                <Phone size={11} />
                Tél.
              </a>
            )}
          </div>
        </div>
        <div className="p-6">
          <FicheReseauForm reseau={national} />
        </div>
      </div>

      {/* Chapitres locaux */}
      {/* POINT D'INSERTION accounts-and-billing (vague 3) :
          - Remplacer le bouton "+ Créer un chapitre" par CreerLocalButton
          - CreerLocalButton appelle la Server Action createLocalReseau (gate peutCreerLocal côté serveur)
          - Si capacité dépassée → afficher "Montez de palier" avec lien portail Stripe
          - Si non abonné → gate déjà visible via le bloc abonnement ci-dessus
      */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7]">
        <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Network size={14} className="text-[#a855f7]" aria-hidden />
            Chapitres locaux
            <span className="text-[#a1a1aa] font-normal">({totalLocaux})</span>
          </h2>
          {estPartenaire ? (
            <Link
              href="/dashboard/locaux"
              className="flex items-center gap-1.5 text-xs bg-[#a855f7] text-white hover:bg-[#9333ea] px-3 py-1.5 rounded-lg font-medium transition-colors no-underline"
            >
              <Plus size={13} aria-hidden />
              Gérer les chapitres
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <Lock size={13} aria-hidden />
              Abonnement requis
            </span>
          )}
        </div>
        {locauxDocs.length === 0 ? (
          <div className="p-8 text-center">
            <Network size={28} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
            {estPartenaire ? (
              <>
                <p className="text-sm text-[#71717a] mb-4">
                  Aucun chapitre local pour l&apos;instant. Créez votre premier chapitre.
                </p>
                <Link
                  href="/dashboard/locaux"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#a855f7] text-white text-sm font-semibold hover:bg-[#9333ea] transition-colors no-underline"
                >
                  <Plus size={14} aria-hidden />
                  Créer un chapitre
                </Link>
              </>
            ) : (
              <p className="text-sm text-[#71717a]">
                Souscrivez un abonnement pour créer vos chapitres locaux.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#e4e4e7]">
            {(locauxDocs as unknown as Record<string, unknown>[]).slice(0, 10).map((local) => {
              const localLogo = local.logo as Media | null | undefined
              const localLogoUrl = localLogo?.sizes?.thumbnail?.url ?? localLogo?.url
              return (
                <div key={local.id as string} className="flex items-center gap-3 px-6 py-3">
                  {localLogoUrl ? (
                    <Image
                      src={localLogoUrl}
                      alt={`Logo ${local.nom as string}`}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-lg object-contain border border-[#e4e4e7] shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#f3e8ff]/50 flex items-center justify-center text-[#a855f7] shrink-0" aria-hidden>
                      <Network size={14} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#18181b] truncate">{local.nom as string}</p>
                    {(local.ville as string | null | undefined) && (
                      <p className="text-xs text-[#71717a] flex items-center gap-1">
                        <MapPin size={10} aria-hidden />
                        {local.ville as string}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-[#71717a]">
                    <span>{(local.nbReseauteurs as number | null) ?? 0} membres</span>
                    <Link
                      href={`/reseau/${local.slug as string}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                      aria-label={`Voir la fiche de ${local.nom as string}`}
                    >
                      <ExternalLink size={12} aria-hidden />
                    </Link>
                  </div>
                </div>
              )
            })}
            {totalLocaux > 10 && (
              <div className="px-6 py-3">
                <Link href="/dashboard/locaux" className="text-xs text-[#a855f7] hover:text-[#9333ea] no-underline font-medium transition-colors">
                  Voir tous les chapitres ({totalLocaux}) →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Événements */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7]">
        <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Calendar size={14} aria-hidden />
            Événements
            <span className="text-[#a1a1aa] font-normal">({totalEvenements})</span>
          </h2>
          {estPartenaire ? (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs bg-[#2563EB] text-white hover:bg-[#1d4ed8] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
              data-action="new-event"
            >
              <Plus size={13} aria-hidden />
              Nouvel événement
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <Lock size={13} aria-hidden />
              Abonnement requis
            </span>
          )}
        </div>
        {!estPartenaire ? (
          <div className="p-8 text-center">
            <AlertCircle size={28} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
            <p className="text-sm text-[#71717a]">
              La publication d&apos;événements est réservée aux réseaux partenaires.
            </p>
          </div>
        ) : (
          <EvenementsManager
            evenements={evenements as unknown as Record<string, unknown>[]}
            reseauId={national.id as string | number}
          />
        )}
      </div>

      {/* Factures */}
      {/* POINT D'INSERTION accounts-and-billing (vague 3) : composant FacturesList */}
      {estPartenaire && (
        <div className="bg-white rounded-2xl border border-[#e4e4e7] p-5">
          <h2 className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
            <FileText size={14} aria-hidden />
            Factures
          </h2>
          <p className="text-xs text-[#71717a] mb-3">
            Accédez à vos factures depuis le portail Stripe ou la page dédiée.
          </p>
          <div className="flex flex-wrap gap-3">
            <PortalButton className="text-xs text-[#71717a] border border-[#e4e4e7] hover:border-[#2563EB] hover:text-[#2563EB] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60">
              Portail Stripe
            </PortalButton>
            <Link
              href="/dashboard/factures"
              className="inline-flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1d4ed8] font-medium transition-colors"
            >
              <CreditCard size={12} aria-hidden />
              Toutes mes factures
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard local délégué ──────────────────────────────────────────────────

async function LocalDashboard({ local }: { local: Record<string, unknown> }) {
  const payload = await getPayload({ config })

  // National parent (umbrella info)
  const parentDoc =
    typeof local.parent === 'object' && local.parent !== null
      ? (local.parent as Record<string, unknown>)
      : null

  // Événements du local délégué uniquement
  const { docs: evenements, totalDocs: totalEvenements } = await payload.find({
    collection: 'evenements',
    where: { reseau: { equals: local.id as string | number } },
    limit: 50,
    sort: '-dateDebut',
    depth: 0,
    overrideAccess: true,
  })

  const logoMedia = local.logo as Media | null | undefined
  const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url

  // Gate de publication : national doit être partenaire (peutPublierEvenement)
  // Le statut partenaire du national est la source de vérité côté serveur
  const nationalPartenaire = parentDoc
    ? Boolean((parentDoc as Record<string, unknown>).partenaire)
    : false

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#16284f] flex items-center gap-2">
          <Network size={20} className="text-[#a855f7]" aria-hidden />
          Mon chapitre local
        </h1>
        {!!local.slug && (
          <Link
            href={`/reseau/${local.slug as string}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#2563EB] hover:text-[#1d4ed8] font-medium no-underline transition-colors flex items-center gap-1"
          >
            Voir la fiche publique
            <ExternalLink size={12} aria-hidden />
          </Link>
        )}
      </div>

      {/* Référence au national */}
      {parentDoc && (
        <div className="bg-[#f3e8ff]/30 border border-[#a855f7]/20 rounded-2xl p-4 flex items-center gap-3">
          <Network size={16} className="text-[#a855f7] shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#71717a] mb-0.5">Rattaché au réseau national</p>
            <Link
              href={`/reseau/${(parentDoc.slug as string | null | undefined) ?? ''}`}
              className="text-sm font-semibold text-[#a855f7] hover:text-[#9333ea] no-underline transition-colors"
            >
              {parentDoc.nom as string}
            </Link>
          </div>
          <p className="text-xs text-[#71717a] shrink-0">
            {nationalPartenaire ? (
              <span className="text-green-700 flex items-center gap-1">
                <CheckCircle size={12} aria-hidden />
                Abonnement actif
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertCircle size={12} aria-hidden />
                Sans abonnement
              </span>
            )}
          </p>
        </div>
      )}

      {/* Résumé */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7] p-5">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`Logo ${local.nom as string}`}
              width={48}
              height={48}
              className="w-11 h-11 rounded-lg object-contain border border-[#e4e4e7] bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-[#f3e8ff]/40 flex items-center justify-center text-[#a855f7] shrink-0" aria-hidden>
              <Network size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#16284f]">{local.nom as string}</p>
            {(local.ville as string | null | undefined) && (
              <p className="text-xs text-[#71717a] flex items-center gap-1 mt-0.5">
                <MapPin size={10} aria-hidden />
                {local.ville as string}
              </p>
            )}
          </div>
          <div className="shrink-0 text-xs text-[#71717a]">
            <span className="flex items-center gap-1">
              <Calendar size={11} aria-hidden />
              {totalEvenements} événement{totalEvenements !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Édition fiche locale */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7]">
        <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Globe size={14} aria-hidden />
            Informations du chapitre
          </h2>
        </div>
        <div className="p-6">
          <FicheReseauForm reseau={local} />
        </div>
      </div>

      {/* Événements */}
      <div className="bg-white rounded-2xl border border-[#e4e4e7]">
        <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Calendar size={14} aria-hidden />
            Événements
            <span className="text-[#a1a1aa] font-normal">({totalEvenements})</span>
          </h2>
          {nationalPartenaire ? (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs bg-[#2563EB] text-white hover:bg-[#1d4ed8] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
              data-action="new-event"
            >
              <Plus size={13} aria-hidden />
              Nouvel événement
            </button>
          ) : (
            <span className="text-xs text-[#a1a1aa] flex items-center gap-1">
              <Lock size={13} aria-hidden />
              National non abonné
            </span>
          )}
        </div>
        {!nationalPartenaire ? (
          <div className="p-8 text-center">
            <AlertCircle size={28} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
            <p className="text-sm text-[#71717a]">
              La publication d&apos;événements nécessite que le réseau national soit partenaire.
            </p>
          </div>
        ) : (
          <EvenementsManager
            evenements={evenements as unknown as Record<string, unknown>[]}
            reseauId={local.id as string | number}
          />
        )}
      </div>
    </div>
  )
}
