'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Building2, Upload, Loader2, CheckCircle2, ExternalLink, Tag, CreditCard, AlertTriangle, ImageIcon,
} from 'lucide-react'
import { updatePartenaire } from './actions'
import { PRIX_ANNONCEUR_HT } from '@/lib/tarifs'

interface SerializedPartenaire {
  id: number
  slug: string | null
  nom: string
  lien: string
  emailContact: string
  telephone: string
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
  'w-full rounded-xl border border-[#DFE0E1] bg-white px-3 py-2 text-sm text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#035AA6]/30 focus:border-[#035AA6] transition-colors'
const labelClass = 'block text-xs font-medium text-[#4E5155] mb-1'

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
        emailContact: String(fd.get('emailContact') ?? ''),
        telephone: String(fd.get('telephone') ?? ''),
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

  // La gestion complète (annuler / réactiver / moyen de paiement / factures) vit sur
  // le hub /dashboard/abonnement — plus de portail direct depuis la fiche partenaire.

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <p className="rsn-eyebrow">Espace connecté</p>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2">
            <Building2 size={20} aria-hidden />
            Mon espace partenaire
          </h1>
          {isActif && partenaire.slug && (
            <Link
              href={`/partenaire/${partenaire.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#8A6D0B] hover:text-[#8A6D0B] font-medium no-underline transition-colors"
            >
              Voir ma fiche publique →
            </Link>
          )}
        </div>

        {/* ── Abonnement ──────────────────────────────────────────── */}
        <section
          className={`rounded-2xl border p-5 mb-6 ${
            isActif ? 'border-green-200 bg-green-50' : 'border-[#EFE08F] bg-[#FEFBE6]'
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
                <Link
                  href="/dashboard/abonnement"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:text-green-900 no-underline"
                >
                  <CreditCard size={14} aria-hidden />
                  Gérer mon abonnement / factures
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#8A6D0B]">Abonnement inactif — fiche non publiée</p>
                <p className="text-xs text-[#6E5608] mt-0.5">
                  Activez votre abonnement pour apparaître sur la page d&apos;accueil, la page Partenaires,
                  et publier votre fiche + votre offre.
                </p>
                <p className="text-lg font-extrabold text-[#012A4A] mt-3">
                  {PRIX_ANNONCEUR_HT} €<span className="text-xs font-medium text-[#6E7175]"> HT / an</span>
                </p>
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={sub !== null}
                  className="mt-2 inline-flex items-center gap-2 bg-[#F5E050] text-[#012A4A] font-semibold p-2.5 rounded-xl hover:bg-[#E3CB2E] transition-colors text-sm disabled:opacity-60"
                >
                  {sub === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  Activer mon abonnement
                </button>
                <p className="text-[10px] text-[#999A9D] mt-1.5">
                  Prix hors taxes — la TVA applicable est calculée au paiement.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Logo ────────────────────────────────────────────────── */}
        <section className="rsn-card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#1D1E21] mb-1">Logo</h2>
          <p className="text-xs text-[#6E7175] mb-3">Carré recommandé (400×400). JPG, PNG ou WebP — max {MAX_SIZE_MB} Mo.</p>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] flex items-center justify-center overflow-hidden shrink-0">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl as string} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={22} className="text-[#CFD0D2]" aria-hidden />
              )}
            </div>
            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[#DFE0E1] cursor-pointer transition-colors ${
                uploadingLogo ? 'opacity-60 cursor-wait' : 'hover:border-[#035AA6] hover:text-[#035AA6]'
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
            <h2 className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="emailContact" className={labelClass}>Email de contact</label>
                  <input id="emailContact" name="emailContact" type="email" maxLength={200} placeholder="contact@entreprise.fr" defaultValue={partenaire.emailContact} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="telephone" className={labelClass}>Téléphone</label>
                  <input id="telephone" name="telephone" type="tel" maxLength={30} placeholder="01 23 45 67 89" defaultValue={partenaire.telephone} className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="description" className={labelClass}>Description courte</label>
                <textarea id="description" name="description" maxLength={500} rows={3} defaultValue={partenaire.description} className={`${inputClass} resize-none`} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#DFE0E1]">
            <h2 className="text-sm font-semibold text-[#1D1E21] mb-1 flex items-center gap-1.5">
              <Tag size={14} className="text-[#8A6D0B]" aria-hidden /> Offre réservée aux réseauteurs
            </h2>
            <p className="text-xs text-[#6E7175] mb-3">
              Visible uniquement par les réseauteurs connectés (dans leur espace « Offres entreprises »).
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
            className="inline-flex items-center gap-2 bg-[#035AA6] text-white font-semibold p-2.5 rounded-xl hover:bg-[#02467F] transition-colors text-sm disabled:opacity-60"
          >
            {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Enregistrer ma fiche
          </button>
          {!isActif && (
            <p className="text-xs text-[#999A9D] flex items-center gap-1.5">
              <ExternalLink size={11} aria-hidden />
              Votre fiche sera publiée dès l&apos;activation de l&apos;abonnement.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
