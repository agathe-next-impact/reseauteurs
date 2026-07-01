/**
 * Partenaires.ts — Annonceurs B2B (ADR-0011 §3).
 *
 * Distinct de `reseaux.partenaire` (drapeau sur la fiche réseau).
 * `partenaires` = entreprises ANNONCEURS qui souhaitent être visibles
 * auprès des réseauteurs (logo page d'accueil + page Partenaires + lien).
 *
 * Le statut d'abonnement est posé par `accounts-and-billing` via webhook Stripe.
 * L'agent data-architect fournit la structure ; le recâblage Stripe est J2.A.
 *
 * Table DB : `partenaires` (migration 20260628_110000_partenaires.ts)
 */

import type { CollectionConfig } from 'payload'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'

export const Partenaires: CollectionConfig = {
  slug: 'partenaires',
  admin: {
    useAsTitle: 'nom',
    defaultColumns: ['nom', 'statut', 'lien', 'createdAt'],
    group: 'Contenu',
    description: 'Annonceurs B2B affichés en page d\'accueil + page Partenaires.',
  },
  access: {
    // Lecture publique pour les actifs (page Partenaires, bandeau home)
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return { statut: { equals: 'actif' } }
    },
    // CRUD admin uniquement (géré par accounts-and-billing via webhook Stripe)
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
      name: 'nom',
      type: 'text',
      required: true,
      label: 'Nom de l\'entreprise',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Logo',
      admin: {
        description: 'Logo affiché sur la page d\'accueil et la page Partenaires (fond clair, format carré recommandé).',
      },
    },
    {
      name: 'lien',
      type: 'text',
      label: 'URL du site',
      admin: {
        description: 'Lien vers le site de l\'annonceur (s\'ouvre dans un nouvel onglet).',
      },
      validate: (value: unknown) => {
        if (!value || typeof value !== 'string') return true
        try {
          const url = new URL(value)
          if (!['http:', 'https:'].includes(url.protocol)) return 'L\'URL doit commencer par http:// ou https://'
          return true
        } catch {
          return 'URL invalide'
        }
      },
    },
    {
      name: 'statut',
      type: 'select',
      required: true,
      options: [
        { label: 'Actif', value: 'actif' },
        { label: 'Expiré', value: 'expire' },
      ],
      defaultValue: 'expire',
      index: true,
      access: {
        // Seul l'admin peut modifier le statut (posé par le webhook Stripe via accounts-and-billing)
        update: ({ req: { user } }) => user?.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        description: 'Statut d\'abonnement. Posé automatiquement par le webhook Stripe (J2.A).',
      },
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      index: true,
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        description: 'Customer Stripe rattaché à cet annonceur (géré par accounts-and-billing).',
      },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      index: true,
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        description: 'ID de l\'abonnement Stripe (géré par accounts-and-billing).',
      },
    },
    {
      name: 'abonnementExpireAt',
      type: 'date',
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        description: 'Date d\'expiration de l\'abonnement.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description courte (optionnelle)',
      admin: {
        description: 'Une phrase de présentation affichée sur la page Partenaires.',
      },
    },
  ],
}
