import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { revalidatePath } from 'next/cache'
import { isAdmin, canCreateNational } from './access'
import { geocodeAddress } from '../lib/geocode'
import { cleanupOrphanedMediaOnChange, cleanupMediaOnDelete } from '../lib/media-cleanup'
import { ficheRejectedEmail } from '../lib/emails'
import { sendEmail } from '../lib/email-sender'
import { stripEmojis } from '../lib/sanitize'
import { seoField } from './fields/seoField'
import { peutCreerLocalAsync, PALIERS_OPTIONS } from '../lib/reseau-hierarchie'

// Champs texte sur lesquels les emojis sont interdits.
// Mirror côté client : ReseauEditForm.stripEmojiOnInput.
const RESEAU_TEXT_FIELDS = [
  'nom',
  'ville',
  'adresse',
  'codePostal',
  'departement',
  'region',
  'siteWeb',
  'emailContact',
  'telephone',
  'responsableNom',
  'responsableFonction',
  'description',
  'objectif',
  'differenciateur',
  'publicConcerne',
  'cotisation',
  'rempliPar',
  'videoYoutube',
] as const

/**
 * Notifie le propriétaire du réseau quand un admin passe le statut à 'suspendue'.
 * Ne se déclenche que sur la transition (pas sur les re-saves d'un réseau déjà suspendu).
 */
const notifyOnSuspension: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update') return doc
  if (doc.statut !== 'suspendue') return doc
  if (previousDoc?.statut === 'suspendue') return doc

  try {
    const userId = typeof doc.user === 'object' && doc.user !== null
      ? (doc.user as { id: number | string }).id
      : (doc.user as number | string | undefined)
    if (!userId) return doc

    const owner = await req.payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
    await sendEmail({
      payload: req.payload,
      kind: 'fiche-rejected',
      to: owner.email,
      subject: 'RÉSEAUTEURS — Votre réseau a été suspendu',
      html: ficheRejectedEmail(owner.nomSociete),
      userId: owner.id,
    })
  } catch (err) {
    console.error('[Reseaux afterChange] Impossible de notifier le propriétaire de la suspension:', err)
  }
  return doc
}

