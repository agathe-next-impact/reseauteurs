/**
 * Server Actions — Dashboard organisateur
 *
 * Mutations fiche réseau, CRUD événements (gate partenaire — réseau doit être partenaire).
 * ADR-0012 : gestion Premium supprimée (événement Premium supprimé du périmètre).
 * Autorisation stricte : un organisateur n'agit que sur SON réseau et SES événements.
 * Validation Zod côté serveur — jamais confiance au client.
 */
'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { addWeeks, addMonths } from 'date-fns'
import { peutPublierEvenement, type ReseauForHierarchy } from '@/lib/reseau-hierarchie'

export type ActionResult = { success: true } | { error: string }

// ─────────────────────────────────────────────────────────────────
// Helpers d'autorisation serveur
// ─────────────────────────────────────────────────────────────────

async function getOrganisateurReseau(
  payload: Awaited<ReturnType<typeof getPayload>>,
  userId: number | string,
) {
  const { docs } = await payload.find({
    collection: 'reseaux',
    where: { user: { equals: userId } },
    limit: 1,
    // depth: 1 → popule `parent` (réseau national) pour la résolution de hiérarchie
    // (gate de publication ADR-0012 : un local s'appuie sur l'abonnement de son national).
    depth: 1,
    overrideAccess: true,
  })
  return docs[0] as unknown as Record<string, unknown> | undefined
}

async function requireOrganisateur(
  payload: Awaited<ReturnType<typeof getPayload>>,
  hdrs: Awaited<ReturnType<typeof headers>>,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      user: { id: number | string; role: string }
      reseau: Record<string, unknown>
    }
> {
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return { ok: false, error: 'Non authentifié' }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
  if (freshUser.role !== 'organisateur') return { ok: false, error: 'Accès réservé aux organisateurs' }

  const reseau = await getOrganisateurReseau(payload, user.id)
  if (!reseau) return { ok: false, error: 'Aucun réseau associé à ce compte' }

  return { ok: true, user: { id: user.id, role: freshUser.role as string }, reseau }
}

// ─────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────

const ReseauSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis').max(200),
  description: z.string().max(3000).optional(),
  presentation: z.string().max(5000).optional(),
  siteWeb: z.string().url('URL invalide').optional().or(z.literal('')),
  emailContact: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().max(30).optional().or(z.literal('')),
  ville: z.string().max(100).optional(),
  departement: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  // Fiche complète (spec 2026-07-13) — champs texte/sélecteurs (uploads gérés en admin)
  typeJuridique: z.string().max(30).optional(),
  responsableNom: z.string().max(200).optional(),
  responsableFonction: z.string().max(200).optional(),
  objectif: z.string().max(3000).optional(),
  differenciateur: z.string().max(2000).optional(),
  nombreMembres: z.string().max(12).optional(),
  publicConcerne: z.string().max(300).optional(),
  ouvertATous: z.string().max(4).optional(),
  participationInvite: z.string().max(4).optional(),
  adhesionObligatoire: z.string().max(4).optional(),
  uneProfessionParGroupe: z.string().max(4).optional(),
  cotisation: z.string().max(200).optional(),
  plaquetteUrl: z.string().url('URL invalide').optional().or(z.literal('')),
  rempliPar: z.string().max(200).optional(),
})

// Normalisation serveur : '' → null, sélecteurs whitelistés, nombre parsé.
const emptyToNull = (v?: string): string | null => (v && v.trim() !== '' ? v.trim() : null)
const enumOrNull = (v: string | undefined, allowed: readonly string[]): string | null =>
  v && allowed.includes(v) ? v : null

