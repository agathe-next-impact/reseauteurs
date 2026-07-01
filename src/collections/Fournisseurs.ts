import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { revalidatePath } from 'next/cache'
import { isAdmin, isPremiumOrAbove, isInfinite, canCreateFiche, getEffectiveFeatureLevel } from './access'
import { geocodeAddress } from '../lib/geocode'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'
import { ficheRejectedEmail } from '../lib/emails'
import { sendEmail } from '../lib/email-sender'
import { stripEmojis } from '../lib/sanitize'
import { seoField } from './fields/seoField'

// Champs texte/textarea/URL ou les emojis sont interdits.
// Mirror cote client : FicheEditForm.stripEmojiOnInput. Le hook serveur sert
// de filet de securite pour les ecritures via REST/admin Payload qui
// shortcuteraient l'UI.
const FOURNISSEUR_TEXT_FIELDS = [
  'raisonSociale',
  'ville',
  'adresse',
  'codePostal',
  'siteWeb',
  'boutiqueEnLigne',
  'lienDevis',
  'emailContact',
  'telephone',
  'description',
  'descriptionRSE',
  'videoYoutube',
] as const

/**
 * Notify the fiche owner when an admin transitions statut to 'suspendue'.
 * Fires only on the transition (not on re-save of an already-suspended doc).
 */
const notifyOnSuspension: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update') return doc
  if (doc.statut !== 'suspendue') return doc
  if (previousDoc?.statut === 'suspendue') return doc

  try {
    const userId = typeof doc.user === 'object' && doc.user !== null
      ? (doc.user as { id: number | string }).id
      : (doc.user as number | string)
    if (!userId) return doc

    const owner = await req.payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
    await sendEmail({
      payload: req.payload,
      kind: 'fiche-rejected',
      to: owner.email,
      subject: 'Panorama Pub — Votre fiche a ete suspendue',
      html: ficheRejectedEmail(owner.nomSociete),
      userId: owner.id,
    })
  } catch (err) {
    console.error('[Fournisseurs afterChange] Failed to notify owner of suspension:', err)
  }
  return doc
}

/**
 * Compte les mots d'un texte de maniere robuste aux espaces insecables,
 * tabulations, apostrophes typographiques et composes avec tiret/apostrophe.
 *   "aujourd'hui"      → 1
 *   "mot\u00a0mot"     → 2 (nbsp)
 *   "grand-texte"      → 1 (trait d'union interne)
 *   "fin.debut"        → 2 (ponctuation = separateur)
 */
function countWords(text: string): number {
  const matches = text.match(/\p{L}+(?:[''\-]\p{L}+)*/gu)
  return matches ? matches.length : 0
}

const DESCRIPTION_WORD_LIMITS: Record<string, number> = {
  premium: 100,
  infinite: 300,
}

const DESCRIPTION_RSE_WORD_LIMIT = 300

const ILLUSTRATIONS_LIMITS: Record<string, number> = {
  gratuit: 0,
  premium: 1,
  infinite: 6,
}

