/**
 * LicencesActivations.ts — [DORMANT depuis ADR-0015 (2026-07-17)]
 *
 * La fonctionnalité de licences par code promo est SUPPRIMÉE (route d'activation en
 * 410). La collection reste enregistrée pour la traçabilité des activations legacy
 * (RGPD : purgées avec le compte via /api/account/delete). Pas de migration destructive.
 *
 * Table DB : `licences_activations` (migration 20260712_100000).
 */

import type { CollectionConfig, Where } from 'payload'

const isAdmin = ({ req: { user } }: { req: { user?: { role?: string } | null } }) =>
  user?.role === 'admin'

export const LicencesActivations: CollectionConfig = {
  slug: 'licences-activations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['pack', 'user', 'activeAt'],
    group: 'Monétisation',
    hidden: true,
    description: '[Dormant — ADR-0015] Traçabilité legacy des activations (fonctionnalité supprimée).',
  },
  access: {
    // Lecture : admin ; le partenaire voit les activations de SES packs ;
    // le réseauteur voit SA propre activation.
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (!user) return false
      return {
        or: [
          { user: { equals: user.id } },
          { 'pack.partenaire.user': { equals: user.id } },
        ],
      } as Where
    },
    // Écritures : admin uniquement — la route d'activation (P2.A) passe par overrideAccess.
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'pack',
      type: 'relationship',
      relationTo: 'licences-packs',
      required: true,
      index: true,
      admin: { description: 'Pack dont provient la licence.' },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Réseauteur ayant activé la licence (une seule activation par compte).' },
    },
    {
      name: 'activeAt',
      type: 'date',
      admin: { description: 'Date d\'activation.' },
    },
  ],
}
