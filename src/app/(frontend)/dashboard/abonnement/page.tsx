/**
 * /dashboard/abonnement — Hub UNIQUE de gestion d'abonnement (ADR-0016).
 *
 * Ouvert à TOUS les rôles souscripteurs (réseauteur Plus, organisateur de réseau
 * national, partenaire annonceur). Chacun y gère entièrement son abonnement :
 * voir l'état (actif / annulation programmée / échec de paiement), souscrire, changer
 * de palier (organisateur), annuler, réactiver, moyen de paiement, factures.
 *
 * Source de vérité de l'accès : DB (posée par webhooks). Détail « annulation programmée /
 * renouvellement » : lu EN DIRECT chez Stripe (resolveAbonnement + fetchLiveStripeState).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { CreditCard } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { resolveAbonnement, fetchLiveStripeState } from '@/lib/abonnement'
import { PALIERS_CONFIG } from '@/lib/reseau-hierarchie'
import { PALIER_PRIX_HT, PRIX_PLUS_HT, PRIX_ANNONCEUR_HT } from '@/lib/tarifs'
import { AbonnementManager, type AbonnementView } from '@/components/billing/AbonnementManager'

export const metadata: Metadata = {
  title: 'Abonnement — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function AbonnementPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
  if (freshUser.role === 'admin') redirect('/admin')

  const ctx = await resolveAbonnement(freshUser as never, payload)
  if (!ctx) redirect('/dashboard')

  // État live Stripe (annulation programmée / renouvellement) — tolérant aux pannes.
  const live = await fetchLiveStripeState(ctx.subscriptionId)

  const view: AbonnementView = {
    produit: ctx.produit,
    label: ctx.label,
    statutGate: ctx.statutGate,
    hasSubscription: Boolean(ctx.subscriptionId),
    hasCustomer: Boolean(ctx.customerId),
    live: live
      ? {
          status: live.status,
          currentPeriodEndISO: live.currentPeriodEnd,
          cancelAtPeriodEnd: live.cancelAtPeriodEnd,
        }
      : null,
    expireAtISO: ctx.expireAt,
    // Le palier live (dérivé du priceId) prime sur la valeur DB si disponible.
    palier: live?.palier ?? ctx.palier,
    supportsPalier: ctx.supportsPalier,
    reseauId: ctx.reseauId ?? null,
    source: ctx.source ?? null,
    motifIndisponible: ctx.motifIndisponible ?? null,
    // Prix HT/an du produit à prix unique (Plus, annonceur) ; null pour le réseau (par palier).
    prixHT:
      ctx.produit === 'reseauteur_plus'
        ? PRIX_PLUS_HT
        : ctx.produit === 'partenaire_annonceur'
          ? PRIX_ANNONCEUR_HT
          : null,
    paliers: ctx.supportsPalier
      ? Object.entries(PALIERS_CONFIG).map(([value, cfg]) => ({
          value,
          label: cfg.label,
          capacite: cfg.maxLocaux,
          prixHT: PALIER_PRIX_HT[value] ?? null,
        }))
      : [],
  }

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Reveal className="mb-6">
          <p className="rsn-eyebrow mb-2">Espace connecté</p>
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
            <CreditCard size={22} aria-hidden />
            Mon abonnement
          </h1>
          <p className="text-sm text-[#71717a] mt-1">{ctx.label}</p>
        </Reveal>

        <AbonnementManager view={view} />
      </div>
    </div>
  )
}
