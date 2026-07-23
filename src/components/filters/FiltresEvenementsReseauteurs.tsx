'use client'

/**
 * FiltresEvenementsReseauteurs — Filtres pour la carte des événements (modèle RÉSEAUTEURS).
 *
 * Filtres (DESIGN.md §6) :
 *   - Réseau organisateur
 *   - Ville
 *   - Date (fourchette)
 *
 * Pas de filtre métier/secteur/badge (ces filtres sont pour les réseauteurs).
 *
 * Rendu comme contenu du dropdown de filtres de la barre de navigation
 * supérieure de la carte (`.rsn-map-filterdrop`) — voir MapEvenementsReseauteurs.
 */

import { useCallback } from 'react'
import { X, MapPin, Calendar } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import ChampLieuAutocomplete from '@/components/forms/ChampLieuAutocomplete'

export interface EvenementFiltersNew {
  reseau: string    // slug(s) séparés par virgule
  ville: string
  dateDebut: string // ISO date string YYYY-MM-DD ou ''
  dateFin: string   // ISO date string YYYY-MM-DD ou ''
}

export const emptyFiltersNew: EvenementFiltersNew = {
  reseau: '',
  ville: '',
  dateDebut: '',
  dateFin: '',
}

export interface ReseauLiteFilter {
  id: number
  slug: string
  nom: string
}

interface FiltresEvenementsReseauteursProps {
  filters: EvenementFiltersNew
  onFilterChange: (filters: EvenementFiltersNew) => void
  resultCount: number
  reseaux: ReseauLiteFilter[]
  /** Fermer le dropdown parent (fourni par la barre de navigation de la carte). */
  onClose?: () => void
}

export default function FiltresEvenementsReseauteurs({
  filters,
  onFilterChange,
  resultCount,
  reseaux,
  onClose,
}: FiltresEvenementsReseauteursProps) {
  const hasActiveFilters =
    filters.reseau !== '' ||
    filters.ville.trim() !== '' ||
    filters.dateDebut !== '' ||
    filters.dateFin !== ''

  const resetFilters = useCallback(() => onFilterChange(emptyFiltersNew), [onFilterChange])

  const selectedReseaux = filters.reseau
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const toggleReseau = useCallback(
    (slug: string) => {
      const next = selectedReseaux.includes(slug)
        ? selectedReseaux.filter((s) => s !== slug)
        : [...selectedReseaux, slug]
      onFilterChange({ ...filters, reseau: next.join(',') })
    },
    [filters, onFilterChange, selectedReseaux],
  )

  const content = (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-[#1D1E21]">Filtrer les événements</h2>
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
        <label
          htmlFor="filtre-ville-ev"
          className="block text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2"
        >
          Ville
        </label>
        <div className="relative">
          <MapPin
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <ChampLieuAutocomplete
            mode="ville"
            id="filtre-ville-ev"
            placeholder="Paris, Lyon, Bordeaux..."
            valeurExterne={filters.ville}
            onValueChange={(ville) => onFilterChange({ ...filters, ville })}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#DFE0E1] rounded-xl focus:outline-none focus:border-[#035AA6] transition-colors bg-white"
          />
        </div>
      </div>

      {/* Date de début */}
      <div className="mb-3">
        <label
          htmlFor="filtre-date-debut"
          className="block text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2"
        >
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            À partir du
          </span>
        </label>
        <input
          id="filtre-date-debut"
          type="date"
          value={filters.dateDebut}
          onChange={(e) => onFilterChange({ ...filters, dateDebut: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-[#DFE0E1] rounded-xl focus:outline-none focus:border-[#035AA6] transition-colors bg-white"
        />
      </div>

      {/* Date de fin */}
      <div className="mb-5">
        <label
          htmlFor="filtre-date-fin"
          className="block text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2"
        >
          Jusqu&apos;au
        </label>
        <input
          id="filtre-date-fin"
          type="date"
          value={filters.dateFin}
          onChange={(e) => onFilterChange({ ...filters, dateFin: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-[#DFE0E1] rounded-xl focus:outline-none focus:border-[#035AA6] transition-colors bg-white"
        />
      </div>

      {/* Réseau */}
      {reseaux.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
            Réseau organisateur
          </p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
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

      {/* Réinitialiser */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1.5 text-sm text-[#6E7175] hover:text-[#1D1E21] transition-colors mb-4 cursor-pointer"
        >
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
        <div className="bg-[#012A4A] rounded-xl py-2 px-3 text-center">
          <span className="text-sm font-semibold text-white">
            {resultCount} événement{resultCount !== 1 ? 's' : ''} visible{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return <div className="rsn-map-filterdrop">{content}</div>
}
