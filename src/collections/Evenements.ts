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
import { revalidatePath } from 'next/cache'
import { isAdmin } from './access'
import { geocodeAddress } from '../lib/geocode'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'
import { stripEmojis } from '../lib/sanitize'
import { seoField } from './fields/seoField'
import { peutPublierEvenement, peutGererReseau } from '../lib/reseau-hierarchie'
import type { ReseauForHierarchy, UserForHierarchy } from '../lib/reseau-hierarchie'
import { estPlus } from '../lib/acces-plus'

// Champs texte protégés contre les emojis
const EVENEMENT_TEXT_FIELDS = [
  'titre',
  'lieuNom',
  'lieuAdresse',
  'lieuCodePostal',
  'lieuVille',
  'lieuDepartement',
  'descriptionCourte',
  'description',
  'intervenants',
  'tarif',
  'contactNom',
  'contactTelephone',
  'publicConcerne',
  'infosPratiques',
  'creePar',
  'lienInscription',
] as const

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
        req,
      })
      await req.payload.update({
        collection: 'reseaux',
        id: reseauId,
        data: { nbEvenements: totalDocs },
        overrideAccess: true,
        req,
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
            { 'organisateurReseauteur.user': { equals: user.id } },
            { creeParUser: { equals: user.id } },
          ],
        } as Where
      }
      return { statut: { equals: 'publie' } }
    },
    // Création : organisateur, réseauteur (Plus — vérifié dans le hook) ou admin.
    // Les vérifications ownership + statut payant sont faites dans le hook beforeValidate
    // (abonnement du national pour un réseau ; estPlus pour un réseauteur — ADR-0013 ;
    // Plus admin déclaré du groupe local pour un événement de groupe — décision 2026-07-16).
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return user.role === 'organisateur' || user.role === 'reseauteur'
    },
    // creeParUser : un réseauteur Plus gère les événements qu'il a créés POUR un groupe
    // local (reseau ≠ null, organisateurReseauteur = null) — sans toucher à ceux du
    // compte organisateur du réseau.
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return {
        or: [
          { 'reseau.user': { equals: user.id } },
          { 'organisateurReseauteur.user': { equals: user.id } },
          { creeParUser: { equals: user.id } },
        ],
      } as Where
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return {
        or: [
          { 'reseau.user': { equals: user.id } },
          { 'organisateurReseauteur.user': { equals: user.id } },
          { creeParUser: { equals: user.id } },
        ],
      } as Where
    },
  },
  hooks: {
    beforeValidate: [
      // ── Traçabilité/ownership : fige le compte créateur à la création (jamais le client).
      //    Sert de clé d'ownership pour les événements de groupe créés par un réseauteur
      //    Plus admin déclaré (reseau ≠ null, organisateurReseauteur = null).
      async ({ data, req, operation }) => {
        if (!data) return data
        if (operation === 'create' && req.user && req.user.role !== 'admin') {
          data.creeParUser = req.user.id
        }
        return data
      },
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
        const slugSet = new Set(existing.docs.map((d) => d.slug))
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
      // ── Invariant « exactement un organisateur » + gate Réseauteur Plus (ADR-0013).
      //
      // XOR : un événement a soit un réseau organisateur, soit un réseauteur organisateur —
      // jamais les deux, jamais aucun. Si la branche réseauteur est utilisée : le profil doit
      // appartenir à l'utilisateur ET le user (lu FRAIS — jamais le JWT) doit être Plus actif.
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        const resolveId = (v: unknown): number | string | null => {
          if (v == null) return null
          return typeof v === 'object' ? ((v as { id?: number | string }).id ?? null) : (v as number | string)
        }
        const effective = (key: 'reseau' | 'organisateurReseauteur'): number | string | null => {
          if (Object.prototype.hasOwnProperty.call(data, key)) return resolveId(data[key])
          return resolveId(originalDoc?.[key])
        }

        const reseauId = effective('reseau')
        const organisateurId = effective('organisateurReseauteur')

        // XOR — exactement un organisateur.
        if (reseauId != null && organisateurId != null) {
          throw new Error(
            'Un événement a un seul organisateur : un réseau OU un réseauteur, pas les deux.',
          )
        }
        if (reseauId == null && organisateurId == null) {
          throw new Error(
            'Un événement doit avoir un organisateur : sélectionnez un réseau ou un réseauteur.',
          )
        }

        // Branche réseauteur — ownership + gate Plus (admin exempté).
        if (organisateurId != null && req.user && req.user.role !== 'admin') {
          const incomingOrganisateur =
            operation === 'update' && Object.prototype.hasOwnProperty.call(data, 'organisateurReseauteur')
              ? resolveId(data.organisateurReseauteur)
              : undefined
          const originalOrganisateur = resolveId(originalDoc?.organisateurReseauteur)
          const organisateurChanged =
            operation === 'update' && incomingOrganisateur !== undefined &&
            String(incomingOrganisateur ?? '') !== String(originalOrganisateur ?? '')

          if (operation === 'create' || organisateurChanged) {
            // 1. Le profil réseauteur doit appartenir à l'utilisateur courant.
            const profil = await req.payload.findByID({
              collection: 'reseauteurs',
              id: organisateurId,
              depth: 0,
              overrideAccess: true,
            })
            const profilUserId = resolveId((profil as { user?: unknown }).user)
            if (profilUserId == null || String(profilUserId) !== String(req.user.id)) {
              throw new Error('Vous ne pouvez organiser un événement qu\'en votre propre nom.')
            }

            // 2. Gate Plus — lecture fraîche du user (le statut est posé serveur, jamais dans le JWT).
            const freshUser = await req.payload.findByID({
              collection: 'users',
              id: req.user.id,
              depth: 0,
              overrideAccess: true,
            })
            if (!estPlus(freshUser as { id: number | string; plusActif?: boolean | null; plusExpireAt?: string | null })) {
              throw new Error(
                'La création d\'événements est réservée aux réseauteurs Plus. ' +
                'Passez Plus depuis votre tableau de bord.',
              )
            }
          }
        }
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

            // ── Branche réseauteur PLUS propriétaire d'un réseau local (ADR-0014 —
            //    remplace l'« admin déclaré » adminReseaux de la décision 2026-07-16).
            //    Le Plus actif + la PROPRIÉTÉ du local remplacent le gate d'abonnement
            //    du national (même pour un local affilié) : c'est l'abonnement Plus
            //    qui ouvre la publication.
            if (req.user.role === 'reseauteur') {
              if ((reseau as { niveau?: string }).niveau !== 'local') {
                throw new Error(
                  'Vous ne pouvez créer un événement que pour un réseau local dont vous êtes propriétaire.',
                )
              }
              const freshUser = await req.payload.findByID({
                collection: 'users',
                id: req.user.id,
                depth: 0,
                overrideAccess: true,
              })
              if (!estPlus(freshUser as { id: number | string; plusActif?: boolean | null; plusExpireAt?: string | null })) {
                throw new Error(
                  'La création d\'événements est réservée aux réseauteurs Plus. ' +
                  'Passez Plus depuis votre tableau de bord.',
                )
              }
              const reseauUser = (reseau as { user?: unknown }).user
              const reseauUserId =
                typeof reseauUser === 'object' && reseauUser !== null
                  ? (reseauUser as { id?: number | string }).id
                  : (reseauUser as number | string | null | undefined)
              if (reseauUserId == null || String(reseauUserId) !== String(req.user.id)) {
                throw new Error(
                  'Vous ne pouvez créer un événement que pour un réseau local dont vous êtes propriétaire. ' +
                  'Créez votre réseau depuis votre espace « Mes réseaux ».',
                )
              }
              return data
            }

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
              req,
            })
            await req.payload.update({
              collection: 'reseaux',
              id: reseauId as string | number,
              data: { nbEvenements: totalDocs },
              overrideAccess: true,
              req,
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
    // ORGANISATEUR — réseau XOR réseauteur (ADR-0013, gate P0 D1)
    // Invariant « exactement un organisateur » garanti par le hook beforeValidate.
    // ============================================================
    {
      name: 'reseau',
      type: 'relationship',
      relationTo: 'reseaux',
      // ADR-0013 : optionnel — un événement peut être organisé par un réseauteur Plus.
      index: true,
      label: 'Réseau organisateur',
      admin: {
        description: 'Réseau qui organise cet événement (exclusif avec « Réseauteur organisateur »).',
      },
    },
    {
      name: 'organisateurReseauteur',
      type: 'relationship',
      relationTo: 'reseauteurs',
      index: true,
      label: 'Réseauteur organisateur',
      admin: {
        description:
          '[ADR-0013] Réseauteur Plus qui organise cet événement (exclusif avec « Réseau organisateur »).',
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
      // Aligné sur la contrainte DB (type_id NOT NULL) : sans required, un create sans
      // catégorie échouait en erreur SQL brute au lieu d'une validation Payload propre.
      required: true,
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
    {
      name: 'lieuDepartement',
      type: 'text',
      label: 'Département',
      index: true,
      admin: { description: 'Ex : Rhône, Paris, Gironde. Utilisé pour le filtre par département.' },
    },
    // ============================================================
    // DESCRIPTION ET LIEN D'INSCRIPTION EXTERNE
    // (RÉSEAUTEURS n'organise pas — l'inscription est sur le site du réseau)
    // ============================================================
    {
      name: 'descriptionCourte',
      type: 'textarea',
      label: 'Description courte (2 à 3 lignes)',
      admin: { description: 'Résumé affiché en tête de fiche et dans les listes.' },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description détaillée',
    },
    {
      name: 'intervenants',
      type: 'textarea',
      label: 'Intervenant(s)',
      admin: { description: 'Nom(s) et qualité des intervenants (si applicable).' },
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
    // ── Contact organisateur (facultatif — pour cet événement)
    {
      name: 'contactNom',
      type: 'text',
      label: 'Nom du contact',
    },
    {
      name: 'contactEmail',
      type: 'email',
      label: 'Email du contact',
    },
    {
      name: 'contactTelephone',
      type: 'text',
      label: 'Téléphone du contact',
    },
    // ============================================================
    // MÉDIAS
    // ============================================================
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Visuel / affiche',
    },
    {
      name: 'galerie',
      type: 'array',
      maxRows: 10,
      label: 'Photos (galerie)',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    // ============================================================
    // CATÉGORISATION (pour recherche et affichage)
    // ============================================================
    {
      name: 'publicConcerne',
      type: 'text',
      label: 'Public concerné',
      admin: { description: 'Ex : entrepreneurs, dirigeants, indépendants, commerciaux, étudiants, tous…' },
    },
    {
      name: 'secteur',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
      label: 'Secteur d\'activité concerné',
      admin: { description: 'Secteur principal concerné (facultatif).' },
    },
    {
      name: 'niveauPublic',
      type: 'select',
      label: 'Niveau',
      options: [
        { label: 'Débutant', value: 'debutant' },
        { label: 'Confirmé', value: 'confirme' },
        { label: 'Tous', value: 'tous' },
      ],
    },
    // ============================================================
    // PARTICIPATION (spécifique à cet événement)
    // ============================================================
    {
      name: 'gratuit',
      type: 'checkbox',
      defaultValue: true,
      label: 'Événement gratuit',
      index: true,
      admin: { description: 'Décochez si l\'événement est payant, puis renseignez le tarif.' },
    },
    {
      name: 'tarif',
      type: 'text',
      label: 'Tarif',
      admin: {
        description: 'Ex : « 25 € », « gratuit pour les membres, 15 € invités ». Affiché si l\'événement est payant.',
        condition: (data) => data?.gratuit === false,
      },
    },
    {
      name: 'nombrePlaces',
      type: 'number',
      min: 0,
      label: 'Nombre de places (facultatif)',
    },
    {
      name: 'dateLimiteInscription',
      type: 'date',
      label: 'Date limite d\'inscription',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'ouvertATous',
      type: 'select',
      label: 'Ouvert à tous ?',
      options: [{ label: 'Oui', value: 'oui' }, { label: 'Non', value: 'non' }],
    },
    {
      name: 'reserveMembres',
      type: 'select',
      label: 'Réservé aux membres ?',
      options: [{ label: 'Oui', value: 'oui' }, { label: 'Non', value: 'non' }],
    },
    {
      name: 'participationInvite',
      type: 'select',
      label: 'Participation en tant qu\'invité possible ?',
      options: [{ label: 'Oui', value: 'oui' }, { label: 'Non', value: 'non' }],
    },
    // ============================================================
    // INFORMATIONS PRATIQUES
    // ============================================================
    {
      name: 'parking',
      type: 'checkbox',
      defaultValue: false,
      label: 'Parking disponible',
    },
    {
      name: 'accesPmr',
      type: 'checkbox',
      defaultValue: false,
      label: 'Accès PMR',
    },
    {
      name: 'infosPratiques',
      type: 'textarea',
      label: 'Informations complémentaires',
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
    {
      name: 'creePar',
      type: 'text',
      label: 'Créé par',
      admin: {
        position: 'sidebar',
        description: 'Nom de la personne ayant créé l\'événement (traçabilité).',
      },
    },
    {
      name: 'creeParUser',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'Créé par (compte)',
      access: { update: isAdmin },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Compte ayant créé l\'événement (figé serveur à la création). Ownership des événements ' +
          'de groupe créés par un réseauteur Plus admin déclaré (décision 2026-07-16).',
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
