/**
 * ProfilForm — Formulaire d'édition du profil réseauteur (Client Component).
 *
 * Utilise les Server Actions pour les mutations.
 * Badge mis à jour côté serveur (hook Payload deriverBadge).
 * ADR-0012 : affiliation uniquement aux réseaux LOCAUX (validation serveur).
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfilReseauteur } from './actions'
import type { ProfilFormData } from './actions'
import type { Reseauteur, Reseau, Media } from '@/types/reseauteurs-domain'
import { Network } from 'lucide-react'
import { ImageUploadField } from '@/components/dashboard/ImageUploadField'

const BADGE_OPTIONS = [
  { value: 0, label: '0–1 événement/mois (Bronze)' },
  { value: 2, label: '2–5 événements/mois (Argent)' },
  { value: 6, label: '6–10 événements/mois (Gold)' },
  { value: 11, label: 'Plus de 10/mois (Platinum)' },
]

/** Réseau local pour le sélecteur d'affiliation (ADR-0012 : locaux uniquement) */
export interface ReseauLocalLite {
  id: number | string
  nom: string
  ville?: string | null
}

interface ProfilFormProps {
  reseauteur: Reseauteur
  /** Réseaux locaux disponibles pour l'affiliation (ADR-0012 : niveau=local uniquement) */
  reseauxLocaux?: ReseauLocalLite[]
}

