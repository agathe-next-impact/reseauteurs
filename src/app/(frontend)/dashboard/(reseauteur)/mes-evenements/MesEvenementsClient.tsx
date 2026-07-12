'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CalendarDays, MapPin, Pencil, Trash2, Plus, Loader2, ExternalLink } from 'lucide-react'
import { createMonEvenement, updateMonEvenement, deleteMonEvenement, type EvenementFormData } from './actions'

export interface TypeEvLite {
  id: number
  label: string
}

export interface MonEvenement {
  id: number
  slug: string | null
  titre: string
  type: number
  description: string | null
  dateDebut: string
  dateFin: string | null
  lieuNom: string | null
  lieuAdresse: string | null
  lieuCodePostal: string | null
  lieuVille: string
  lienInscription: string | null
  statut: string
}

const inputClass =
  'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors'
const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

/** ISO → valeur datetime-local (heure locale, sans secondes). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MesEvenementsClient({
  evenements,
  types,
}: {
  evenements: MonEvenement[]
  types: TypeEvLite[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<MonEvenement | 'new' | null>(null)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: EvenementFormData = {
      titre: String(fd.get('titre') ?? ''),
      type: Number(fd.get('type')),
      description: String(fd.get('description') ?? ''),
      dateDebut: fd.get('dateDebut') ? new Date(String(fd.get('dateDebut'))).toISOString() : '',
      dateFin: fd.get('dateFin') ? new Date(String(fd.get('dateFin'))).toISOString() : '',
      lieuNom: String(fd.get('lieuNom') ?? ''),
      lieuAdresse: String(fd.get('lieuAdresse') ?? ''),
      lieuCodePostal: String(fd.get('lieuCodePostal') ?? ''),
      lieuVille: String(fd.get('lieuVille') ?? ''),
      lienInscription: String(fd.get('lienInscription') ?? ''),
    }
    startTransition(async () => {
      const res =
        editing === 'new' || editing === null
          ? await createMonEvenement(data)
          : await updateMonEvenement(editing.id, data)
      if (res.ok) {
        toast.success(editing === 'new' ? 'Événement publié.' : 'Événement mis à jour.')
        setEditing(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const onDelete = (ev: MonEvenement) => {
    if (!window.confirm(`Supprimer « ${ev.titre} » ?`)) return
    startTransition(async () => {
      const res = await deleteMonEvenement(ev.id)
      if (res.ok) {
        toast.success('Événement supprimé.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const current = editing !== null && editing !== 'new' ? editing : null

  return (
    <div className="space-y-6">
      {/* Formulaire création/édition */}
      {editing !== null ? (
        <form onSubmit={onSubmit} className="rsn-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#18181b]">
            {current ? `Modifier « ${current.titre} »` : 'Nouvel événement'}
          </h2>

          <div>
            <label htmlFor="titre" className={labelClass}>Titre *</label>
            <input id="titre" name="titre" type="text" required maxLength={200} defaultValue={current?.titre ?? ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="type" className={labelClass}>Catégorie *</label>
              <select id="type" name="type" required defaultValue={current?.type ?? ''} className={inputClass}>
                <option value="" disabled>Choisir…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lienInscription" className={labelClass}>Lien d&apos;inscription (externe)</label>
              <input id="lienInscription" name="lienInscription" type="url" maxLength={500} placeholder="https://…" defaultValue={current?.lienInscription ?? ''} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="dateDebut" className={labelClass}>Date et heure *</label>
              <input id="dateDebut" name="dateDebut" type="datetime-local" required defaultValue={toLocalInput(current?.dateDebut ?? null)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="dateFin" className={labelClass}>Fin (optionnel)</label>
              <input id="dateFin" name="dateFin" type="datetime-local" defaultValue={toLocalInput(current?.dateFin ?? null)} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" name="description" rows={4} maxLength={3000} defaultValue={current?.description ?? ''} className={`${inputClass} resize-none`} />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-[#52525b]">Lieu</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lieuNom" className={labelClass}>Nom du lieu</label>
                <input id="lieuNom" name="lieuNom" type="text" maxLength={200} defaultValue={current?.lieuNom ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuAdresse" className={labelClass}>Adresse</label>
                <input id="lieuAdresse" name="lieuAdresse" type="text" maxLength={300} defaultValue={current?.lieuAdresse ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuCodePostal" className={labelClass}>Code postal</label>
                <input id="lieuCodePostal" name="lieuCodePostal" type="text" maxLength={10} defaultValue={current?.lieuCodePostal ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuVille" className={labelClass}>Ville *</label>
                <input id="lieuVille" name="lieuVille" type="text" required maxLength={100} defaultValue={current?.lieuVille ?? ''} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-[#a1a1aa]">L&apos;adresse est géocodée automatiquement pour la carte.</p>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60"
            >
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {current ? 'Enregistrer' : 'Publier l\'événement'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={pending}
              className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm"
        >
          <Plus size={15} aria-hidden />
          Nouvel événement
        </button>
      )}

      {/* Liste */}
      {evenements.length === 0 && editing === null ? (
        <div className="rsn-card rounded-2xl border-dashed p-10 text-center">
          <CalendarDays size={32} className="text-[#d4d4d8] mx-auto mb-4" aria-hidden />
          <p className="text-sm font-medium text-[#52525b] mb-1">Aucun événement pour l&apos;instant</p>
          <p className="text-sm text-[#71717a]">Publiez votre premier événement de networking.</p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {evenements.map((ev) => {
            const d = new Date(ev.dateDebut)
            const past = d.getTime() < Date.now()
            return (
              <li key={ev.id} className="rsn-card rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#16284f] truncate">
                    {ev.titre}
                    {past && <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-[#a1a1aa]">passé</span>}
                    {ev.statut !== 'publie' && <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-amber-600">{ev.statut}</span>}
                  </p>
                  <p className="text-xs text-[#71717a] flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={11} aria-hidden />{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden />{ev.lieuVille}</span>
                  </p>
                </div>
                {ev.slug && (
                  <Link href={`/evenement/${ev.slug}`} target="_blank" className="text-[#a1a1aa] hover:text-[#2563EB] transition-colors" aria-label={`Voir la fiche de ${ev.titre}`}>
                    <ExternalLink size={15} />
                  </Link>
                )}
                <button type="button" onClick={() => setEditing(ev)} className="text-[#a1a1aa] hover:text-[#2563EB] transition-colors" aria-label={`Modifier ${ev.titre}`}>
                  <Pencil size={15} />
                </button>
                <button type="button" onClick={() => onDelete(ev)} disabled={pending} className="text-[#a1a1aa] hover:text-red-600 transition-colors disabled:opacity-50" aria-label={`Supprimer ${ev.titre}`}>
                  <Trash2 size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
