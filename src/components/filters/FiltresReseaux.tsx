'use client'

/**
 * FiltresReseaux — Panneau de filtres pour la carte des réseaux locaux (ADR-0012).
 *
 * Filtres disponibles :
 *   - Réseau national parent (umbrella — sélection radio : un seul à la fois)
 *   - Ville (texte libre)
 *
 * Pas d'axe date (un réseau local est persistant).
 * Pas de filtre badge (les badges sont pour les réseauteurs).
 *
 * Rendu comme contenu du dropdown de filtres de la barre de navigation
 * supérieure de la carte (`.rsn-map-filterdrop`) — voir MapReseaux.
 */

import { useCallback } from 'react'
import { X, RotateCcw, MapPin } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

export interface ReseauFilters {
  ville: string
  /** ID du réseau national parent sous forme de chaîne. '' = tous les nationaux. */
  national: string
}

export const emptyReseauFilters: ReseauFilters = {
  ville: '',
  national: '',
}

export interface NationalLite {
  id: number
  slug: string
  nom: string
}

interface FiltresReseauxProps {
  filters: ReseauFilters
  onFilterChange: (filters: ReseauFilters) => void
  resultCount: number
  /** Liste des réseaux nationaux disponibles pour le filtre parent. */
  nationals: NationalLite[]
  /** Fermer le dropdown parent (fourni par la barre de navigation de la carte). */
  onClose?: () => void
}

export default function FiltresReseaux({
  filters,
  onFilterChange,
  resultCount,
  nationals,
  onClose,
}: FiltresReseauxProps) {
  const hasActiveFilters = filters.ville.trim() !== '' || filters.national !== ''

  const resetFilters = useCallback(() => onFilterChange(emptyReseauFilters), [onFilterChange])

  /** Sélection radio : un seul national à la fois ; re-cliquer désélectionne. */
  const toggleNational = useCallback(
    (id: number) => {
      const idStr = String(id)
      onFilterChange({
        ...filters,
        national: filters.national === idStr ? '' : idStr,
      })
    },
    [filters, onFilterChange],
  )

  const content = (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-[#18181b]">Filtrer les réseaux</h2>
        {onClose && (
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer"
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
          htmlFor="filtre-ville-res"
          className="block text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2"
        >
          Ville
        </label>
        <div className="relative">
          <MapPin
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            id="filtre-ville-res"
            type="text"
            placeholder="Paris, Lyon, Bordeaux..."
            value={filters.ville}
            onChange={(e) => onFilterChange({ ...filters, ville: e.target.value })}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#e4e4e7] rounded-xl focus:outline-none focus:border-[#a855f7] transition-colors bg-white"
          />
        </div>
      </div>

      {/* Réseau national parent */}
      {nationals.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
            Réseau national
          </p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {nationals.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggleNational(n.id)}
              >
                <Checkbox
                  checked={filters.national === String(n.id)}
                  onCheckedChange={() => toggleNational(n.id)}
                  aria-label={`Filtrer par réseau national ${n.nom}`}
                />
                <span className="text-sm text-[#18181b] truncate">{n.nom}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Compteur résultat */}
      <div
        className="mt-auto pt-4 border-t border-[#e4e4e7]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="bg-[#a855f7] rounded-xl py-2 px-3 text-center">
          <span className="text-sm font-semibold text-white">
            {resultCount} réseau{resultCount !== 1 ? 'x' : ''} visible{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return <div className="rsn-map-filterdrop">{content}</div>
}