export function ProfilForm({ reseauteur, reseauxLocaux = [] }: ProfilFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Photo actuelle (populée par la page — depth 1)
  const photoMedia = (typeof reseauteur.photo === 'object' ? reseauteur.photo : null) as Media | null
  const photoUrl = photoMedia?.sizes?.thumbnail?.url ?? photoMedia?.url ?? null

  // Persistance immédiate de la photo (indépendante du bouton « Enregistrer ») :
  // l'access `update` de la collection scope déjà au propriétaire (user = req.user).
  const handlePhotoUploaded = async ({ id }: { id: number | string }) => {
    const res = await fetch(`/api/reseauteurs/${reseauteur.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ photo: id }),
    })
    if (!res.ok) return "Erreur lors de l'enregistrement de la photo."
    router.refresh()
  }

  // IDs des réseaux fréquentés actuels
  const currentReseauxIds = new Set(
    (reseauteur.reseauxFrequentes ?? []).map((r) =>
      typeof r === 'object' ? String((r as Reseau).id) : String(r),
    ),
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const fd = new FormData(e.currentTarget)
    // Récupérer les réseaux cochés
    const reseauxIds = fd.getAll('reseauxFrequentes').map((v) => Number(v))

    const data: ProfilFormData = {
      prenom: fd.get('prenom') as string,
      nom: fd.get('nom') as string,
      fonction: fd.get('fonction') as string | undefined,
      entreprise: fd.get('entreprise') as string | undefined,
      description: fd.get('description') as string | undefined,
      telephone: fd.get('telephone') as string | undefined,
      emailContact: fd.get('emailContact') as string | undefined,
      site: fd.get('site') as string | undefined,
      linkedin: fd.get('linkedin') as string | undefined,
      ville: fd.get('ville') as string,
      departement: fd.get('departement') as string | undefined,
      region: fd.get('region') as string | undefined,
      evenementsParMois: Number(fd.get('evenementsParMois') ?? 0),
      noindex: fd.get('noindex') === '1',
      reseauxFrequentes: reseauxIds,
    }

    startTransition(async () => {
      const result = await updateProfilReseauteur(reseauteur.id, data)
      if ('error' in result) {
        setErrorMsg(result.error)
      } else {
        setSuccessMsg('Profil mis à jour.')
      }
    })
  }

  const inputClass =
    'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors disabled:opacity-50'
  const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identité */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[#18181b] mb-3">Identité</legend>
        <ImageUploadField
          label="Photo de profil"
          hint="Portrait carré recommandé."
          alt={`Photo de ${reseauteur.prenom} ${reseauteur.nom}`.trim()}
          currentUrl={photoUrl}
          shape="round"
          onUploaded={handlePhotoUploaded}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prenom" className={labelClass}>Prénom *</label>
            <input
              id="prenom"
              name="prenom"
              type="text"
              required
              maxLength={100}
              defaultValue={reseauteur.prenom}
              className={inputClass}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="nom" className={labelClass}>Nom *</label>
            <input
              id="nom"
              name="nom"
              type="text"
              required
              maxLength={100}
              defaultValue={reseauteur.nom}
              className={inputClass}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div>
          <label htmlFor="fonction" className={labelClass}>Fonction / poste</label>
          <input
            id="fonction"
            name="fonction"
            type="text"
            maxLength={200}
            defaultValue={reseauteur.fonction ?? ''}
            className={inputClass}
            autoComplete="organization-title"
          />
        </div>
        <div>
          <label htmlFor="entreprise" className={labelClass}>Entreprise</label>
          <input
            id="entreprise"
            name="entreprise"
            type="text"
            maxLength={200}
            defaultValue={reseauteur.entreprise ?? ''}
            className={inputClass}
            autoComplete="organization"
          />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Présentation</label>
          <textarea
            id="description"
            name="description"
            maxLength={2000}
            rows={4}
            defaultValue={reseauteur.description ?? ''}
            className={`${inputClass} resize-none`}
          />
        </div>
      </fieldset>

      {/* Localisation */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[#18181b] mb-3">Localisation</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ville" className={labelClass}>Ville *</label>
            <input
              id="ville"
              name="ville"
              type="text"
              required
              maxLength={100}
              defaultValue={reseauteur.ville ?? ''}
              className={inputClass}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label htmlFor="departement" className={labelClass}>Département</label>
            <input
              id="departement"
              name="departement"
              type="text"
              maxLength={100}
              defaultValue={reseauteur.departement ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="region" className={labelClass}>Région</label>
            <input
              id="region"
              name="region"
              type="text"
              maxLength={100}
              defaultValue={reseauteur.region ?? ''}
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* Contacts facultatifs */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[#18181b] mb-1">
          Contacts <span className="text-xs font-normal text-[#71717a]">(facultatifs — vous contrôlez ce qui est visible)</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="telephone" className={labelClass}>Téléphone</label>
            <input
              id="telephone"
              name="telephone"
              type="tel"
              maxLength={30}
              defaultValue={reseauteur.telephone ?? ''}
              className={inputClass}
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="emailContact" className={labelClass}>Email de contact public</label>
            <input
              id="emailContact"
              name="emailContact"
              type="email"
              maxLength={254}
              defaultValue={reseauteur.emailContact ?? ''}
              className={inputClass}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="site" className={labelClass}>Site web</label>
            <input
              id="site"
              name="site"
              type="url"
              maxLength={500}
              placeholder="https://..."
              defaultValue={reseauteur.site ?? ''}
              className={inputClass}
              autoComplete="url"
            />
          </div>
          <div>
            <label htmlFor="linkedin" className={labelClass}>Profil LinkedIn</label>
            <input
              id="linkedin"
              name="linkedin"
              type="url"
              maxLength={500}
              placeholder="https://linkedin.com/in/..."
              defaultValue={reseauteur.linkedin ?? ''}
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* Réseaux fréquentés — têtes de réseau ou groupes locaux (décision 2026-07-17) */}
      {reseauxLocaux.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-[#18181b] mb-1 flex items-center gap-1.5">
            <Network size={14} className="text-[#a855f7]" aria-hidden />
            Réseaux fréquentés
          </legend>
          <p className="text-xs text-[#71717a] mb-3">
            Cochez les réseaux que vous fréquentez — réseau national ou groupe local.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-[#e4e4e7] rounded-xl p-3">
            {reseauxLocaux.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer group text-sm text-[#18181b] hover:text-[#a855f7] transition-colors">
                <input
                  type="checkbox"
                  name="reseauxFrequentes"
                  value={String(r.id)}
                  defaultChecked={currentReseauxIds.has(String(r.id))}
                  className="rounded text-[#a855f7] focus:ring-[#a855f7]/30"
                />
                <span className="truncate">
                  {r.nom}
                  {r.ville && <span className="text-xs text-[#71717a] ml-1">({r.ville})</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Badge networking */}
      <fieldset>
        <legend className="text-sm font-semibold text-[#18181b] mb-3">Badge réseauteur</legend>
        <label htmlFor="evenementsParMois" className={labelClass}>
          Combien d&apos;événements de networking fréquentez-vous chaque mois ?
        </label>
        <select
          id="evenementsParMois"
          name="evenementsParMois"
          defaultValue={reseauteur.evenementsParMois ?? 0}
          className={inputClass}
        >
          {BADGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-[#a1a1aa] mt-1.5">
          Ce badge est déclaratif et s&apos;affiche sur votre profil public et la carte.
        </p>
      </fieldset>

      {/* Confidentialité */}
      <fieldset className="pt-3 border-t border-[#e4e4e7]">
        <legend className="text-sm font-semibold text-[#18181b] mb-3">Confidentialité</legend>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="noindex"
            value="1"
            defaultChecked={
              (reseauteur as unknown as Record<string, unknown>).seo
                ? Boolean(((reseauteur as unknown as Record<string, unknown>).seo as Record<string, unknown>)?.noindex)
                : false
            }
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-[#52525b]">
            Ne pas référencer mon profil dans les moteurs de recherche (opt-out d&apos;indexation)
          </span>
        </label>
      </fieldset>

      {/* Messages */}
      {errorMsg && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          {successMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
      >
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}
