'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Building2, Upload, Loader2, CheckCircle2, ExternalLink, Tag, CreditCard, AlertTriangle, ImageIcon,
} from 'lucide-react'
import { updatePartenaire } from './actions'

interface SerializedPartenaire {
  id: number
  slug: string | null
  nom: string
  lien: string
  description: string
  logoUrl: string | null
  statut: 'actif' | 'expire'
  abonnementExpireAt: string | null
  offreTitre: string
  offreDescription: string
  offreLien: string
}

const MAX_SIZE_MB = 4.5
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const inputClass =
  'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors'
const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

export function PartenaireForm({ partenaire }: { partenaire: SerializedPartenaire }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(partenaire.logoUrl)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [sub, setSub] = useState<'checkout' | 'portal' | null>(null)
  const [pending, startTransition] = useTransition()

  const isActif = partenaire.statut === 'actif'
  const hasLogo = !!logoUrl

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return toast.error(`Fichier trop lourd (max ${MAX_SIZE_MB} Mo).`)
    if (!ACCEPTED.includes(file.type)) return toast.error('Format non supporté (JPG, PNG, WebP).')
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('_payload', JSON.stringify({ alt: `Logo ${partenaire.nom}` }))
      const up = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
      if (!up.ok) return toast.error('Erreur lors de l\'upload du logo.')
      const media = (await up.json()).doc ?? (await up.json())
      const patch = await fetch(`/api/partenaires/${partenaire.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logo: media.id }),
      })
      if (!patch.ok) return toast.error('Erreur lors de l\'enregistrement du logo.')
      setLogoUrl(media.sizes?.thumbnail?.url ?? media.url ?? null)
      toast.success('Logo mis à jour.')
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updatePartenaire({
        nom: String(fd.get('nom') ?? ''),
        lien: String(fd.get('lien') ?? ''),
        description: String(fd.get('description') ?? ''),
        offreTitre: String(fd.get('offreTitre') ?? ''),
        offreDescription: String(fd.get('offreDescription') ?? ''),
        offreLien: String(fd.get('offreLien') ?? ''),
      })
      if (res.ok) toast.success('Fiche enregistrée.')
      else toast.error(res.error ?? 'Erreur lors de l\'enregistrement.')
    })
  }

  async function subscribe() {
    setSub('checkout')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'partenaire_annonceur', partenaireId: String(partenaire.id) }),
      })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else {
        toast.error(json.error ?? 'Impossible d\'ouvrir le paiement.')
        setSub(null)
      }
    } catch {
      toast.error('Erreur réseau.')
      setSub(null)
    }
  }

  async function openPortal() {
    setSub('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else {
        toast.error(json.error ?? 'Impossible d\'ouvrir le portail.')
        setSub(null)
      }
    } catch {
      toast.error('Erreur réseau.')
      setSub(null)
    }
  }

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <p className="rsn-eyebrow">Espace connecté</p>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
            <Building2 size={20} aria-hidden />
            Mon espace partenaire
          </h1>
          {isActif && partenaire.slug && (
            <Link
              href={`/partenaire/${partenaire.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#f5851f] hover:text-[#c2410c] font-medium no-underline transition-colors"
            >
              Voir ma fiche publique →
            </Link>
          )}
        </div>

        {/* ── Abonnement ──────────────────────────────────────────── */}
        <section
          className={`rounded-2xl border p-5 mb-6 ${
            isActif ? 'border-green-200 bg-green-50' : 'border-[#fed7aa] bg-[#fff7ed]'
          }`}
        >
          {isActif ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Abonnement actif</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Votre fiche est visible sur la page d&apos;accueil, la page Partenaires et votre fiche perso.
                  {partenaire.abonnementExpireAt &&
                    ` Renouvellement le ${new Date(partenaire.abonnementExpireAt).toLocaleDateString('fr-FR')}.`}
                </p>
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={sub !== null}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:text-green-900 disabled:opacity-60"
                >
                  {sub === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Gérer mon abonnement / factures
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-[#f5851f] shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#c2410c]">Abonnement inactif — fiche non publiée</p>
                <p className="text-xs text-[#9a3412] mt-0.5">
                  Activez votre abonnement pour apparaître sur la page d&apos;accueil, la page Partenaires,
                  et publier votre fiche + votre offre.
                </p>
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={sub !== null}
                  className="mt-3 inline-flex items-center gap-2 bg-[#f5851f] text-white font-semibold py-2 px-4 rounded-xl hover:bg-[#e07710] transition-colors text-sm disabled:opacity-60"
                >
                  {sub === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  Activer mon abonnement
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Logo ────────────────────────────────────────────────── */}
        <section className="rsn-card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#18181b] mb-1">Logo</h2>
          <p className="text-xs text-[#71717a] mb-3">Carré recommandé (400×400). JPG, PNG ou WebP — max {MAX_SIZE_MB} Mo.</p>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border border-[#e4e4e7] bg-[#faf9f5] flex items-center justify-center overflow-hidden shrink-0">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl as string} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={22} className="text-[#d4d4d8]" aria-hidden />
              )}
            </div>
            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[#e4e4e7] cursor-pointer transition-colors ${
                uploadingLogo ? 'opacity-60 cursor-wait' : 'hover:border-[#2563EB] hover:text-[#2563EB]'
              }`}
            >
              {uploadingLogo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {hasLogo ? 'Remplacer' : 'Ajouter un logo'}
              <input type="file" accept={ACCEPTED.join(',')} onChange={handleLogo} disabled={uploadingLogo} className="hidden" />
            </label>
          </div>
        </section>

        {/* ── Fiche + offre ───────────────────────────────────────── */}
        <form onSubmit={handleSave} className="rsn-card rounded-2xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
              <Building2 size={14} aria-hidden /> Fiche partenaire
            </h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="nom" className={labelClass}>Nom de l&apos;entreprise *</label>
                <input id="nom" name="nom" type="text" required maxLength={200} defaultValue={partenaire.nom} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lien" className={labelClass}>Site web</label>
                <input id="lien" name="lien" type="url" maxLength={500} placeholder="https://…" defaultValue={partenaire.lien} className={inputClass} />
              </div>
              <div>
                <label htmlFor="description" className={labelClass}>Description courte</label>
                <textarea id="description" name="description" maxLength={500} rows={3} defaultValue={partenaire.description} className={`${inputClass} resize-none`} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#e4e4e7]">
            <h2 className="text-sm font-semibold text-[#18181b] mb-1 flex items-center gap-1.5">
              <Tag size={14} className="text-[#f5851f]" aria-hidden /> Offre réservée aux réseauteurs
            </h2>
            <p className="text-xs text-[#71717a] mb-3">
              Visible uniquement par les réseauteurs connectés (dans leur espace « Offres partenaires »).
              Laissez le titre vide pour ne pas proposer d&apos;offre.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="offreTitre" className={labelClass}>Titre de l&apos;offre</label>
                <input id="offreTitre" name="offreTitre" type="text" maxLength={120} placeholder="Ex : -20% sur votre première commande" defaultValue={partenaire.offreTitre} className={inputClass} />
              </div>
              <div>
                <label htmlFor="offreDescription" className={labelClass}>Description de l&apos;offre</label>
                <textarea id="offreDescription" name="offreDescription" maxLength={1000} rows={3} defaultValue={partenaire.offreDescription} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label htmlFor="offreLien" className={labelClass}>Lien pour en profiter (optionnel)</label>
                <input id="offreLien" name="offreLien" type="url" maxLength={500} placeholder="https://…" defaultValue={partenaire.offreLien} className={inputClass} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60"
          >
            {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Enregistrer ma fiche
          </button>
          {!isActif && (
            <p className="text-xs text-[#a1a1aa] flex items-center gap-1.5">
              <ExternalLink size={11} aria-hidden />
              Votre fiche sera publiée dès l&apos;activation de l&apos;abonnement.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
