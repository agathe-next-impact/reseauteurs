import type { Field } from 'payload'

/**
 * Shared SEO field group appended to public-facing collections.
 * Overrides are optional — when empty, routes fall back on entity defaults
 * (nom / titre, description).
 */
export const seoField: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  admin: {
    description:
      'Champs SEO optionnels. Laissez vide pour utiliser les valeurs par defaut calculees depuis la fiche.',
    position: 'sidebar',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Titre SEO',
      maxLength: 70,
      admin: {
        description: 'Meta title (60 car. recommandes). Fallback : nom de l\'entite.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description SEO',
      maxLength: 200,
      admin: {
        description: 'Meta description (160 car. max). Fallback : description de la fiche.',
      },
    },
    {
      name: 'keywords',
      type: 'text',
      label: 'Mots-cles',
      admin: {
        description: 'Mots-cles separes par des virgules (optionnel, peu utile en 2026).',
      },
    },
    {
      name: 'ogImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Image OpenGraph',
      admin: {
        description:
          'Image partagee sur les reseaux sociaux. Fallback : image OpenGraph par defaut du site.',
      },
    },
    {
      name: 'noindex',
      type: 'checkbox',
      label: 'Ne pas indexer',
      defaultValue: false,
      admin: {
        description: 'Cochez pour empecher cette page d\'etre indexee par les moteurs de recherche.',
      },
    },
  ],
}
