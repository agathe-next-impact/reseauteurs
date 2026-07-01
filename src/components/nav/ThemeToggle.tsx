'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'reseauteurs-theme'
const EVENT = 'reseauteurs-theme-change'

/**
 * Bascule clair ⇄ sombre (« Plasma »).
 *
 * Le mode CLAIR est le défaut (DESIGN.md §8). Le mode SOMBRE est opt-in :
 * il s'active en ajoutant la classe `.ir-plasma` sur <body>, qui pilote tout
 * le thème Plasma via les variables --ir-*. Le choix est mémorisé en
 * localStorage et ré-appliqué avant peinture par un script inline (layout.tsx),
 * ce qui évite le flash au chargement (FOUC).
 *
 * L'état est lu directement depuis le DOM via useSyncExternalStore — la source
 * de vérité est `body.classList`, pas un state React (évite la désync SSR et
 * le setState-dans-effect).
 */
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}

function getSnapshot() {
  return document.body.classList.contains('ir-plasma')
}

// Rendu serveur (et 1er rendu client) : clair par défaut.
function getServerSnapshot() {
  return false
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    const next = !document.body.classList.contains('ir-plasma')
    document.body.classList.toggle('ir-plasma', next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      /* localStorage indisponible (mode privé strict) — la bascule reste effective pour la session */
    }
    window.dispatchEvent(new Event(EVENT))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      aria-pressed={dark}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#e4e4e7] text-[#52525b] hover:text-[#2563EB] hover:border-[#2563EB] bg-transparent transition-colors cursor-pointer shrink-0"
    >
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  )
}