export const Reseaux: CollectionConfig = {
  slug: 'reseaux',
  admin: {
    useAsTitle: 'nom',
    defaultColumns: ['nom', 'niveau', 'ville', 'partenaire', 'statut'],
    group: 'Contenu',
  },
  access: {
    // Lecture : public pour les fiches publiées + propriétaire + admin.
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) {
        return {
          or: [
            { statut: { equals: 'publiee' } } as Record<string, unknown>,
            { user: { equals: user.id } } as Record<string, unknown>,
          ],
        } as import('payload').Where
      }
      return { statut: { equals: 'publiee' } }
    },
    // Création réservée à l'admin : la tête d'un organisateur est auto-créée par le hook
    // afterChange de Users, les groupes locaux via /dashboard/locaux et la délégation
    // admin — tous en overrideAccess. Aucun create utilisateur-contexte légitime → on ferme
    // l'API générique (C3 : partenaire/niveau posés au create via POST /api/reseaux).
    create: isAdmin,
    // Mise à jour : propriétaire direct OU umbrella (national → ses locaux) OU admin.
    // La règle umbrella (national gère ses locaux délégués) est enforced via le hook
    // beforeChange ; l'access layer couvre propriétaire direct et nationaux auto-gérés.
    // E2 affinera avec un pre-query async si nécessaire.
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    // Suppression : admin uniquement (garde-fou — empêche la perte d'occurrences).
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeValidate: [
      // Génération du slug depuis le nom à la CRÉATION uniquement.
      // Le slug est figé ensuite (contrat SEO — ADR-0005).
      async ({ data, req, operation }) => {
        if (!data?.nom) return data
        if (operation !== 'create') return data
        if (data.slug) return data

        let slug = String(data.nom)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        if (!slug) slug = 'reseau-sans-nom'

        // Vérification d'unicité — suffixe -<id> si collision
        const existing = await req.payload.find({
          collection: 'reseaux',
          where: { slug: { equals: slug } },
          limit: 1,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          // Suffixe déterministe (jamais Date.now() — SEO stable, ADR-0005)
          const allSlugs = await req.payload.find({
            collection: 'reseaux',
            where: { slug: { like: `${slug}%` } },
            limit: 100,
            overrideAccess: true,
            select: { slug: true } as Record<string, boolean>,
          })
          const slugSet = new Set(allSlugs.docs.map((d) => d.slug))
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
    ],
    beforeChange: [
      // Strip des emojis — filet de sécurité côté serveur.
      async ({ data }) => {
        for (const field of RESEAU_TEXT_FIELDS) {
          const v = data[field]
          if (typeof v === 'string') data[field] = stripEmojis(v)
        }
        if (Array.isArray(data.reseauxSociaux)) {
          data.reseauxSociaux = data.reseauxSociaux.map((s: { plateforme?: string; url?: string }) => ({
            ...s,
            url: typeof s?.url === 'string' ? stripEmojis(s.url) : s?.url,
          }))
        }
        return data
      },
      // ── Validation de la hiérarchie tête/locale (ADR-0012 E1.1 ; ADR-0014)
      // Règles : tête → jamais de parent ; local → parent FACULTATIF (vide = réseau
      // local indépendant) ; s'il est fourni, le parent doit être une tête (2 étages max).
      async ({ data, req, operation, originalDoc }) => {
        // Niveau effectif : un update partiel (édition de fiche) ne transmet ni niveau
        // ni parent — on retombe sur le document existant, sinon un local tombait à
        // tort dans la branche « tête » et son parent était effacé silencieusement.
        const niveau = (data.niveau ?? originalDoc?.niveau ?? 'national') as string

        // TÊTE de réseau (régional/national/international) → jamais de parent.
        if (niveau !== 'local') {
          if (data.parent !== undefined && data.parent !== null && data.parent !== '') {
            throw new Error(
              'Une tête de réseau (régional/national/international) ne peut pas avoir de réseau parent. ' +
              'Retirez le champ parent ou passez le niveau à "local".',
            )
          }
          // Ne forcer parent=null qu'à la création ou quand la hiérarchie est
          // explicitement transmise — un update partiel ne doit pas y toucher.
          if (operation === 'create' || data.niveau !== undefined || data.parent !== undefined) {
            data.parent = null
          }
        }

        // GROUPE local → parent facultatif (ADR-0014 : réseau local indépendant).
        // S'il est fourni, il doit exister et être une tête.
        if (niveau === 'local' && data.parent != null && data.parent !== '') {
          const parentId = typeof data.parent === 'object' ? (data.parent as { id?: unknown }).id : data.parent
          const parent = await req.payload.findByID({
            collection: 'reseaux',
            id: parentId as string | number,
            depth: 0,
            overrideAccess: true,
          })
          if (!parent) {
            throw new Error('Le réseau parent spécifié est introuvable.')
          }
          if ((parent.niveau ?? 'national') === 'local') {
            throw new Error(
              'Le réseau parent doit être une tête de réseau (régional/national/international) — hiérarchie à 2 étages. ' +
              'Un réseau local ne peut pas être parent d\'un autre local.',
            )
          }
        }

        return data
      },
      // ── Vérification unicité national / capacité de création de local (ADR-0012 E1.2)
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        if (!req.user || req.user.role === 'admin') return data

        const niveau = (data.niveau ?? 'national') as string

        // Toute TÊTE (régional/national/international) est soumise à l'unicité « 1 tête par compte ».
        if (niveau !== 'local') {
          const allowed = await canCreateNational(req)
          if (!allowed) {
            throw new Error(
              'Vous possédez déjà une tête de réseau. ' +
              'Une seule tête de réseau (régional/national/international) par compte est autorisée.',
            )
          }
        } else if (niveau === 'local') {
          const result = await peutCreerLocalAsync(req.user.id, req.payload as Parameters<typeof peutCreerLocalAsync>[1])
          if (!result.autorise) {
            throw new Error(result.raison ?? 'Vous ne pouvez pas créer ce réseau local.')
          }
        }
        return data
      },
      // Validation de la vidéo YouTube.
      async ({ data }) => {
        if (!data.videoYoutube) return data
        const patterns = [
          /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
          /^https?:\/\/youtu\.be\/[\w-]+/,
          /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
        ]
        if (!patterns.some((p) => p.test(String(data.videoYoutube)))) {
          throw new Error('Le lien vidéo doit être une URL YouTube valide.')
        }
        return data
      },
      // Géocodage automatique si l'adresse change.
      //
      // Corrigé le 2026-07-22 : l'ancienne condition exigeait AUSSI que les coordonnées
      // soient absentes, donc renommer/déplacer un réseau DÉJÀ géocodé laissait son
      // marqueur à l'ancienne ville (visible depuis « Mes groupes » : un national édite
      // la ville d'un groupe, la fiche change mais pas la carte).
      //
      // On re-géocode désormais dès que l'adresse effective change, ou si les
      // coordonnées manquent. Seule exception : l'écriture fournit elle-même des
      // coordonnées (saisie admin — champs lat/lng réservés à l'admin), qu'on respecte.
      async ({ data, originalDoc }) => {
        if (process.env.SEED_DEV === 'true') return data

        // Valeur effective = champ soumis, sinon valeur existante. Robuste que Payload
        // transmette un patch partiel ou le document fusionné.
        const eff = <T,>(incoming: T | undefined, current: T | undefined): T | undefined =>
          incoming !== undefined ? incoming : current
        const ville = eff(data.ville, originalDoc?.ville)
        const adresse = eff(data.adresse, originalDoc?.adresse)
        const codePostal = eff(data.codePostal, originalDoc?.codePostal)

        const addressChanged =
          ville !== originalDoc?.ville ||
          adresse !== originalDoc?.adresse ||
          codePostal !== originalDoc?.codePostal

        // Coordonnées posées explicitement par cette écriture (admin) → on n'y touche pas.
        const coordsFournies =
          data.latitude != null &&
          data.longitude != null &&
          (data.latitude !== originalDoc?.latitude || data.longitude !== originalDoc?.longitude)

        const coordsManquantes =
          eff(data.latitude, originalDoc?.latitude) == null ||
          eff(data.longitude, originalDoc?.longitude) == null

        if (ville && !coordsFournies && (addressChanged || coordsManquantes)) {
          const result = await geocodeAddress(adresse, codePostal, ville)
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
      // Revalidation ISR des pages dépendantes.
      ({ doc }) => {
        try {
          if (doc?.slug) {
            revalidatePath(`/reseau/${doc.slug}`, 'page')
          }
          revalidatePath('/reseaux', 'page')
        } catch {
          // Peut échouer hors contexte request (cron, scripts)
        }
        return doc
      },
      notifyOnSuspension,
    ],
    afterDelete: [
      cleanupMediaOnDelete,
      () => {
        try {
          revalidatePath('/reseaux', 'page')
        } catch {
          // Peut échouer hors contexte request
        }
      },
    ],
    beforeDelete: [
      // Garde-fou : interdit la suppression si des événements y sont rattachés.
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.find({
          collection: 'evenements',
          where: { reseau: { equals: id } },
          limit: 0,
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          throw new Error(
            `Impossible de supprimer ce réseau : ${totalDocs} événement(s) y sont rattaché(s). Supprimez-les d'abord.`,
          )
        }
      },
      // Garde-fou ADR-0012 E1.1 : interdit la suppression d'un national qui a des locaux.
      async ({ id, req }) => {
        const reseau = await req.payload.findByID({
          collection: 'reseaux',
          id: id as string | number,
          depth: 0,
          overrideAccess: true,
        })
        const niveauReseau = reseau?.niveau ?? 'national'
        // Toute tête (non-local) avec des groupes locaux ne peut pas être supprimée.
        if (niveauReseau !== 'local') {
          const { totalDocs: nbLocaux } = await req.payload.count({
            collection: 'reseaux',
            where: {
              and: [
                { parent: { equals: id } },
                { niveau: { equals: 'local' } },
              ],
            },
            overrideAccess: true,
          })
          if (nbLocaux > 0) {
            throw new Error(
              `Impossible de supprimer ce réseau national : ${nbLocaux} réseau(x) local/locaux y sont rattaché(s). ` +
              `Supprimez ou réaffectez les locaux d'abord.`,
            )
          }
        }
      },
    ],
  },
  fields: [
    // ============================================================
    // PROPRIÉTÉ ET PROVENANCE
    // ============================================================
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      // Unicité DB gérée par la migration (index partiel WHERE user_id IS NOT NULL).
      // Pas de unique: true ici car Payload génèrerait un UNIQUE non conditionnel
      // qui bloquerait les fiches orphelines (user = null) multiples.
      admin: {
        description: 'Compte propriétaire (vide pour les fiches orphelines non revendiquées).',
        position: 'sidebar',
      },
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Revendiqué (compte actif)', value: 'revendique' },
        { label: 'Importé / national', value: 'importe' },
      ],
      defaultValue: 'importe',
      required: true,
      index: true,
      access: {
        // Seul l'admin peut modifier la provenance (sécurité anti-escalade).
        update: isAdmin,
      },
      admin: {
        description: 'Provenance du réseau. "Revendiqué" = propriétaire actif ; "Importé" = fiche importée revendiquable.',
        position: 'sidebar',
      },
    },
    // ============================================================
    // HIÉRARCHIE NATIONAL / LOCAL (ADR-0012 E1.1)
    // ============================================================
    {
      name: 'niveau',
      type: 'select',
      // Échelle du réseau — champ UNIQUE à 4 valeurs (réconciliation 2026-07-13).
      // Tête de réseau = Régional / National / International (porte l'abonnement, peut
      // avoir des groupes locaux) ; Local = groupe rattaché à une tête.
      options: [
        { label: 'Local (groupe, section)', value: 'local' },
        { label: 'Régional (tête de réseau)', value: 'regional' },
        { label: 'National (tête de réseau)', value: 'national' },
        { label: 'International (tête de réseau)', value: 'international' },
      ],
      defaultValue: 'national',
      required: true,
      index: true,
      access: {
        // Seul l'admin peut changer le niveau après création (contrat SEO / intégrité hiérarchie)
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description:
          'Échelle du réseau. Régional/National/International = tête de réseau (abonnement + groupes) ; ' +
          'Local = groupe rattaché à une tête.',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'reseaux',
      index: true,
      // Facultatif pour un local (ADR-0014 : vide = réseau local indépendant),
      // interdit pour une tête — validé par hook beforeChange.
      admin: {
        position: 'sidebar',
        description: 'Tête de réseau parente (facultatif — laissez vide pour un réseau local indépendant).',
        condition: (data) => data?.niveau === 'local',
      },
    },
    // ============================================================
    // PALIER (pour les nationaux abonnés — posé par webhook Stripe, ADR-0012 E1.2)
    // ⚠️ TODO : valeurs placeholder — seuils/prix réels à fournir avant E2.A (accounts-and-billing)
    // ============================================================
    {
      name: 'palier',
      type: 'select',
      options: PALIERS_OPTIONS,
      index: true,
      access: {
        // Seul l'admin peut modifier le palier (posé par le webhook Stripe)
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description:
          '[Significatif sur une tête de réseau uniquement] Palier d\'abonnement déterminant le nombre max de locaux. ' +
          'Posé par le webhook Stripe après souscription. ⚠️ Valeurs placeholder — seuils/prix réels à configurer avant E2.A.',
        condition: (data) => data?.niveau !== 'local',
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
        description: 'Généré depuis le nom à la création ; figé ensuite (contrat SEO).',
      },
    },
    {
      name: 'nom',
      type: 'text',
      required: true,
      label: 'Nom du réseau',
    },
    {
      name: 'ville',
      type: 'text',
      // Facultatif depuis le 2026-07-17 : l'annuaire des réseaux nationaux est seedé
      // « nom seul ». Les formulaires self-service (création de local par le national
      // ou par un réseauteur Plus, signup organisateur) l'exigent toujours via Zod —
      // un LOCAL sans ville n'est pas géocodé et n'a donc pas de marqueur carte.
      label: 'Ville du siège',
    },
    {
      name: 'adresse',
      type: 'text',
      label: 'Adresse',
    },
    {
      name: 'codePostal',
      type: 'text',
      label: 'Code postal',
    },
    {
      name: 'departement',
      type: 'text',
      index: true,
      label: 'Département',
      admin: { description: 'Ex : Rhône, Paris, Gironde.' },
    },
    {
      name: 'region',
      type: 'text',
      index: true,
      label: 'Région',
      admin: { description: 'Ex : Auvergne-Rhône-Alpes, Île-de-France.' },
    },
    // ============================================================
    // TYPE DE STRUCTURE (l'échelle géographique = champ `niveau`, 4 valeurs)
    // ============================================================
    {
      name: 'typeJuridique',
      type: 'select',
      label: 'Type de structure',
      options: [
        { label: 'Association', value: 'association' },
        { label: 'Privé / société', value: 'prive' },
        { label: 'Franchise', value: 'franchise' },
        { label: 'Institution', value: 'institution' },
        { label: 'Autre', value: 'autre' },
      ],
      admin: { description: 'Nature juridique du réseau.' },
    },
    // ============================================================
    // CATÉGORIE
    // ============================================================
    // [DORMANT — audit fiches 2026-07-22] Aucune surface publique ne lit ce champ :
    // ni la fiche /reseau/<slug>, ni les filtres de l'annuaire, ni le JSON-LD.
    // Conservé en DB (pas de migration destructive), masqué de l'admin pour ne pas
    // faire saisir une donnée qui ne s'affiche nulle part.
    {
      name: 'categorie',
      type: 'relationship',
      relationTo: 'types-evenement',
      index: true,
      label: 'Catégorie [dormant]',
      admin: {
        hidden: true,
        description:
          '[Dormant] Catégorie principale du réseau — non exploitée par le front (fiche, filtres, JSON-LD).',
      },
    },
    // ============================================================
    // DESCRIPTION ET MÉDIAS
    // ============================================================
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      admin: {
        description: 'Description courte du réseau (sans limite de longueur).',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
    },
    // [DORMANT — audit fiches 2026-07-22] La fiche publique n'affiche pas de bannière
    // (en-tête = bandeau navy + logo) et le fallback OG « bannière puis logo » n'est pas
    // implémenté (cf. buildReseauOrganizationJsonLd : image = champ seo.ogImage seul).
    // Conservé en DB — le GC média (media-cleanup) continue de le prendre en compte.
    {
      name: 'banniere',
      type: 'upload',
      relationTo: 'media',
      label: 'Bannière [dormant]',
      admin: {
        hidden: true,
        description: '[Dormant] Non affichée sur la fiche publique. Utilisez le logo et la galerie.',
      },
    },
    {
      name: 'illustrations',
      type: 'array',
      maxRows: 10,
      label: 'Galerie (10 photos max)',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'plaquetteUrl',
      type: 'text',
      label: 'Plaquette PDF (lien)',
      admin: {
        description: 'Lien vers la plaquette de présentation (PDF hébergé). Le média interne n\'accepte que des images.',
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
    // CONTACTS
    // ============================================================
    {
      name: 'siteWeb',
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
      name: 'emailContact',
      type: 'email',
      label: 'Email de contact',
    },
    {
      name: 'telephone',
      type: 'text',
      label: 'Téléphone',
    },
    // ============================================================
    // RESPONSABLE LOCAL (personne référente)
    // ============================================================
    {
      name: 'responsableNom',
      type: 'text',
      label: 'Nom du responsable local',
    },
    {
      name: 'responsableFonction',
      type: 'text',
      label: 'Fonction du responsable',
    },
    {
      name: 'responsablePhoto',
      type: 'upload',
      relationTo: 'media',
      label: 'Photo du responsable (facultatif)',
    },
    {
      name: 'videoYoutube',
      type: 'text',
      label: 'Vidéo YouTube',
      admin: {
        description: 'Lien vers une vidéo YouTube (ex: https://www.youtube.com/watch?v=xxx).',
      },
    },
    // ============================================================
    // RÉSEAUX SOCIAUX
    // ============================================================
    {
      name: 'reseauxSociaux',
      type: 'array',
      maxRows: 6,
      label: 'Réseaux sociaux',
      fields: [
        {
          name: 'plateforme',
          type: 'select',
          required: true,
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'X (Twitter)', value: 'twitter' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'Pinterest', value: 'pinterest' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (value: unknown) => {
            if (!value || typeof value !== 'string') return true
            try {
              const parsed = new URL(value)
              if (!['http:', 'https:'].includes(parsed.protocol)) return 'L\'URL doit commencer par http:// ou https://'
              return true
            } catch {
              return 'URL invalide'
            }
          },
        },
      ],
    },
    // ============================================================
    // GÉO (source de saisie — maintenue pour rétrocompat + hook geocode)
    // La colonne geom geography(Point,4326) est gérée hors Payload (migration DDL).
    // ============================================================
    {
      name: 'latitude',
      type: 'number',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Latitude (auto-calculée par géocodage).',
      },
    },
    {
      name: 'longitude',
      type: 'number',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Longitude (auto-calculée par géocodage).',
      },
    },
    // ============================================================
    // PRÉSENTATION (texte long — distinct de description courte)
    // ============================================================
    {
      name: 'presentation',
      type: 'textarea',
      label: 'Présentation détaillée',
      admin: {
        description: 'Texte de présentation complet du réseau (affiché sur la fiche publique).',
      },
    },
    {
      name: 'objectif',
      type: 'textarea',
      label: 'Objectif du réseau',
    },
    {
      name: 'differenciateur',
      type: 'textarea',
      label: 'Ce qui le différencie',
      admin: { description: 'Ce qui distingue ce réseau des autres (3 à 5 lignes).' },
    },
    {
      name: 'nombreMembres',
      type: 'number',
      min: 0,
      label: 'Nombre de membres (déclaré)',
      admin: {
        description:
          'Nombre de membres déclaré par le réseau — distinct du compteur « nbReseauteurs » (réseauteurs de la plateforme).',
      },
    },
    // ============================================================
    // FONCTIONNEMENT (ADR-0012 amendé 2026-07-13 — présentation du réseau)
    // ============================================================
    {
      name: 'publicConcerne',
      type: 'text',
      label: 'Public concerné',
      admin: { description: 'Ex : dirigeants, entrepreneurs, indépendants, commerciaux…' },
    },
    {
      name: 'ouvertATous',
      type: 'select',
      label: 'Tout le monde peut participer ?',
      options: [
        { label: 'Oui', value: 'oui' },
        { label: 'Non', value: 'non' },
      ],
    },
    {
      name: 'participationInvite',
      type: 'select',
      label: 'Participation possible en tant qu\'invité ?',
      options: [
        { label: 'Oui', value: 'oui' },
        { label: 'Non', value: 'non' },
      ],
    },
    {
      name: 'adhesionObligatoire',
      type: 'select',
      label: 'Adhésion obligatoire ?',
      options: [
        { label: 'Oui', value: 'oui' },
        { label: 'Non', value: 'non' },
      ],
    },
    {
      name: 'uneProfessionParGroupe',
      type: 'select',
      label: 'Une seule profession par groupe ?',
      options: [
        { label: 'Oui', value: 'oui' },
        { label: 'Non', value: 'non' },
      ],
    },
    {
      name: 'cotisation',
      type: 'text',
      label: 'Cotisation (facultatif)',
      admin: { description: 'Ex : « à partir de 400 €/an » — texte libre.' },
    },
    // ============================================================
    // DRAPEAU PARTENAIRE (posé par accounts-and-billing via webhook Stripe)
    // ⚠️ ADR-0012 : significatif UNIQUEMENT sur les réseaux niveau='national'.
    //    Sur un local, ces champs sont INERTES (jamais écrits par les webhooks,
    //    jamais lus par le gate peutPublierEvenement). Les données de locaux importés
    //    ne doivent pas avoir ces champs positionnés.
    // ============================================================
    {
      name: 'partenaire',
      type: 'checkbox',
      defaultValue: false,
      label: 'Abonnement partenaire actif',
      index: true,
      access: {
        // Posé par le webhook Stripe uniquement (jamais par le client, même au create)
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description:
          '[Significatif sur le national uniquement — ADR-0012] Abonnement partenaire actif. ' +
          'Débloque : création de locaux, publication d\'événements, badge partenaire, logo page d\'accueil. ' +
          'Posé par webhook Stripe. Inerte sur un local.',
      },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      index: true,
      access: {
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description:
          '[Significatif sur le national uniquement — ADR-0012] ID de l\'abonnement Stripe partenaire. ' +
          'Géré par accounts-and-billing. Inerte sur un local.',
      },
    },
    {
      name: 'partenaireExpireAt',
      type: 'date',
      access: {
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description:
          '[Significatif sur le national uniquement — ADR-0012] Date d\'expiration du partenariat. Inerte sur un local.',
      },
    },
    // ============================================================
    // COMPTEURS DÉRIVÉS (recalculés par hooks)
    // ============================================================
    {
      name: 'nbReseauteurs',
      type: 'number',
      defaultValue: 0,
      access: {
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Nombre de réseauteurs validés qui fréquentent ce réseau (auto-calculé).',
      },
    },
    {
      name: 'nbEvenements',
      type: 'number',
      defaultValue: 0,
      access: {
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Nombre d\'événements publiés pour ce réseau (auto-calculé).',
      },
    },
    // ============================================================
    // STATUT
    // ============================================================
    {
      name: 'statut',
      type: 'select',
      options: [
        { label: 'Publiée', value: 'publiee' },
        { label: 'Suspendue', value: 'suspendue' },
      ],
      defaultValue: 'publiee',
      required: true,
      index: true,
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: 'Statut de visibilité publique du réseau.',
      },
    },
    {
      name: 'rempliPar',
      type: 'text',
      label: 'Fiche remplie par',
      admin: {
        position: 'sidebar',
        description: 'Nom de la personne ayant renseigné/mis à jour la fiche (traçabilité).',
      },
    },
    seoField,
  ],
}
