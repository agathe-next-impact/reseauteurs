import type { CollectionConfig } from 'payload'
import { isAdmin } from './access'

/**
 * Persisted idempotency store for processed Stripe webhook event IDs.
 *
 * The DB UNIQUE constraint on `eventId` is the source of truth — the webhook
 * handler attempts to insert a row before processing; a conflict means the
 * event has already been handled and can be safely acknowledged as duplicate.
 * This survives cold starts and multi-instance serverless deployments, unlike
 * the previous in-memory Map.
 */
export const StripeEvents: CollectionConfig = {
  slug: 'stripe-events',
  admin: {
    useAsTitle: 'eventId',
    description: 'Journal des événements Stripe traités (idempotence webhook).',
    group: 'Configuration',
    defaultColumns: ['eventId', 'type', 'createdAt'],
  },
  access: {
    read: isAdmin,
    create: () => true,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'eventId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Identifiant Stripe de l\'event (evt_...).',
      },
    },
    {
      name: 'type',
      type: 'text',
      index: true,
    },
  ],
  timestamps: true,
}
