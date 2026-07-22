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
import { CheckCircle2, AlertCircle, Clock, CreditCard, Loader2, CalendarClock, XCircle } from 'lucide-react'
import CancelConfirmModal from '@/components/dashboard/CancelConfirmModal'
import ReactivateConfirmModal from '@/components/dashboard/ReactivateConfirmModal'
import { PortalButton } from '@/app/(frontend)/dashboard/(organisateur)/reseau/CheckoutButtons'
import { formatEuroHTAn } from '@/lib/tarifs'

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
  /** Prix HT/an du produit à prix unique (Plus, annonceur) ; null pour le réseau (par palier). */
  prixHT: number | null
  /** Paliers disponibles (organisateur) — [{ value, label, capacite, prixHT }]. */
  paliers: { value: string; label: string; capacite: number; prixHT: number | null }[]
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
          <section className="rounded-2xl border border-[#DFE0E1] bg-white p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={20} className="text-[#6E7175] shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#1D1E21]">Sans abonnement</p>
                <p className="text-xs text-[#6E7175] mt-0.5">{subscribeHint(view.produit)}</p>
              </div>
            </div>

            {view.supportsPalier && view.paliers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {view.paliers.map((p) => (
                  <div key={p.value} className="border border-[#DFE0E1] rounded-xl p-3 bg-[#F2F2F2]">
                    <p className="text-xs font-semibold text-[#1D1E21] mb-0.5">
                      {p.value.charAt(0).toUpperCase() + p.value.slice(1)}
                    </p>
                    {p.prixHT != null && (
                      <p className="text-sm font-extrabold text-[#012A4A] leading-tight">
                        {p.prixHT} €<span className="text-[10px] font-medium text-[#6E7175]"> HT/an</span>
                      </p>
                    )}
                    <p className="text-[10px] text-[#6E7175] mb-2 mt-0.5">{capaciteLabel(p.capacite)}</p>
                    <button
                      type="button"
                      onClick={() => subscribe(p.value)}
                      disabled={busy !== null}
                      className="w-full text-xs bg-[#F5E050] text-[#012A4A] hover:bg-[#E3CB2E] p-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
                    >
                      {busy === 'checkout' ? '…' : 'Choisir'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {view.prixHT != null && (
                  <p className="text-lg font-extrabold text-[#012A4A]">
                    {view.prixHT} €<span className="text-xs font-medium text-[#6E7175]"> HT / an</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => subscribe()}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 bg-[#035AA6] text-white font-semibold p-2.5 rounded-xl hover:bg-[#02467F] transition-colors text-sm disabled:opacity-60"
                >
                  {busy === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : null}
                  S’abonner
                </button>
              </div>
            )}
            <p className="text-[10px] text-[#999A9D] mt-2">
              Prix hors taxes — la TVA applicable est calculée sur la page de paiement sécurisée Stripe.
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
                  {(() => {
                    const prix = view.paliers.find((p) => p.value === view.palier)?.prixHT
                    return prix != null ? ` · ${formatEuroHTAn(prix)}` : ''
                  })()}
                </p>
              )}
              {!view.supportsPalier && view.prixHT != null && (
                <p className={cancelScheduled ? 'text-amber-700' : 'text-green-700'}>
                  <span className="font-medium">Tarif :</span> {formatEuroHTAn(view.prixHT)}
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
        <section className="rounded-2xl border border-[#DFE0E1] bg-white p-5">
          <p className="text-sm text-[#4E5155]">
            Votre accès est actif. Aucun abonnement en ligne n’est rattaché à ce compte —
            pour toute question, contactez{' '}
            <a href="mailto:contact@reseauteurs.com" className="text-[#035AA6] hover:underline">
              contact@reseauteurs.com
            </a>.
          </p>
        </section>
      )}

      {/* Actions */}
      {!licence && (view.hasSubscription || view.hasCustomer) && (
        <section className="rounded-2xl border border-[#DFE0E1] bg-white p-5 space-y-4">
          <h2 className="text-xs font-semibold text-[#4E5155] uppercase tracking-wide">
            Gérer mon abonnement
          </h2>

          {/* Changement de palier (organisateur) */}
          {view.hasSubscription && view.supportsPalier && !cancelScheduled && (
            <div>
              <button
                type="button"
                onClick={() => setSelectedPalier(selectedPalier === null ? (view.palier ?? '') : null)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#035AA6] hover:text-[#02467F]"
              >
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
                        className={`text-left border rounded-xl p-2.5 transition-colors disabled:opacity-60 ${
                          current
                            ? 'border-[#035AA6] bg-[#EFF5FA] cursor-default'
                            : 'border-[#DFE0E1] bg-white hover:border-[#035AA6]/50'
                        }`}
                      >
                        <p className="text-xs font-semibold text-[#1D1E21] mb-0.5">
                          {p.value.charAt(0).toUpperCase() + p.value.slice(1)}
                          {current && <span className="text-[#035AA6]"> · actuel</span>}
                        </p>
                        {p.prixHT != null && (
                          <p className="text-xs font-bold text-[#012A4A]">
                            {p.prixHT} €<span className="text-[10px] font-medium text-[#6E7175]"> HT/an</span>
                          </p>
                        )}
                        <p className="text-[10px] text-[#6E7175] mt-0.5">{capaciteLabel(p.capacite)}</p>
                        {busy === `palier:${p.value}` && (
                          <Loader2 size={12} className="animate-spin text-[#035AA6] mt-1" />
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
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 border border-green-300 bg-white hover:bg-green-50 p-2.5 rounded-xl transition-colors"
                >
                  Réactiver le renouvellement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6E7175] border border-[#DFE0E1] bg-white hover:border-red-300 hover:text-red-600 p-2.5 rounded-xl transition-colors"
                >
                  Annuler l’abonnement
                </button>
              ))}

            {/* Moyen de paiement */}
            {view.hasCustomer && (
              <PortalButton className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4E5155] border border-[#DFE0E1] bg-white hover:border-[#035AA6] hover:text-[#035AA6] px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
                <CreditCard size={14} aria-hidden />
                Moyen de paiement
              </PortalButton>
            )}

            {/* Factures */}
            {view.hasCustomer && (
              <Link
                href="/dashboard/factures"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#035AA6] hover:text-[#02467F] no-underline px-1"
              >
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
    <div className="rounded-2xl border border-[#DFE0E1] bg-white p-8 text-center">
      <CreditCard size={30} className="text-[#CFD0D2] mx-auto mb-3" aria-hidden />
      <p className="text-sm font-medium text-[#1D1E21] mb-1">{title}</p>
      <p className="text-sm text-[#6E7175] mb-4">{desc}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-[#035AA6] text-white text-sm font-semibold hover:bg-[#02467F] transition-colors no-underline"
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
