/**
 * Dashboard organisateur — Fiche réseau + abonnement.
 *
 * ADR-0012 : deux cas selon la propriété du compte organisateur :
 *
 * 1. **National** (user possède un réseau `niveau=national`) :
 *    - Fiche du national + abonnement
 * 2. **Local délégué** (user possède uniquement un réseau `niveau=local`) :
 *    - Fiche du local uniquement
 *
 * La gestion des GROUPES LOCAUX vit sur /dashboard/locaux et celle des
 * ÉVÉNEMENTS sur /dashboard/evenements (items dédiés de la barre latérale).
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
  CheckCircle,
  AlertCircle,
  Network,
  ExternalLink,
} from 'lucide-react'
import { FicheReseauForm } from './FicheReseauForm'
import { PortalButton } from './CheckoutButtons'
import { BadgePartenaire } from '@/components/ui/BadgeReseauteur'
import { AbonnementNationalStatus } from '@/components/billing/AbonnementNationalStatus'
import Reveal from '@/components/home/Reveal'
import type { Media } from '@/types/reseauteurs-domain'

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
        { niveau: { not_equals: 'local' } },
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const national = (nationauxDocs[0] as unknown as Record<string, unknown> | undefined) ?? null

  if (national) {
    // ─── VUE NATIONALE ─────────────────────────────────────────────────────
    return <NationalDashboard national={national} />
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
      <div className="rsn-page">
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
      </div>
    )
  }

  return <LocalDashboard local={local} />
}

// ─── Dashboard national ─────────────────────────────────────────────────────

async function NationalDashboard({ national }: { national: Record<string, unknown> }) {
  const payload = await getPayload({ config })

  // Groupes locaux du national (compteur du résumé — gestion sur /dashboard/locaux)
  const { docs: locauxDocs, totalDocs: totalLocaux } = await payload.find({
    collection: 'reseaux',
    where: { parent: { equals: national.id as string | number } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  // Jauge d'abonnement : seuls les locaux POSSÉDÉS par le national consomment le
  // quota du palier (ADR-0014 — les locaux affiliés par des réseauteurs Plus, non).
  const nationalUserId =
    typeof national.user === 'object' && national.user !== null
      ? (national.user as { id: number | string }).id
      : (national.user as number | string | null)
  const nbLocauxPossedes = nationalUserId
    ? locauxDocs.filter((l) => {
        const u = (l as unknown as Record<string, unknown>).user
        const uid = typeof u === 'object' && u !== null ? (u as { id: number | string }).id : u
        return uid != null && String(uid) === String(nationalUserId)
      }).length
    : 0

  // Événements du national ET de ses locaux (compteur — gestion sur /dashboard/evenements)
  const localIds = locauxDocs.map((l) => l.id)
  const reseauIds = [national.id as string | number, ...localIds]

  const { totalDocs: totalEvenements } = await payload.count({
    collection: 'evenements',
    where: {
      and: [
        { statut: { equals: 'publie' } },
        { reseau: { in: reseauIds } },
      ],
    },
    overrideAccess: true,
  })

  const estPartenaire = Boolean(national.partenaire)
  const logoMedia = national.logo as Media | null | undefined
  const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <Reveal>
        <p className="rsn-eyebrow mb-2">Espace connecté</p>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
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
      </Reveal>

      {/* Résumé national */}
      <div className="rsn-card rounded-2xl p-5">
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
              {totalLocaux} groupe{totalLocaux !== 1 ? 's' : ''}
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
        nbLocaux={nbLocauxPossedes}
      />

      {/* Édition fiche nationale */}
      <div className="rsn-card rounded-2xl">
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

      {/* Factures */}
      {/* POINT D'INSERTION accounts-and-billing (vague 3) : composant FacturesList */}
      {estPartenaire && (
        <div className="rsn-card rounded-2xl p-5">
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

  // Événements du local délégué (compteur — gestion sur /dashboard/evenements)
  const { totalDocs: totalEvenements } = await payload.count({
    collection: 'evenements',
    where: { reseau: { equals: local.id as string | number } },
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
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <Reveal>
        <p className="rsn-eyebrow mb-2">Espace connecté</p>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
            <Network size={20} className="text-[#a855f7]" aria-hidden />
            Mon groupe local
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
      </Reveal>

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
      <div className="rsn-card rounded-2xl p-5">
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
      <div className="rsn-card rounded-2xl">
        <div className="px-6 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Globe size={14} aria-hidden />
            Informations du groupe
          </h2>
        </div>
        <div className="p-6">
          <FicheReseauForm reseau={local} />
        </div>
      </div>

      </div>
    </div>
  )
}
