'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cookie-consent'

export type ConsentValue = 'granted' | 'denied' | 'pending'

// Listeners partages au module-scope : permet de synchroniser CookieInfoBanner
// et GoogleAnalytics (rendus dans des sous-arbres React differents) sans
// passer par un Context. localStorage `storage` event ne se propage pas dans
// la meme tab, d'ou la necessite d'un store maison.
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): ConsentValue {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'granted' || raw === 'denied') return raw
    return 'pending'
  } catch {
    // localStorage indisponible (incognito, policies) → pending = pas de
    // tracking par defaut, banner non affiche (cf. getServerSnapshot).
    return 'pending'
  }
}

// SSR : equivalent du client au premier paint pour eviter mismatch d'hydration.
// On retourne 'granted' pour eviter d'afficher le banner avant que le client
// ait lu localStorage — il bascule a la vraie valeur des le 1er commit client.
function getServerSnapshot(): ConsentValue {
  return 'granted'
}

export function useConsent(): ConsentValue {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function setConsent(value: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore (storage indisponible)
  }
  notify()
}
