'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateFicheReseau } from './actions'
import { ImageUploadField } from '@/components/dashboard/ImageUploadField'
import type { Media } from '@/types/reseauteurs-domain'

interface FicheReseauFormProps {
  reseau: Record<string, unknown>
}

export function FicheReseauForm({ reseau }: FicheReseauFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Logo actuel (populé par la page — depth 1)
  const logoMedia = (typeof reseau.logo === 'object' ? reseau.logo : null) as Media | null
  const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url ?? null

  // Persistance immédiate du logo — l'access `update` de la collection scope au propriétaire.
  const handleLogoUploaded = async ({ id }: { id: number | string }) => {
    const res = await fetch(`/api/reseaux/${reseau.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ logo: id }),
    })
    if (!res.ok) return "Erreur lors de l'enregistrement du logo."
    router.refresh()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const fd = new FormData(e.currentTarget)
    const str = (k: string) => (fd.get(k) as string | null) ?? undefined
    const data = {
      nom: fd.get('nom') as string,
      description: str('description'),
      presentation: str('presentation'),
      siteWeb: str('siteWeb'),
      emailContact: str('emailContact'),
      telephone: str('telephone'),
      ville: str('ville'),
      departement: str('departement'),
      region: str('region'),
      typeJuridique: str('typeJuridique'),
      responsableNom: str('responsableNom'),
      responsableFonction: str('responsableFonction'),
      objectif: str('objectif'),
      differenciateur: str('differenciateur'),
      nombreMembres: str('nombreMembres'),
      publicConcerne: str('publicConcerne'),
      ouvertATous: str('ouvertATous'),
      participationInvite: str('participationInvite'),
      adhesionObligatoire: str('adhesionObligatoire'),
      uneProfessionParGroupe: str('uneProfessionParGroupe'),
      cotisation: str('cotisation'),
      plaquetteUrl: str('plaquetteUrl'),
      rempliPar: str('rempliPar'),
    }

    startTransition(async () => {
      const result = await updateFicheReseau(data)
      if ('error' in result) {
        setErrorMsg(result.error)
      } else {
        setSuccessMsg('Fiche réseau mise à jour.')
      }
    })
  }

  const inputClass =
    'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors disabled:opacity-50'
  const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ImageUploadField
        label="Logo"
        hint="Carré recommandé (400×400)."
        alt={`Logo ${(reseau.nom as string) ?? 'du réseau'}`}
        currentUrl={logoUrl}
        onUploaded={handleLogoUploaded}
      />

      <div>
        <label htmlFor="nom" className={labelClass}>Nom du réseau *</label>
        <input
          id="nom"
          name="nom"
          type="text"
          required
          maxLength={200}
          defaultValue={reseau.nom as string ?? ''}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Description courte</label>
        <textarea
          id="description"
          name="description"
          maxLength={3000}
          rows={3}
          defaultValue={reseau.description as string ?? ''}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="presentation" className={labelClass}>Présentation complète</label>
        <textarea
          id="presentation"
          name="presentation"
          maxLength={5000}
          rows={6}
          defaultValue={reseau.presentation as string ?? ''}
          className={`${inputClass} resize-none`}
          placeholder="Décrivez votre réseau en détail : histoire, valeurs, membres types, événements…"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="ville" className={labelClass}>Ville principale</label>
          <input
            id="ville"
            name="ville"
            type="text"
            maxLength={100}
            defaultValue={reseau.ville as string ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="departement" className={labelClass}>Département</label>
          <input
            id="departement"
            name="departement"
            type="text"
            maxLength={100}
            defaultValue={reseau.departement as string ?? ''}
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
            defaultValue={reseau.region as string ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="siteWeb" className={labelClass}>Site web</label>
          <input
            id="siteWeb"
            name="siteWeb"
            type="url"
            maxLength={500}
            placeholder="https://..."
            defaultValue={reseau.siteWeb as string ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="emailContact" className={labelClass}>Email de contact</label>
          <input
            id="emailContact"
            name="emailContact"
            type="email"
            maxLength={254}
            defaultValue={reseau.emailContact as string ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="telephone" className={labelClass}>Téléphone</label>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            maxLength={30}
            defaultValue={reseau.telephone as string ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Type de structure (l'échelle = champ « niveau », géré en administration) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#f4f4f5]">
        <div>
          <label htmlFor="typeJuridique" className={labelClass}>Type de structure</label>
          <select id="typeJuridique" name="typeJuridique" defaultValue={(reseau.typeJuridique as string) ?? ''} className={inputClass}>
            <option value="">— Non renseigné —</option>
            <option value="association">Association</option>
            <option value="prive">Privé / société</option>
            <option value="franchise">Franchise</option>
            <option value="institution">Institution</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>

      {/* ── Responsable local */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="responsableNom" className={labelClass}>Responsable local (nom)</label>
          <input id="responsableNom" name="responsableNom" type="text" maxLength={200} defaultValue={(reseau.responsableNom as string) ?? ''} className={inputClass} />
        </div>
        <div>
          <label htmlFor="responsableFonction" className={labelClass}>Fonction du responsable</label>
          <input id="responsableFonction" name="responsableFonction" type="text" maxLength={200} defaultValue={(reseau.responsableFonction as string) ?? ''} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-[#a1a1aa] -mt-2">La photo du responsable et la galerie se gèrent depuis l&apos;administration.</p>

      {/* ── Objectif / différenciateur / membres */}
      <div>
        <label htmlFor="objectif" className={labelClass}>Objectif du réseau</label>
        <textarea id="objectif" name="objectif" maxLength={3000} rows={3} defaultValue={(reseau.objectif as string) ?? ''} className={`${inputClass} resize-none`} />
      </div>
      <div>
        <label htmlFor="differenciateur" className={labelClass}>Ce qui le différencie (3 à 5 lignes)</label>
        <textarea id="differenciateur" name="differenciateur" maxLength={2000} rows={3} defaultValue={(reseau.differenciateur as string) ?? ''} className={`${inputClass} resize-none`} />
      </div>

      {/* ── Fonctionnement */}
      <fieldset className="space-y-3 pt-2 border-t border-[#f4f4f5]">
        <legend className="text-xs font-semibold text-[#52525b]">Fonctionnement</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="publicConcerne" className={labelClass}>Public concerné</label>
            <input id="publicConcerne" name="publicConcerne" type="text" maxLength={300} placeholder="dirigeants, indépendants…" defaultValue={(reseau.publicConcerne as string) ?? ''} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nombreMembres" className={labelClass}>Nombre de membres (déclaré)</label>
            <input id="nombreMembres" name="nombreMembres" type="number" min={0} defaultValue={(reseau.nombreMembres as number | undefined) ?? ''} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['ouvertATous', 'Ouvert à tous'],
            ['participationInvite', 'Invités possibles'],
            ['adhesionObligatoire', 'Adhésion obligatoire'],
            ['uneProfessionParGroupe', '1 métier/groupe'],
          ] as const).map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className={labelClass}>{label}</label>
              <select id={name} name={name} defaultValue={(reseau[name] as string) ?? ''} className={inputClass}>
                <option value="">—</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="cotisation" className={labelClass}>Cotisation (facultatif)</label>
          <input id="cotisation" name="cotisation" type="text" maxLength={200} placeholder="ex : à partir de 400 €/an" defaultValue={(reseau.cotisation as string) ?? ''} className={inputClass} />
        </div>
      </fieldset>

      {/* ── Médias & validation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#f4f4f5]">
        <div>
          <label htmlFor="plaquetteUrl" className={labelClass}>Plaquette PDF (lien)</label>
          <input id="plaquetteUrl" name="plaquetteUrl" type="url" maxLength={500} placeholder="https://…/plaquette.pdf" defaultValue={(reseau.plaquetteUrl as string) ?? ''} className={inputClass} />
        </div>
        <div>
          <label htmlFor="rempliPar" className={labelClass}>Fiche remplie par</label>
          <input id="rempliPar" name="rempliPar" type="text" maxLength={200} defaultValue={(reseau.rempliPar as string) ?? ''} className={inputClass} />
        </div>
      </div>

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
        {isPending ? 'Enregistrement…' : 'Enregistrer la fiche'}
      </button>
    </form>
  )
}
