/**
 * Partenaires.ts — Annonceurs B2B (ADR-0011 §3) — self-service.
 *
 * Distinct de `reseaux.partenaire` (drapeau sur la fiche réseau).
 * `partenaires` = entreprises ANNONCEURS visibles auprès des réseauteurs
 * (logo page d'accueil + page Partenaires + fiche perso /partenaire/<slug>).
 *
 * Self-service : 1 compte `user` (role 'partenaire') = 1 fiche partenaire.
 * L'activation (statut 'actif') est posée par le webhook Stripe après abonnement.
 * Le partenaire édite sa fiche + son offre ; il ne peut PAS toucher statut/stripe
 * (field-access admin/webhook uniquement).
 *
 * Offre : promotion réservée aux réseauteurs connectés (visible dans leur espace).
 *
 * Table DB : `partenaires` (migrations 20260628_110000 + 20260709 participation… +
 * 20260710 self-service).
 */

import type { CollectionConfig, Where } from 'payload'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'

/** Validation d'URL http(s) partagée (lien site + lien offre). */
const urlValidate = (value: unknown): true | string => {
  if (!value || typeof value !== 'string') return true
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return 'L\'URL doit commencer par http:// ou https://'
    return true
  } catch {
    return 'URL invalide'
  }
}

const isAdmin = ({ req: { user } }: { req: { user?: { role?: string } | null } }) =>
  user?.role === 'admin'

export const Partenaires: CollectionConfig = {
  slug: 'partenaires',
  admin: {
    useAsTitle: 'nom',
    defaultColumns: ['nom', 'statut', 'lien', 'createdAt'],
    group: 'Contenu',
    description: 'Annonceurs B2B — logo page d\'accueil + page Partenaires + fiche perso.',
  },
  access: {
    // Lecture : public pour les actifs ; admin ; propriétaire (voit sa fiche même expirée).
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) {
        return {
          or: [{ statut: { equals: 'actif' } }, { user: { equals: user.id } }],
        } as Where
      }
      return { statut: { equals: 'actif' } }
    },
    // Création : admin (la fiche est auto-créée au signup via hook Users, overrideAccess).
    create: ({ req: { user } }) => user?.role === 'admin',
    // Mise à jour : admin ou propriétaire. Les champs statut/stripe restent verrouillés
    // par field-access ci-dessous.
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } } as Where
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeValidate: [
      // Génération du slug depuis le nom (figé après création — contrat SEO fiche perso).
      async ({ data, req, operation }) => {
        if (!data) return data
        if (operation !== 'create') return data
        if (data.slug) return data
        const base =
          String(data.nom ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'partenaire'
        const { docs } = await req.payload.find({
          collection: 'partenaires',
          where: { slug: { like: `${base}%` } },
          limit: 100,
          overrideAccess: true,
          req,
          select: { slug: true } as Record<string, boolean>,
        })
        const taken = new Set(docs.map((d) => (d as { slug?: string }).slug))
        if (!taken.has(base)) {
          data.slug = base
          return data
        }
        let i = 2
        while (taken.has(`${base}-${i}`) && i < 100) i++
        data.slug = `${base}-${i}`
        return data
      },
    ],
    afterChange: [cleanupOrphanedMediaOnChange],
    afterDelete: [cleanupMediaOnDelete],
  },
  fields: [
    // ── Propriété (1 user 'partenaire' = 1 fiche partenaire)
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      unique: true,
      index: true,
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Compte propriétaire (1 user = 1 partenaire).',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Généré depuis le nom à la création ; figé ensuite (URL /partenaire/<slug>).',
      },
    },
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
      // Optionnel : la fiche est un squelette au signup ; le logo est ajouté ensuite.
      // La fiche n'est publiée (bandeau/page/fiche perso) que si actif ET logo présent.
      label: 'Logo',
      admin: {
        description: 'Logo affiché sur la page d\'accueil, la page Partenaires et votre fiche (fond clair, carré recommandé).',
      },
    },
    {
      name: 'lien',
      type: 'text',
      label: 'URL du site',
      validate: urlValidate,
      admin: {
        description: 'Lien vers votre site (s\'ouvre dans un nouvel onglet).',
      },
    },
    // ── Contacts publics (CTA « Prendre contact » sur la fiche publique) ──
    {
      name: 'emailContact',
      type: 'email',
      label: 'Email de contact',
      admin: {
        description: 'Affiché sur votre fiche publique (bouton « Envoyer un email »). Facultatif.',
      },
    },
    {
      name: 'telephone',
      type: 'text',
      label: 'Téléphone',
      admin: {
        description: 'Affiché sur votre fiche publique (bouton « Appeler »). Facultatif.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description courte',
      maxLength: 500,
      admin: {
        description: 'Une phrase de présentation affichée sur la page Partenaires et votre fiche.',
      },
    },
    // ── Offre réservée aux réseauteurs (visible dans leur espace « Offres partenaires »)
    {
      name: 'offre',
      type: 'group',
      label: 'Offre réservée aux réseauteurs',
      // Lecture RÉSERVÉE aux réseauteurs/admin — même via l'API REST/GraphQL générique
      // (C4 : sans ce gate, GET /api/partenaires?where[slug]=… fuite l'offre à un visiteur
      // anonyme). La fiche SSR et la route /offre passent en overrideAccess → non affectées.
      access: {
        read: ({ req: { user } }) => user?.role === 'reseauteur' || user?.role === 'admin',
      },
      admin: {
        description:
          'Offre promotionnelle visible UNIQUEMENT par les réseauteurs connectés. Laissez le titre vide pour ne pas proposer d\'offre.',
      },
      fields: [
        { name: 'titre', type: 'text', maxLength: 120, label: 'Titre de l\'offre' },
        { name: 'description', type: 'textarea', maxLength: 1000, label: 'Description' },
        { name: 'lien', type: 'text', label: 'Lien pour en profiter (optionnel)', validate: urlValidate },
      ],
    },
    // ── Abonnement (posé par le webhook Stripe — jamais éditable par le partenaire)
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
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Statut d\'abonnement. Posé automatiquement par le webhook Stripe.',
      },
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      index: true,
      access: { read: isAdmin, update: isAdmin },
      admin: { position: 'sidebar', description: 'Customer Stripe rattaché.' },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      index: true,
      access: { read: isAdmin, update: isAdmin },
      admin: { position: 'sidebar', description: 'ID de l\'abonnement Stripe.' },
    },
    {
      name: 'abonnementExpireAt',
      type: 'date',
      access: { read: isAdmin, update: isAdmin },
      admin: { position: 'sidebar', description: 'Date d\'expiration de l\'abonnement.' },
    },
  ],
}
