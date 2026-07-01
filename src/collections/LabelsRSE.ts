import type { CollectionConfig } from 'payload'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'

export const LabelsRSE: CollectionConfig = {
  slug: 'labels-rse',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'value', 'logo', 'ordre'],
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
          collection: 'fournisseurs',
          where: { labelsRSE: { contains: id } },
          limit: 0,
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer ce label RSE : ${totalDocs} fournisseur(s) l'utilisent encore.`,
          )
        }
      },
    ],
    afterChange: [cleanupOrphanedMediaOnChange],
    afterDelete: [cleanupMediaOnDelete],
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
        description: 'Identifiant technique, ex: ecovadis-gold',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo du label',
      admin: {
        description: 'Visuel/logo du label RSE.',
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
