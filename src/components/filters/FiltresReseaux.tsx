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
 * Layout :
 *   - Desktop : sidebar fixe à gauche (280px)
 *   - Mobile  : bouton FAB (violet) + drawer bottom-sheet
 */

import { useState, useCallback } from 'react'
import { SlidersHorizontal, X, RotateCcw, MapPin } from 'lucide-react'
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
}

export default function FiltresReseaux({
  filters,
  onFilterChange,
  resultCount,
  nationals,
}: FiltresReseauxProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const activeFilterCount = [filters.ville, filters.national].filter(Boolean).length

  const content = (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-[#18181b]">Filtrer les réseaux</h2>
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

  return (
    <>
      {/* Bouton FAB mobile */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-[800] bg-[#a855f7] text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-[#9333ea] transition-colors cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir les filtres"
        aria-expanded={mobileOpen}
      >
        <SlidersHorizontal size={15} />
        Filtres
        {hasActiveFilters && (
          <span className="bg-white text-[#a855f7] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {activeFilterCount}
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
            <div
              className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3 shrink-0"
              aria-hidden="true"
            />
            {content}
          </div>
        </div>
      )}
    </>
  )
}