const EvenementSchema = z.object({
  titre: z.string().min(1, 'Le titre est requis').max(300),
  // Catégorie (types-evenement) — requise par la collection (type_id NOT NULL)
  type: z.number({ message: 'La catégorie est requise' }).int().positive('La catégorie est requise'),
  descriptionCourte: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  intervenants: z.string().max(1000).optional(),
  dateDebut: z.string().min(1, 'La date est requise'),
  dateFin: z.string().optional().or(z.literal('')),
  lieuNom: z.string().max(200).optional(),
  lieuVille: z.string().max(100).optional(),
  lieuAdresse: z.string().max(300).optional(),
  lieuCodePostal: z.string().max(10).optional(),
  lieuDepartement: z.string().max(100).optional(),
  lienInscription: z.string().url('URL invalide').optional().or(z.literal('')),
  // Participation / catégorisation / contact / infos pratiques (spec 2026-07-13)
  gratuit: z.boolean().optional(),
  tarif: z.string().max(100).optional(),
  nombrePlaces: z.string().max(12).optional(),
  dateLimiteInscription: z.string().optional(),
  ouvertATous: z.string().max(4).optional(),
  reserveMembres: z.string().max(4).optional(),
  participationInvite: z.string().max(4).optional(),
  niveauPublic: z.string().max(12).optional(),
  publicConcerne: z.string().max(300).optional(),
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().max(254).optional(),
  contactTelephone: z.string().max(30).optional(),
  parking: z.boolean().optional(),
  accesPmr: z.boolean().optional(),
  infosPratiques: z.string().max(1000).optional(),
  // Visuel : id d'un media déjà uploadé par le client (POST /api/media, auth requise).
  // undefined = ne pas toucher au visuel existant.
  imageId: z.number().int().positive().optional(),
  // Récurrence (création uniquement — ignorée à la mise à jour) : un événement
  // DISTINCT est créé par date, modifiable/supprimable individuellement.
  // Pas de série ni de serieId (modèle « occurrences » retiré — ADR-0011 §12).
  recurrence: z.enum(['aucune', 'hebdomadaire', 'quinzaine', 'mensuelle']).optional(),
  recurrenceFin: z.string().optional(),
})

/** Plafond d'occurrences par création récurrente (le dédoublonnage de slug borne à ~50 collisions). */
const MAX_OCCURRENCES = 26

/**
 * Calcule les dates de début des occurrences (la 1re = dateDebut saisie).
 * `recurrenceFin` (date seule, incluse) borne la série ; plafond MAX_OCCURRENCES.
 */
function datesRecurrence(
  dateDebut: Date,
  recurrence: 'hebdomadaire' | 'quinzaine' | 'mensuelle',
  recurrenceFin: string,
): Date[] | { error: string } {
  const fin = new Date(recurrenceFin)
  if (Number.isNaN(fin.getTime())) return { error: 'Date de fin de récurrence invalide.' }
  fin.setHours(23, 59, 59, 999) // « jusqu'au » inclus
  if (fin <= dateDebut) {
    return { error: 'La fin de récurrence doit être postérieure à la date de début.' }
  }
  const nth = (i: number) =>
    recurrence === 'hebdomadaire'
      ? addWeeks(dateDebut, i)
      : recurrence === 'quinzaine'
        ? addWeeks(dateDebut, 2 * i)
        : addMonths(dateDebut, i)
  const dates: Date[] = [dateDebut]
  for (let i = 1; ; i++) {
    const d = nth(i)
    if (d > fin) break
    if (dates.length >= MAX_OCCURRENCES) {
      return {
        error: `La récurrence dépasse ${MAX_OCCURRENCES} événements — rapprochez la date de fin.`,
      }
    }
    dates.push(d)
  }
  return dates
}

// Normalise les champs additionnels d'un événement ('' → null, enums whitelistés, nombre/date parsés).
function evenementExtras(d: z.infer<typeof EvenementSchema>): Record<string, unknown> {
  const opt = (v?: string) => (v && v.trim() !== '' ? v.trim() : null)
  const enumOr = (v: string | undefined, a: readonly string[]) => (v && a.includes(v) ? v : null)
  const nb = d.nombrePlaces && d.nombrePlaces.trim() !== '' ? parseInt(d.nombrePlaces, 10) : NaN
  return {
    descriptionCourte: opt(d.descriptionCourte),
    intervenants: opt(d.intervenants),
    lieuCodePostal: opt(d.lieuCodePostal),
    lieuDepartement: opt(d.lieuDepartement),
    gratuit: d.gratuit !== false,
    tarif: opt(d.tarif),
    nombrePlaces: Number.isFinite(nb) && nb >= 0 ? nb : null,
    dateLimiteInscription: opt(d.dateLimiteInscription) ? new Date(d.dateLimiteInscription as string).toISOString() : null,
    ouvertATous: enumOr(d.ouvertATous, ['oui', 'non']),
    reserveMembres: enumOr(d.reserveMembres, ['oui', 'non']),
    participationInvite: enumOr(d.participationInvite, ['oui', 'non']),
    niveauPublic: enumOr(d.niveauPublic, ['debutant', 'confirme', 'tous']),
    publicConcerne: opt(d.publicConcerne),
    contactNom: opt(d.contactNom),
    contactEmail: opt(d.contactEmail),
    contactTelephone: opt(d.contactTelephone),
    parking: d.parking === true,
    accesPmr: d.accesPmr === true,
    infosPratiques: opt(d.infosPratiques),
  }
}

