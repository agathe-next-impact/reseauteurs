/**
 * seo-canonical.ts — Helpers canonical pour les pages à bascules RÉSEAUTEURS.
 *
 * ADR-0012 §7 : /reseauteurs, /reseaux, /evenements sont des landing pages self-canonical.
 * L'état vue (?vue=carte|annuaire|agenda) et les paramètres de filtre représentent
 * l'état de l'UI — ils ne doivent PAS figurer dans le canonical pour éviter le
 * duplicate content crawlé par les robots.
 *
 * La règle est volontairement simple : le canonical d'une page à bascules est
 * TOUJOURS son chemin nu, sans aucun paramètre de query.
 *
 * ────────────────────────────────────────────────────────────────────────────────
 * USAGE PAR frontend-builder
 * ────────────────────────────────────────────────────────────────────────────────
 * Dans le generateMetadata de /reseauteurs, /reseaux, /evenements :
 *
 *   import { buildTogglePageMetadata } from '@/lib/seo-canonical'
 *   import type { Metadata } from 'next'
 *
 *   // NE PAS passer searchParams — ils sont intentionnellement ignorés.
 *   export async function generateMetadata(): Promise<Metadata> {
 *     return buildTogglePageMetadata('/reseauteurs', {
 *       title: `Réseauteurs — Annuaire et carte du networking | ${SITE_NAME}`,
 *       description: 'Trouvez les professionnels du networking près de chez vous…',
 *     })
 *   }
 *
 * Remplacer l'éventuel `export const metadata = buildMetadata(…)` statique par
 * cette fonction pour que Next.js génère l'alternate/canonical dynamiquement.
 *
 * IMPORTANT : ne pas inclure `path` dans le second argument — il est injecté
 * automatiquement par buildTogglePageMetadata à partir du pathname.
 */

import { buildMetadata, type BuildMetadataInput } from './seo'
import type { Metadata } from 'next'

/**
 * Paramètres de query volatils sur les pages à bascules RÉSEAUTEURS.
 *
 * Ces paramètres représentent l'état de l'UI (vue active, filtres combinables)
 * et doivent être exclus du canonical afin d'éviter que les crawlers traitent
 * /reseauteurs?vue=carte comme une page distincte de /reseauteurs.
 *
 * Exporté pour permettre au frontend-builder de filtrer ces params dans ses
 * propres traitements si nécessaire (ex. désactiver le caching d'une vue carte).
 */
export const VOLATILE_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'vue',       // bascule carte|annuaire|agenda (ADR-0012 §7)
  'q',         // recherche texte libre
  'ville',     // filtre géographique — ville/commune
  'dept',      // filtre département
  'region',    // filtre région administrative
  'secteur',   // filtre secteur d'activité / métier
  'reseau',    // filtre réseau local (slug)
  'national',  // filtre réseau national / umbrella (slug)
  'badge',     // filtre badge réseauteur (bronze|argent|gold|platinum)
  'date',      // filtre date événements (ISO string ou slug ex. "cette-semaine")
  'categorie', // filtre catégorie d'événement (slug)
  'niveau',    // filtre niveau réseau (national|local)
  'page',      // pagination — paramètre d'état non canonicalisé
])

/**
 * Retourne le canonical propre d'une page à bascules : toujours le chemin nu,
 * sans aucun paramètre de query.
 *
 * @param pathname - chemin absolu sans query, ex. '/reseauteurs', '/evenements'
 * @returns le chemin normalisé (avec slash initial garanti)
 */
export function buildTogglePageCanonical(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/**
 * Génère les Metadata Next.js complètes pour une page à bascules.
 *
 * Le canonical est forcé au chemin nu (self-canonical sans query params) — les
 * searchParams de la requête sont intentionnellement ignorés (état UI volatil).
 *
 * Passe tous les arguments à buildMetadata() (title, description, ogType,
 * images, noindex, keywords…) avec `path` automatiquement résolu.
 *
 * @param pathname  - chemin de la page, ex. '/reseauteurs'
 * @param metaInput - champs Metadata (tout sauf `path`, injecté par la fonction)
 *
 * @example
 * // src/app/(frontend)/reseauteurs/page.tsx
 * import { buildTogglePageMetadata } from '@/lib/seo-canonical'
 * import { SITE_NAME } from '@/lib/site'
 *
 * export async function generateMetadata(): Promise<Metadata> {
 *   return buildTogglePageMetadata('/reseauteurs', {
 *     title: `Réseauteurs — Annuaire et carte du networking | ${SITE_NAME}`,
 *     description:
 *       'Trouvez les professionnels du networking près de chez vous : ' +
 *       'entrepreneurs, dirigeants, indépendants par ville, secteur, réseau ou badge.',
 *   })
 * }
 *
 * @example
 * // src/app/(frontend)/reseaux/page.tsx
 * export async function generateMetadata(): Promise<Metadata> {
 *   return buildTogglePageMetadata('/reseaux', {
 *     title: `Réseaux d'affaires — BNI, DCF, CJD et tous les réseaux | ${SITE_NAME}`,
 *     description:
 *       'Découvrez tous les réseaux d\'affaires et leurs groupes locaux : ' +
 *       'BNI, DCF, CJD, Rotary, Cafés Business… Filtrez par ville ou national.',
 *   })
 * }
 *
 * @example
 * // src/app/(frontend)/evenements/page.tsx
 * export async function generateMetadata(): Promise<Metadata> {
 *   return buildTogglePageMetadata('/evenements', {
 *     title: `Événements networking — Agenda et carte des rendez-vous business | ${SITE_NAME}`,
 *     description:
 *       'Trouvez les prochains événements de networking près de chez vous : ' +
 *       'afterworks, petits-déjeuners, conférences par ville, réseau et date.',
 *   })
 * }
 */
export function buildTogglePageMetadata(
  pathname: string,
  metaInput: Omit<BuildMetadataInput, 'path'>,
): Metadata {
  return buildMetadata({ ...metaInput, path: buildTogglePageCanonical(pathname) })
}
