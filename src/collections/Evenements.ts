// @ts-nocheck — types en attente de generate:types (data-architect)
/**
 * Evenements.ts — Événement business daté (ADR-0011 §1, SIMPLIFIÉ ; ADR-0012 E1.3).
 *
 * Simplifications vs l'existant (ADR-0011) :
 *   - Retiré  : serieId (récurrence hors V1), visible (remplacé par statut),
 *               archivage admin, quota/canCreateOccurrence, emailContact public
 *   - Gardé   : lienInscription (URL externe — RÉSEAUTEURS n'organise PAS l'inscription)
 *   - Accès   : organisateur d'un réseau dont le NATIONAL EST ABONNÉ peut créer des événements
 *               (gate via peutPublierEvenement — ADR-0012)
 *
 * ADR-0012 E1.3 :
 *   - RETIRÉ  : champs `premium` et `stripeCheckoutSessionId` (Checkout one-shot Premium supprimé).
 *               Les colonnes DB sont droppées par la migration 20260630_110000_evenements_drop_premium.ts.
 *   - CHANGÉ  : gate `if (!reseau.partenaire)` → `if (!peutPublierEvenement(reseau))`
 *               (prend en compte la hiérarchie national↔local — ADR-0012 §4).
 *
 * Le hook afterChange met à jour le compteur reseaux.nbEvenements.
 */

import type { CollectionConfig, CollectionAfterChangeHook, Where } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { revalidatePath } from 'next/cache'
import { isAdmin } from './access'
import { geocodeAddress } from '../lib/geocode'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'
import { stripEmojis } from '../lib/sanitize'
import { seoField } from './fields/seoField'
import { peutPublierEvenement, peutGererReseau } from '../lib/reseau-hierarchie'
import type { ReseauForHierarchy, UserForHierarchy } from '../lib/reseau-hierarchie'

// Champs texte protégés contre les emojis
const EVENEMENT_TEXT_FIELDS = [
  'titre',
  'lieuNom',
  'lieuAdresse',
  'lieuCodePostal',
  'lieuVille',
  'description',
  'lienInscription',
] as const

/**
 * Synchronise la colonne PostGIS geom depuis lieuLatitude/lieuLongitude.
 * Pattern identique à Reseaux.ts — ADR-0002.
 */
const syncGeom: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (process.env.SEED_DEV === 'true') return doc
  if (!doc.lieuLatitude || !doc.lieuLongitude) return doc
  try {
    await req.payload.db.drizzle.execute(sql`
      UPDATE evenements
         SET geom = ST_SetSRID(ST_MakePoint(${doc.lieuLongitude}, ${doc.lieuLatitude}), 4326)::geography
       WHERE id = ${doc.id}
         AND (geom IS NULL
           OR ST_X(geom::geometry) != ${doc.lieuLongitude}
           OR ST_Y(geom::geometry) != ${doc.lieuLatitude})
    `.inlineParams())
  } catch (err) {
    console.error('[Evenements afterChange] syncGeom failed:', err)
  }
  return doc
}

/**
 * Met à jour le compteur nbEvenements du réseau organisateur.
 */
const updateReseauCompteurEvenements: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (process.env.SEED_DEV === 'true') return doc
  const extractId = (rel: unknown): string | number | null => {
    if (rel == null) return null
    return typeof rel === 'object' ? ((rel as { id?: string | number }).id ?? null) : (rel as string | number)
  }

  // Réseaux impactés : l'actuel ET le précédent — sur réassignation A→B, il faut
  // aussi décrémenter A, sinon son nbEvenements reste figé (divergence corrigée J3).
  const affected = new Set<string | number>()
  const current = extractId(doc.reseau)
  const previous = extractId(previousDoc?.reseau)
  if (current != null) affected.add(current)
  if (previous != null) affected.add(previous)

  for (const reseauId of affected) {
    try {
      const { totalDocs } = await req.payload.count({
        collection: 'evenements',
        where: {
          reseau: { equals: reseauId },
          statut: { equals: 'publie' },
        },
        overrideAccess: true,
      })
      await req.payload.update({
        collection: 'reseaux',
        id: reseauId,
        data: { nbEvenements: totalDocs },
        overrideAccess: true,
      })
    } catch (err) {
      console.error(`[Evenements afterChange] updateReseauCompteur failed for reseau ${reseauId}:`, err)
    }
  }
  return doc
}

