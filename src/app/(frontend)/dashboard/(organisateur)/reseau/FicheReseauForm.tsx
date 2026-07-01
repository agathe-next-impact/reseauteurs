'use client'

import { useState, useTransition } from 'react'
import { updateFicheReseau } from './actions'

interface FicheReseauFormProps {
  reseau: Record<string, unknown>
}

export function FicheReseauForm({ reseau }: FicheReseauFormProps) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const fd = new FormData(e.currentTarget)
    const data = {
      nom: fd.get('nom') as string,
      description: fd.get('description') as string | undefined,
      presentation: fd.get('presentation') as string | undefined,
      siteWeb: fd.get('siteWeb') as string | undefined,
      emailContact: fd.get('emailContact') as string | undefined,
      telephone: fd.get('telephone') as string | undefined,
      ville: fd.get('ville') as string | undefined,
      departement: fd.get('departement') as string | undefined,
      region: fd.get('region') as string | undefined,
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
