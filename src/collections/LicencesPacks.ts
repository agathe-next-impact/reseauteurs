/**
 * LicencesPacks.ts — Packs de licences « Réseauteur Plus » achetés par un partenaire (ADR-0013 §3).
 *
 * Un pack = un quota de licences Plus (10 / 50 / 100 — gate P0 D2 : 300/600/1 000 €)
 * + UN code promo unique que le partenaire diffuse à ses réseauteurs.
 * Paiement : Checkout one-shot (gate P0 D3) — le webhook crée/active le pack.
 * Expiration alignée sur le pack ; reconduction au rachat (gate P0 D4).
 *
 * Le quota est décrémenté TRANSACTIONNELLEMENT par la route d'activation (P2.A) —
 * jamais par le client. Les activations sont tracées dans `licences-activations`.
 *
 * Table DB : `licences_packs` (migration 20260712_100000).
 */

import type { CollectionConfig, Where } from 'payload'
import crypto from 'crypto'

const isAdmin = ({ req: { user } }: { req: { user?: { role?: string } | null } }) =>
  user?.role === 'admin'

/** Code lisible, non devinable, généré serveur (ex. RSN-7F3K9QX2). Sans 0/O/1/I. */
function genererCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length]
  return `RSN-${code}`
}

export const LicencesPacks: CollectionConfig = {
  slug: 'licences-packs',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'partenaire', 'quota', 'quotaUtilise', 'statut', 'expireAt'],
    group: 'Monétisation',
    description: 'Packs de licences Réseauteur Plus achetés par les partenaires (ADR-0013).',
  },
  access: {
    // Lecture : admin ; le partenaire voit SES packs (code à diffuser, quota restant).
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'partenaire') {
        return { 'partenaire.user': { equals: user.id } } as Where
      }
      return false
    },
    // Écritures : admin uniquement — le webhook Stripe et la route d'activation
    // passent par overrideAccess (serveur).
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      // Génération du code (création uniquement ; unicité garantie par l'index + retry improbable)
      async ({ data, operation }) => {
        if (!data) return data
        if (operation !== 'create') return data
        if (!data.code) data.code = genererCode()
        return data
      },
    ],
  },
  fields: [
    {
      name: 'partenaire',
      type: 'relationship',
      relationTo: 'partenaires',
      required: true,
      index: true,
      admin: { description: 'Partenaire propriétaire du pack.' },
    },
    {
      name: 'quota',
      type: 'number',
      required: true,
      min: 1,
      admin: { description: 'Nombre de licences du pack (10 / 50 / 100 — gate P0 D2).' },
    },
    {
      name: 'quotaUtilise',
      type: 'number',
      defaultValue: 0,
      min: 0,
      access: { update: isAdmin },
      admin: {
        description: 'Licences déjà activées. Incrémenté transactionnellement par la route d\'activation.',
      },
    },
    {
      name: 'code',
      type: 'text',
      unique: true,
      index: true,
      access: { update: isAdmin },
      admin: {
        readOnly: true,
        description: 'Code promo à diffuser aux réseauteurs. Généré serveur à la création.',
      },
    },
    {
      name: 'statut',
      type: 'select',
      required: true,
      options: [
        { label: 'Actif', value: 'actif' },
        { label: 'Épuisé', value: 'epuise' },
        { label: 'Expiré', value: 'expire' },
      ],
      defaultValue: 'actif',
      index: true,
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Posé par le webhook (achat), la route d\'activation (épuisement) et le cron (expiration).',
      },
    },
    {
      name: 'expireAt',
      type: 'date',
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Expiration du pack (alignée sur l\'abonnement annonceur — gate P0 D4). Reconduction au rachat.',
      },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      access: { read: isAdmin, update: isAdmin },
      admin: { position: 'sidebar', description: 'Session Checkout one-shot du paiement du pack.' },
    },
  ],
}