export const Fournisseurs: CollectionConfig = {
  slug: 'fournisseurs',
  admin: {
    useAsTitle: 'raisonSociale',
    defaultColumns: ['raisonSociale', 'ville', 'activitePrincipale', 'statut'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) {
        return {
          or: [
            { statut: { equals: 'publiee' } } as Record<string, unknown>,
            { user: { equals: user.id } } as Record<string, unknown>,
          ],
        } as import('payload').Where
      }
      return { statut: { equals: 'publiee' } }
    },
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
        if (!data?.raisonSociale) return data
        if (operation !== 'create' && !data.raisonSociale) return data

        let slug = data.raisonSociale
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        const existing = await req.payload.find({
          collection: 'fournisseurs',
          where: { slug: { equals: slug } },
          limit: 1,
          overrideAccess: true,
        })
        if (existing.docs.length > 0 && existing.docs[0].id !== data.id) {
          slug = `${slug}-${Date.now()}`
        }
        data.slug = slug
        return data
      },
    ],
    beforeChange: [
      // Strip les emojis de tous les champs texte/URL avant validation/persistance.
      // Mirror du strip client (FicheEditForm) : si la requete arrive via REST,
      // CLI ou admin Payload, on bloque tout de meme l'insertion d'emojis.
      async ({ data }) => {
        for (const field of FOURNISSEUR_TEXT_FIELDS) {
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
        if (Array.isArray(data.offresEmploi)) {
          data.offresEmploi = data.offresEmploi.map((o: { titre?: string; lien?: string }) => ({
            ...o,
            titre: typeof o?.titre === 'string' ? stripEmojis(o.titre) : o?.titre,
            lien: typeof o?.lien === 'string' ? stripEmojis(o.lien) : o?.lien,
          }))
        }
        return data
      },
      async ({ data, operation, req }) => {
        if (operation === 'create' && req.user && req.user.role !== 'admin') {
          const allowed = await canCreateFiche(req)
          if (!allowed) {
            throw new Error('Vous avez atteint le nombre maximum de fiches pour votre abonnement.')
          }
        }
        return data
      },
      async ({ data, req }) => {
        if (req.user && req.user.role !== 'admin') {
          const freshUser = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
            overrideAccess: true,
          })
          const level = getEffectiveFeatureLevel(freshUser)

          if (data.description) {
            const limit = DESCRIPTION_WORD_LIMITS[level]
            if (limit && countWords(data.description) > limit) {
              throw new Error(`La description est limitee a ${limit} mots pour votre abonnement.`)
            }
          }

          if (data.descriptionRSE) {
            if (countWords(data.descriptionRSE) > DESCRIPTION_RSE_WORD_LIMIT) {
              throw new Error(`La description RSE est limitee a ${DESCRIPTION_RSE_WORD_LIMIT} mots.`)
            }
          }

          if (data.illustrations) {
            const maxIllus = ILLUSTRATIONS_LIMITS[level] ?? 0
            if (data.illustrations.length > maxIllus) {
              throw new Error(`Votre abonnement autorise ${maxIllus} illustration${maxIllus > 1 ? 's' : ''} maximum.`)
            }
          }
        }
        return data
      },
      async ({ data, originalDoc }) => {
        const addressChanged =
          data.ville !== originalDoc?.ville ||
          data.adresse !== originalDoc?.adresse ||
          data.codePostal !== originalDoc?.codePostal

        if (addressChanged && data.ville) {
          const result = await geocodeAddress(data.adresse, data.codePostal, data.ville)
          if (result) {
            data.latitude = result.latitude
            data.longitude = result.longitude
          }
        }
        return data
      },
    ],
    afterChange: [
      cleanupOrphanedMediaOnChange,
      // Pousse immediatement la mise a jour sur la map et les fiches publiques
      // sans attendre les 5 min d'ISR. Critique apres un changement d'adresse :
      // le geocodage du beforeChange a deja recalcule latitude/longitude, mais
      // sans revalidation, /api/geo/revendeurs, /api/fournisseurs/public/[slug]
      // et la page /revendeurs/[slug] (qui alimente le bouton itineraire)
      // continuent de servir les anciennes coordonnees pendant 5 min.
      ({ doc }) => {
        try {
          revalidatePath('/api/geo/revendeurs')
          revalidatePath('/api/fournisseurs/public/[slug]', 'page')
          if (doc?.slug) {
            revalidatePath(`/revendeurs/${doc.slug}`, 'page')
          }
        } catch {
          // revalidation may fail outside of request context (cron, scripts)
        }
        return doc
      },
      notifyOnSuspension,
    ],
    afterDelete: [
      cleanupMediaOnDelete,
      () => {
        try {
          revalidatePath('/api/geo/revendeurs')
        } catch {
          // revalidation may fail outside of request context
        }
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.find({
          collection: 'evenements',
          where: {
            or: [
              { fournisseur: { equals: id } },
              { fournisseursAssocies: { contains: id } },
            ],
          },
          limit: 0,
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer ce fournisseur : ${totalDocs} evenement(s) y sont rattaches.`,
          )
        }
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      unique: true,
      admin: {
        description: 'Compte proprietaire (vide pour les fiches orphelines non revendiquees).',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'raisonSociale',
      type: 'text',
      required: true,
    },
    {
      name: 'ville',
      type: 'text',
      required: true,
    },
    {
      name: 'activitePrincipale',
      type: 'relationship',
      relationTo: 'categories-activite',
    },
    {
      name: 'activitesSecondaires',
      type: 'relationship',
      relationTo: 'categories-activite',
      hasMany: true,
      access: { update: isPremiumOrAbove },
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
    },
    // Standard+ fields
    {
      name: 'adresse',
      type: 'text',
      access: { update: isPremiumOrAbove },
    },
    {
      name: 'codePostal',
      type: 'text',
      access: { update: isPremiumOrAbove },
    },
    {
      name: 'siteWeb',
      type: 'text',
      access: { update: isPremiumOrAbove },
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
      name: 'boutiqueEnLigne',
      type: 'text',
      access: { update: isPremiumOrAbove },
      admin: {
        description: 'Lien vers votre boutique en ligne.',
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
      name: 'lienDevis',
      type: 'text',
      access: { update: isPremiumOrAbove },
      admin: {
        description: 'Lien vers votre formulaire de demande de devis.',
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
      name: 'emailContact',
      type: 'email',
      access: { update: isPremiumOrAbove },
    },
    {
      name: 'telephone',
      type: 'text',
      access: { update: isPremiumOrAbove },
    },
    {
      name: 'reseauxSociaux',
      type: 'array',
      maxRows: 6,
      access: { update: isPremiumOrAbove },
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
    // Premium fields
    {
      name: 'description',
      type: 'textarea',
      access: { update: isPremiumOrAbove },
    },
    // RSE
    {
      name: 'labelsRSE',
      type: 'relationship',
      relationTo: 'labels-rse',
      hasMany: true,
      access: { update: isPremiumOrAbove },
      admin: {
        description: 'Selectionnez les labels RSE que vous detenez.',
      },
    },
    {
      name: 'descriptionRSE',
      type: 'textarea',
      access: { update: isPremiumOrAbove },
      admin: {
        description: 'Decrivez votre demarche RSE (300 mots max).',
      },
    },
    {
      name: 'banniere',
      type: 'upload',
      relationTo: 'media',
      access: { update: isPremiumOrAbove },
      admin: {
        description: 'Image de banniere affichee en tete de la fiche.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Logo de l\'entreprise.',
      },
    },
    {
      name: 'illustrations',
      type: 'array',
      maxRows: 6,
      access: { update: isPremiumOrAbove },
      admin: {
        description: '4 photos d\'illustration maximum.',
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
    // Infinite: video YouTube
    {
      name: 'videoYoutube',
      type: 'text',
      access: { update: isInfinite },
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
    // Infinite: offres d'emploi
    {
      name: 'offresEmploi',
      type: 'array',
      maxRows: 10,
      access: { update: isInfinite },
      labels: { singular: 'Offre d\'emploi', plural: 'Offres d\'emploi' },
      admin: {
        description: 'Offres d\'emploi publiees sur votre fiche (abonnement Infinite).',
      },
      fields: [
        {
          name: 'titre',
          type: 'text',
          required: true,
        },
        {
          name: 'lien',
          type: 'text',
          required: true,
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
          name: 'datePublication',
          type: 'date',
          required: true,
        },
      ],
    },
    // Geo (auto)
    {
      name: 'latitude',
      type: 'number',
      access: { update: isAdmin },
      admin: { position: 'sidebar' },
    },
    {
      name: 'longitude',
      type: 'number',
      access: { update: isAdmin },
      admin: { position: 'sidebar' },
    },
    seoField,
  ],
}
