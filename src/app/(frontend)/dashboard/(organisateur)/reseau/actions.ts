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
  description: z.string().max(5000).optional(),
  dateDebut: z.string().min(1, 'La date est requise'),
  dateFin: z.string().optional().or(z.literal('')),
  heure: z.string().optional(),
  lieuNom: z.string().max(200).optional(),
  lieuVille: z.string().max(100).optional(),
  lieuAdresse: z.string().max(300).optional(),
  lienInscription: z.string().url('URL invalide').optional().or(z.literal('')),
})

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
// ─────────────────────────────────────────────────────────────────

export async function createEvenement(
  data: z.infer<typeof EvenementSchema>,
): Promise<ActionResult & { id?: string | number }> {
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

  const { lienInscription, dateFin, ...rest } = parsed.data

  try {
    const created = await payload.create({
      collection: 'evenements',
      data: {
        ...rest,
        dateFin: dateFin || null,
        lienInscription: lienInscription || null,
        reseau: auth.reseau.id,
        statut: 'publie',
      } as unknown as RequiredDataFromCollectionSlug<'evenements'>,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/reseau')
    return { success: true, id: created.id }
  } catch (err) {
    console.error('[action/createEvenement]', err)
    return { error: 'Erreur lors de la création de l\'événement.' }
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

  const { lienInscription, dateFin, ...rest } = parsed.data

  try {
    await payload.update({
      collection: 'evenements',
      id: evenementId,
      data: {
        ...rest,
        dateFin: dateFin || null,
        lienInscription: lienInscription || null,
      } as Record<string, unknown>,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/reseau')
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
    return { success: true }
  } catch (err) {
    console.error('[action/deleteEvenement]', err)
    return { error: 'Erreur lors de la suppression de l\'événement.' }
  }
}
