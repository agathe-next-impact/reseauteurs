/**
 * /dashboard/abonnement — Page abonnement organisateur (ADR-0011).
 *
 * Exclusivement pour les comptes organisateurs (réseau partenaire).
 * Les réseauteurs sont et restent gratuits (ADR-0011 §4).
 *
 * Fonctionnalités :
 *   - Statut d'abonnement lu depuis reseau.partenaire / reseau.partenaireExpireAt (DB, source de vérité serveur)
 *   - Bouton « Souscrire » → Stripe Checkout Subscription réseau partenaire
 *   - Bouton « Gérer l'abonnement » → Stripe Customer Portal
 *   - Lien vers les factures PDF (/dashboard/factures)
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { CreditCard, CheckCircle, Building2, CalendarDays, FileText } from 'lucide-react'
import Link from 'next/link'
import {
  CheckoutPartenaireButton,
  PortalButton,
} from '@/app/(frontend)/dashboard/(organisateur)/reseau/CheckoutButtons'
import Reveal from '@/components/home/Reveal'

export const metadata: Metadata = {
  title: 'Abonnement — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function AbonnementPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  // Les réseauteurs n'ont pas d'abonnement : les renvoyer à leur profil.
  if ((user as { role?: string }).role === 'reseauteur') {
    redirect('/dashboard/profil')
  }

  // Pour les organisateurs, charger la fiche NATIONALE liée (ADR-0012 : abonnement au national).
  // Statut lu depuis national.partenaire / national.palier / national.partenaireExpireAt (DB, source de vérité serveur).
  let reseau: {
    id: string | number
    nom?: string
    partenaire?: boolean
    palier?: string
    partenaireExpireAt?: string
    stripeSubscriptionId?: string
  } | null = null

  if ((user as { role?: string }).role === 'organisateur') {
    const reseauxRes = await payload.find({
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
    if (reseauxRes.docs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reseau = reseauxRes.docs[0] as any
    }
  }

  const isPartenaire = reseau?.partenaire === true
  const expireAt = reseau?.partenaireExpireAt ? new Date(reseau.partenaireExpireAt) : null
  const nowDate = new Date()
  const isActive = isPartenaire && expireAt ? expireAt > nowDate : isPartenaire

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-6 py-8">
      <Reveal className="mb-6">
        <p className="rsn-eyebrow mb-2">Espace connecté</p>
        <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
          <CreditCard size={22} aria-hidden />
          Abonnement
        </h1>
      </Reveal>

      {/* Statut actuel */}
      {reseau ? (
        <div className="mb-8">
          <div
            className={`rounded-2xl border p-6 mb-4 ${
              isActive
                ? 'border-green-200 bg-green-50'
                : 'rsn-card'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`rounded-xl p-3 shrink-0 ${
                  isActive ? 'bg-green-100' : 'bg-zinc-100'
                }`}
              >
                <Building2
                  size={22}
                  className={isActive ? 'text-green-700' : 'text-zinc-400'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-[#18181b] mb-1">
                  Réseau national partenaire — {reseau.nom ?? 'votre réseau'}
                  {reseau.palier && (
                    <span className="ml-2 text-xs font-normal text-[#71717a] bg-[#f4f4f5] px-2 py-0.5 rounded-full">
                      {reseau.palier.charAt(0).toUpperCase() + reseau.palier.slice(1)}
                    </span>
                  )}
                </h2>
                {isActive ? (
                  <>
                    <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium mb-1">
                      <CheckCircle size={14} />
                      Partenariat actif
                    </div>
                    {expireAt && (
                      <p className="text-sm text-[#52525b] flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-[#71717a]" />
                        Renouvellement le{' '}
                        {expireAt.toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#71717a]">
                    Partenariat inactif — votre réseau n&apos;est pas encore partenaire.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* J2.A — Actions Stripe */}
          <div className="rsn-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#52525b] uppercase tracking-wide">
              Gestion de l&apos;abonnement
            </h3>

            {!isActive && (
              <div className="p-4 bg-[#faf9f5] rounded-xl border border-[#e4e4e7]">
                <p className="text-sm font-medium text-[#18181b] mb-1">
                  Devenez réseau partenaire
                </p>
                <p className="text-sm text-[#71717a] mb-3">
                  Publiez vos événements, affichez votre badge partenaire et gagnez en visibilité
                  auprès des milliers de réseauteurs inscrits.
                  Choisissez le palier adapté au nombre de vos groupes locaux.
                </p>
                {/* Palier Starter par défaut — l'utilisateur peut upgrader depuis le portail Stripe */}
                <CheckoutPartenaireButton
                  reseauId={reseau.id}
                  palier="starter"
                  className="inline-block px-4 py-2 rounded-xl bg-[#f5851f] text-white text-sm font-semibold hover:bg-[#e07518] transition-colors disabled:opacity-60"
                >
                  Souscrire (Starter) →
                </CheckoutPartenaireButton>
                <p className="text-xs text-[#a1a1aa] mt-2">
                  Pour les paliers Growth ou Enterprise, utilisez la page de gestion de votre réseau.
                </p>
              </div>
            )}

            {isActive && (
              <div className="flex flex-wrap gap-3">
                <PortalButton className="inline-block px-4 py-2 rounded-xl border border-[#e4e4e7] text-[#52525b] text-sm font-medium hover:border-[#2563EB] hover:text-[#2563EB] transition-colors disabled:opacity-60">
                  Gérer l&apos;abonnement (Stripe Portal)
                </PortalButton>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Aucun réseau lié au compte organisateur */
        <div className="rsn-card rounded-2xl p-8 text-center mb-8">
          <Building2 size={32} className="mx-auto text-zinc-300 mb-3" />
          <p className="text-[#52525b] font-medium mb-1">Aucun réseau associé à ce compte</p>
          <p className="text-sm text-[#71717a] mb-4">
            Créez d&apos;abord votre fiche réseau pour accéder aux options de partenariat.
          </p>
          <Link
            href="/dashboard/reseau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors no-underline"
          >
            Créer ma fiche réseau
          </Link>
        </div>
      )}

      {/* Offre partenariat — récapitulatif des avantages */}
      <div className="rsn-card rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[#52525b] uppercase tracking-wide mb-4">
          Ce que comprend le partenariat
        </h3>
        <ul className="space-y-3">
          {[
            'Logo affiché en page d\'accueil et dans le bandeau réseaux',
            'Badge partenaire sur votre fiche réseau',
            'Droit de publier vos événements (visible sur la carte et dans les résultats)',
            'Fiche réseau enrichie (présentation longue, logo, bannière, lien site)',
            'Accès au tableau de bord organisateur (gestion des événements)',
          ].map((avantage, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#3f3f46]">
              <CheckCircle size={15} className="text-[#2563EB] shrink-0 mt-0.5" />
              {avantage}
            </li>
          ))}
        </ul>
      </div>

      {/* Lien vers les factures */}
      <div className="mt-6 flex items-center gap-2">
        <FileText size={15} className="text-[#71717a]" />
        <Link
          href="/dashboard/factures"
          className="text-sm text-[#2563EB] hover:underline"
        >
          Voir l&apos;historique des factures
        </Link>
      </div>
      </div>
    </div>
  )
}
