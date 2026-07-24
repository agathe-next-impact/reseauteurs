/**
 * revendication-reseau.ts — Revendication d'une fiche de tête de réseau orpheline.
 *
 * Contexte : l'annuaire est seedé avec ~200 réseaux nationaux « nom seul »
 * (`seed-reseaux-nationaux.ts`) — publiés, sans compte propriétaire (`user` null,
 * `source: 'importe'`). Ces fiches doivent pouvoir être revendiquées depuis le front,
 * par un nouvel utilisateur (à l'inscription) comme par un utilisateur déjà connecté.
 *
 * Source unique de vérité des deux questions :
 *   1. cette fiche est-elle revendicable ?          → `chargerReseauRevendicable`
 *   2. ce compte a-t-il le droit de revendiquer ?   → `eligibiliteCompte`
 *
 * L'écriture elle-même (`revendiquerPour`) est RACE-SAFE : la mise à jour est
 * conditionnée à `user: { exists: false }`, donc deux revendications simultanées
 * ne peuvent pas aboutir toutes les deux — c'est le même garde que le claim à
 * l'inscription (hook afterChange de Users, `req.context.claimReseauId`).
 *
 * Invariant ADR-0014 préservé : on ne touche PAS au `statut` de la fiche. Une fiche
 * importée déjà publiée le reste après revendication (« fiches importées épargnées ») ;
 * seul `source` passe à 'revendique', ce qui la rend désormais sujette à la
 * dépublication par le webhook/cron en cas d'expiration d'abonnement.
 */
import type { Payload } from 'payload'

export interface ReseauRevendicable {
  id: number | string
  nom: string
  slug: string | null
  ville: string | null
}

export type ResultatFiche =
  | { ok: true; reseau: ReseauRevendicable }
  | { ok: false; error: string }

export type ResultatCompte =
  | { ok: true }
  | { ok: false; error: string }

/** Compte minimal nécessaire aux contrôles (toujours lu FRAIS, jamais le JWT). */
export interface CompteRevendiquant {
  id: number | string
  role?: string | null
}

/** Extrait l'id d'une relation Payload, peuplée ou non. */
function relationId(rel: unknown): number | string | null {
  if (rel === null || rel === undefined) return null
  if (typeof rel === 'object') return (rel as { id?: number | string }).id ?? null
  return rel as number | string
}

/**
 * Charge une fiche et vérifie qu'elle est revendicable.
 *
 * Conditions cumulatives :
 *   - la fiche existe ;
 *   - c'est une TÊTE de réseau (`niveau !== 'local'`) — les groupes locaux se gèrent
 *     par affiliation, pas par revendication ;
 *   - elle est publiée (une fiche suspendue n'est pas exposée au public) ;
 *   - elle n'a pas déjà de compte propriétaire (`reseau.user`) ;
 *   - AUCUN compte n'existe déjà avec l'email de contact de la fiche. Un tel compte
 *     est le représentant légitime du réseau : la fiche ne s'ouvre donc PAS à une
 *     revendication publique (qui permettrait à un tiers de la détourner). Le
 *     rattachement se fait alors côté admin (champ « Compte propriétaire »).
 */
