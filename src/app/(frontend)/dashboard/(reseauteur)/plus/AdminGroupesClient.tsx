'use client'

/**
 * AdminGroupesClient — déclaration des groupes locaux administrés par un
 * réseauteur Plus (décision 2026-07-16). 3 groupes maximum, sélection libre
 * parmi les groupes locaux publiés (règles re-vérifiées serveur).
 *
 * Effets : nom affiché sur la fiche du groupe (« Admins du groupe ») + droit
 * de créer des événements pour ce groupe depuis /dashboard/mes-evenements.
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Search, ShieldCheck } from 'lucide-react'
import { saveAdminReseaux } from './actions'

const MAX = 3

export interface GroupeLite {
  id: number
  nom: string
  ville: string | null
}

export function AdminGroupesClient({
  groupes,
  initialSelected,
}: {
  groupes: GroupeLite[]
  initialSelected: number[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected))
  const [filtre, setFiltre] = useState('')
  const [pending, startTransition] = useTransition()

  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase()
    if (!f) return groupes
    return groupes.filter(
      (g) => g.nom.toLowerCase().includes(f) || (g.ville ?? '').toLowerCase().includes(f),
    )
  }, [groupes, filtre])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX) next.add(id)
      else toast.error(`${MAX} groupes maximum.`)
      return next
    })
  }

  const save = () => {
    startTransition(async () => {
      const res = await saveAdminReseaux([...selected])
      if (res.ok) {
        toast.success('Groupes administrés enregistrés.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const dirty =
    selected.size !== initialSelected.length || initialSelected.some((id) => !selected.has(id))

  return (
    <section className="rsn-card rounded-2xl p-5" aria-labelledby="admin-groupes-titre">
      <h2 id="admin-groupes-titre" className="text-sm font-semibold text-[#18181b] mb-1 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#f5851f]" aria-hidden />
        Mes groupes en tant qu&apos;admin
      </h2>
      <p className="text-xs text-[#71717a] mb-4">
        Déclarez-vous admin de {MAX} groupes locaux maximum. Votre nom apparaît sur la fiche de
        chaque groupe et vous pouvez créer des événements en son nom depuis « Mes événements ».
      </p>

      {groupes.length === 0 ? (
        <p className="text-sm text-[#71717a]">Aucun groupe local publié pour l&apos;instant.</p>
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" aria-hidden />
            <input
              type="search"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Rechercher un groupe (nom, ville)…"
              aria-label="Rechercher un groupe local"
              className="w-full rounded-xl border border-[#e4e4e7] bg-white pl-9 pr-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-[#e4e4e7] divide-y divide-[#f4f4f5]" role="list">
            {visibles.length === 0 ? (
              <p className="p-3 text-sm text-[#71717a]">Aucun groupe ne correspond à la recherche.</p>
            ) : (
              visibles.map((g) => {
                const checked = selected.has(g.id)
                const disabled = !checked && selected.size >= MAX
                return (
                  <label
                    key={g.id}
                    role="listitem"
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:bg-[#fafafa]'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(g.id)}
                      className="w-4 h-4 rounded border-[#d4d4d8] shrink-0"
                    />
                    <span className="text-[#18181b] font-medium truncate">{g.nom}</span>
                    {g.ville && <span className="text-xs text-[#a1a1aa] shrink-0">{g.ville}</span>}
                  </label>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[#71717a]">
              {selected.size}/{MAX} groupe{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="inline-flex items-center gap-2 bg-[#f5851f] text-white font-semibold py-2 px-4 rounded-xl hover:bg-[#e47318] transition-colors text-sm disabled:opacity-50"
            >
              {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Enregistrer
            </button>
          </div>
        </>
      )}
    </section>
  )
}
