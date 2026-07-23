'use client'

/**
 * lib/pwa-install.ts — état d'installabilité de l'app (store externe).
 *
 * Même patron que `lib/cookie-consent.ts` : un store au module-scope lu par
 * `useSyncExternalStore`. C'est le seul moyen propre ici — l'état vient
 * d'événements navigateur (`beforeinstallprompt`, `appinstalled`) et d'une
 * détection d'UA, donc d'un système EXTERNE à React. Le poser via
 * `setState` dans un `useEffect` déclencherait des rendus en cascade (règle
 * `react-hooks/set-state-in-effect`) et une divergence d'hydratation.
 *
 * Deux modes possibles (cf. `components/pwa/InstallPWABanner`) :
 *   • `prompt` — Chrome/Edge : l'installation est déclenchable par `prompt()` ;
 *   • `ios`    — Safari iOS/iPadOS : AUCUNE API d'installation n'existe, on ne
 *                peut qu'afficher la marche à suivre (Partager → écran d'accueil).
 */

import { useSyncExternalStore } from 'react'

/** Événement Chrome/Edge — non standard, absent de la lib DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type ModeInstall = 'prompt' | 'ios' | null

export interface EtatInstall {
  mode: ModeInstall
  /** Pages vues dans la session — sert de seuil d'engagement. */
  vues: number
}

const CLE_REFUS = 'pwa-install-refus'
const CLE_VUES = 'pwa-vues'
/** Après un refus, on ne repropose pas avant ce délai. */
export const REFUS_JOURS = 30
/** On n'interrompt jamais un premier contact : bannière dès la 2ᵉ page vue. */
export const MIN_VUES = 2

// Référence STABLE pour le rendu serveur : `useSyncExternalStore` compare par
// identité, un objet recréé à chaque appel provoquerait une boucle de rendus.
const ETAT_SSR: EtatInstall = { mode: null, vues: 0 }

let etat: EtatInstall = ETAT_SSR
let differe: BeforeInstallPromptEvent | null = null

const listeners = new Set<() => void>()
function notifier() {
  listeners.forEach((l) => l())
}
function majEtat(patch: Partial<EtatInstall>) {
  etat = { ...etat, ...patch }
  notifier()
}

// ─── Détections ──────────────────────────────────────────────────────────────

/** Déjà installé : on ne propose évidemment rien. */
function estInstalle(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS < 16.4 : propriété historique, absente des types standards.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Safari iOS/iPadOS — seul navigateur iOS à proposer « Sur l'écran d'accueil ». */
function estSafariIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS ≥ 13 se déclare « Macintosh » : on le reconnaît à l'écran tactile.
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  // Chrome/Firefox/Edge iOS embarquent WebKit mais gardent leur propre menu.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Mercury/.test(ua)
  return iOS && safari
}

function refusRecent(): boolean {
  try {
    const brut = localStorage.getItem(CLE_REFUS)
    if (!brut) return false
    const age = Date.now() - Number(brut)
    return Number.isFinite(age) && age < REFUS_JOURS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// ─── Initialisation ──────────────────────────────────────────────────────────

// Au module-scope, donc à l'évaluation du bundle client — AVANT l'hydratation.
// `beforeinstallprompt` n'est pas rejoué si on le manque : s'abonner depuis un
// effet laisserait une fenêtre où l'événement serait perdu.
if (typeof window !== 'undefined') {
  if (!estInstalle() && !refusRecent()) {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Supprime l'infobar native de Chrome au profit de notre bannière.
      e.preventDefault()
      differe = e as BeforeInstallPromptEvent
      majEtat({ mode: 'prompt' })
    })
    window.addEventListener('appinstalled', () => {
      differe = null
      majEtat({ mode: null })
    })
    if (estSafariIOS()) etat = { ...etat, mode: 'ios' }
  }
}

// ─── API ─────────────────────────────────────────────────────────────────────

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => etat
const getServerSnapshot = () => ETAT_SSR

export function useEtatInstall(): EtatInstall {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Incrémente le compteur de pages vues (appelé à chaque changement de route). */
export function enregistrerVue(): void {
  try {
    const n = Number(sessionStorage.getItem(CLE_VUES) ?? '0') + 1
    sessionStorage.setItem(CLE_VUES, String(n))
    majEtat({ vues: n })
  } catch {
    // sessionStorage indisponible (navigation privée stricte) → on ne compte pas,
    // donc on n'affiche pas : le silence est le défaut le moins intrusif.
  }
}

/** Refus explicite — masque la bannière et la met en sommeil REFUS_JOURS jours. */
export function refuserInstall(): void {
  differe = null
  majEtat({ mode: null })
  try {
    localStorage.setItem(CLE_REFUS, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/**
 * Déclenche le dialogue natif (Chrome/Edge uniquement).
 * Un refus du dialogue vaut refus : Chrome ne réémet pas `beforeinstallprompt`
 * de sitôt, inutile de reproposer.
 */
export async function lancerInstall(): Promise<void> {
  if (!differe) return
  const evenement = differe
  differe = null
  await evenement.prompt()
  const { outcome } = await evenement.userChoice
  if (outcome === 'dismissed') refuserInstall()
  else majEtat({ mode: null })
}
