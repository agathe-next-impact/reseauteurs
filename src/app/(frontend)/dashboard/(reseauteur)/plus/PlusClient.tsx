'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, CreditCard, Loader2, Ticket, CalendarPlus, ArrowRight } from 'lucide-react'

export function PlusClient({
  actif,
  expireAt,
  source,
}: {
  actif: boolean
  expireAt: string | null
  source: 'abonnement' | 'licence' | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState<'checkout' | 'portal' | 'code' | null>(null)
  const [code, setCode] = useState('')
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

  async function openPortal() {
    setBusy('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (json.url) window.location.assign(json.url)
      else {
        toast.error(json.error ?? 'Impossible d\'ouvrir le portail.')
        setBusy(null)
      }
    } catch {
      toast.error('Erreur réseau.')
      setBusy(null)
    }
  }

  async function activerCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy('code')
    try {
      const res = await fetch('/api/licences/activer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        toast.success(
          json.partenaire
            ? `Licence activée — offerte par ${json.partenaire}. Bienvenue en Réseauteur Plus !`
            : 'Licence activée. Bienvenue en Réseauteur Plus !',
        )
        router.refresh()
      } else {
        toast.error(json.error ?? 'Activation refusée.')
      }
    } catch {
      toast.error('Erreur réseau.')
    } finally {
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
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={busy !== null}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:text-green-900 disabled:opacity-60"
                >
                  {busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Gérer mon abonnement / factures
                </button>
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

      {/* Code partenaire */}
      <section className="rsn-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[#18181b] mb-1 flex items-center gap-1.5">
          <Ticket size={14} className="text-[#f5851f]" aria-hidden />
          J&apos;ai un code partenaire
        </h2>
        <p className="text-xs text-[#71717a] mb-4">
          Un partenaire vous a transmis un code de licence ? Activez votre accès Plus gratuitement.
        </p>
        <form onSubmit={activerCode} className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RSN-XXXXXXXX"
            maxLength={12}
            className="flex-1 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm font-mono tracking-wide text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#f5851f]/30 focus:border-[#f5851f] transition-colors"
            aria-label="Code de licence partenaire"
          />
          <button
            type="submit"
            disabled={busy !== null || !code.trim()}
            className="inline-flex items-center gap-2 bg-[#f5851f] text-white font-semibold py-2 px-4 rounded-xl hover:bg-[#e07710] transition-colors text-sm disabled:opacity-60"
          >
            {busy === 'code' && <Loader2 size={14} className="animate-spin" />}
            Activer
          </button>
        </form>
      </section>
    </div>
  )
}
