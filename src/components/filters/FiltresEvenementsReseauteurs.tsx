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
 */

import { useState, useCallback } from 'react'
import { SlidersHorizontal, X, RotateCcw, MapPin, Calendar } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

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
}

export default function FiltresEvenementsReseauteurs({
  filters,
  onFilterChange,
  resultCount,
  reseaux,
}: FiltresEvenementsReseauteursProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

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
        <h2 className="text-base font-semibold text-[#18181b]">Filtrer les événements</h2>
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
          htmlFor="filtre-ville-ev"
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
            id="filtre-ville-ev"
            type="text"
            placeholder="Paris, Lyon, Bordeaux..."
            value={filters.ville}
            onChange={(e) => onFilterChange({ ...filters, ville: e.target.value })}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#e4e4e7] rounded-xl focus:outline-none focus:border-[#2563EB] transition-colors bg-white"
          />
        </div>
      </div>

      {/* Date de début */}
      <div className="mb-3">
        <label
          htmlFor="filtre-date-debut"
          className="block text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2"
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
          className="w-full px-3 py-2 text-sm border border-[#e4e4e7] rounded-xl focus:outline-none focus:border-[#2563EB] transition-colors bg-white"
        />
      </div>

      {/* Date de fin */}
      <div className="mb-5">
        <label
          htmlFor="filtre-date-fin"
          className="block text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2"
        >
          Jusqu&apos;au
        </label>
        <input
          id="filtre-date-fin"
          type="date"
          value={filters.dateFin}
          onChange={(e) => onFilterChange({ ...filters, dateFin: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-[#e4e4e7] rounded-xl focus:outline-none focus:border-[#2563EB] transition-colors bg-white"
        />
      </div>

      {/* Réseau */}
      {reseaux.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
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
                <span className="text-sm text-[#18181b] truncate">{r.nom}</span>
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

      {/* Compteur */}
      <div
        className="mt-auto pt-4 border-t border-[#e4e4e7]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="bg-[#16284f] rounded-xl py-2 px-3 text-center">
          <span className="text-sm font-semibold text-white">
            {resultCount} événement{resultCount !== 1 ? 's' : ''} visible{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Bouton FAB mobile */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-[800] bg-[#16284f] text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-[#1a3d8f] transition-colors cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir les filtres"
        aria-expanded={mobileOpen}
      >
        <SlidersHorizontal size={15} />
        Filtres
        {hasActiveFilters && (
          <span className="bg-white text-[#16284f] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {[filters.reseau, filters.ville, filters.dateDebut, filters.dateFin].filter(Boolean).length}
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
