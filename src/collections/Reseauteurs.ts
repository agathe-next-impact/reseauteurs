/**
 * Reseauteurs.ts — Collection principale : la personne qui réseaute (ADR-0011 §1 ; ADR-0012 E1.4).
 *
 * Échafaudage cloné depuis Reseaux.ts (plan directeur : slug figé, syncGeom PostGIS,
 * géocodage, seoField, statut de modération, field-access).
 *
 * Différences clés vs Reseaux :
 *   - Entité PERSONNE (prénom/nom, non raison sociale)
 *   - Slug = /reseauteur/<prenom-nom>, collision → suffixe -2, -3, … (déterministe)
 *   - geom = centroïde VILLE par défaut (pas adresse exacte — RGPD ADR-0011 §7)
 *   - Badge déclaratif dérivé de evenementsParMois (lib/badge.ts)
 *   - Relation M2M vers `reseaux` (réseaux fréquentés, LOCAUX UNIQUEMENT — ADR-0012 E1.4)
 *   - Statut de modération : en_attente / valide / suspendu
 *   - noindex forcé jusqu'à validation (RGPD opt-out personnes physiques)
 *   - 1 user `reseauteur` = 1 reseauteur (auto-créé au signup — Users.ts hook)
 *
 * Affiliation (décision 2026-07-17 — amende ADR-0012 E1.4) :
 *   - `reseauxFrequentes` accepte les TÊTES de réseau (annuaire national) comme les
 *     groupes locaux. Pour un local, le national reste dérivé à la lecture
 *     (lib/reseau-hierarchie.ts — nationalDe) ; une tête est sa propre tête.
 */

import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { revalidatePath } from 'next/cache'
import { isAdmin } from './access'
import { geocodeAddress } from '../lib/geocode'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'
import { stripEmojis } from '../lib/sanitize'
import { seoField } from './fields/seoField'
import { deriverBadge } from '../lib/badge'

/** [Dormant — ADR-0014] Borne du champ adminReseaux conservé en DB (ancien « admin déclaré »). */
export const MAX_ADMIN_RESEAUX = 3

// Champs texte sur lesquels les emojis sont interdits
const RESEAUTEUR_TEXT_FIELDS = [
  'prenom',
  'nom',
  'entreprise',
  'fonction',
  'ville',
  'departement',
  'region',
  'telephone',
  'emailContact',
  'site',
  'linkedin',
] as const

/** Slugifie un libellé (minuscules, sans accents, tirets). */
const toSlug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Recalcule le compteur nbReseauteurs des réseaux affectés.
 * Déclenché quand reseauxFrequentes change.
 */
const updateReseauxCompteurs: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (process.env.SEED_DEV === 'true') return doc
  // Collecte les IDs de réseaux impactés (ajoutés ou retirés)
  const extractIds = (rels: unknown): Set<string | number> => {
    const ids = new Set<string | number>()
    if (!Array.isArray(rels)) return ids
    for (const r of rels) {
      const id = typeof r === 'object' && r !== null ? (r as { id?: string | number }).id : r
      if (id != null) ids.add(id)
    }
    return ids
  }

  const prevIds = extractIds(previousDoc?.reseauxFrequentes)
  const newIds = extractIds(doc.reseauxFrequentes)
  const affected = new Set([...prevIds, ...newIds])

  for (const reseauId of affected) {
    try {
      const { totalDocs } = await req.payload.count({
        collection: 'reseauteurs',
        where: {
          reseauxFrequentes: { contains: reseauId },
          statut: { equals: 'valide' },
        },
        overrideAccess: true,
        req,
      })
      await req.payload.update({
        collection: 'reseaux',
        id: reseauId as string | number,
        data: { nbReseauteurs: totalDocs },
        overrideAccess: true,
        req,
      })
    } catch (err) {
      console.error(`[Reseauteurs afterChange] updateReseauxCompteurs failed for reseau ${reseauId}:`, err)
    }
  }
  return doc
}