// ─────────────────────────────────────────────────────────────────
// Action : mise à jour de la fiche réseau
// ─────────────────────────────────────────────────────────────────

export async function updateFicheReseau(
  data: z.infer<typeof ReseauSchema>,
): Promise<ActionResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const auth = await requireOrganisateur(payload, hdrs)
  if (!auth.ok) return { error: auth.error }

  const parsed = ReseauSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const d = parsed.data
  const nbRaw = d.nombreMembres && d.nombreMembres.trim() !== '' ? parseInt(d.nombreMembres, 10) : NaN

  try {
    await payload.update({
      collection: 'reseaux',
      id: auth.reseau.id as string | number,
      data: {
        nom: d.nom,
        description: d.description,
        presentation: d.presentation,
        ville: d.ville,
        departement: d.departement,
        region: d.region,
        siteWeb: d.siteWeb || null,
        emailContact: d.emailContact || null,
        telephone: d.telephone || null,
        // Fiche complète
        typeJuridique: enumOrNull(d.typeJuridique, ['association', 'prive', 'franchise', 'institution', 'autre']),
        responsableNom: emptyToNull(d.responsableNom),
        responsableFonction: emptyToNull(d.responsableFonction),
        objectif: emptyToNull(d.objectif),
        differenciateur: emptyToNull(d.differenciateur),
        nombreMembres: Number.isFinite(nbRaw) && nbRaw >= 0 ? nbRaw : null,
        publicConcerne: emptyToNull(d.publicConcerne),
        ouvertATous: enumOrNull(d.ouvertATous, ['oui', 'non']),
        participationInvite: enumOrNull(d.participationInvite, ['oui', 'non']),
        adhesionObligatoire: enumOrNull(d.adhesionObligatoire, ['oui', 'non']),
        uneProfessionParGroupe: enumOrNull(d.uneProfessionParGroupe, ['oui', 'non']),
        cotisation: emptyToNull(d.cotisation),
        plaquetteUrl: d.plaquetteUrl || null,
        rempliPar: emptyToNull(d.rempliPar),
      } as Record<string, unknown>,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/reseau')
    return { success: true }
  } catch (err) {
    console.error('[action/updateFicheReseau]', err)
    return { error: 'Erreur lors de la mise à jour de la fiche.' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Action : création d'un événement (gate partenaire côté serveur)
// Récurrence optionnelle : crée 1 événement DISTINCT par date (hebdo /
// quinzaine / mensuel jusqu'à recurrenceFin incluse, max MAX_OCCURRENCES).
// ─────────────────────────────────────────────────────────────────

export async function createEvenement(
  data: z.infer<typeof EvenementSchema>,
): Promise<ActionResult & { id?: string | number; count?: number }> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const auth = await requireOrganisateur(payload, hdrs)
  if (!auth.ok) return { error: auth.error }

  // GATE SERVEUR (ADR-0012 §4) : publication réservée si le NATIONAL effectif est abonné.
  // Pour un réseau local, on remonte au parent national (hiérarchie) via le helper central.
  if (!peutPublierEvenement(auth.reseau as unknown as ReseauForHierarchy)) {
    return {
      error:
        'La publication d\'événements est réservée aux réseaux partenaires. Souscrivez à un abonnement partenaire pour accéder à cette fonctionnalité.',
    }
  }

  const parsed = EvenementSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { lienInscription, dateFin, recurrence, recurrenceFin, imageId, ...rest } = parsed.data

  const premiereDate = new Date(parsed.data.dateDebut)
  if (Number.isNaN(premiereDate.getTime())) {
    return { error: 'Date de début invalide.' }
  }

  // Récurrence : liste des dates de début (1 événement distinct par date)
  let occurrences: Date[] = [premiereDate]
  if (recurrence && recurrence !== 'aucune') {
    if (!recurrenceFin) {
      return { error: 'Indiquez la date de fin de la récurrence.' }
    }
    const result = datesRecurrence(premiereDate, recurrence, recurrenceFin)
    if (!Array.isArray(result)) return result
    occurrences = result
  }

  // dateFin / dateLimiteInscription suivent chaque occurrence avec le même décalage
  const extras = evenementExtras(parsed.data)
  const decale = (iso: string, occ: Date): string =>
    new Date(new Date(iso).getTime() + (occ.getTime() - premiereDate.getTime())).toISOString()

  let firstId: string | number | undefined
  let crees = 0
  try {
    for (const occ of occurrences) {
      const created = await payload.create({
        collection: 'evenements',
        data: {
          ...rest,
          ...extras,
          dateDebut: occ.toISOString(),
          dateFin: dateFin ? decale(dateFin, occ) : null,
          dateLimiteInscription: extras.dateLimiteInscription
            ? decale(extras.dateLimiteInscription as string, occ)
            : null,
          lienInscription: lienInscription || null,
          image: imageId ?? null,
          reseau: auth.reseau.id,
          statut: 'publie',
        } as unknown as RequiredDataFromCollectionSlug<'evenements'>,
        overrideAccess: true,
      })
      firstId ??= created.id
      crees++
    }
    revalidatePath('/dashboard/reseau')
    revalidatePath('/dashboard/evenements')
    return { success: true, id: firstId, count: crees }
  } catch (err) {
    console.error('[action/createEvenement]', err)
    revalidatePath('/dashboard/reseau')
    revalidatePath('/dashboard/evenements')
    return {
      error:
        crees > 0
          ? `Erreur en cours de route : ${crees} événement(s) sur ${occurrences.length} créé(s). Rechargez la page pour vérifier avant de réessayer.`
          : 'Erreur lors de la création de l\'événement.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Action : mise à jour d'un événement (vérification ownership)
// ─────────────────────────────────────────────────────────────────

export async function updateEvenement(
  evenementId: string | number,
  data: z.infer<typeof EvenementSchema>,
): Promise<ActionResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const auth = await requireOrganisateur(payload, hdrs)
  if (!auth.ok) return { error: auth.error }

  // Vérification ownership côté serveur
  const evenement = await payload.findByID({
    collection: 'evenements',
    id: evenementId,
    depth: 0,
    overrideAccess: true,
  })
  const evenementReseauId = (evenement as unknown as Record<string, unknown>).reseau
  if (String(evenementReseauId) !== String(auth.reseau.id)) {
    return { error: 'Vous n\'êtes pas autorisé à modifier cet événement.' }
  }

  // Gate partenaire pour les mises à jour aussi (hiérarchie ADR-0012 : national effectif abonné)
  if (!peutPublierEvenement(auth.reseau as unknown as ReseauForHierarchy)) {
    return { error: 'La gestion d\'événements est réservée aux réseaux partenaires.' }
  }

  const parsed = EvenementSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  // recurrence/recurrenceFin : création uniquement — jamais réappliqués à un événement existant
  const { lienInscription, dateFin, imageId, recurrence: _r, recurrenceFin: _rf, ...rest } = parsed.data

  try {
    await payload.update({
      collection: 'evenements',
      id: evenementId,
      data: {
        ...rest,
        ...evenementExtras(parsed.data),
        dateFin: dateFin || null,
        lienInscription: lienInscription || null,
        // imageId absent = visuel inchangé (jamais effacé implicitement)
        ...(imageId !== undefined ? { image: imageId } : {}),
      } as Record<string, unknown>,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/reseau')
    revalidatePath('/dashboard/evenements')
    return { success: true }
  } catch (err) {
    console.error('[action/updateEvenement]', err)
    return { error: 'Erreur lors de la mise à jour de l\'événement.' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Action : suppression d'un événement
// ─────────────────────────────────────────────────────────────────

export async function deleteEvenement(evenementId: string | number): Promise<ActionResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const auth = await requireOrganisateur(payload, hdrs)
  if (!auth.ok) return { error: auth.error }

  // Vérification ownership côté serveur
  const evenement = await payload.findByID({
    collection: 'evenements',
    id: evenementId,
    depth: 0,
    overrideAccess: true,
  })
  const evenementReseauId = (evenement as unknown as Record<string, unknown>).reseau
  if (String(evenementReseauId) !== String(auth.reseau.id)) {
    return { error: 'Vous n\'êtes pas autorisé à supprimer cet événement.' }
  }

  try {
    await payload.delete({
      collection: 'evenements',
      id: evenementId,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/reseau')
    revalidatePath('/dashboard/evenements')
    return { success: true }
  } catch (err) {
    console.error('[action/deleteEvenement]', err)
    return { error: 'Erreur lors de la suppression de l\'événement.' }
  }
}
