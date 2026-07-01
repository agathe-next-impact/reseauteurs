/**
 * Badges.ts — Référentiel des badges réseauteur (ADR-0011 §5).
 *
 * Ce référentiel permet à l'admin de gérer les libellés, descriptions et
 * visuels (icônes/couleurs) des badges Bronze/Argent/Gold/Platinum.
 *
 * La VALEUR stockée sur `reseauteurs.badge` est l'enum string ('bronze' etc.),
 * PAS un ID de cette collection. Ce découplage intentionnel évite une jointure
 * sur chaque lecture de carte et rend les badges autonomes.
 *
 * Seed initial : voir migration 20260628_120000_badges.ts.
 */

import type { CollectionConfig } from 'payload'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'

export const Badges: CollectionConfig = {
  slug: 'badges',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['niveau', 'label', 'seuilMin', 'seuilMax'],
    group: 'Configuration',
    description: 'Référentiel des badges réseauteur (libellés, icônes). La dérivation reste dans lib/badge.ts.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    afterChange: [cleanupOrphanedMediaOnChange],
    afterDelete: [cleanupMediaOnDelete],
  },
  fields: [
    {
      name: 'niveau',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'Bronze', value: 'bronze' },
        { label: 'Argent', value: 'argent' },
        { label: 'Gold', value: 'gold' },
        { label: 'Platinum', value: 'platinum' },
      ],
      index: true,
      admin: {
        description: 'Identifiant technique du badge (correspond à reseauteurs.badge).',
        position: 'sidebar',
      },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      label: 'Libellé affiché',
      admin: {
        description: 'Ex : Bronze, Argent, Gold, Platinum.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      admin: {
        description: 'Explication du badge pour les visiteurs (ex : « Fréquente 2 à 5 événements/mois »).',
      },
    },
    {
      name: 'icone',
      type: 'upload',
      relationTo: 'media',
      label: 'Icône',
      admin: {
        description: 'Icône SVG ou PNG affiché sur le profil et les marqueurs de carte.',
      },
    },
    {
      name: 'couleur',
      type: 'text',
      label: 'Couleur (hex)',
      admin: {
        description: 'Code couleur hexadécimal, ex : #CD7F32 (bronze).',
      },
    },
    {
      name: 'seuilMin',
      type: 'number',
      required: true,
      label: 'Seuil minimum (événements/mois)',
      admin: {
        description: 'Nombre minimum d\'événements/mois pour ce badge.',
        position: 'sidebar',
      },
    },
    {
      name: 'seuilMax',
      type: 'number',
      label: 'Seuil maximum (événements/mois, null = illimité)',
      admin: {
        description: 'Nombre maximum d\'événements/mois (laisser vide pour Platinum).',
        position: 'sidebar',
      },
    },
  ],
}