export const Reseauteurs: CollectionConfig = {
  slug: 'reseauteurs',
  admin: {
    useAsTitle: 'nom',
    defaultColumns: ['prenom', 'nom', 'entreprise', 'ville', 'badge', 'statut'],
    group: 'Contenu',
    description: 'Personnes inscrites sur la plateforme (profil public, carte des réseauteurs).',
  },
  access: {
    // Lecture : public si valide ; propriétaire ; admin
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) {
        return {
          or: [
            { statut: { equals: 'valide' } } as Record<string, unknown>,
            { user: { equals: user.id } } as Record<string, unknown>,
          ],
        } as import('payload').Where
      }
      return { statut: { equals: 'valide' } }
    },
    // Création : tout utilisateur connecté (garde 1 user = 1 reseauteur dans beforeValidate)
    // Création réservée à l'admin : le profil est auto-créé en squelette par le hook
    // afterChange de Users (overrideAccess), jamais par l'utilisateur via l'API générique.
    // Ferme l'usurpation de fiche (C2 : Reseauteurs.user assignable à un tiers au create).
    create: isAdmin,
    // Mise à jour : propriétaire ou admin
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } } as import('payload').Where
    },
    // Suppression : admin uniquement
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeValidate: [
      // ── Slug = /reseauteur/<prénom-nom>, dérivé des CHAMPS STRUCTURÉS prénom+nom
      //    (jamais du placeholder `nomSociete` du squelette d'inscription).
      //
      //    À l'inscription, le profil est un SQUELETTE (prénom vide, statut en_attente) :
      //    on ne fige AUCUN slug tant que prénom+nom ne sont pas renseignés (slug reste
      //    NULL — l'index unique tolère NULL). Le slug est généré au moment où le
      //    réseauteur complète prénom+nom (depuis le dashboard), puis FIGÉ dès que le
      //    profil devient public (statut 'valide') — contrat SEO ADR-0005.
      //
      //    Collision → suffixe -2, -3, … (déterministe, jamais Date.now()).
      async ({ data, req, originalDoc }) => {
        if (!data) return data
        const orig = originalDoc as
          | { slug?: string; statut?: string; prenom?: string; nom?: string; ville?: string; id?: number | string }
          | undefined

        // 1. Profil DÉJÀ public → slug figé : ne jamais le changer (même si prénom/nom sont édités).
        if (orig?.statut === 'valide' && orig.slug) {
          data.slug = orig.slug
          return data
        }
        // 2. Slug explicitement fourni (import/admin) et pas encore figé → le respecter.
        if (data.slug) return data

        // 3. (Re)génération depuis prénom + nom structurés, dès qu'ils sont disponibles.
        const prenom = toSlug(String(data.prenom ?? orig?.prenom ?? ''))
        const nom = toSlug(String(data.nom ?? orig?.nom ?? ''))
        if (!prenom || !nom) return data // squelette incomplet → slug reste NULL

        const baseSlug = `${prenom}-${nom}`
        const existing = await req.payload.find({
          collection: 'reseauteurs',
          where: { slug: { like: `${baseSlug}%` } },
          limit: 100,
          overrideAccess: true,
          select: { slug: true } as Record<string, boolean>,
        })
        // Exclut le doc courant (une régénération ne doit pas entrer en collision avec lui-même).
        const slugSet = new Set(
          existing.docs
            .filter((d) => String(d.id) !== String(orig?.id ?? ''))
            .map((d) => d.slug),
        )
        if (!slugSet.has(baseSlug)) {
          data.slug = baseSlug
        } else {
          let suffix = 2
          let candidate = `${baseSlug}-${suffix}`
          while (slugSet.has(candidate) && suffix < 50) {
            suffix++
            candidate = `${baseSlug}-${suffix}`
          }
          if (suffix >= 50) {
            const ville = toSlug(String(data.ville ?? orig?.ville ?? ''))
            candidate = ville ? `${baseSlug}-${ville}` : `${baseSlug}-${suffix}`
          }
          data.slug = candidate
        }
        return data
      },
      // ── Garde 1 user = 1 reseauteur
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        if (!req.user || req.user.role === 'admin') return data
        const { totalDocs } = await req.payload.count({
          collection: 'reseauteurs',
          where: { user: { equals: req.user.id } },
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error('Un profil réseauteur existe déjà pour ce compte.')
        }
        return data
      },
    ],
    beforeChange: [
      // ── Auto-publication (modération admin SUPPRIMÉE) : un profil `en_attente`
      //    se publie tout seul dès qu'il est complété (prénom + nom renseignés).
      //    Aucune validation admin requise. L'admin conserve la main sur le statut
      //    (ex. 'suspendu' pour retirer un profil abusif) : on ne l'écrase pas.
      async ({ data, originalDoc, req }) => {
        if (req.user?.role === 'admin' && data.statut) return data
        const current = data.statut ?? originalDoc?.statut
        if (current === 'en_attente') {
          const prenom = String(data.prenom ?? originalDoc?.prenom ?? '').trim()
          const nom = String(data.nom ?? originalDoc?.nom ?? '').trim()
          if (prenom && nom) {
            data.statut = 'valide'
            // Devient public → indexable (le hook noindex ci-dessous ne force le
            // noindex que pour en_attente/suspendu ; il ne le lève pas de lui-même).
            data.seo = { ...(data.seo ?? originalDoc?.seo ?? {}), noindex: false }
          }
        }
        return data
      },
      // ── Strip emojis (filet serveur)
      async ({ data }) => {
        for (const field of RESEAUTEUR_TEXT_FIELDS) {
          const v = data[field]
          if (typeof v === 'string') data[field] = stripEmojis(v)
        }
        return data
      },
      // ── Affiliation (reseauxFrequentes) — décision 2026-07-17 : ouverte aux TÊTES
      //    de réseau comme aux groupes locaux (l'annuaire des 200 nationaux « nom seul »
      //    doit être sélectionnable). L'ancien refus des têtes (ADR-0012 E1.4) est caduc ;
      //    le national d'un local reste dérivé à la lecture (nationalDe).
      // ── Participation aux événements : scope serveur (jamais confiance au client).
      //    On ne garde que les événements PUBLIÉS dont le réseau organisateur fait
      //    partie des réseaux fréquentés du réseauteur. Les entrées hors-scope sont
      //    filtrées silencieusement. L'admin n'est pas restreint.
      async ({ data, originalDoc, req }) => {
        if (req.user?.role === 'admin') return data
        const raw = data.evenementsParticipes
        if (!Array.isArray(raw)) return data // champ non modifié → on ne touche pas
        const eventIds = raw
          .map((r) => (typeof r === 'object' && r !== null ? (r as { id?: unknown }).id : r))
          .filter((v) => v != null)
        if (eventIds.length === 0) {
          data.evenementsParticipes = []
          return data
        }
        const reseauxRaw = data.reseauxFrequentes ?? originalDoc?.reseauxFrequentes ?? []
        const reseauIds = new Set(
          (Array.isArray(reseauxRaw) ? reseauxRaw : []).map((r) =>
            String(typeof r === 'object' && r !== null ? (r as { id?: unknown }).id : r),
          ),
        )
        if (reseauIds.size === 0) {
          data.evenementsParticipes = []
          return data
        }
        const { docs: evs } = await req.payload.find({
          collection: 'evenements',
          where: { id: { in: eventIds } },
          depth: 0,
          limit: 500,
          overrideAccess: true,
          req,
          select: { statut: true, reseau: true } as Record<string, boolean>,
        })
        const allowed = new Set(
          evs
            .filter((e) => {
              const reseauId = String(
                typeof e.reseau === 'object' && e.reseau !== null ? (e.reseau as { id?: unknown }).id : e.reseau,
              )
              return e.statut === 'publie' && reseauIds.has(reseauId)
            })
            .map((e) => String(e.id)),
        )
        data.evenementsParticipes = eventIds.filter((id) => allowed.has(String(id)))
        return data
      },
      // ── Dérivation du badge depuis evenementsParMois
      async ({ data }) => {
        if (data.evenementsParMois !== undefined) {
          const badge = deriverBadge(data.evenementsParMois)
          if (badge !== null) data.badge = badge
        }
        return data
      },
      // ── noindex forcé si statut non validé (RGPD — personnes physiques)
      async ({ data }) => {
        if (!data.seo) data.seo = {}
        const statut = data.statut
        if (statut === 'en_attente' || statut === 'suspendu') {
          data.seo = { ...data.seo, noindex: true }
        }
        // Si validation → on laisse le réseauteur gérer son noindex (défaut false)
        return data
      },
      // ── Géocodage automatique du centroïde VILLE (pas d'adresse exacte — RGPD)
      async ({ data, originalDoc }) => {
        if (process.env.SEED_DEV === 'true') return data
        const villeChanged = data.ville !== originalDoc?.ville
        if (villeChanged && data.ville && (data.latitude == null || data.longitude == null)) {
          // Géocodage de la ville seule (centroïde commune) — pas de l'adresse
          const result = await geocodeAddress(undefined, undefined, data.ville)
          if (result) {
            data.latitude = result.latitude
            data.longitude = result.longitude
          }
        }
        return data
      },
    ],
    afterChange: [
      cleanupOrphanedMediaOnChange,
      updateReseauxCompteurs,
      // ── Revalidation ISR
      ({ doc }) => {
        try {
          revalidatePath('/api/geo/reseauteurs')
          if (doc?.slug) revalidatePath(`/reseauteur/${doc.slug}`, 'page')
          revalidatePath('/reseauteurs', 'page')
        } catch {
          // Peut échouer hors contexte request (cron, scripts)
        }
        return doc
      },
    ],
    afterDelete: [
      cleanupMediaOnDelete,
      () => {
        try {
          revalidatePath('/api/geo/reseauteurs')
          revalidatePath('/reseauteurs', 'page')
        } catch { /* hors contexte */ }
      },
    ],
  },
  fields: [
    // ============================================================
    // PROPRIÉTÉ (1 user = 1 reseauteur)
    // ============================================================
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      unique: true,
      index: true,
      access: {
        // Seul l'admin peut assigner/réassigner la propriété
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Compte propriétaire (1 user = 1 réseauteur).',
      },
    },
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
        description: 'Généré depuis prénom+nom à la création ; figé ensuite (contrat SEO — ADR-0005).',
      },
    },
    {
      name: 'prenom',
      type: 'text',
      label: 'Prénom',
      // `required` CONDITIONNEL (et non `required: true`) : à l'inscription, le
      // profil est auto-créé en SQUELETTE (statut 'en_attente', prénom vide) puis
      // complété depuis le dashboard (cf. Users.ts afterChange l.311-341). Un
      // `required: true` rigide fait échouer cette auto-création → rollback de la
      // transaction d'inscription → le compte n'est jamais persisté (bug 500/200
      // silencieux). Le prénom (re)devient obligatoire dès que le profil quitte
      // 'en_attente' (validation/publication) : aucune fiche publique sans prénom.
      validate: (value: unknown, { siblingData }: { siblingData?: { statut?: string } }) => {
        const statut = siblingData?.statut
        if (statut !== 'en_attente' && (!value || String(value).trim() === '')) {
          return 'Le prénom est obligatoire pour publier le profil.'
        }
        return true
      },
    },
    {
      name: 'nom',
      type: 'text',
      required: true,
      label: 'Nom',
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Photo de profil',
    },
    {
      name: 'fonction',
      type: 'text',
      label: 'Fonction / poste',
    },
    {
      name: 'entreprise',
      type: 'text',
      label: 'Entreprise',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Présentation',
      admin: {
        description: 'Description libre affichée sur la fiche publique.',
      },
    },
    // ============================================================
    // CONTACTS (FACULTATIFS — contrôle de confidentialité du réseauteur)
    // Le fait de ne pas renseigner = ne pas partager. Pas de double geom.
    // ============================================================
    {
      name: 'telephone',
      type: 'text',
      label: 'Téléphone (facultatif)',
      admin: {
        description: 'Laissez vide pour ne pas partager votre téléphone.',
      },
    },
    {
      name: 'emailContact',
      type: 'email',
      label: 'Email de contact (facultatif)',
      admin: {
        description: 'Laissez vide pour ne pas partager votre email publiquement.',
      },
    },
    {
      name: 'site',
      type: 'text',
      label: 'Site web',
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
    {
      name: 'linkedin',
      type: 'text',
      label: 'Profil LinkedIn',
      admin: {
        description: 'URL complète de votre profil LinkedIn.',
      },
      validate: (value: unknown) => {
        if (!value || typeof value !== 'string') return true
        if (!value.includes('linkedin.com')) return 'L\'URL doit être un profil LinkedIn.'
        return true
      },
    },
    // ============================================================
    // LOCALISATION (ville/département/région — pas d'adresse exacte)
    // ============================================================
    {
      name: 'ville',
      type: 'text',
      required: true,
      label: 'Ville',
      index: true,
    },
    {
      name: 'departement',
      type: 'text',
      label: 'Département',
      index: true,
      admin: {
        description: 'Ex : Puy-de-Dôme, Rhône, Paris.',
      },
    },
    {
      name: 'region',
      type: 'text',
      label: 'Région',
      index: true,
      admin: {
        description: 'Ex : Auvergne-Rhône-Alpes, Île-de-France.',
      },
    },
    // ============================================================
    // SECTEUR ET COMPÉTENCES
    // ============================================================
    {
      name: 'secteur',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
      label: 'Secteur d\'activité',
      admin: {
        description: 'Secteur principal du réseauteur.',
      },
    },
    {
      name: 'competences',
      type: 'array',
      label: 'Compétences',
      maxRows: 20,
      admin: {
        description: 'Compétences clés (max 20). Utilisées pour la recherche par profil.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Compétence',
        },
      ],
    },
    // ============================================================
    // RÉSEAUX FRÉQUENTÉS (M2M vers reseaux — têtes OU groupes locaux)
    // Décision 2026-07-17 (amende ADR-0012 E1.4) : les têtes de réseau de
    // l'annuaire national sont sélectionnables directement. Pour un local,
    // le national reste dérivé à la lecture (nationalDe) — non stocké.
    // ============================================================
    {
      name: 'reseauxFrequentes',
      type: 'relationship',
      relationTo: 'reseaux',
      hasMany: true,
      label: 'Réseaux fréquentés',
      index: true,
      admin: {
        description:
          'Réseaux d\'affaires que vous fréquentez — réseau national (ex : BNI France) ' +
          'ou groupe local (ex : DCF Lyon). Multi-sélection.',
      },
    },
    // ============================================================
    // GROUPES ADMINISTRÉS — [DORMANT depuis ADR-0014 (2026-07-17)]
    // L'« admin déclaré » est remplacé par la PROPRIÉTÉ des réseaux locaux
    // (reseaux.user — espace « Mes réseaux » du réseauteur Plus). Champ conservé
    // en DB (pas de migration destructive), plus lu par aucun gate ni aucune UI.
    // ============================================================
    {
      name: 'adminReseaux',
      type: 'relationship',
      relationTo: 'reseaux',
      hasMany: true,
      maxRows: MAX_ADMIN_RESEAUX,
      label: 'Groupes administrés [dormant]',
      index: true,
      admin: {
        hidden: true,
        description:
          '[Dormant — ADR-0014] Ancien mécanisme « admin déclaré », remplacé par la propriété des réseaux locaux (reseaux.user).',
      },
    },
    // ============================================================
    // PARTICIPATION AUX ÉVÉNEMENTS (M2M — réseauteur ↔ événements)
    // Le réseauteur signale sa présence aux événements des réseaux qu'il fréquente.
    // Le scope (réseau organisateur ∈ réseaux fréquentés, statut publié) est
    // garanti côté serveur par un hook beforeChange — jamais confiance au client.
    // ============================================================
    {
      name: 'evenementsParticipes',
      type: 'relationship',
      relationTo: 'evenements',
      hasMany: true,
      label: 'Événements auxquels je participe',
      index: true,
      filterOptions: {
        // UI-only : ne proposer que les événements publiés (le hook serveur est le garde).
        statut: { equals: 'publie' },
      },
      admin: {
        description:
          'Événements des réseaux que vous fréquentez auxquels vous signalez votre présence. ' +
          'Affiché sur votre fiche publique et sur la fiche de chaque événement.',
      },
    },
    // ============================================================
    // BADGE (déclaratif, dérivé de evenementsParMois)
    // ============================================================
    {
      name: 'evenementsParMois',
      type: 'number',
      required: true,
      min: 0,
      label: 'Nombre d\'événements de networking par mois',
      admin: {
        description: 'Question obligatoire à l\'inscription. Détermine votre badge (Bronze/Argent/Gold/Platinum).',
      },
    },
    {
      name: 'badge',
      type: 'select',
      options: [
        { label: 'Bronze (0–1 événement/mois)', value: 'bronze' },
        { label: 'Argent (2–5 événements/mois)', value: 'argent' },
        { label: 'Gold (6–10 événements/mois)', value: 'gold' },
        { label: 'Platinum (plus de 10 événements/mois)', value: 'platinum' },
      ],
      index: true,
      access: {
        // Seul l'admin peut forcer le badge manuellement (sinon auto-dérivé)
        update: isAdmin,
      },
      admin: {
        description: 'Auto-dérivé depuis "événements par mois". Ne pas modifier manuellement sauf exception.',
        position: 'sidebar',
      },
    },
    // ============================================================
    // GÉO — centroïde ville (pas d'adresse exacte — RGPD ADR-0011 §7)
    // La colonne geom geography(Point,4326) est gérée hors Payload (migration DDL)
    // et alimentée par le hook syncGeom via la route de géocodage data.gouv.
    // ============================================================
    {
      name: 'latitude',
      type: 'number',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Latitude du centroïde ville (auto-calculée par géocodage).',
      },
    },
    {
      name: 'longitude',
      type: 'number',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Longitude du centroïde ville (auto-calculée par géocodage).',
      },
    },
    // ============================================================
    // STATUT DE MODÉRATION
    // ============================================================
    {
      name: 'statut',
      type: 'select',
      options: [
        { label: 'En attente', value: 'en_attente' },
        { label: 'Validé', value: 'valide' },
        { label: 'Suspendu', value: 'suspendu' },
      ],
      defaultValue: 'en_attente',
      required: true,
      index: true,
      access: {
        // Seul l'admin peut valider ou suspendre / forcer le badge
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Statut de modération. Seuls les profils validés sont visibles sur la carte et dans le sitemap.',
      },
    },
    seoField,
  ],
}
