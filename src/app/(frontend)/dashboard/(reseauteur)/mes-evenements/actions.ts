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
  description?: string
  dateDebut: string
  dateFin?: string
  lieuNom?: string
  lieuAdresse?: string
  lieuCodePostal?: string
  lieuVille: string
  lienInscription?: string
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
  return {
    titre: (data.titre ?? '').trim(),
    type: Number(data.type),
    description: opt(data.description),
    dateDebut: data.dateDebut,
    dateFin: opt(data.dateFin),
    lieuNom: opt(data.lieuNom),
    lieuAdresse: opt(data.lieuAdresse),
    lieuCodePostal: opt(data.lieuCodePostal),
    lieuVille: (data.lieuVille ?? '').trim(),
    lienInscription: opt(data.lienInscription),
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

  try {
    const doc = await ctx.payload.create({
      collection: 'evenements',
      data: {
        ...sanitize(data),
        organisateurReseauteur: Number(ctx.profil.id),
        statut: 'publie' as const,
      },
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
      data: sanitize(data) as Record<string, unknown>,
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
