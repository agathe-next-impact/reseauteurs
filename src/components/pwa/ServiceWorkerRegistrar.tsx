'use client'

/**
 * ServiceWorkerRegistrar — enregistre `/sw.js` (service worker inerte).
 *
 * Le SW ne sert QU'À rendre le site éligible à `beforeinstallprompt` sur
 * Chrome/Edge — voir l'en-tête de `public/sw.js` pour le détail et les garanties
 * (aucun cache, aucune interception).
 *
 * Enregistré après l'événement `load` : la mise en place du SW ne doit pas
 * concurrencer le chargement initial (LCP), d'autant qu'elle n'apporte aucun
 * bénéfice au premier rendu.
 *
 * Monté dans le layout `(frontend)` uniquement : l'admin Payload est un autre
 * groupe de routes, il n'enregistre donc rien.
 */

import { useEffect } from 'react'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const enregistrer = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Échec silencieux : le site fonctionne identiquement sans SW, seule la
        // bannière d'installation Android est perdue.
      })
    }

    if (document.readyState === 'complete') {
      enregistrer()
      return
    }
    window.addEventListener('load', enregistrer, { once: true })
    return () => window.removeEventListener('load', enregistrer)
  }, [])

  return null
}
