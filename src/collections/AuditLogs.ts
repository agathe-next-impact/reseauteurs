import type { CollectionConfig } from 'payload'
import { isAdmin } from './access'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'type',
    description: 'Journal d\'audit RGPD (anonymise). Preuve de conformite.',
    group: 'Configuration',
    defaultColumns: ['type', 'userIdHash', 'createdAt'],
  },
  access: {
    read: isAdmin,
    create: () => true,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Suppression compte', value: 'account_deleted' },
        { label: 'Consentement donne', value: 'consent_given' },
        { label: 'Consentement revoque', value: 'consent_revoked' },
        { label: 'Donnees exportees', value: 'data_exported' },
        { label: 'Stripe misconfig (priceId inconnu)', value: 'stripe_misconfig' },
        { label: 'Groupe coupon sync failed', value: 'groupe_sync_failed' },
        { label: 'Plan change', value: 'plan_changed' },
        { label: 'Groupe soft-deleted', value: 'groupe_soft_deleted' },
        { label: 'Email change', value: 'email_changed' },
        { label: 'Groupe cree', value: 'groupe_created' },
        { label: 'Groupe rejoint', value: 'groupe_joined' },
        { label: 'Groupe quitte', value: 'groupe_left' },
        { label: 'Groupe ownership transfere', value: 'groupe_ownership_transferred' },
        { label: 'Email blackliste', value: 'email_blacklisted' },
      ],
    },
    {
      name: 'userIdHash',
      type: 'text',
      index: true,
      required: true,
      admin: {
        description: 'SHA-256(userId + PAYLOAD_SECRET) — anonymise.',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Contexte non-identifiant (plan, raison, palier, etc.).',
      },
    },
  ],
  timestamps: true,
}
