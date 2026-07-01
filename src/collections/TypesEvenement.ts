import type { CollectionConfig } from 'payload'
import { seoField } from './fields/seoField'

export const TypesEvenement: CollectionConfig = {
  slug: 'types-evenement',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'value', 'couleur', 'ordre'],
    group: 'Configuration',
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
        const { totalDocs } = await req.payload.find({
          collection: 'evenements',
          where: { type: { equals: id } },
          limit: 0,
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer ce type : ${totalDocs} evenement(s) l'utilisent encore.`,
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
      label: 'Libelle',
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      unique: true,
      label: 'Slug (identifiant unique)',
      admin: {
        description: 'Identifiant technique, ex: salon',
      },
    },
    {
      name: 'couleur',
      type: 'text',
      required: true,
      label: 'Couleur (hex)',
      admin: {
        description: 'Code couleur hexadecimal, ex: #1e40af',
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
    seoField,
  ],
}
