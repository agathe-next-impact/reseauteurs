/**
 * notif-local-affilie.ts — Notification du réseau national lors de l'affiliation
 * d'un nouveau groupe local (décision 2026-07-22).
 *
 * Appelé par les DEUX chemins de création d'un local :
 *   - `createMonReseauLocal` (réseauteur Plus, ADR-0014) — le cas qui motive la règle ;
 *   - `createLocalReseau` (organisateur national / admin) — no-op quand la tête crée
 *     elle-même le groupe, cf. la garde d'auto-notification ci-dessous.
 *
 * Contrat : cette fonction ne jette JAMAIS et ne renvoie rien d'exploitable comme
 * erreur métier. Une notification qui échoue ne doit pas faire échouer la création
 * du groupe — le réseau est créé, l'email est un effet de bord best-effort.
 */
import type { Payload } from 'payload'
import { sendEmail } from '@/lib/email-sender'
import { nouveauLocalAffilieEmail } from '@/lib/emails'

/** Extrait l'id d'une relation Payload, peuplée ou non. */
function relationId(rel: unknown): number | string | null {
  if (rel === null || rel === undefined) return null
  if (typeof rel === 'object') return (rel as { id?: number | string }).id ?? null
  return rel as number | string
}

export interface NotifierNationalInput {
  payload: Payload
  /** Tête de réseau à laquelle le groupe vient d'être rattaché. `null` = local indépendant → no-op. */
  parentId: number | string | null
  /** Nom du groupe local créé. */
  nomLocal: string
  /** Ville du groupe local (facultative). */
  villeLocal?: string | null
  /** Compte auteur de la création — sert à ne pas auto-notifier la tête. */
  createurUserId: number | string
  /** Nom affiché de l'auteur dans l'email. */
  createurNom: string
}

/**
 * Envoie l'email d'affiliation à la tête de réseau, si et seulement si :
 *   - le groupe est bien affilié (parentId non nul) ;
 *   - la tête existe ;
 *   - l'auteur n'est PAS le propriétaire de la tête (pas d'auto-notification) ;
 *   - un destinataire est résolvable (email du compte propriétaire, sinon
 *     l'email de contact public de la fiche).
 *
 * Toute autre situation est un no-op silencieux (tracé en console).
 */
export async function notifierNationalNouveauLocal({
  payload,
  parentId,
  nomLocal,
  villeLocal,
  createurUserId,
  createurNom,
}: NotifierNationalInput): Promise<void> {
  if (parentId == null) return // local indépendant — personne à prévenir

  try {
    // depth 1 : peuple `user` pour récupérer l'email du compte propriétaire.
    const parent = (await payload.findByID({
      collection: 'reseaux',
      id: parentId,
      depth: 1,
      overrideAccess: true,
    })) as unknown as Record<string, unknown> | null

    if (!parent) return

    const proprietaire = parent.user as { id?: number | string; email?: string | null } | null | undefined
    const proprietaireId = relationId(proprietaire)

    // La tête crée son propre groupe → ne pas s'auto-notifier.
    if (proprietaireId != null && String(proprietaireId) === String(createurUserId)) return

    // Destinataire : compte propriétaire en priorité, sinon contact public de la fiche
    // (fiche importée non revendiquée : `user` est null mais `emailContact` peut exister).
    const destinataire =
      (typeof proprietaire === 'object' && proprietaire?.email ? proprietaire.email : null) ??
      ((parent.emailContact as string | null | undefined) || null)

    if (!destinataire) {
      console.info(
        `[notifierNationalNouveauLocal] aucun destinataire pour le réseau ${String(parentId)} — notification ignorée.`,
      )
      return
    }

    const nomNational = String(parent.nom ?? 'votre réseau')

    await sendEmail({
      payload,
      kind: 'local-affilie-cree',
      to: destinataire,
      subject: `RÉSEAUTEURS — ${nomLocal} vient d'être rattaché à ${nomNational}`,
      html: nouveauLocalAffilieEmail({ nomNational, nomLocal, villeLocal, createurNom }),
      // Notification de gestion de compte : transactionnelle, pas de gate opt-in marketing.
      userId: proprietaireId ?? undefined,
    })
  } catch (err) {
    // Best-effort : la création du groupe a déjà réussi, on ne la compromet pas.
    console.error('[notifierNationalNouveauLocal] envoi impossible:', err)
  }
}
