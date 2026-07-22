/**
 * Categories.ts — Référentiel des secteurs d'activité / métiers (ADR-0011).
 *
 * Repurpose de l'idée de CategoriesActivite.ts, mais pour les secteurs/métiers
 * des RÉSEAUTEURS (ex : BTP, Santé, Finance, Tech, Commerce…).
 *
 * Table DB : `categories` (créée par migration 20260628_130000_categories.ts).
 * Slug Payload : `categories`
 *
 * Utilisé par :
 *   - `reseauteurs.secteur` (relation N-1)
 *   - filtres de recherche réseauteurs
 *
 * La collection CategoriesActivite (slug `categories-activite`) reste en DB
 * pour compatibilité transitoire mais n'est plus montée dans payload.config.ts.
 */

import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'value', 'couleur', 'ordre'],
    group: 'Configuration',
    description: 'Secteurs d\'activité / métiers des réseauteurs.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        // Bloque la suppression si des réseauteurs utilisent encore ce secteur
        const { totalDocs } = await req.payload.count({
          collection: 'reseauteurs',
          where: { secteur: { equals: id } },
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer ce secteur : ${totalDocs} réseauteur(s) l'utilisent encore.`,
          )
        }
      },
    ],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      label: 'Libellé',
      admin: {
        description: 'Ex : BTP, Santé, Finance, Tech, Commerce…',
      },
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      unique: true,
      label: 'Identifiant unique (slug)',
      admin: {
        description: 'Identifiant technique, ex : btp, sante, finance.',
      },
    },
    {
      name: 'couleur',
      type: 'text',
      label: 'Couleur (hex)',
      admin: {
        description: 'Code couleur hexadécimal, ex : #01365F.',
      },
    },
    {
      name: 'ordre',
      type: 'number',
      defaultValue: 0,
      label: 'Ordre d\'affichage',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
