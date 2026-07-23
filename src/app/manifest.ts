import type { MetadataRoute } from 'next'
import { PUBLIC_NAV_LINKS } from '@/lib/public-nav'
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_LANG } from '@/lib/site'

/**
 * Manifeste d'application web — servi sur /manifest.webmanifest.
 *
 * Rend le site INSTALLABLE (écran d'accueil mobile, dock desktop) et le fait
 * s'ouvrir en plein écran, sans barre d'URL.
 *
 * Service worker (`public/sw.js`, ajouté le 2026-07-23) : présent mais
 * VOLONTAIREMENT INERTE. Il n'existe que parce que Chrome/Edge n'émettent
 * `beforeinstallprompt` — donc n'autorisent aucune bannière d'installation — sans
 * service worker déclarant un gestionnaire `fetch`. Il ne met rien en cache et
 * n'appelle jamais `respondWith()` : la garantie d'origine tient toujours — aucun
 * contenu périmé face à l'ISR, aucune interférence avec l'admin Payload, Stripe
 * ou les routes authentifiées.
 *
 * Les couleurs suivent le thème CLAIR, qui est le défaut du site (DESIGN.md §8) :
 * la bascule sombre est un choix utilisateur stocké en localStorage, que le
 * manifeste — statique et lu avant tout script — ne peut pas connaître.
 *
 * Icônes générées par `pnpm gen:pwa-icons` (src/scripts/generate-pwa-icons.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` fige l'identité de l'app : `start_url` peut évoluer sans que le système
    // considère qu'il s'agit d'une nouvelle application (perte des installations).
    id: '/',
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: SITE_LANG,
    dir: 'ltr',
    start_url: '/',
    // Portée large : les liens internes (y compris /dashboard) restent dans la
    // fenêtre de l'app. Stripe et les sites de réseaux, hors origine, s'ouvrent
    // dans le navigateur — comportement attendu pour un paiement.
    scope: '/',
    display: 'standalone',
    // `orientation` est volontairement absent : les deux cartes plein écran
    // gagnent au format paysage, il ne faut pas verrouiller le portrait.
    background_color: '#F2F2F2', // --ir-bg (clair) — fond de l'écran de démarrage
    theme_color: '#FFFFFF', // teinte de la barre système, alignée sur l'en-tête collant
    categories: ['business', 'social'],
    icons: [
      // "any" : affichée telle quelle (desktop, écran de démarrage iOS, listes).
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // "maskable" : rognée par le lanceur Android (cercle, squircle, goutte).
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Raccourcis d'icône (appui long sur Android / clic droit sur le dock desktop).
    // Dérivés de la navigation publique pour éviter toute dérive de libellés.
    shortcuts: PUBLIC_NAV_LINKS.map(({ href, label }) => ({
      name: label,
      short_name: label,
      url: href,
    })),
  }
}
