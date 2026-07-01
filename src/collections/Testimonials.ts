import type { CollectionConfig } from 'payload'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: {
    useAsTitle: 'author',
    defaultColumns: ['author', 'company', 'rating', 'isPublished'],
    group: 'Configuration',
  },
  defaultSort: '-createdAt',
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
      name: 'quote',
      type: 'textarea',
      required: true,
      label: 'Citation',
    },
    {
      name: 'author',
      type: 'text',
      required: true,
      label: 'Auteur',
    },
    {
      name: 'company',
      type: 'text',
      label: 'Entreprise',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo de l\'entreprise',
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      label: 'Note (sur 5)',
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: true,
      label: 'Publie',
    },
  ],
}
