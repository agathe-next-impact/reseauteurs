'use client'

/**
 * PanneauFiltresPliable — enveloppe commune aux panneaux de filtres des annuaires
 * (réseauteurs) et de l'agenda (événements).
 *
 * Sous `lg`, les filtres passent AU-DESSUS des résultats (`flex-col`) : déployés,
 * ils repoussaient la première carte à ~790 px du haut, si bien que l'utilisateur
 * atterrissait sur un formulaire et devait faire défiler pour voir le moindre
 * résultat. Ils sont donc repliés par défaut en accordéon, et l'écran s'ouvre sur
 * le contenu. À partir de `lg`, le panneau occupe sa colonne latérale : il est
 * toujours déployé et l'accordéon disparaît.
 *
 * Deux en-têtes distincts plutôt qu'un bouton neutralisé en CSS : sur desktop le
 * déclencheur est retiré du DOM accessible (`lg:hidden`), ce qui évite d'exposer
 * un `aria-expanded="false"` mensonger sur un contenu visible.
 *
 * `nbActifs` est indispensable : replié, le panneau masque les critères en cours.
 * La pastille et le bouton « Effacer » restent visibles pour que l'utilisateur ne
 * puisse pas croire qu'il consulte une liste complète alors qu'elle est filtrée.
 */

import { useId, useState, type ReactNode } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'

interface PanneauFiltresPliableProps {
  /** Nombre de filtres actuellement actifs (0 = aucun). */
  nbActifs: number
  /** Efface tous les filtres. Le bouton n'apparaît que si `nbActifs > 0`. */
  onReset: () => void
  /** Libellé accessible de la région de filtres. */
  titre?: string
  children: ReactNode
}

export default function PanneauFiltresPliable({
  nbActifs,
  onReset,
  titre = 'Filtrer',
  children,
}: PanneauFiltresPliableProps) {
  // Replié par défaut : l'état initial est identique côté serveur et client, donc
  // aucun décalage d'hydratation. Sur desktop, `lg:block` rend l'état sans effet.
  const [ouvert, setOuvert] = useState(false)
  const idContenu = useId()

  const pastille =
    nbActifs > 0 ? (
      <span
        className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#035AA6] text-white text-[11px] font-semibold"
        aria-hidden
      >
        {nbActifs}
      </span>
    ) : null

  return (
    <div className="bg-white rounded-2xl border border-[#DFE0E1]">
      <div className="flex items-center justify-between gap-2 p-4">
        {/* Déclencheur — mobile et tablette uniquement */}
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-controls={idContenu}
          className="lg:hidden flex items-center gap-1.5 text-sm font-semibold text-[#1D1E21] bg-transparent border-none p-0 cursor-pointer"
        >
          <SlidersHorizontal size={14} aria-hidden />
          {titre}
          {pastille}
          <span className="sr-only">
            {nbActifs > 0 ? ` — ${nbActifs} filtre${nbActifs > 1 ? 's' : ''} actif${nbActifs > 1 ? 's' : ''}` : ''}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Titre statique — desktop, où le panneau est toujours déployé */}
        <h2 className="hidden lg:flex items-center gap-1.5 text-sm font-semibold text-[#1D1E21]">
          <SlidersHorizontal size={14} aria-hidden />
          {titre}
        </h2>

        {nbActifs > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-[#6E7175] hover:text-[#035AA6] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            aria-label="Effacer tous les filtres"
          >
            Effacer
          </button>
        )}
      </div>

      {/* `hidden lg:block` : replié sous lg selon l'état, toujours déployé au-delà. */}
      <div
        id={idContenu}
        className={`${ouvert ? 'block' : 'hidden'} lg:block px-4 pb-4 space-y-4`}
      >
        {children}
      </div>
    </div>
  )
}
