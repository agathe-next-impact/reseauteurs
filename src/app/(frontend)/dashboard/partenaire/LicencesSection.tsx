'use client'

/**
 * Section « Licences Réseauteur Plus » de l'espace partenaire (ADR-0013 P2.B).
 * Achat de packs (Checkout one-shot) + suivi des packs (code à diffuser, quota, statut).
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Ticket, Loader2, Copy, CreditCard } from 'lucide-react'

export interface PackLite {
  id: number
  code: string | null
  quota: number
  quotaUtilise: number
  statut: 'actif' | 'epuise' | 'expire'
  expireAt: string | null
}

const OFFRES: Array<{ taille: '10' | '50' | '100'; quota: number; prix: string }> = [
  { taille: '10', quota: 10, prix: '300 €' },
  { taille: '50', quota: 50, prix: '600 €' },
  { taille: '100', quota: 100, prix: '1 000 €' },
]

const STATUT_LABEL: Record<PackLite['statut'], { label: string; cls: string }> = {
  actif: { label: 'Actif', cls: 'bg-green-50 text-green-700 border-green-200' },
  epuise: { label: 'Épuisé', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  expire: { label: 'Expiré', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function LicencesSection({
  partenaireId,
  packs,
  abonnementActif,
}: {
  partenaireId: number
  packs: PackLite[]
  abonnementActif: boolean
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function acheter(taille: '10' | '50' | '100') {
    setBusy(taille)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'licences_pack', partenaireId: String(partenaireId), taille }),
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

  function copier(code: string) {
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success('Code copié.'))
      .catch(() => toast.error('Impossible de copier.'))
  }

  return (
    <section className="rsn-card rounded-2xl p-5 mt-6">
      <h2 className="text-sm font-semibold text-[#18181b] mb-1 flex items-center gap-1.5">
        <Ticket size={14} className="text-[#f5851f]" aria-hidden />
        Licences Réseauteur Plus
      </h2>
      <p className="text-xs text-[#71717a] mb-4">
        Offrez le niveau <strong>Plus</strong> (création d&apos;événements) à vos réseauteurs :
        achetez un pack, diffusez le code — chacun l&apos;active depuis son espace, dans la limite du quota.
      </p>

      {/* Achat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {OFFRES.map((o) => (
          <button
            key={o.taille}
            type="button"
            onClick={() => acheter(o.taille)}
            disabled={busy !== null}
            className="rounded-xl border border-[#e4e4e7] p-4 text-left hover:border-[#f5851f] transition-colors disabled:opacity-60 group"
          >
            <p className="text-lg font-extrabold text-[#16284f]">{o.quota} licences</p>
            <p className="text-sm text-[#f5851f] font-semibold">{o.prix}</p>
            <p className="text-xs text-[#71717a] mt-2 inline-flex items-center gap-1 group-hover:text-[#f5851f] transition-colors">
              {busy === o.taille ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
              Acheter
            </p>
          </button>
        ))}
      </div>
      {!abonnementActif && (
        <p className="text-xs text-[#9a3412] bg-[#fff7ed] border border-[#fed7aa] rounded-xl px-3 py-2 mb-5">
          Astuce : l&apos;expiration des licences est alignée sur votre abonnement annonceur —
          activez-le pour maximiser leur durée.
        </p>
      )}

      {/* Packs existants */}
      {packs.length > 0 && (
        <ul className="space-y-2" role="list" aria-label="Vos packs de licences">
          {packs.map((p) => {
            const st = STATUT_LABEL[p.statut]
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-[#e4e4e7] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-semibold text-[#16284f] flex items-center gap-2">
                    {p.code ?? '—'}
                    {p.code && (
                      <button type="button" onClick={() => copier(p.code as string)} className="text-[#a1a1aa] hover:text-[#2563EB] transition-colors" aria-label="Copier le code">
                        <Copy size={13} />
                      </button>
                    )}
                  </p>
                  <p className="text-xs text-[#71717a] mt-0.5">
                    {p.quotaUtilise}/{p.quota} activées
                    {p.expireAt && ` · expire le ${new Date(p.expireAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
