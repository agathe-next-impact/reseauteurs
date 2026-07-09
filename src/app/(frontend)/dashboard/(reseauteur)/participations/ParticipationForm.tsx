'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { saveParticipations } from './actions'

export interface ParticipationEventItem {
  id: number | string
  titre: string
  dateDebut: string
  lieuVille: string | null
  reseauNom: string | null
}

export function ParticipationForm({
  events,
  initialSelected,
}: {
  events: ParticipationEventItem[]
  initialSelected: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected.map(String)))
  const [pending, startTransition] = useTransition()

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSave = () => {
    startTransition(async () => {
      const res = await saveParticipations([...selected])
      if (res.ok) {
        toast.success(
          res.count > 0
            ? `Présence enregistrée pour ${res.count} événement${res.count > 1 ? 's' : ''}.`
            : 'Vos participations ont été mises à jour.',
        )
      } else {
        toast.error(res.error ?? 'Erreur lors de l\'enregistrement.')
      }
    })
  }

  return (
    <div>
      <ul className="space-y-2" role="list" aria-label="Événements de vos réseaux">
        {events.map((ev) => {
          const id = String(ev.id)
          const on = selected.has(id)
          const d = new Date(ev.dateDebut)
          const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
          return (
            <li key={id}>
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  on ? 'border-[#2563EB] bg-[#eff6ff]' : 'border-[#e4e4e7] hover:border-[#2563EB]/40'
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(id)} className="sr-only" />
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    on ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-[#d4d4d8] bg-white'
                  }`}
                  aria-hidden
                >
                  {on && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[#18181b] truncate">{ev.titre}</span>
                  <span className="block text-xs text-[#71717a] truncate capitalize">
                    {dateStr}
                    {ev.lieuVille ? ` · ${ev.lieuVille}` : ''}
                    {ev.reseauNom ? ` · ${ev.reseauNom}` : ''}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-[#71717a]">
          {selected.size} événement{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60"
        >
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}
