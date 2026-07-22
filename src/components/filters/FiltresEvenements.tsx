'use client'

import { useState } from 'react'
import { X, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '@/lib/categories'

export interface EvenementFilters {
  periodeDebut: string
  periodeFin: string
  types: string[]
  activites: string[]
}

interface FiltresEvenementsProps {
  filters: EvenementFilters
  onFilterChange: (filters: EvenementFilters) => void
  resultCount: number
  categories: CategoryOption[]
  typesEvenement: CategoryOption[]
}

function parseMonthValue(value: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(`${value}-01`)
  return isNaN(d.getTime()) ? undefined : d
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = parseMonthValue(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left cursor-pointer',
          !selected && 'text-gray-400',
        )}
      >
        <CalendarIcon className="size-4 shrink-0" />
        {selected ? format(selected, 'MMMM yyyy', { locale: fr }) : label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'yyyy-MM'))
            } else {
              onChange('')
            }
            setOpen(false)
          }}
          locale={fr}
          defaultMonth={selected}
        />
      </PopoverContent>
    </Popover>
  )
}

const emptyFilters: EvenementFilters = { periodeDebut: '', periodeFin: '', types: [], activites: [] }

export default function FiltresEvenements({
  filters,
  onFilterChange,
  resultCount,
  categories,
  typesEvenement,
}: FiltresEvenementsProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.activites.length > 0 ||
    filters.periodeDebut !== '' ||
    filters.periodeFin !== ''

  const activeCount =
    filters.types.length +
    filters.activites.length +
    (filters.periodeDebut ? 1 : 0) +
    (filters.periodeFin ? 1 : 0)

  const toggleType = (value: string) => {
    const next = filters.types.includes(value)
      ? filters.types.filter((t) => t !== value)
      : [...filters.types, value]
    onFilterChange({ ...filters, types: next })
  }

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
        <h3 className="text-lg font-semibold text-text-dark">Filtrer les événements</h3>
        <button
          className="md:hidden p-2.5 rounded-md hover:bg-gray-100 text-gray-500"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer les filtres"
        >
          <X size={20} />
        </button>
      </div>

      {/* Période */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">Période</h4>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            { label: 'Ce mois', getRange: () => {
              const now = new Date()
              const v = format(now, 'yyyy-MM')
              return { periodeDebut: v, periodeFin: v }
            }},
            { label: '3 prochains mois', getRange: () => {
              const now = new Date()
              const end = new Date(now.getFullYear(), now.getMonth() + 3, 1)
              return { periodeDebut: format(now, 'yyyy-MM'), periodeFin: format(end, 'yyyy-MM') }
            }},
            { label: '6 prochains mois', getRange: () => {
              const now = new Date()
              const end = new Date(now.getFullYear(), now.getMonth() + 6, 1)
              return { periodeDebut: format(now, 'yyyy-MM'), periodeFin: format(end, 'yyyy-MM') }
            }},
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                const range = preset.getRange()
                onFilterChange({ ...filters, ...range })
              }}
              className="text-sm p-2.5 rounded-full border border-gray-300 text-text-medium hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <DatePickerField
            label="Début"
            value={filters.periodeDebut}
            onChange={(v) => onFilterChange({ ...filters, periodeDebut: v })}
          />
          <DatePickerField
            label="Fin"
            value={filters.periodeFin}
            onChange={(v) => onFilterChange({ ...filters, periodeFin: v })}
          />
        </div>
      </div>

      {/* Type */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">Type</h4>
        {typesEvenement.map((t) => (
          <div key={t.value} className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded-md px-1 -mx-1 transition-colors" onClick={() => toggleType(t.value)}>
            <Checkbox
              checked={filters.types.includes(t.value)}
              onCheckedChange={(checked) => {
                const isChecked = checked === true
                const alreadySelected = filters.types.includes(t.value)
                if (isChecked !== alreadySelected) toggleType(t.value)
              }}
            />
            <span className="text-text-dark">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Activité */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">Activité revendeur</h4>
        {categories.map((act) => (
          <div key={act.value} className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded-md px-1 -mx-1 transition-colors" onClick={() => toggleActivite(act.value)}>
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
          Réinitialiser les filtres
        </button>
      )}

      <div className="mt-auto pt-4 border-t border-border-light" role="status" aria-live="polite" aria-atomic="true">
        <div className="bg-border-light rounded-lg py-2.5 px-3 text-center">
          <span className="text-sm font-semibold text-text-medium transition-opacity duration-150">
            {resultCount} événement{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-[800] bg-primary text-white p-2.5 rounded-full flex items-center gap-2 text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir les filtres"
      >
        Filtres
        {hasActiveFilters && (
          <span className="bg-white text-primary text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] shrink-0 p-4 border-r border-border bg-white overflow-y-auto">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[900]">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto flex flex-col border-t border-[#DFE0E1] animate-[slideUp_200ms_ease-out]">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 shrink-0" />
            {content}
          </div>
        </div>
      )}
    </>
  )
}
