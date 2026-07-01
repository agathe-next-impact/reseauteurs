import type { CollectionConfig } from 'payload'
import { isAdmin } from './access'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'
import { stripEmojis } from '../lib/sanitize'
import { seoField } from './fields/seoField'

// Mirror serveur du strip client (OrganisateurFicheEditForm.stripEmojiOnInput) :
// blocage des emojis pour les ecritures via REST/admin Payload.
const ORGANISATEUR_TEXT_FIELDS = [
  'nom',
  'ville',
  'adresse',
  'codePostal',
  'telephone',
  'siteWeb',
  'emailContact',
  'description',
  'videoYoutube',
] as const

export const OrganisateursEvenements: CollectionConfig = {
  slug: 'organisateurs-evenements',
  admin: {
    useAsTitle: 'nom',
    defaultColumns: ['nom', 'ville', 'statut', 'user'],
    group: 'Configuration',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data?.nom) return data
        if (operation !== 'create' && !data.nom) return data

        let slug = data.nom
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        const existing = await req.payload.find({
          collection: 'organisateurs-evenements',
          where: { slug: { equals: slug } },
          limit: 1,
        })
        if (existing.docs.length > 0 && existing.docs[0].id !== data.id) {
          slug = `${slug}-${Date.now()}`
        }
        data.slug = slug
        return data
      },
    ],
    beforeChange: [
      async ({ data }) => {
        for (const field of ORGANISATEUR_TEXT_FIELDS) {
          const v = data[field]
          if (typeof v === 'string') {
            data[field] = stripEmojis(v)
          }
        }
        if (Array.isArray(data.reseauxSociaux)) {
          data.reseauxSociaux = data.reseauxSociaux.map((s: { plateforme?: string; url?: string }) => ({
            ...s,
            url: typeof s?.url === 'string' ? stripEmojis(s.url) : s?.url,
          }))
        }
        return data
      },
      async ({ data, req, operation, originalDoc }) => {
        if (req.user && req.user.role !== 'admin') {
          // Defence-in-depth ownership check on update. The collection-level
          // access already restricts the query, but re-validating here means a
          // future refactor that shrinks the access clause cannot accidentally
          // open a privilege escalation path.
          if (operation === 'update' && originalDoc) {
            const ownerRel = originalDoc.user
            const ownerId =
              typeof ownerRel === 'object' && ownerRel !== null
                ? (ownerRel as { id: number | string }).id
                : (ownerRel as number | string | null | undefined)
            if (ownerId == null || Number(ownerId) !== Number(req.user.id)) {
              throw new Error('Vous ne pouvez modifier que votre propre organisateur.')
            }
          }

          if (data.description) {
            const wordCount = data.description.trim().split(/\s+/).filter(Boolean).length
            if (wordCount > 500) {
              throw new Error('La description est limitee a 500 mots.')
            }
          }
          if (data.illustrations && data.illustrations.length > 6) {
            throw new Error('6 illustrations maximum.')
          }
        }
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.find({
          collection: 'evenements',
          where: { organisateurExterne: { equals: id } },
          limit: 0,
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer cet organisateur : ${totalDocs} evenement(s) y sont rattaches.`,
          )
        }
      },
    ],
    afterChange: [cleanupOrphanedMediaOnChange],
    afterDelete: [cleanupMediaOnDelete],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Compte utilisateur associe (vide pour les organisateurs crees par un admin).',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'nom',
      type: 'text',
      required: true,
    },
    {
      name: 'ville',
      type: 'text',
    },
    {
      name: 'statut',
      type: 'select',
      options: [
        { label: 'Publiee', value: 'publiee' },
        { label: 'Suspendue', value: 'suspendue' },
      ],
      defaultValue: 'publiee',
      required: true,
      index: true,
      access: { update: isAdmin },
      admin: { position: 'sidebar' },
    },
    {
      name: 'adresse',
      type: 'text',
    },
    {
      name: 'codePostal',
      type: 'text',
    },
    {
      name: 'telephone',
      type: 'text',
    },
    {
      name: 'siteWeb',
      type: 'text',
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
      name: 'emailContact',
      type: 'email',
    },
    {
      name: 'reseauxSociaux',
      type: 'array',
      maxRows: 6,
      admin: {
        description: 'Liens vers vos profils sur les reseaux sociaux.',
      },
      fields: [
        {
          name: 'plateforme',
          type: 'select',
          required: true,
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'X (Twitter)', value: 'twitter' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'Pinterest', value: 'pinterest' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (value: unknown) => {
            if (!value || typeof value !== 'string') return true
            try {
              const parsed = new URL(value)
              if (!['http:', 'https:'].includes(parsed.protocol)) return 'L\'URL doit commencer par http:// ou https://'
              return true
            } catch {
              return 'URL invalide'
            }
          },
        },
      ],
    },
    {
      name: 'activites',
      type: 'relationship',
      relationTo: 'categories-activite',
      hasMany: true,
      admin: {
        description: 'Activites / secteurs de l\'organisateur.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 2000,
    },
    {
      name: 'banniere',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Image de banniere affichee en tete de la fiche.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Logo de l\'organisateur.',
      },
    },
    {
      name: 'illustrations',
      type: 'array',
      maxRows: 6,
      admin: {
        description: '6 photos d\'illustration maximum.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'videoYoutube',
      type: 'text',
      admin: {
        description: 'Lien vers une video YouTube (ex: https://www.youtube.com/watch?v=xxx ou https://youtu.be/xxx).',
      },
      validate: (value: unknown) => {
        if (!value || typeof value !== 'string') return true
        const patterns = [
          /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
          /^https?:\/\/youtu\.be\/[\w-]+/,
          /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
        ]
        if (!patterns.some((p) => p.test(value))) {
          return 'Le lien doit etre une URL YouTube valide (youtube.com/watch?v=... ou youtu.be/...).'
        }
        return true
      },
    },
    seoField,
  ],
}
