'use client'

/**
 * FiltresReseauteurs — Panneau de filtres pour la carte des réseauteurs.
 *
 * Filtres de premier rang (ADR-0011 §4.8) :
 *   - Métier / secteur d'activité
 *   - Réseau fréquenté
 *   - Badge (Bronze / Argent / Gold / Platinum)
 *   - Ville (texte libre)
 *
 * PAS d'axe date : un réseauteur est persistant (DESIGN.md §6).
 *
 * Layout :
 *   - Desktop : sidebar fixe à gauche (280px)
 *   - Mobile : bouton FAB + drawer bottom-sheet
 */

import { useState, useCallback } from 'react'
import { SlidersHorizontal, X, RotateCcw, MapPin, Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

export interface ReseauteurFilters {
  ville: string
  secteur: string   // value/slug
  reseau: string    // slug (peut être plusieurs, virgule-séparés)
  badge: string     // 'bronze' | 'argent' | 'gold' | 'platinum' | ''
}

export const emptyFilters: ReseauteurFilters = {
  ville: '',
  secteur: '',
  reseau: '',
  badge: '',
}

export interface CategoryLite {
  id: number
  value: string
  label: string
  couleur?: string | null
}

export interface ReseauLite {
  id: number
  slug: string
  nom: string
}

interface FiltresReseauteursProps {
  filters: ReseauteurFilters
  onFilterChange: (filters: ReseauteurFilters) => void
  resultCount: number
  categories: CategoryLite[]
  reseaux: ReseauLite[]
}

const BADGES = [
  { value: 'bronze', label: 'Bronze', couleur: '#92400e', description: '0–1 événement/mois' },
  { value: 'argent', label: 'Argent', couleur: '#475569', description: '2–5 événements/mois' },
  { value: 'gold', label: 'Gold', couleur: '#a16207', description: '6–10 événements/mois' },
  { value: 'platinum', label: 'Platinum', couleur: '#1d4ed8', description: '+10 événements/mois' },
] as const

export default function FiltresReseauteurs({
  filters,
  onFilterChange,
  resultCount,
  categories,
  reseaux,
}: FiltresReseauteursProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const hasActiveFilters =
    filters.ville.trim() !== '' ||
    filters.secteur !== '' ||
    filters.reseau !== '' ||
    filters.badge !== ''

  const resetFilters = useCallback(() => onFilterChange(emptyFilters), [onFilterChange])

  const handleVille = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onFilterChange({ ...filters, ville: e.target.value }),
    [filters, onFilterChange],
  )

  const toggleSecteur = useCallback(
    (value: string) =>
      onFilterChange({ ...filters, secteur: filters.secteur === value ? '' : value }),
    [filters, onFilterChange],
  )

  const toggleReseau = useCallback(
    (slug: string) => {
      const current = filters.reseau
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug]
      onFilterChange({ ...filters, reseau: next.join(',') })
    },
    [filters, onFilterChange],
  )

  const toggleBadge = useCallback(
    (value: string) =>
      onFilterChange({ ...filters, badge: filters.badge === value ? '' : value }),
    [filters, onFilterChange],
  )

  const selectedReseaux = filters.reseau
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const content = (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-[#18181b]">Filtrer les réseauteurs</h2>
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer les filtres"
        >
          <X size={18} />
        </button>
      </div>

      {/* Ville */}
      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
          Ville
        </label>
        <div className="relative">
          <MapPin
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Paris, Lyon, Clermont..."
            value={filters.ville}
            onChange={handleVille}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#e4e4e7] rounded-xl focus:outline-none focus:border-[#2563EB] transition-colors bg-white"
            aria-label="Filtrer par ville"
          />
        </div>
      </div>

      {/* Secteur */}
      {categories.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
            Secteur d&apos;activité
          </p>
          <div className="space-y-0.5">
            {categories.map((cat) => (
              <div
                key={cat.value}
                className="flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggleSecteur(cat.value)}
              >
                <Checkbox
                  checked={filters.secteur === cat.value}
                  onCheckedChange={() => toggleSecteur(cat.value)}
                  aria-label={`Secteur ${cat.label}`}
                />
                {cat.couleur && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cat.couleur }}
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm text-[#18181b]">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Réseau fréquenté */}
      {reseaux.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
            Réseau fréquenté
          </p>
          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
            {reseaux.map((r) => (
              <div
                key={r.slug}
                className="flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggleReseau(r.slug)}
              >
                <Checkbox
                  checked={selectedReseaux.includes(r.slug)}
                  onCheckedChange={() => toggleReseau(r.slug)}
                  aria-label={`Réseau ${r.nom}`}
                />
                <span className="text-sm text-[#18181b] truncate">{r.nom}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badge */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
          Badge
        </p>
        <div className="space-y-0.5">
          {BADGES.map((b) => (
            <div
              key={b.value}
              className="flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => toggleBadge(b.value)}
            >
              <Checkbox
                checked={filters.badge === b.value}
                onCheckedChange={() => toggleBadge(b.value)}
                aria-label={`Badge ${b.label}`}
              />
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ background: b.couleur }}
              >
                {b.label}
              </span>
              <span className="text-xs text-[#71717a]">{b.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Réinitialiser */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1.5 text-sm text-[#71717a] hover:text-[#18181b] transition-colors mb-4 cursor-pointer"
        >
          <RotateCcw size={13} />
          Réinitialiser les filtres
        </button>
      )}

      {/* Compteur */}
      <div
        className="mt-auto pt-4 border-t border-[#e4e4e7]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="bg-[#2563EB] rounded-xl py-2 px-3 text-center">
          <span className="text-sm font-semibold text-white">
            {resultCount} réseauteur{resultCount !== 1 ? 's' : ''} visible{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Bouton FAB mobile */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-[800] bg-[#2563EB] text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-[#1d4ed8] transition-colors cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir les filtres"
        aria-expanded={mobileOpen}
      >
        <SlidersHorizontal size={15} />
        Filtres
        {hasActiveFilters && (
          <span className="bg-white text-[#2563EB] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {[filters.ville, filters.secteur, filters.badge].filter(Boolean).length +
              selectedReseaux.length}
          </span>
        )}
      </button>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-[280px] shrink-0 p-4 border-r border-[#e4e4e7] bg-white overflow-y-auto">
        {content}
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[900]">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto flex flex-col shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3 shrink-0" aria-hidden="true" />
            {content}
          </div>
        </div>
      )}
    </>
  )
}
