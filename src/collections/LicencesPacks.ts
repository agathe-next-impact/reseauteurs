/**
 * LicencesPacks.ts — [DORMANT depuis ADR-0015 (2026-07-17)]
 *
 * La fonctionnalité d'achat de packs de licences par les partenaires est SUPPRIMÉE
 * (checkout, webhook, activation par code, UI). La collection reste enregistrée pour
 * les données legacy (packs déjà achetés) : le cron expiration-plus les fait expirer
 * et désactive les Plus associés. Pas de migration destructive.
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
    hidden: true,
    description: '[Dormant — ADR-0015] Packs de licences legacy (fonctionnalité supprimée, extinction par cron).',
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
