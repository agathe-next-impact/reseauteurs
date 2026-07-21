'use client'

/**
 * AbonnementManager — brique unique de gestion d'abonnement, partagée par les 3 types
 * de souscripteurs (réseauteur Plus, organisateur de réseau national, partenaire annonceur).
 *
 * Pilotée par un descripteur `AbonnementView` sérialisé côté serveur (hub
 * /dashboard/abonnement) : statut d'accès (DB), état live Stripe (annulation programmée /
 * renouvellement), palier. Les actions pilotent Stripe via les routes dédiées ; l'accès
 * n'est jamais posé par le client (invariant §11).
 */
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Loader2,
  CalendarClock,
  FileText,
  TrendingUp,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import CancelConfirmModal from '@/components/dashboard/CancelConfirmModal'
import ReactivateConfirmModal from '@/components/dashboard/ReactivateConfirmModal'
import { PortalButton } from '@/app/(frontend)/dashboard/(organisateur)/reseau/CheckoutButtons'

export interface AbonnementView {
  produit: 'reseauteur_plus' | 'reseau_partenaire' | 'partenaire_annonceur'
  label: string
  statutGate: 'actif' | 'inactif'
  hasSubscription: boolean
  hasCustomer: boolean
  /** État live Stripe (null si indisponible → on retombe sur la DB). */
  live: { status: string; currentPeriodEndISO: string | null; cancelAtPeriodEnd: boolean } | null
  expireAtISO: string | null
  palier: string | null
  supportsPalier: boolean
  reseauId: string | number | null
  source: 'abonnement' | 'licence' | null
  motifIndisponible: 'gratuit' | 'sans_reseau' | 'sans_fiche' | null
  /** Paliers disponibles (organisateur) — [{ value, label, capacite }]. */
  paliers: { value: string; label: string; capacite: number }[]
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; data: { url?: string; error?: string } }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export function AbonnementManager({ view }: { view: AbonnementView }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [selectedPalier, setSelectedPalier] = useState<string | null>(null)

  const renewISO = view.live?.currentPeriodEndISO ?? view.expireAtISO
  const renewLabel = fmtDate(renewISO)
  const cancelScheduled = view.live?.cancelAtPeriodEnd === true
  const pastDue = view.live?.status === 'past_due' || view.live?.status === 'unpaid'
  const actif = view.statutGate === 'actif'
  const licence = view.produit === 'reseauteur_plus' && view.source === 'licence'

  async function subscribe(palier?: string) {
    setBusy('checkout')
    const body: Record<string, unknown> = { type: view.produit }
    if (view.produit === 'reseau_partenaire') {
      body.reseauId = String(view.reseauId)
      body.palier = palier ?? 'starter'
    }
    const { ok, data } = await postJson('/api/stripe/checkout', body)
    if (ok && data.url) window.location.assign(data.url)
    else {
      toast.error(data.error ?? 'Impossible d’ouvrir le paiement.')
      setBusy(null)
    }
  }

  async function changePalier(palier: string) {
    setBusy(`palier:${palier}`)
    const { ok, data } = await postJson('/api/stripe/change-palier', { palier })
    if (ok) {
      toast.success('Palier mis à jour — la modification est effective immédiatement.')
      setSelectedPalier(null)
      // Laisse le webhook reposer le palier, puis rafraîchit.
      setTimeout(() => window.location.reload(), 1200)
    } else {
      toast.error(data.error ?? 'Impossible de changer de palier.')
      setBusy(null)
    }
  }

  // ── Cas « pas encore d'abonnement » ────────────────────────────────
  if (!actif) {
    return (
      <div className="space-y-4">
        {view.motifIndisponible === 'sans_reseau' && (
          <EmptyState
            title="Aucun réseau associé à ce compte"
            desc="Créez d’abord votre fiche réseau national pour souscrire un abonnement."
            href="/dashboard/reseau"
            cta="Créer ma fiche réseau"
          />
        )}
        {view.motifIndisponible === 'sans_fiche' && (
          <EmptyState
            title="Aucune fiche partenaire"
            desc="Complétez votre fiche pour activer votre abonnement de visibilité."
            href="/dashboard/partenaire"
            cta="Compléter ma fiche"
          />
        )}

        {view.motifIndisponible !== 'sans_reseau' && view.motifIndisponible !== 'sans_fiche' && (
          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={20} className="text-[#71717a] shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#18181b]">Sans abonnement</p>
                <p className="text-xs text-[#71717a] mt-0.5">{subscribeHint(view.produit)}</p>
              </div>
            </div>

            {view.supportsPalier && view.paliers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {view.paliers.map((p) => (
                  <div key={p.value} className="border border-[#e4e4e7] rounded-xl p-3 bg-[#faf9f5]">
                    <p className="text-xs font-semibold text-[#18181b] mb-0.5">
                      {p.value.charAt(0).toUpperCase() + p.value.slice(1)}
                    </p>
                    <p className="text-[10px] text-[#71717a] mb-2">{capaciteLabel(p.capacite)}</p>
                    <button
                      type="button"
                      onClick={() => subscribe(p.value)}
                      disabled={busy !== null}
                      className="w-full text-xs bg-[#f5851f] text-white hover:bg-[#e07518] px-2 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
                    >
                      {busy === 'checkout' ? '…' : 'Choisir'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => subscribe()}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60"
              >
                {busy === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                S’abonner
              </button>
            )}
            <p className="text-[10px] text-[#a1a1aa] mt-2">
              Les tarifs vous sont présentés sur la page de paiement sécurisée Stripe.
            </p>
          </section>
        )}
      </div>
    )
  }

  // ── Cas « abonnement actif » ───────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Bandeau statut */}
      <section
        className={`rounded-2xl border p-5 ${
          pastDue
            ? 'border-red-200 bg-red-50'
            : cancelScheduled
              ? 'border-amber-200 bg-amber-50'
              : 'border-green-200 bg-green-50'
        }`}
      >
        <div className="flex items-start gap-3">
          {pastDue ? (
            <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" aria-hidden />
          ) : cancelScheduled ? (
            <CalendarClock size={20} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" aria-hidden />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold ${
                pastDue ? 'text-red-800' : cancelScheduled ? 'text-amber-800' : 'text-green-800'
              }`}
            >
              {pastDue
                ? 'Paiement en échec'
                : cancelScheduled
                  ? 'Annulation programmée'
                  : `${view.label} — actif`}
            </p>
            <div className="mt-1 space-y-0.5 text-xs">
              {view.supportsPalier && view.palier && (
                <p className={cancelScheduled ? 'text-amber-700' : 'text-green-700'}>
                  <span className="font-medium">Palier :</span>{' '}
                  {view.palier.charAt(0).toUpperCase() + view.palier.slice(1)}
                </p>
              )}
              {renewLabel && (
                <p
                  className={`flex items-center gap-1.5 ${
                    pastDue ? 'text-red-700' : cancelScheduled ? 'text-amber-700' : 'text-green-700'
                  }`}
                >
                  <Clock size={12} aria-hidden />
                  {cancelScheduled
                    ? `Accès conservé jusqu’au ${renewLabel} — pas de renouvellement`
                    : pastDue
                      ? 'Régularisez votre moyen de paiement pour éviter l’interruption'
                      : `Renouvellement automatique le ${renewLabel}`}
                </p>
              )}
              {licence && (
                <p className="text-green-700">
                  Accès offert par une licence partenaire — non géré depuis cette page.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Accès actif sans abonnement Stripe (accordé manuellement / démo) */}
      {!licence && !view.hasSubscription && !view.hasCustomer && (
        <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5">
          <p className="text-sm text-[#52525b]">
            Votre accès est actif. Aucun abonnement en ligne n’est rattaché à ce compte —
            pour toute question, contactez{' '}
            <a href="mailto:contact@reseauteurs.com" className="text-[#2563EB] hover:underline">
              contact@reseauteurs.com
            </a>.
          </p>
        </section>
      )}

      {/* Actions */}
      {!licence && (view.hasSubscription || view.hasCustomer) && (
        <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 space-y-4">
          <h2 className="text-xs font-semibold text-[#52525b] uppercase tracking-wide">
            Gérer mon abonnement
          </h2>

          {/* Changement de palier (organisateur) */}
          {view.hasSubscription && view.supportsPalier && !cancelScheduled && (
            <div>
              <button
                type="button"
                onClick={() => setSelectedPalier(selectedPalier === null ? (view.palier ?? '') : null)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8]"
              >
                <TrendingUp size={15} aria-hidden />
                Changer de palier
              </button>
              {selectedPalier !== null && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {view.paliers.map((p) => {
                    const current = p.value === view.palier
                    return (
                      <button
                        key={p.value}
                        type="button"
                        disabled={current || busy !== null}
                        onClick={() => changePalier(p.value)}
                        className={`text-left border rounded-xl p-3 transition-colors disabled:opacity-60 ${
                          current
                            ? 'border-[#2563EB] bg-[#eff6ff] cursor-default'
                            : 'border-[#e4e4e7] bg-white hover:border-[#2563EB]/50'
                        }`}
                      >
                        <p className="text-xs font-semibold text-[#18181b] mb-0.5">
                          {p.value.charAt(0).toUpperCase() + p.value.slice(1)}
                          {current && <span className="text-[#2563EB]"> · actuel</span>}
                        </p>
                        <p className="text-[10px] text-[#71717a]">{capaciteLabel(p.capacite)}</p>
                        {busy === `palier:${p.value}` && (
                          <Loader2 size={12} className="animate-spin text-[#2563EB] mt-1" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Annuler / Réactiver (seulement si un abonnement Stripe existe) */}
            {view.hasSubscription &&
              (cancelScheduled ? (
                <button
                  type="button"
                  onClick={() => setReactivateOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 border border-green-300 bg-white hover:bg-green-50 px-4 py-2 rounded-xl transition-colors"
                >
                  <RefreshCw size={14} aria-hidden />
                  Réactiver le renouvellement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71717a] border border-[#e4e4e7] bg-white hover:border-red-300 hover:text-red-600 px-4 py-2 rounded-xl transition-colors"
                >
                  <XCircle size={14} aria-hidden />
                  Annuler l’abonnement
                </button>
              ))}

            {/* Moyen de paiement */}
            {view.hasCustomer && (
              <PortalButton className="inline-flex items-center gap-1.5 text-sm font-medium text-[#52525b] border border-[#e4e4e7] bg-white hover:border-[#2563EB] hover:text-[#2563EB] px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
                <CreditCard size={14} aria-hidden />
                Moyen de paiement
              </PortalButton>
            )}

            {/* Factures */}
            {view.hasCustomer && (
              <Link
                href="/dashboard/factures"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8] no-underline px-1"
              >
                <FileText size={14} aria-hidden />
                Mes factures
              </Link>
            )}
          </div>
        </section>
      )}

      <CancelConfirmModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        productLabel={view.label}
        endDateLabel={renewLabel}
      />
      <ReactivateConfirmModal
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        productLabel={view.label}
      />
    </div>
  )
}

function EmptyState({ title, desc, href, cta }: { title: string; desc: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-[#e4e4e7] bg-white p-8 text-center">
      <CreditCard size={30} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
      <p className="text-sm font-medium text-[#18181b] mb-1">{title}</p>
      <p className="text-sm text-[#71717a] mb-4">{desc}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors no-underline"
      >
        {cta}
      </Link>
    </div>
  )
}

function capaciteLabel(capacite: number): string {
  if (capacite === 0) return 'Publication de la fiche — sans groupes locaux'
  if (capacite >= 999) return 'Fiche publiée + locaux illimités'
  return `Fiche publiée + jusqu’à ${capacite} locaux`
}

function subscribeHint(produit: AbonnementView['produit']): string {
  switch (produit) {
    case 'reseauteur_plus':
      return 'Passez Plus pour créer et publier vos propres événements de networking.'
    case 'partenaire_annonceur':
      return 'Souscrivez pour rendre votre fiche visible (accueil, page Entreprises, offre réservée).'
    case 'reseau_partenaire':
      return 'Souscrivez pour publier votre fiche réseau, créer vos groupes locaux et vos événements.'
  }
}
