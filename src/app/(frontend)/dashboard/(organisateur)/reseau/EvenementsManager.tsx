'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Calendar, Pencil, Trash2, X } from 'lucide-react'
import { createEvenement, updateEvenement, deleteEvenement } from './actions'

interface EvenementsManagerProps {
  evenements: Record<string, unknown>[]
  reseauId: string | number
}

type FormMode = 'idle' | 'create' | { edit: Record<string, unknown> }

export function EvenementsManager({ evenements, reseauId }: EvenementsManagerProps) {
  const [mode, setMode] = useState<FormMode>('idle')
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [localEvenements, setLocalEvenements] = useState(evenements)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)

    const fd = new FormData(e.currentTarget)
    const data = {
      titre: fd.get('titre') as string,
      description: fd.get('description') as string | undefined,
      dateDebut: fd.get('dateDebut') as string,
      dateFin: fd.get('dateFin') as string | undefined,
      heure: fd.get('heure') as string | undefined,
      lieuNom: fd.get('lieuNom') as string | undefined,
      lieuVille: fd.get('lieuVille') as string | undefined,
      lieuAdresse: fd.get('lieuAdresse') as string | undefined,
      lienInscription: fd.get('lienInscription') as string | undefined,
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createEvenement(data)
        if ('error' in result) {
          setErrorMsg(result.error)
        } else {
          // Refresh optimiste — rechargement complet nécessaire pour avoir l'id/slug
          window.location.reload()
        }
      } else if (typeof mode === 'object' && 'edit' in mode) {
        const result = await updateEvenement(mode.edit.id as string | number, data)
        if ('error' in result) {
          setErrorMsg(result.error)
        } else {
          setLocalEvenements((prev) =>
            prev.map((ev) =>
              ev.id === (mode.edit.id as string | number)
                ? { ...ev, ...data }
                : ev
            )
          )
          setMode('idle')
        }
      }
    })
  }

  const handleDelete = (evenementId: string | number) => {
    if (!window.confirm('Supprimer cet événement ? Cette action est irréversible.')) return
    startTransition(async () => {
      const result = await deleteEvenement(evenementId)
      if ('error' in result) {
        setErrorMsg(result.error)
      } else {
        setLocalEvenements((prev) => prev.filter((ev) => ev.id !== evenementId))
      }
    })
  }

  const inputClass =
    'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors'
  const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

  const editingEvenement =
    typeof mode === 'object' && 'edit' in mode ? mode.edit : null

  return (
    <div className="p-6">
      {/* Liste événements */}
      {localEvenements.length === 0 && mode === 'idle' ? (
        <div className="text-center py-6">
          <Calendar size={28} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
          <p className="text-sm text-[#71717a] mb-4">Aucun événement publié.</p>
          <button
            type="button"
            onClick={() => setMode('create')}
            className="text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] transition-colors"
          >
            Créer le premier événement →
          </button>
        </div>
      ) : (
        <div className="space-y-2 mb-4" role="list" aria-label="Événements du réseau">
          {localEvenements.map((ev) => (
            <div
              key={ev.id as string}
              role="listitem"
              className="flex items-center gap-3 p-3 rounded-xl border border-[#e4e4e7] hover:border-[#d4d4d8] transition-colors"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-[#eff6ff] flex items-center justify-center text-[#2563EB]" aria-hidden>
                <Calendar size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {ev.slug ? (
                    <Link
                      href={`/evenement/${ev.slug as string}`}
                      className="text-sm font-medium text-[#18181b] hover:text-[#2563EB] no-underline transition-colors truncate"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ev.titre as string}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-[#18181b] truncate">{ev.titre as string}</p>
                  )}
                  {/* ADR-0012 : événement Premium supprimé — marqueur unique */}
                </div>
                <p className="text-xs text-[#71717a]">
                  {new Date(ev.dateDebut as string).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {ev.lieuVille ? ` · ${ev.lieuVille as string}` : ''}
                  <span className={`ml-1 ${
                    ev.statut === 'publie' ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    · {ev.statut === 'publie' ? 'Publié' : 'Suspendu'}
                  </span>
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode({ edit: ev })
                    setErrorMsg(null)
                  }}
                  className="p-1.5 rounded-lg text-[#71717a] hover:text-[#2563EB] hover:bg-[#eff6ff] transition-colors"
                  aria-label={`Modifier ${ev.titre as string}`}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ev.id as string | number)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg text-[#71717a] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label={`Supprimer ${ev.titre as string}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire create / edit */}
      {mode !== 'idle' && (
        <div className="rounded-2xl border border-[#2563EB]/20 bg-[#eff6ff]/20 p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#18181b]">
              {mode === 'create' ? 'Nouvel événement' : `Modifier l'événement`}
            </h3>
            <button
              type="button"
              onClick={() => { setMode('idle'); setErrorMsg(null) }}
              className="p-1 rounded-lg text-[#71717a] hover:text-[#18181b] hover:bg-[#f4f4f5] transition-colors"
              aria-label="Fermer le formulaire"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="titre" className={labelClass}>Titre de l&apos;événement *</label>
              <input
                id="titre"
                name="titre"
                type="text"
                required
                maxLength={300}
                defaultValue={editingEvenement?.titre as string ?? ''}
                className={inputClass}
                placeholder="Petit-déjeuner networking, Soirée BNI…"
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>Description</label>
              <textarea
                id="description"
                name="description"
                maxLength={5000}
                rows={3}
                defaultValue={editingEvenement?.description as string ?? ''}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dateDebut" className={labelClass}>Date de début *</label>
                <input
                  id="dateDebut"
                  name="dateDebut"
                  type="datetime-local"
                  required
                  defaultValue={
                    editingEvenement?.dateDebut
                      ? new Date(editingEvenement.dateDebut as string).toISOString().slice(0, 16)
                      : ''
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="dateFin" className={labelClass}>Date de fin</label>
                <input
                  id="dateFin"
                  name="dateFin"
                  type="datetime-local"
                  defaultValue={
                    editingEvenement?.dateFin
                      ? new Date(editingEvenement.dateFin as string).toISOString().slice(0, 16)
                      : ''
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="lieuVille" className={labelClass}>Ville</label>
                <input
                  id="lieuVille"
                  name="lieuVille"
                  type="text"
                  maxLength={100}
                  defaultValue={editingEvenement?.lieuVille as string ?? ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lieuNom" className={labelClass}>Lieu / salle</label>
                <input
                  id="lieuNom"
                  name="lieuNom"
                  type="text"
                  maxLength={200}
                  defaultValue={editingEvenement?.lieuNom as string ?? ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lieuAdresse" className={labelClass}>Adresse</label>
                <input
                  id="lieuAdresse"
                  name="lieuAdresse"
                  type="text"
                  maxLength={300}
                  defaultValue={editingEvenement?.lieuAdresse as string ?? ''}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="lienInscription" className={labelClass}>
                Lien d&apos;inscription externe
              </label>
              <input
                id="lienInscription"
                name="lienInscription"
                type="url"
                maxLength={500}
                placeholder="https://… (site de votre réseau)"
                defaultValue={editingEvenement?.lienInscription as string ?? ''}
                className={inputClass}
              />
              <p className="text-xs text-[#a1a1aa] mt-1">
                Le bouton &quot;S&apos;inscrire&quot; redirigera vers cette URL.
              </p>
            </div>

            {errorMsg && (
              <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
              >
                {isPending ? 'Enregistrement…' : mode === 'create' ? 'Publier l\'événement' : 'Enregistrer les modifications'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('idle'); setErrorMsg(null) }}
                className="px-4 py-2.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:bg-[#f4f4f5] transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bouton afficher le formulaire (si la liste est non-vide et pas en mode form) */}
      {mode === 'idle' && localEvenements.length > 0 && (
        <button
          type="button"
          onClick={() => { setMode('create'); setErrorMsg(null) }}
          className="text-xs text-[#2563EB] hover:text-[#1d4ed8] font-medium transition-colors mt-1"
        >
          + Ajouter un événement
        </button>
      )}
    </div>
  )
}
