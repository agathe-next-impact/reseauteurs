/**
 * lib/inscriptions.ts — Inscription d'un réseauteur à un événement Plus (ADR-0013 §3bis).
 *
 * Règles (validées SERVEUR, jamais confiance au client) :
 *   - seul un compte disposant d'un profil réseauteur peut s'inscrire ;
 *   - uniquement à un événement ORGANISÉ PAR UN RÉSEAUTEUR PLUS (organisateurReseauteur),
 *     PUBLIÉ et À VENIR ;
 *   - une seule inscription par (événement, réseauteur) — garde applicative + index unique DB.
 *
 * Appelé par la route POST /api/evenements/inscription (jamais le client directement).
 */
import type { Payload } from 'payload'

export interface InscriptionResult {
  ok: boolean
  /** Message FR affichable en cas de refus. */
  raison?: string
  /** true si l'inscription existait déjà (idempotent). */
  deja?: boolean
  /** Nombre d'inscrits après l'opération. */
  total?: number
}

export interface InscritSummary {
  id: number
  reseauteurId: number
  slug: string | null
  prenom: string
  nom: string
  ville: string | null
  photoUrl: string | null
  dateInscription: string
}

function relId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as { id?: unknown }).id
    return typeof id === 'number' ? id : id != null ? Number(id) : null
  }
  return Number(v)
}

/** Profil réseauteur (id) d'un compte, ou null s'il n'en a pas. */
async function profilReseauteurId(payload: Payload, userId: number | string): Promise<number | null> {
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: Number(userId) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ? (docs[0].id as number) : null
}

/**
 * Charge un événement et vérifie qu'il est ouvert aux inscriptions en ligne
 * (Plus, publié, à venir). Renvoie l'événement ou un motif de refus.
 */
async function evenementInscriptible(
  payload: Payload,
  evenementId: number | string,
): Promise<{ ev: { id: number } } | { raison: string }> {
  const ev = await payload
    .findByID({ collection: 'evenements', id: Number(evenementId), depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!ev) return { raison: 'Événement introuvable.' }
  if ((ev as { statut?: string }).statut !== 'publie') {
    return { raison: "Cet événement n'est pas ouvert aux inscriptions." }
  }
  if (relId((ev as { organisateurReseauteur?: unknown }).organisateurReseauteur) == null) {
    return {
      raison:
        "Les inscriptions en ligne ne sont ouvertes que pour les événements organisés par un réseauteur.",
    }
  }
  const e = ev as { dateDebut?: string; dateFin?: string | null }
  const finMs = e.dateFin ? new Date(e.dateFin).getTime() : new Date(e.dateDebut ?? '').getTime()
  if (Number.isFinite(finMs) && finMs < Date.now()) return { raison: 'Cet événement est terminé.' }
  return { ev: { id: ev.id as number } }
}

export async function inscrire(
  payload: Payload,
  userId: number | string,
  evenementId: number | string,
): Promise<InscriptionResult> {
  const reseauteurId = await profilReseauteurId(payload, userId)
  if (reseauteurId == null) {
    return { ok: false, raison: 'Seuls les réseauteurs peuvent s\'inscrire à un événement.' }
  }

  const check = await evenementInscriptible(payload, evenementId)
  if ('raison' in check) return { ok: false, raison: check.raison }
  const evId = check.ev.id

  const { totalDocs: deja } = await payload.count({
    collection: 'inscriptions',
    where: { and: [{ evenement: { equals: evId } }, { reseauteur: { equals: reseauteurId } }] },
    overrideAccess: true,
  })
  if (deja > 0) {
    return { ok: true, deja: true, total: await compterInscrits(payload, evId) }
  }

  try {
    await payload.create({
      collection: 'inscriptions',
      data: { evenement: evId, reseauteur: reseauteurId } as Record<string, unknown> as never,
      overrideAccess: true,
    })
  } catch (err) {
    // Course parfaite sur l'index unique → traiter comme déjà inscrit.
    const msg = err instanceof Error ? err.message : String(err)
    if (/inscriptions_evenement_reseauteur_idx|duplicate key/i.test(msg)) {
      return { ok: true, deja: true, total: await compterInscrits(payload, evId) }
    }
    console.error('[inscriptions] inscrire failed:', err)
    return { ok: false, raison: 'Erreur lors de l\'inscription. Réessayez.' }
  }
  return { ok: true, total: await compterInscrits(payload, evId) }
}

export async function desinscrire(
  payload: Payload,
  userId: number | string,
  evenementId: number | string,
): Promise<InscriptionResult> {
  const reseauteurId = await profilReseauteurId(payload, userId)
  if (reseauteurId == null) return { ok: false, raison: 'Profil réseauteur introuvable.' }

  const { docs } = await payload.find({
    collection: 'inscriptions',
    where: { and: [{ evenement: { equals: Number(evenementId) } }, { reseauteur: { equals: reseauteurId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) {
    await payload.delete({ collection: 'inscriptions', id: docs[0].id, overrideAccess: true })
  }
  return { ok: true, total: await compterInscrits(payload, Number(evenementId)) }
}

export async function compterInscrits(payload: Payload, evenementId: number | string): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'inscriptions',
    where: { evenement: { equals: Number(evenementId) } },
    overrideAccess: true,
  })
  return totalDocs
}

export async function estInscrit(
  payload: Payload,
  userId: number | string,
  evenementId: number | string,
): Promise<boolean> {
  const reseauteurId = await profilReseauteurId(payload, userId)
  if (reseauteurId == null) return false
  const { totalDocs } = await payload.count({
    collection: 'inscriptions',
    where: { and: [{ evenement: { equals: Number(evenementId) } }, { reseauteur: { equals: reseauteurId } }] },
    overrideAccess: true,
  })
  return totalDocs > 0
}

/** Liste des inscrits d'un événement (pour l'espace organisateur). */
export async function listerInscrits(
  payload: Payload,
  evenementId: number | string,
  limit = 500,
): Promise<InscritSummary[]> {
  const { docs } = await payload.find({
    collection: 'inscriptions',
    where: { evenement: { equals: Number(evenementId) } },
    depth: 1,
    limit,
    sort: 'createdAt',
    overrideAccess: true,
  })
  return docs
    .map((i) => {
      const r = (i as { reseauteur?: unknown }).reseauteur
      if (!r || typeof r !== 'object') return null
      const rr = r as {
        id: number
        slug?: string | null
        prenom?: string | null
        nom?: string | null
        ville?: string | null
        photo?: unknown
      }
      const photo = rr.photo
      const photoUrl =
        photo && typeof photo === 'object'
          ? ((photo as { sizes?: { thumbnail?: { url?: string | null } }; url?: string | null }).sizes?.thumbnail
              ?.url ??
              (photo as { url?: string | null }).url ??
              null)
          : null
      return {
        id: i.id as number,
        reseauteurId: rr.id,
        slug: rr.slug ?? null,
        prenom: rr.prenom ?? '',
        nom: rr.nom ?? '',
        ville: rr.ville ?? null,
        photoUrl,
        dateInscription: (i as { createdAt?: string }).createdAt ?? '',
      } as InscritSummary
    })
    .filter((x): x is InscritSummary => x !== null)
}