export const Evenements: CollectionConfig = {
  slug: 'evenements',
  admin: {
    useAsTitle: 'titre',
    // 'premium' retiré (ADR-0012 E1.3 — champ supprimé)
    defaultColumns: ['titre', 'reseau', 'dateDebut', 'lieuVille', 'statut'],
    group: 'Contenu',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) {
        return {
          or: [
            { statut: { equals: 'publie' } },
            { 'reseau.user': { equals: user.id } },
          ],
        } as Where
      }
      return { statut: { equals: 'publie' } }
    },
    // Création : organisateur ou admin.
    // La vérification reseau.partenaire === true est faite dans le hook beforeValidate (J2.A, ADR-0011).
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // L'organisateur passe ici ; le hook beforeValidate vérifie ensuite l'ownership et le statut partenaire.
      return user.role === 'organisateur'
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { 'reseau.user': { equals: user.id } } as Where
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { 'reseau.user': { equals: user.id } } as Where
    },
  },
  hooks: {
    beforeValidate: [
      // ── Génère un slug stable depuis le titre (création uniquement)
      async ({ data, req, operation }) => {
        if (!data) return data
        if (operation !== 'create') return data
        if (data.slug) return data
        if (!data.titre) return data

        let slug = String(data.titre)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        if (!slug) slug = 'evenement'

        // Suffixe déterministe (jamais Date.now() — ADR-0005)
        const existing = await req.payload.find({
          collection: 'evenements',
          where: { slug: { like: `${slug}%` } },
          limit: 100,
          overrideAccess: true,
          select: { slug: true } as Record<string, boolean>,
        })
        const slugSet = new Set(existing.docs.map((d: { slug?: string }) => d.slug))
        if (slugSet.has(slug)) {
          let suffix = 2
          let candidate = `${slug}-${suffix}`
          while (slugSet.has(candidate) && suffix < 50) {
            suffix++
            candidate = `${slug}-${suffix}`
          }
          slug = candidate
        }
        data.slug = slug
        return data
      },
      // ── Vérification ownership + gate de publication (ADR-0012 E1.3).
      //
      // Ownership : peutGererReseau (propriétaire direct OU umbrella national→local).
      //   Requiert depth=1 sur le réseau pour accès au parent (national effectif).
      //
      // Gate de publication : peutPublierEvenement (national effectif abonné).
      //   Remplace l'ancien `if (!reseau.partenaire)` qui ne regardait que le réseau lui-même.
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data
        if (!req.user || req.user.role === 'admin') return data

        const incomingReseau = operation === 'update' && Object.prototype.hasOwnProperty.call(data, 'reseau')
          ? (data.reseau ?? null)
          : undefined
        const originalReseau = (() => {
          const v = originalDoc?.reseau
          if (v == null) return null
          return typeof v === 'object' ? (v as { id: number | string }).id : v
        })()
        const ownershipChanged = operation === 'update' && incomingReseau !== undefined
          && Number(incomingReseau ?? 0) !== Number(originalReseau ?? 0)

        if (operation === 'create' || ownershipChanged) {
          const reseauId = data.reseau ?? null
          if (reseauId) {
            // depth: 1 pour peupler parent (nécessaire à nationalDe / peutPublierEvenement)
            const reseau = await req.payload.findByID({
              collection: 'reseaux',
              id: reseauId as number | string,
              depth: 1,
              overrideAccess: true,
            })

            // ── Vérification ownership (direct ou umbrella national→local)
            if (!peutGererReseau(req.user as UserForHierarchy, reseau as unknown as ReseauForHierarchy)) {
              throw new Error(
                'Vous ne pouvez créer un événement que pour un réseau que vous gérez ' +
                '(votre réseau ou un local de votre réseau national).',
              )
            }

            // ── Gate de publication : l'abonnement du national effectif doit être actif.
            //    peutPublierEvenement utilise nationalDe(reseau) — fonctionne pour local et national.
            if (!peutPublierEvenement(reseau as unknown as ReseauForHierarchy)) {
              throw new Error(
                'La publication d\'événements est réservée aux réseaux dont le réseau national dispose ' +
                'd\'un abonnement actif. Souscrivez à un abonnement depuis votre tableau de bord.',
              )
            }
          }
        }
        return data
      },
    ],
    beforeChange: [
      // ── Strip emojis
      async ({ data }) => {
        for (const field of EVENEMENT_TEXT_FIELDS) {
          const v = data[field]
          if (typeof v === 'string') data[field] = stripEmojis(v)
        }
        return data
      },
      // ── Géocodage automatique du lieu
      async ({ data, originalDoc }) => {
        if (process.env.SEED_DEV === 'true') return data
        const addressChanged =
          data.lieuVille !== originalDoc?.lieuVille ||
          data.lieuAdresse !== originalDoc?.lieuAdresse ||
          data.lieuCodePostal !== originalDoc?.lieuCodePostal
        if (addressChanged && data.lieuVille && (data.lieuLatitude == null || data.lieuLongitude == null)) {
          const result = await geocodeAddress(data.lieuAdresse, data.lieuCodePostal, data.lieuVille)
          if (result) {
            data.lieuLatitude = result.latitude
            data.lieuLongitude = result.longitude
          }
        }
        return data
      },
    ],
    afterChange: [
      cleanupOrphanedMediaOnChange,
      syncGeom,
      updateReseauCompteurEvenements,
      ({ doc }) => {
        try {
          revalidatePath('/api/geo/evenements')
          if (doc?.slug) revalidatePath(`/evenement/${doc.slug}`, 'page')
          revalidatePath('/evenements', 'page')
          if (doc.reseau) {
            const reseauSlug = typeof doc.reseau === 'object'
              ? (doc.reseau as { slug?: string }).slug
              : null
            if (reseauSlug) revalidatePath(`/reseau/${reseauSlug}`, 'page')
          }
        } catch {
          // Peut échouer hors contexte request
        }
        return doc
      },
    ],
    afterDelete: [
      cleanupMediaOnDelete,
      async ({ doc, req }) => {
        // Décrémente le compteur du réseau
        const reseauId = typeof doc.reseau === 'object' && doc.reseau !== null
          ? (doc.reseau as { id: number | string }).id
          : (doc.reseau as number | string | null | undefined)
        if (reseauId) {
          try {
            const { totalDocs } = await req.payload.count({
              collection: 'evenements',
              where: { reseau: { equals: reseauId }, statut: { equals: 'publie' } },
              overrideAccess: true,
            })
            await req.payload.update({
              collection: 'reseaux',
              id: reseauId as string | number,
              data: { nbEvenements: totalDocs },
              overrideAccess: true,
            })
          } catch (err) {
            console.error('[Evenements afterDelete] updateReseauCompteur failed:', err)
          }
        }
        try {
          revalidatePath('/api/geo/evenements')
          revalidatePath('/evenements', 'page')
        } catch { /* hors contexte */ }
      },
    ],
  },
  fields: [
    // ============================================================
    // IDENTITÉ
    // ============================================================
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Généré depuis le titre à la création ; figé ensuite (contrat SEO — ADR-0005).',
      },
    },
    // ============================================================
    // RÉSEAU ORGANISATEUR (N-1 vers reseaux)
    // ============================================================
    {
      name: 'reseau',
      type: 'relationship',
      relationTo: 'reseaux',
      required: true,
      index: true,
      label: 'Réseau organisateur',
      admin: {
        description: 'Réseau qui organise cet événement.',
      },
    },
    // ============================================================
    // CONTENU
    // ============================================================
    {
      name: 'titre',
      type: 'text',
      required: true,
      label: 'Titre',
    },
    {
      name: 'type',
      type: 'relationship',
      relationTo: 'types-evenement',
      label: 'Catégorie',
      index: true,
    },
    {
      name: 'dateDebut',
      type: 'date',
      required: true,
      index: true,
      label: 'Date (et heure)',
      admin: {
        description: 'Date et heure de début de l\'événement.',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'dateFin',
      type: 'date',
      label: 'Date de fin (optionnelle)',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    // ============================================================
    // LIEU
    // ============================================================
    {
      name: 'lieuNom',
      type: 'text',
      label: 'Nom du lieu',
    },
    {
      name: 'lieuAdresse',
      type: 'text',
      label: 'Adresse',
    },
    {
      name: 'lieuCodePostal',
      type: 'text',
      label: 'Code postal',
    },
    {
      name: 'lieuVille',
      type: 'text',
      required: true,
      label: 'Ville',
      index: true,
    },
    // ============================================================
    // DESCRIPTION ET LIEN D'INSCRIPTION EXTERNE
    // (RÉSEAUTEURS n'organise pas — l'inscription est sur le site du réseau)
    // ============================================================
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
    {
      name: 'lienInscription',
      type: 'text',
      label: 'Lien d\'inscription (externe)',
      admin: {
        description: 'URL vers le site ou formulaire d\'inscription du réseau organisateur. Le bouton « S\'inscrire » redirige vers ce lien.',
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
    // ============================================================
    // MÉDIAS
    // ============================================================
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Image / bannière',
    },
    // ============================================================
    // STATUT
    // NOTE ADR-0012 E1.3 : les champs `premium` et `stripeCheckoutSessionId` ont été RETIRÉS.
    //   - L'événement Premium ponctuel (Checkout one-shot) est supprimé du modèle.
    //   - Les colonnes DB sont droppées par la migration 20260630_110000_evenements_drop_premium.ts.
    //   - Plus aucune référence premium dans ce fichier (dropper aussi de la carte et de l'UI en E2.B/E2.C).
    // ============================================================
    {
      name: 'statut',
      type: 'select',
      options: [
        { label: 'Publié', value: 'publie' },
        { label: 'Suspendu', value: 'suspendu' },
      ],
      defaultValue: 'publie',
      required: true,
      index: true,
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Statut de visibilité de l\'événement.',
      },
    },
    // ============================================================
    // GÉO DU LIEU (colonne geom gérée hors Payload — hook syncGeom)
    // ============================================================
    {
      name: 'lieuLatitude',
      type: 'number',
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Latitude (auto-calculée par géocodage).',
      },
    },
    {
      name: 'lieuLongitude',
      type: 'number',
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Longitude (auto-calculée par géocodage).',
      },
    },
    seoField,
  ],
}
