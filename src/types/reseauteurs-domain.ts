/**
 * Types de domaine RÉSEAUTEURS — en attente de `pnpm generate:types` (data-architect).
 * Ces types reflètent les collections définies dans src/collections/*.ts.
 * Une fois `generate:types` relancé, ces types seront supersédés par payload-types.ts.
 */

import type { Media as PayloadMedia } from '@/payload-types'

export type { PayloadMedia as Media }

// ─── Badges ──────────────────────────────────────────────────────────
export type BadgeValue = 'bronze' | 'argent' | 'gold' | 'platinum'

// ─── Catégorie (secteur / métier) ────────────────────────────────────
export interface Categorie {
  id: number | string
  label?: string | null
  /** Identifiant technique (ex: btp, sante, finance) */
  value?: string | null
  slug?: string | null
  couleur?: string | null
  ordre?: number | null
  updatedAt: string
  createdAt: string
}

// ─── Types d'événement ───────────────────────────────────────────────
export interface TypesEvenement {
  id: number | string
  label?: string | null
  couleur?: string | null
  slug?: string | null
  updatedAt: string
  createdAt: string
}

// ─── Réseau ──────────────────────────────────────────────────────────
export interface Reseau {
  id: number | string
  slug?: string | null
  nom: string
  ville?: string | null
  adresse?: string | null
  codePostal?: string | null
  latitude?: number | null
  longitude?: number | null
  description?: string | null
  presentation?: string | null
  logo?: (number | null) | PayloadMedia
  banniere?: (number | null) | PayloadMedia
  siteWeb?: string | null
  emailContact?: string | null
  telephone?: string | null
  partenaire?: boolean | null
  nbReseauteurs?: number | null
  nbEvenements?: number | null
  statut: 'publiee' | 'suspendue'
  stripeSubscriptionId?: string | null
  partenaireExpireAt?: string | null
  source?: 'revendique' | 'importe'
  /** ADR-0012 — hiérarchie nationale/locale (2 niveaux max) */
  niveau?: 'national' | 'local' | null
  /** ADR-0012 — réseau national parent (requis si local, null si national).
   *  Populé à depth ≥ 1 sous forme de Reseau ; sinon ID numérique. */
  parent?: (number | null) | Reseau
  seo?: {
    title?: string | null
    description?: string | null
    keywords?: string | null
    ogImage?: (number | null) | PayloadMedia
    noindex?: boolean | null
  } | null
  user?: number | null | Record<string, unknown>
  updatedAt: string
  createdAt: string
}

// ─── Réseauteur ──────────────────────────────────────────────────────
export interface Reseauteur {
  id: number | string
  slug?: string | null
  prenom: string
  nom: string
  photo?: (number | null) | PayloadMedia
  fonction?: string | null
  entreprise?: string | null
  description?: string | null
  /** RGPD : facultatif — affiché seulement si renseigné */
  telephone?: string | null
  /** RGPD : facultatif — affiché seulement si renseigné */
  emailContact?: string | null
  site?: string | null
  linkedin?: string | null
  ville?: string | null
  departement?: string | null
  region?: string | null
  secteur?: (number | null) | Categorie
  competences?: Array<{ label: string; id?: string | null }> | null
  reseauxFrequentes?: (number | Reseau)[] | null
  evenementsParMois?: number | null
  badge?: BadgeValue | null
  latitude?: number | null
  longitude?: number | null
  statut: 'en_attente' | 'valide' | 'suspendu'
  seo?: {
    title?: string | null
    description?: string | null
    keywords?: string | null
    ogImage?: (number | null) | PayloadMedia
    noindex?: boolean | null
  } | null
  user?: number | null | Record<string, unknown>
  updatedAt: string
  createdAt: string
}

// ─── Événement (modèle ADR-0011) ─────────────────────────────────────
export interface EvenementRsn {
  id: number | string
  slug?: string | null
  reseau?: (number | null) | Reseau
  titre: string
  type?: (number | null) | TypesEvenement
  dateDebut: string
  dateFin?: string | null
  lieuNom?: string | null
  lieuAdresse?: string | null
  lieuCodePostal?: string | null
  lieuVille?: string | null
  description?: string | null
  lienInscription?: string | null
  image?: (number | null) | PayloadMedia
  premium?: boolean | null
  stripeCheckoutSessionId?: string | null
  statut: 'publie' | 'suspendu'
  lieuLatitude?: number | null
  lieuLongitude?: number | null
  seo?: {
    title?: string | null
    description?: string | null
    keywords?: string | null
    ogImage?: (number | null) | PayloadMedia
    noindex?: boolean | null
  } | null
  updatedAt: string
  createdAt: string
}

// ─── Partenaire (annonceur B2B) ──────────────────────────────────────
export interface Partenaire {
  id: number | string
  nom: string
  logo?: (number | null) | PayloadMedia
  lien?: string | null
  description?: string | null
  statut: 'actif' | 'expire'
  stripeSubscriptionId?: string | null
  abonnementExpireAt?: string | null
  updatedAt: string
  createdAt: string
}
