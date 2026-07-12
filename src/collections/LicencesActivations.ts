/**
 * LicencesActivations.ts — Traçabilité des activations de licences Plus (ADR-0013 §3).
 *
 * Une ligne = un réseauteur qui a activé une licence via le code promo d'un pack.
 * Invariants (garantis par la route d'activation P2.A + contraintes DB) :
 *   - UNE SEULE activation par utilisateur (index unique sur user) ;
 *   - le quota du pack est décrémenté dans la même transaction que la création.
 *
 * Table DB : `licences_activations` (migration 20260712_100000).
 */

import type { CollectionConfig, Where } from 'payload'

const isAdmin = ({ req: { user } }: { req: { user?: { role?: string } | null } }) =>
  user?.role === 'admin'

export const LicencesActivations: CollectionConfig = {
  slug: 'licences-activations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['pack', 'user', 'activeAt'],
    group: 'Monétisation',
    description: 'Activations de licences Réseauteur Plus (qui a activé quel code, quand).',
  },
  access: {
    // Lecture : admin ; le partenaire voit les activations de SES packs ;
    // le réseauteur voit SA propre activation.
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (!user) return false
      return {
        or: [
          { user: { equals: user.id } },
          { 'pack.partenaire.user': { equals: user.id } },
        ],
      } as Where
    },
    // Écritures : admin uniquement — la route d'activation (P2.A) passe par overrideAccess.
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'pack',
      type: 'relationship',
      relationTo: 'licences-packs',
      required: true,
      index: true,
      admin: { description: 'Pack dont provient la licence.' },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Réseauteur ayant activé la licence (une seule activation par compte).' },
    },
    {
      name: 'activeAt',
      type: 'date',
      admin: { description: 'Date d\'activation.' },
    },
  ],
}
