'use client'

/**
 * ReseauteursFilters — Panneau de filtres pour la recherche de réseauteurs.
 * Synchronise avec l'URL (partageable). Consomme Payload find() via Server Action.
 * Filtres : nom/entreprise, ville, departement, region, badge, reseau (slug).
 * Pas de moteur FTS — colonnes indexées (CLAUDE.md §10, ADR-0011 §6).
 */

import { useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { DebouncedFilterInput } from './DebouncedFilterInput'

interface ReseauteursFiltersProps {
  categories: Array<{ id: string | number; label: string }>
  reseaux?: Array<{ slug: string; nom: string }>
}

const BADGES = [
  { value: '', label: 'Tous les badges' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'argent', label: 'Argent' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
]

export function ReseauteursFilters({ categories, reseaux = [] }: ReseauteursFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const current = {
    q: searchParams.get('q') ?? '',
    ville: searchParams.get('ville') ?? '',
    departement: searchParams.get('departement') ?? '',
    region: searchParams.get('region') ?? '',
    badge: searchParams.get('badge') ?? '',
    secteur: searchParams.get('secteur') ?? '',
    reseau: searchParams.get('reseau') ?? '',
  }

  const hasFilters = Object.values(current).some(Boolean)

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page') // reset pagination
      startTransition(() => {
        // scroll: false — filtrer ne doit pas renvoyer l'utilisateur en haut de page.
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams],
  )

  const reset = useCallback(() => {
    // Conserve la vue courante : sans `vue`, /reseauteurs retombe sur la carte
    // et l'utilisateur perd l'annuaire en effaçant ses filtres.
    const params = new URLSearchParams()
    const vue = searchParams.get('vue')
    if (vue) params.set('vue', vue)
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }, [router, pathname, searchParams])

  return (
    <div className="bg-white rounded-2xl border border-[#DFE0E1] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1D1E21] flex items-center gap-1.5">
          <SlidersHorizontal size={14} aria-hidden />
          Filtrer
        </h2>
        {hasFilters && (
          <button
            onClick={reset}
            className="text-xs text-[#6E7175] hover:text-[#035AA6] flex items-center gap-1 cursor-pointer transition-colors"
            aria-label="Effacer tous les filtres"
          >
            <X size={12} aria-hidden />
            Effacer
          </button>
        )}
      </div>

      {/* Recherche nom/entreprise */}
      <div>
        <label htmlFor="filter-q" className="block text-xs font-medium text-[#4E5155] mb-1">
          Nom ou entreprise
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999A9D]" aria-hidden />
          <DebouncedFilterInput
            id="filter-q"
            type="search"
            urlValue={current.q}
            onCommit={(v) => update('q', v)}
            placeholder="Jean Dupont, Dupont SARL…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Ville */}
      <div>
        <label htmlFor="filter-ville" className="block text-xs font-medium text-[#4E5155] mb-1">
          Ville
        </label>
        <DebouncedFilterInput
          id="filter-ville"
          type="text"
          urlValue={current.ville}
          onCommit={(v) => update('ville', v)}
          placeholder="Paris, Lyon, Bordeaux…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent"
          autoComplete="address-level2"
        />
      </div>

      {/* Département */}
      <div>
        <label htmlFor="filter-dept" className="block text-xs font-medium text-[#4E5155] mb-1">
          Département
        </label>
        <DebouncedFilterInput
          id="filter-dept"
          type="text"
          urlValue={current.departement}
          onCommit={(v) => update('departement', v)}
          placeholder="Rhône, Puy-de-Dôme…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent"
        />
      </div>

      {/* Région — le serveur filtrait déjà `region`, il manquait le contrôle. */}
      <div>
        <label htmlFor="filter-region" className="block text-xs font-medium text-[#4E5155] mb-1">
          Région
        </label>
        <DebouncedFilterInput
          id="filter-region"
          type="text"
          urlValue={current.region}
          onCommit={(v) => update('region', v)}
          placeholder="Auvergne-Rhône-Alpes…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent"
        />
      </div>

      {/* Badge */}
      <div>
        <label htmlFor="filter-badge" className="block text-xs font-medium text-[#4E5155] mb-1">
          Badge
        </label>
        <select
          id="filter-badge"
          value={current.badge}
          onChange={(e) => update('badge', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent cursor-pointer"
        >
          {BADGES.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>

      {/* Réseau */}
      {reseaux.length > 0 && (
        <div>
          <label htmlFor="filter-reseau" className="block text-xs font-medium text-[#4E5155] mb-1">
            Réseau
          </label>
          <select
            id="filter-reseau"
            value={current.reseau}
            onChange={(e) => update('reseau', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent cursor-pointer"
          >
            <option value="">Tous les réseaux</option>
            {reseaux.map((r) => (
              <option key={r.slug} value={r.slug}>{r.nom}</option>
            ))}
          </select>
        </div>
      )}

      {/* Secteur */}
      {categories.length > 0 && (
        <div>
          <label htmlFor="filter-secteur" className="block text-xs font-medium text-[#4E5155] mb-1">
            Secteur d&apos;activité
          </label>
          <select
            id="filter-secteur"
            value={current.secteur}
            onChange={(e) => update('secteur', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#DFE0E1] bg-[#F2F2F2] text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent cursor-pointer"
          >
            <option value="">Tous les secteurs</option>
            {categories.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {isPending && (
        <p className="text-xs text-center text-[#6E7175] animate-pulse" aria-live="polite">
          Mise à jour…
        </p>
      )}
    </div>
  )
}
