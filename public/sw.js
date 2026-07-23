/**
 * Service worker RÉSEAUTEURS — VOLONTAIREMENT INERTE.
 *
 * Raison d'être UNIQUE : Chrome/Edge n'émettent `beforeinstallprompt` (donc
 * aucune bannière d'installation possible sur Android) que si l'origine a un
 * service worker enregistré avec un gestionnaire `fetch`. Ce fichier existe pour
 * satisfaire ce critère — RIEN D'AUTRE.
 *
 * Il ne met RIEN en cache et n'appelle JAMAIS `event.respondWith()` :
 *   • aucune réponse n'est interceptée → aucun risque de servir du contenu
 *     périmé face à l'ISR, ni d'interférer avec l'admin Payload, Stripe ou les
 *     routes authentifiées (c'était la réserve qui avait fait écarter le SW) ;
 *   • en particulier, un `respondWith(fetch(event.request))` — le « passthrough »
 *     apparemment inoffensif — CASSE les navigations redirigées (un SW ne peut
 *     pas renvoyer une réponse `redirected` à une requête de navigation), donc
 *     les redirections d'auth. On ne le fait pas.
 *
 * `activate` purge toute cache éventuelle : si ce fichier venait à être modifié
 * par erreur pour cacher quelque chose, un retour à cette version nettoie.
 */

self.addEventListener('install', () => {
  // Pas d'attente : la version inerte peut remplacer la précédente immédiatement.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Filet de sécurité : ce SW ne crée aucune cache, on supprime donc tout ce
      // qui traînerait sous cette origine (SW antérieur, test, erreur de déploiement).
      const noms = await caches.keys()
      await Promise.all(noms.map((nom) => caches.delete(nom)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  // Gestionnaire NON VIDE mais totalement passif. Chrome détecte statiquement les
  // handlers `fetch` vides et les ignore (optimisation de démarrage), ce qui peut
  // faire retomber le site sous le critère d'installabilité : on lit donc l'URL
  // sans jamais répondre. Sans `respondWith()`, le navigateur poursuit sa requête
  // réseau normale, exactement comme s'il n'y avait pas de service worker.
  void event.request.url
})
