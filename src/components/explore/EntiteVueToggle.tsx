'use client'
/**
 * EntiteVueToggle — Bascule vue (annuaire ↔ carte / agenda ↔ carte).
 *
 * ADR-0012 §7 : deux landing pages self-canonical et DISTINCTES (/reseauteurs, /reseaux) —
 * chaque page est indépendante, il n'y a PAS de bascule entité entre elles.
 * - Bascule vue : router.push vers ?vue=annuaire|carte|agenda (conserve les autres searchParams).
 *   La page se met à jour et l'URL devient deep-linkable.
 *
 * A11y : boutons keyboard-focusables, aria-pressed.
 */
import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { List, Map, CalendarDays } from 'lucide-react'

export type Entite = 'reseauteurs' | 'reseaux' | 'evenements'
export type Vue = 'annuaire' | 'carte' | 'agenda'

interface EntiteVueToggleProps {
  /** Entité affichée sur cette page */
  entite: Entite
  /** Vue actuellement active — déterminée côté SSR et passée en prop */
  vue: Vue
}

const VUE_LABELS: Record<Vue, string> = {
  annuaire: 'Annuaire',
  agenda: 'Agenda',
  carte: 'Carte',
}

const VUE_ICONS: Record<Vue, React.ElementType> = {
  annuaire: List,
  agenda: CalendarDays,
  carte: Map,
}

/**
 * Vue par défaut (= URL sans paramètre `vue`) par entité.
 * Réseauteurs et Événements ouvrent en CARTE ; Réseaux ouvre en annuaire.
 * Doit rester cohérent avec le calcul de `vue` dans les pages correspondantes.
 */
const DEFAULT_VUE: Record<Entite, Vue> = {
  reseauteurs: 'carte',
  evenements: 'carte',
  reseaux: 'annuaire',
}

export default function EntiteVueToggle({ entite, vue }: EntiteVueToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const switchVue = useCallback(
    (newVue: Vue) => {
      const params = new URLSearchParams(searchParams.toString())
      // On omet le paramètre pour la vue par défaut, on le fixe sinon.
      if (newVue === DEFAULT_VUE[entite]) {
        params.delete('vue')
      } else {
        params.set('vue', newVue)
      }
      params.delete('page')
      const qs = params.toString()
      router.push(`${pathname}${qs ? `?${qs}` : ''}`)
    },
    [router, pathname, searchParams, entite],
  )

  const vueOptions: Vue[] = entite === 'evenements' ? ['agenda', 'carte'] : ['annuaire', 'carte']

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Bascule vue */}
      <div
        className="flex items-center bg-[#f4f4f5] rounded-xl p-0.5 gap-0.5"
        role="group"
        aria-label="Basculer entre l'annuaire et la carte"
      >
        {vueOptions.map((v) => {
          const Icon = VUE_ICONS[v]
          return (
            <button
              key={v}
              type="button"
              onClick={() => switchVue(v)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                vue === v
                  ? 'bg-white text-[#16284f] shadow-sm'
                  : 'text-[#71717a] hover:text-[#18181b]'
              }`}
              aria-pressed={vue === v}
            >
              <Icon size={14} aria-hidden />
              {VUE_LABELS[v]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
