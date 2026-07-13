/**
 * Inscriptions.ts — Inscription d'un réseauteur à un événement organisé par un
 * réseauteur Plus (ADR-0013 §3bis).
 *
 * Une ligne = un réseauteur inscrit à un événement Plus. Invariants :
 *   - UNE inscription par (événement, réseauteur) — index unique DB ;
 *   - ne concerne QUE les événements organisés par un réseauteur Plus
 *     (`evenements.organisateurReseauteur` renseigné) — garanti par la route
 *     d'inscription (P2), jamais par le client.
 *
 * Distinct de `reseauteurs.evenementsParticipes` (participation aux événements des
 * réseaux fréquentés) : disjoints par le XOR d'organisateur.
 *
 * Écritures via la route dédiée (`overrideAccess`) uniquement — jamais l'API CRUD directe.
 * Table DB : `inscriptions` (migration 20260713_100000).
 */

import type { CollectionConfig, Where } from 'payload'

const isAdmin = ({ req: { user } }: { req: { user?: { role?: string } | null } }) =>
  user?.role === 'admin'

export const Inscriptions: CollectionConfig = {
  slug: 'inscriptions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['evenement', 'reseauteur', 'createdAt'],
    group: 'Événements',
    description: 'Inscriptions des réseauteurs aux événements organisés par des réseauteurs Plus (ADR-0013).',
  },
  access: {
    // Lecture : admin ; l'organisateur Plus voit les inscrits de SES événements ;
    // le réseauteur voit SES propres inscriptions.
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (!user) return false
      return {
        or: [
          { 'reseauteur.user': { equals: user.id } },
          { 'evenement.organisateurReseauteur.user': { equals: user.id } },
        ],
      } as Where
    },
    // Écritures : admin uniquement — la route d'inscription (P2) passe par overrideAccess.
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'evenement',
      type: 'relationship',
      relationTo: 'evenements',
      required: true,
      index: true,
      admin: { description: "Événement (organisé par un réseauteur Plus)." },
    },
    {
      name: 'reseauteur',
      type: 'relationship',
      relationTo: 'reseauteurs',
      required: true,
      index: true,
      admin: { description: 'Réseauteur inscrit (une inscription par événement).' },
    },
  ],
}
