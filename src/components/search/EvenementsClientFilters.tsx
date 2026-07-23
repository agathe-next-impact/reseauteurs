'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import PanneauFiltresPliable from './PanneauFiltresPliable'
import ChampLieuFiltre from './ChampLieuFiltre'

interface EvenementsClientFiltersProps {
  reseaux: Array<{ slug: string; nom: string }>
  types?: Array<{ value: string; label: string }>
}

export default function EvenementsClientFilters({ reseaux, types = [] }: EvenementsClientFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const current = {
    ville: searchParams.get('ville') ?? '',
    departement: searchParams.get('departement') ?? '',
    type: searchParams.get('type') ?? '',
    tarification: searchParams.get('tarification') ?? '',
    reseau: searchParams.get('reseau') ?? '',
    // Vocabulaire partagé carte↔liste (cf. /api/geo/evenements).
    dateDebut: searchParams.get('dateDebut') ?? '',
  }

  // Compté, pas booléen : replié, l'accordéon doit annoncer COMBIEN de critères
  // s'appliquent, sinon la liste paraît complète alors qu'elle est filtrée.
  const nbActifs = Object.values(current).filter(Boolean).length

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      startTransition(() => {
        // scroll: false — filtrer ne doit pas renvoyer l'utilisateur en haut de page.
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams],
  )

  const reset = useCallback(() => {
    // Conserve la vue courante : sans `vue`, /evenements retombe sur la carte
    // et l'utilisateur perd l'agenda en effaçant ses filtres.
    const params = new URLSearchParams()
    const vue = searchParams.get('vue')
    if (vue) params.set('vue', vue)
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [router, pathname, searchParams])

  return (
    <PanneauFiltresPliable nbActifs={nbActifs} onReset={reset}>
      {/* Ville */}
      <div>
        <label htmlFor="ev-filter-ville" className="block text-xs font-medium text-[#4E5155] mb-1">
          Ville
        </label>
        <ChampLieuFiltre
          mode="ville"
          id="ev-filter-ville"
          urlValue={current.ville}
          onCommit={(v) => update('ville', v)}
          placeholder="Paris, Lyon…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#8A6D0B] focus:border-transparent"
        />
      </div>

      {/* Département */}
      <div>
        <label htmlFor="ev-filter-departement" className="block text-xs font-medium text-[#4E5155] mb-1">
          Département
        </label>
        <ChampLieuFiltre
          mode="departement"
          id="ev-filter-departement"
          urlValue={current.departement}
          onCommit={(v) => update('departement', v)}
          placeholder="Rhône, 69, Paris…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#8A6D0B] focus:border-transparent"
        />
      </div>

      {/* Type d'événement */}
      {types.length > 0 && (
        <div>
          <label htmlFor="ev-filter-type" className="block text-xs font-medium text-[#4E5155] mb-1">
            Type d&apos;événement
          </label>
          <select
            id="ev-filter-type"
            value={current.type}
            onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#8A6D0B] focus:border-transparent cursor-pointer"
          >
            <option value="">Tous les types</option>
            {types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tarification */}
      <div>
        <label htmlFor="ev-filter-tarif" className="block text-xs font-medium text-[#4E5155] mb-1">
          Tarif
        </label>
        <select
          id="ev-filter-tarif"
          value={current.tarification}
          onChange={(e) => update('tarification', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#8A6D0B] focus:border-transparent cursor-pointer"
        >
          <option value="">Tous</option>
          <option value="gratuit">Gratuit</option>
          <option value="payant">Payant</option>
        </select>
      </div>

      {/* Réseau */}
      {reseaux.length > 0 && (
        <div>
          <label htmlFor="ev-filter-reseau" className="block text-xs font-medium text-[#4E5155] mb-1">
            Réseau organisateur
          </label>
          <select
            id="ev-filter-reseau"
            value={current.reseau}
            onChange={(e) => update('reseau', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#8A6D0B] focus:border-transparent cursor-pointer"
          >
            <option value="">Tous les réseaux</option>
            {reseaux.map((r) => (
              <option key={r.slug} value={r.slug}>{r.nom}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date à partir de */}
      <div>
        <label htmlFor="ev-filter-datedebut" className="block text-xs font-medium text-[#4E5155] mb-1">
          À partir du
        </label>
        <input
          id="ev-filter-datedebut"
          type="date"
          value={current.dateDebut}
          onChange={(e) => update('dateDebut', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#8A6D0B] focus:border-transparent cursor-pointer"
        />
      </div>

      {isPending && (
        <p className="text-xs text-center text-[#6E7175] animate-pulse" aria-live="polite">
          Mise à jour…
        </p>
      )}
    </PanneauFiltresPliable>
  )
}
