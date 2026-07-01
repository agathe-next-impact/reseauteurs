'use client'

import { useState } from 'react'
import { SlidersHorizontal, X, RotateCcw, Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { CategoryOption } from '@/lib/categories'

export interface RevendeurFilters {
  search: string
  activites: string[]
}

interface FiltresRevendeursProps {
  filters: RevendeurFilters
  onFilterChange: (filters: RevendeurFilters) => void
  resultCount: number
  categories: CategoryOption[]
}

const emptyFilters: RevendeurFilters = { search: '', activites: [] }

export default function FiltresRevendeurs({
  filters,
  onFilterChange,
  resultCount,
  categories,
}: FiltresRevendeursProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const hasActiveFilters = filters.search.trim() !== '' || filters.activites.length > 0

  const toggleActivite = (value: string) => {
    const next = filters.activites.includes(value)
      ? filters.activites.filter((a) => a !== value)
      : [...filters.activites, value]
    onFilterChange({ ...filters, activites: next })
  }

  const resetFilters = () => {
    onFilterChange(emptyFilters)
  }

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-dark">Filtrer les revendeurs</h3>
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer les filtres"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher un revendeur, une ville..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">
          Activité
        </h4>
        {categories.map((act) => (
          <div
            key={act.value}
            className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded-md px-1 -mx-1 transition-colors"
            onClick={() => toggleActivite(act.value)}
          >
            <Checkbox
              checked={filters.activites.includes(act.value)}
              onCheckedChange={(checked) => {
                const isChecked = checked === true
                const alreadySelected = filters.activites.includes(act.value)
                if (isChecked !== alreadySelected) toggleActivite(act.value)
              }}
            />
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: act.couleur }}
              aria-hidden="true"
            />
            <span className="text-text-dark">{act.label}</span>
          </div>
        ))}
      </div>

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1.5 text-sm text-text-light hover:text-text-dark transition-colors mb-4 cursor-pointer"
        >
          <RotateCcw size={14} />
          Réinitialiser les filtres
        </button>
      )}

      <div className="mt-auto pt-4 border-t border-border-light" role="status" aria-live="polite" aria-atomic="true">
        <div className="bg-primary rounded-lg py-1 px-3 text-center">
          <span className="text-sm font-semibold text-white transition-opacity duration-150">
            {resultCount} revendeur{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile trigger button */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-[800] bg-primary text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir les filtres"
      >
        <SlidersHorizontal size={16} />
        Filtres
        {hasActiveFilters && (
          <span className="bg-white text-primary text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {filters.activites.length + (filters.search.trim() ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] shrink-0 p-4 border-r border-border bg-white overflow-y-auto">
        {content}
      </aside>

      {/* Mobile drawer (bottom sheet) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[900]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto flex flex-col shadow-2xl animate-[slideUp_200ms_ease-out]">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 shrink-0" />
            {content}
          </div>
        </div>
      )}
    </>
  )
}
