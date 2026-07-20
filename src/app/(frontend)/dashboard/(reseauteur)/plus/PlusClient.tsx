'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, CreditCard, Loader2, CalendarPlus, ArrowRight } from 'lucide-react'

export function PlusClient({
  actif,
  expireAt,
  source,
}: {
  actif: boolean
  expireAt: string | null
  /** 'licence' = legacy (packs partenaires supprimés — ADR-0015) : affichage seul. */
  source: 'abonnement' | 'licence' | null
}) {
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const checkoutSuccess = searchParams.get('checkout') === 'success'

  async function subscribe() {
    setBusy('checkout')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'reseauteur_plus' }),
      })
      const json = await res.json()
      if (json.url) window.location.assign(json.url)
      else {
        toast.error(json.error ?? 'Impossible d\'ouvrir le paiement.')
        setBusy(null)
      }
    } catch {
      toast.error('Erreur réseau.')
      setBusy(null)
    }
  }

  if (actif) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Vous êtes Réseauteur Plus</p>
              <p className="text-xs text-green-700 mt-0.5">
                {source === 'licence' ? 'Licence offerte par un partenaire.' : 'Abonnement actif.'}
                {expireAt && ` Valable jusqu'au ${new Date(expireAt).toLocaleDateString('fr-FR')}.`}
              </p>
              {source === 'abonnement' && (
                <Link
                  href="/dashboard/abonnement"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:text-green-900 no-underline"
                >
                  <CreditCard size={14} aria-hidden />
                  Gérer mon abonnement / factures
                </Link>
              )}
            </div>
          </div>
        </section>

        <Link
          href="/dashboard/mes-evenements"
          className="rsn-lift flex items-center gap-3 p-4 rounded-2xl border border-[#e4e4e7] bg-white hover:border-[#2563EB]/40 transition-colors no-underline group"
        >
          <span className="w-10 h-10 rounded-xl bg-[#eff6ff] text-[#2563EB] flex items-center justify-center shrink-0" aria-hidden>
            <CalendarPlus size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[#16284f] group-hover:text-[#2563EB] transition-colors">
              Mes événements
            </span>
            <span className="block text-xs text-[#71717a]">Créez et gérez vos événements de networking.</span>
          </span>
          <ArrowRight size={16} className="text-[#a1a1aa] group-hover:text-[#2563EB] transition-colors shrink-0 rsn-arrow" aria-hidden />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {checkoutSuccess && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800" role="status">
          Paiement confirmé — votre accès Plus s&apos;active d&apos;ici quelques instants.
          Rechargez la page si nécessaire.
        </div>
      )}

      {/* Abonnement */}
      <section className="rsn-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[#18181b] mb-1">Passer Plus — 39 € HT / an</h2>
        <p className="text-xs text-[#71717a] mb-4">
          Débloquez la création d&apos;événements. Sans engagement — gérable à tout moment depuis
          le portail de facturation.
        </p>
        <button
          type="button"
          onClick={subscribe}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60"
        >
          {busy === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
          S&apos;abonner à Réseauteur Plus
        </button>
      </section>
    </div>
  )
}