export async function chargerReseauRevendicable(
  payload: Payload,
  reseauId: number | string,
): Promise<ResultatFiche> {
  let doc: Record<string, unknown> | null = null
  try {
    doc = (await payload.findByID({
      collection: 'reseaux',
      id: reseauId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    doc = null
  }
  if (!doc) return { ok: false, error: 'Ce réseau est introuvable.' }

  if (doc.niveau === 'local') {
    return {
      ok: false,
      error:
        'Ce réseau est un groupe local : il se rattache à une tête de réseau, il ne se revendique pas.',
    }
  }
  if (doc.statut !== 'publiee') {
    return { ok: false, error: 'Cette fiche n\'est pas disponible.' }
  }
  if (relationId(doc.user) != null) {
    return { ok: false, error: 'Ce réseau est déjà géré par un compte.' }
  }

  // Un compte organisateur/admin existe déjà avec l'email de contact → c'est le
  // représentant du réseau. La fiche lui est rattachée AUTOMATIQUEMENT (voir
  // rattacherFicheACompte, déclenché à la vérification d'email et à l'écriture de la
  // fiche). En attendant que ce rattachement s'applique, on ferme la revendication
  // publique pour empêcher un tiers de s'emparer de la fiche.
  const compteAssocie = await compteRattachableParEmail(payload, doc.emailContact)
  if (compteAssocie) {
    return {
      ok: false,
      error:
        'Ce réseau est rattaché à un compte (adresse de contact). Connectez-vous avec l\'adresse du réseau pour le gérer.',
    }
  }

  return {
    ok: true,
    reseau: {
      id: doc.id as number | string,
      nom: String(doc.nom ?? ''),
      slug: (doc.slug as string | null) ?? null,
      ville: (doc.ville as string | null) ?? null,
    },
  }
}

// ─────────────────────────────────────────────
// RATTACHEMENT AUTOMATIQUE PAR EMAIL DE CONTACT
// ─────────────────────────────────────────────
//
// Objectif : plus AUCUN geste admin pour associer une fiche à son représentant.
// Dès qu'une fiche de tête orpheline et un compte partagent la même adresse
// (`reseau.emailContact` == `users.email`), la fiche est liée au compte, tout seul.
//
// Deux déclencheurs (même helper `rattacherFicheACompte`) :
//   - vérification d'email d'un compte  → `rattacherFichesParEmail` (verify route) ;
//   - écriture d'une fiche (email posé)  → hook afterChange de Reseaux.
//
// Choix de sûreté (volontairement conservateurs) :
//   - éligibles : `organisateur` et `admin` UNIQUEMENT. On ne rattache pas à un
//     réseauteur/partenaire et on n'escalade JAMAIS un rôle automatiquement (ni
//     profil orphelin, ni élévation de privilège silencieuse) ;
//   - invariant « 1 tête par compte » respecté (skip si le compte en possède déjà) ;
//   - `source` inchangé : une fiche importée reste publiée (pas de dépublication) ;
//   - écriture race-safe (`user exists false`) ; contexte `autoRattachement` pour
//     couper la récursion du hook afterChange.

/** Rôles autorisés à se voir rattacher une tête de réseau. */
function roleRattachable(role?: string | null): boolean {
  return role === 'organisateur' || role === 'admin'
}

/** Compte ÉLIGIBLE (organisateur/admin) portant cet email de contact, s'il existe. */
export async function compteRattachableParEmail(
  payload: Payload,
  emailContact: unknown,
): Promise<CompteRevendiquant | null> {
  const email = typeof emailContact === 'string' ? emailContact.trim().toLowerCase() : ''
  if (!email) return null
  // Emails d'auth normalisés en minuscules par Payload → comparaison directe.
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const u = docs[0] as { id?: number | string; role?: string | null } | undefined
  if (!u || !roleRattachable(u.role)) return null
  return { id: u.id as number | string, role: (u.role as string | null) ?? null }
}

/**
 * Lie une fiche de tête ORPHELINE à un compte éligible, de façon atomique.
 * Retourne `true` si le lien a été posé par CET appel. Ne jette jamais.
 *
 * `req` (facultatif) : quand l'appel vient d'un hook afterChange de Reseaux, on
 * REJOINT la transaction en cours — sinon le `update` s'exécute dans une transaction
 * séparée qui ne voit pas encore la ligne créée (fiche invisible → aucun lien posé).
 * Depuis une route (verify), pas de transaction ouverte → on n'en passe pas.
 *
 * Récursion : la mise à jour re-déclenche l'afterChange, mais la fiche porte alors
 * `user` → le hook de rattachement s'arrête à sa garde `doc.user != null`. Pas de
 * drapeau de contexte (qui écraserait le `req.context` partagé de l'opération hôte).
 */
export async function rattacherFicheACompte(
  payload: Payload,
  reseauId: number | string,
  user: CompteRevendiquant,
  req?: unknown,
): Promise<boolean> {
  if (!roleRattachable(user.role)) return false
  const reqOpt = req ? { req: req as never } : {}

  // Invariant « 1 tête par compte » : ne rien lier si le compte en possède déjà une.
  const { totalDocs } = await payload.count({
    collection: 'reseaux',
    where: { and: [{ user: { equals: user.id } }, { niveau: { not_equals: 'local' } }] },
    overrideAccess: true,
    ...reqOpt,
  })
  if (totalDocs > 0) return false

  try {
    const { docs } = await payload.update({
      collection: 'reseaux',
      where: {
        and: [
          { id: { equals: reseauId } },
          { user: { exists: false } },
          { niveau: { not_equals: 'local' } },
          { statut: { equals: 'publiee' } },
        ],
      },
      data: { user: user.id } as never,
      overrideAccess: true,
      ...reqOpt,
    })
    return docs.length > 0
  } catch (err) {
    console.error('[rattacherFicheACompte] échec:', err)
    return false
  }
}

/**
 * Rattache au compte la (première) fiche de tête orpheline dont l'email de contact
 * correspond à celui du compte. Best-effort, idempotent, ne jette jamais.
 * Appelé à la vérification d'email d'un compte.
 */
export async function rattacherFichesParEmail(
  payload: Payload,
  user: { id: number | string; email?: string | null; role?: string | null },
): Promise<number> {
  if (!roleRattachable(user.role)) return 0
  const email = (user.email ?? '').trim().toLowerCase()
  if (!email) return 0

  try {
    // Comparaison en JS : robuste au casse même si `emailContact` n'est pas normalisé
    // en base. Borné aux têtes orphelines publiées portant un email de contact.
    const { docs } = await payload.find({
      collection: 'reseaux',
      where: {
        and: [
          { niveau: { not_equals: 'local' } },
          { statut: { equals: 'publiee' } },
          { user: { exists: false } },
          { emailContact: { exists: true } },
        ],
      },
      depth: 0,
      limit: 200,
      overrideAccess: true,
      select: { emailContact: true } as Record<string, boolean>,
    })
    const matches = docs.filter(
      (d) => String((d as { emailContact?: unknown }).emailContact ?? '').trim().toLowerCase() === email,
    )
    if (matches.length === 0) return 0

    const ok = await rattacherFicheACompte(payload, matches[0].id, { id: user.id, role: user.role })
    if (ok && matches.length > 1) {
      console.warn(
        `[rattacherFichesParEmail] ${email}: ${matches.length} fiches correspondent — une seule liée (#${matches[0].id}).`,
      )
    }
    return ok ? 1 : 0
  } catch (err) {
    console.error('[rattacherFichesParEmail] échec:', err)
    return 0
  }
}

/**
 * Vérifie qu'un compte EXISTANT peut revendiquer une tête de réseau.
 *
 * Règles (volontairement strictes — revendiquer, c'est prendre le contrôle d'une
 * fiche publique) :
 *   - admin : toujours autorisé ;
 *   - organisateur SANS tête de réseau : autorisé (c'est le cas nominal) ;
 *   - organisateur possédant DÉJÀ une tête : refusé — invariant « 1 tête par compte »
 *     (cf. `canCreateNational`). Fusionner deux fiches est une opération admin ;
 *   - réseauteur / partenaire : refusé. Passer organisateur est un changement de
 *     rôle, donc d'autorisations : il n'est pas accordé automatiquement depuis une
 *     page publique.
 */
export async function eligibiliteCompte(
  payload: Payload,
  user: CompteRevendiquant,
): Promise<ResultatCompte> {
  if (user.role === 'admin') return { ok: true }

  if (user.role !== 'organisateur') {
    return {
      ok: false,
      error:
        'Seul un compte organisateur peut gérer un réseau. Votre compte actuel ne permet pas de revendiquer cette fiche — créez un compte organisateur ou contactez-nous.',
    }
  }

  const { totalDocs } = await payload.count({
    collection: 'reseaux',
    where: {
      and: [{ user: { equals: user.id } }, { niveau: { not_equals: 'local' } }],
    },
    overrideAccess: true,
  })
  if (totalDocs > 0) {
    return {
      ok: false,
      error:
        'Votre compte gère déjà un réseau. Un compte ne peut piloter qu\'une seule tête de réseau — contactez-nous pour un rattachement.',
    }
  }

  return { ok: true }
}

/**
 * Consomme la revendication mise en attente d'un compte, APRÈS vérification de son
 * email (décision 2026-07-22). C'est le seul moment où une fiche change de mains via
 * le parcours d'inscription : tant que l'email n'est pas vérifié, aucune fiche n'est
 * immobilisée par un compte qui ne pourra jamais se connecter.
 *
 * Le champ `pendingClaimReseauId` est vidé dans TOUS les cas — succès comme échec :
 * une revendication perdue (fiche prise entre-temps) ne doit pas être retentée
 * indéfiniment à chaque passage.
 *
 * Repli : si la revendication échoue, on crée le réseau national que l'inscription
 * aurait créé sans revendication (même forme que le hook afterChange de Users —
 * `statut: 'suspendue'`, publié par le webhook Stripe uniquement, ADR-0014). Sans ce
 * repli, un organisateur se retrouverait avec un compte sans aucun réseau.
 *
 * Ne jette jamais : la vérification d'email doit aboutir même si cette étape échoue.
 */
export async function resoudreClaimEnAttente(
  payload: Payload,
  user: { id: number | string; role?: string | null; nomSociete?: string | null; ville?: string | null },
): Promise<void> {
  try {
    const frais = (await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    })) as unknown as Record<string, unknown>

    const enAttente = frais?.pendingClaimReseauId
    const claimId = enAttente != null ? Number(enAttente) : NaN
    if (!Number.isInteger(claimId) || claimId <= 0) return

    // Toujours purger le marqueur, quelle que soit l'issue.
    const purger = async () => {
      try {
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { pendingClaimReseauId: null } as never,
          context: { webhookTrusted: true },
          overrideAccess: true,
        })
      } catch (err) {
        console.error('[resoudreClaimEnAttente] purge du marqueur impossible:', err)
      }
    }

    // Un compte qui possède déjà une tête ne revendique pas (invariant 1 tête/compte).
    const eligible = await eligibiliteCompte(payload, {
      id: user.id,
      role: (frais.role as string | null) ?? user.role ?? null,
    })

    let revendique = false
    if (eligible.ok) {
      const fiche = await chargerReseauRevendicable(payload, claimId)
      if (fiche.ok) {
        const res = await revendiquerPour(payload, fiche.reseau.id, user.id)
        revendique = res.ok
        if (!res.ok) {
          console.warn(
            `[resoudreClaimEnAttente] revendication perdue pour le réseau ${claimId}: ${res.error}`,
          )
        }
      } else {
        console.warn(
          `[resoudreClaimEnAttente] fiche ${claimId} non revendicable: ${fiche.error}`,
        )
      }
    }

    await purger()

    if (revendique) return

    // Repli : aucun réseau rattaché → on crée celui de l'inscription classique.
    const { totalDocs } = await payload.count({
      collection: 'reseaux',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    if (totalDocs > 0) return

    await payload.create({
      collection: 'reseaux',
      data: {
        user: user.id,
        nom: (frais.nomSociete as string | null) ?? user.nomSociete ?? 'Mon réseau',
        ville: (frais.ville as string | null) ?? user.ville ?? undefined,
        niveau: 'national',
        statut: 'suspendue', // ADR-0014 : publiée par le webhook Stripe uniquement
        source: 'revendique',
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    // La vérification d'email reste un succès — on ne la compromet pas.
    console.error('[resoudreClaimEnAttente] échec:', err)
  }
}

/**
 * Attribue la fiche au compte, de façon atomique.
 *
 * Le `where` sur `user: { exists: false }` est le garde anti-course : si une autre
 * revendication est passée entre-temps, `updated` est vide et on renvoie une erreur
 * explicite plutôt que d'écraser le propriétaire légitime.
 *
 * `statut` n'est délibérément pas touché (cf. invariant ADR-0014 en tête de fichier).
 */
export async function revendiquerPour(
  payload: Payload,
  reseauId: number | string,
  userId: number | string,
): Promise<ResultatCompte> {
  try {
    const { docs: updated } = await payload.update({
      collection: 'reseaux',
      where: {
        and: [{ id: { equals: reseauId } }, { user: { exists: false } }],
      },
      data: { user: userId, source: 'revendique' } as never,
      overrideAccess: true,
    })
    if (updated.length === 0) {
      return { ok: false, error: 'Ce réseau vient d\'être revendiqué par un autre compte.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('[revendiquerPour] échec:', err)
    return { ok: false, error: 'La revendication a échoué. Réessayez.' }
  }
}
