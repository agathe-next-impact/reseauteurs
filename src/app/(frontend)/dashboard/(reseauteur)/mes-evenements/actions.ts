'use server'

/**
 * Server actions — CRUD des événements d'un réseauteur Plus (ADR-0013 P2.B).
 *
 * Toutes les mutations passent par l'API locale Payload AVEC l'utilisateur courant
 * (overrideAccess: false) : les hooks de la collection appliquent le gate Plus,
 * l'invariant XOR (réseau/réseauteur) et l'ownership — jamais confiance au client.
 */
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'

export interface EvenementFormData {
  titre: string
  type: number | string
  /**
   * Organisateur (création uniquement — ADR-0014) : null/absent = en mon nom
   * (organisateurReseauteur) ; id d'un réseau local = pour ce réseau (reseau). Le hook
   * serveur vérifie que le réseauteur Plus est PROPRIÉTAIRE du réseau local.
   */
  organisateurReseau?: number | null
  descriptionCourte?: string
  description?: string
  intervenants?: string
  dateDebut: string
  dateFin?: string
  lieuNom?: string
  lieuAdresse?: string
  lieuCodePostal?: string
  lieuVille: string
  lieuDepartement?: string
  lienInscription?: string
  // Participation
  gratuit?: boolean
  tarif?: string
  nombrePlaces?: string
  dateLimiteInscription?: string
  ouvertATous?: string
  reserveMembres?: string
  participationInvite?: string
  niveauPublic?: string
  publicConcerne?: string
  /** Secteur d'activité concerné (id `categories`) ; null = non renseigné. */
  secteur?: number | null
  // Contact
  contactNom?: string
  contactEmail?: string
  contactTelephone?: string
  // Infos pratiques
  parking?: boolean
  accesPmr?: boolean
  infosPratiques?: string
  /** Visuel : id d'un media déjà uploadé (POST /api/media, auth). undefined = inchangé. */
  imageId?: number
}

/** Id media validé (entier > 0) ou undefined — jamais confiance au client. */
function imagePatch(imageId: unknown): { image: number } | Record<string, never> {
  const n = Number(imageId)
  return Number.isInteger(n) && n > 0 ? { image: n } : {}
}

type ActionResult = { ok: true; id?: number | string } | { ok: false; error: string }

async function getContext() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return null
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return { payload, user, profil: docs[0] ?? null }
}

function sanitize(data: EvenementFormData) {
  const opt = (v?: string) => {
    const t = (v ?? '').trim()
    return t || null
  }
  const enumOr = (v: string | undefined, allowed: readonly string[]) => (v && allowed.includes(v) ? v : null)
  const nb = data.nombrePlaces && String(data.nombrePlaces).trim() !== '' ? parseInt(String(data.nombrePlaces), 10) : NaN
  const dateLimite = data.dateLimiteInscription && data.dateLimiteInscription.trim() !== ''
    ? new Date(data.dateLimiteInscription).toISOString()
    : null
  return {
    titre: (data.titre ?? '').trim(),
    type: Number(data.type),
    descriptionCourte: opt(data.descriptionCourte),
    description: opt(data.description),
    intervenants: opt(data.intervenants),
    dateDebut: data.dateDebut,
    dateFin: opt(data.dateFin),
    lieuNom: opt(data.lieuNom),
    lieuAdresse: opt(data.lieuAdresse),
    lieuCodePostal: opt(data.lieuCodePostal),
    lieuVille: (data.lieuVille ?? '').trim(),
    lieuDepartement: opt(data.lieuDepartement),
    lienInscription: opt(data.lienInscription),
    // Participation
    gratuit: data.gratuit !== false,
    tarif: opt(data.tarif),
    nombrePlaces: Number.isFinite(nb) && nb >= 0 ? nb : null,
    dateLimiteInscription: dateLimite,
    ouvertATous: enumOr(data.ouvertATous, ['oui', 'non']),
    reserveMembres: enumOr(data.reserveMembres, ['oui', 'non']),
    participationInvite: enumOr(data.participationInvite, ['oui', 'non']),
    niveauPublic: enumOr(data.niveauPublic, ['debutant', 'confirme', 'tous']),
    publicConcerne: opt(data.publicConcerne),
    // Relation optionnelle : entier positif, ou null (« non renseigné »), ou `undefined`
    // (champ absent du formulaire → on ne touche pas à la valeur existante).
    // Jamais NaN/0 : ce serait une FK invalide.
    secteur:
      data.secteur === undefined
        ? undefined
        : Number.isInteger(data.secteur) && Number(data.secteur) > 0
          ? Number(data.secteur)
          : null,
    // Contact
    contactNom: opt(data.contactNom),
    contactEmail: opt(data.contactEmail),
    contactTelephone: opt(data.contactTelephone),
    // Infos pratiques
    parking: data.parking === true,
    accesPmr: data.accesPmr === true,
    infosPratiques: opt(data.infosPratiques),
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    // Payload ValidationError agrège les messages des hooks — on remonte le premier utile.
    return err.message.replace(/^ValidationError:?\s*/i, '')
  }
  return 'Erreur lors de l\'enregistrement.'
}

export async function createMonEvenement(data: EvenementFormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'Non authentifié.' }
  if (!ctx.profil) return { ok: false, error: 'Profil réseauteur introuvable.' }

  // XOR organisateur : en mon nom (défaut) OU pour un réseau local dont je suis
  // PROPRIÉTAIRE (ADR-0014 — gate Plus + ownership vérifiés par les hooks).
  const organisateurReseau =
    data.organisateurReseau != null && Number(data.organisateurReseau) > 0
      ? Number(data.organisateurReseau)
      : null

  try {
    const doc = await ctx.payload.create({
      collection: 'evenements',
      data: {
        ...sanitize(data),
        ...imagePatch(data.imageId),
        ...(organisateurReseau
          ? { reseau: organisateurReseau }
          : { organisateurReseauteur: Number(ctx.profil.id) }),
        statut: 'publie' as const,
      } as unknown as import('payload').RequiredDataFromCollectionSlug<'evenements'>,
      user: ctx.user,
      overrideAccess: false,
    })
    revalidatePath('/evenements')
    return { ok: true, id: doc.id }
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
}

export async function updateMonEvenement(
  id: number | string,
  data: EvenementFormData,
): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'Non authentifié.' }

  try {
    // L'access control `update` (organisateurReseauteur.user = moi) borne la portée.
    const doc = await ctx.payload.update({
      collection: 'evenements',
      id,
      // imageId absent = visuel inchangé (jamais effacé implicitement)
      data: { ...sanitize(data), ...imagePatch(data.imageId) } as Record<string, unknown>,
      user: ctx.user,
      overrideAccess: false,
    })
    revalidatePath('/evenements')
    if ((doc as { slug?: string }).slug) revalidatePath(`/evenement/${(doc as { slug?: string }).slug}`)
    return { ok: true, id: doc.id }
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
}

export async function deleteMonEvenement(id: number | string): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'Non authentifié.' }

  try {
    await ctx.payload.delete({
      collection: 'evenements',
      id,
      user: ctx.user,
      overrideAccess: false,
    })
    revalidatePath('/evenements')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
}
