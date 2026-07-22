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
 * Rendu comme contenu du dropdown de filtres de la barre de navigation
 * supérieure de la carte (`.rsn-map-filterdrop`) — voir MapReseauteurs.
 */

import { useCallback } from 'react'
import { X, RotateCcw, MapPin } from 'lucide-react'
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
  /** Fermer le dropdown parent (fourni par la barre de navigation de la carte). */
  onClose?: () => void
}

const BADGES = [
  { value: 'bronze', label: 'Bronze', couleur: '#6E5608', description: '0–1 événement/mois' },
  { value: 'argent', label: 'Argent', couleur: '#4E5155', description: '2–5 événements/mois' },
  { value: 'gold', label: 'Gold', couleur: '#a16207', description: '6–10 événements/mois' },
  { value: 'platinum', label: 'Platinum', couleur: '#02467F', description: '+10 événements/mois' },
] as const

export default function FiltresReseauteurs({
  filters,
  onFilterChange,
  resultCount,
  categories,
  reseaux,
  onClose,
}: FiltresReseauteursProps) {
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
        <h2 className="text-base font-semibold text-[#1D1E21]">Filtrer les réseauteurs</h2>
        {onClose && (
          <button
            type="button"
            className="p-2.5 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer"
            onClick={onClose}
            aria-label="Fermer les filtres"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Ville */}
      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
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
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#DFE0E1] rounded-xl focus:outline-none focus:border-[#035AA6] transition-colors bg-white"
            aria-label="Filtrer par ville"
          />
        </div>
      </div>

      {/* Secteur */}
      {categories.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
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
                <span className="text-sm text-[#1D1E21]">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Réseau fréquenté */}
      {reseaux.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
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
                <span className="text-sm text-[#1D1E21] truncate">{r.nom}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badge */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
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
              <span className="text-xs text-[#6E7175]">{b.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Réinitialiser */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1.5 text-sm text-[#6E7175] hover:text-[#1D1E21] transition-colors mb-4 cursor-pointer"
        >
          <RotateCcw size={13} />
          Réinitialiser les filtres
        </button>
      )}

      {/* Compteur */}
      <div
        className="mt-auto pt-4 border-t border-[#DFE0E1]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="bg-[#035AA6] rounded-xl py-2 px-3 text-center">
          <span className="text-sm font-semibold text-white">
            {resultCount} réseauteur{resultCount !== 1 ? 's' : ''} visible{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return <div className="rsn-map-filterdrop">{content}</div>
}
