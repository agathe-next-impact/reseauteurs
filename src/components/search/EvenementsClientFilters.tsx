'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'

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

  const hasFilters = Object.values(current).some(Boolean)

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const reset = useCallback(() => {
    startTransition(() => router.push(pathname))
  }, [router, pathname])

  return (
    <div className="bg-white rounded-2xl border border-[#e4e4e7] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
          <SlidersHorizontal size={14} aria-hidden />
          Filtrer
        </h2>
        {hasFilters && (
          <button
            onClick={reset}
            className="text-xs text-[#71717a] hover:text-[#0284c7] flex items-center gap-1 cursor-pointer transition-colors"
            aria-label="Effacer tous les filtres"
          >
            <X size={12} aria-hidden />
            Effacer
          </button>
        )}
      </div>

      {/* Ville */}
      <div>
        <label htmlFor="ev-filter-ville" className="block text-xs font-medium text-[#52525b] mb-1">
          Ville
        </label>
        <input
          id="ev-filter-ville"
          type="text"
          value={current.ville}
          onChange={(e) => update('ville', e.target.value)}
          placeholder="Paris, Lyon…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-[#18181b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:border-transparent"
          autoComplete="address-level2"
        />
      </div>

      {/* Département */}
      <div>
        <label htmlFor="ev-filter-departement" className="block text-xs font-medium text-[#52525b] mb-1">
          Département
        </label>
        <input
          id="ev-filter-departement"
          type="text"
          value={current.departement}
          onChange={(e) => update('departement', e.target.value)}
          placeholder="Rhône, Paris…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-[#18181b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:border-transparent"
        />
      </div>

      {/* Type d'événement */}
      {types.length > 0 && (
        <div>
          <label htmlFor="ev-filter-type" className="block text-xs font-medium text-[#52525b] mb-1">
            Type d&apos;événement
          </label>
          <select
            id="ev-filter-type"
            value={current.type}
            onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:border-transparent cursor-pointer"
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
        <label htmlFor="ev-filter-tarif" className="block text-xs font-medium text-[#52525b] mb-1">
          Tarif
        </label>
        <select
          id="ev-filter-tarif"
          value={current.tarification}
          onChange={(e) => update('tarification', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:border-transparent cursor-pointer"
        >
          <option value="">Tous</option>
          <option value="gratuit">Gratuit</option>
          <option value="payant">Payant</option>
        </select>
      </div>

      {/* Réseau */}
      {reseaux.length > 0 && (
        <div>
          <label htmlFor="ev-filter-reseau" className="block text-xs font-medium text-[#52525b] mb-1">
            Réseau organisateur
          </label>
          <select
            id="ev-filter-reseau"
            value={current.reseau}
            onChange={(e) => update('reseau', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:border-transparent cursor-pointer"
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
        <label htmlFor="ev-filter-datedebut" className="block text-xs font-medium text-[#52525b] mb-1">
          À partir du
        </label>
        <input
          id="ev-filter-datedebut"
          type="date"
          value={current.dateDebut}
          onChange={(e) => update('dateDebut', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:border-transparent cursor-pointer"
        />
      </div>

      {isPending && (
        <p className="text-xs text-center text-[#71717a] animate-pulse" aria-live="polite">
          Mise à jour…
        </p>
      )}
    </div>
  )
}
