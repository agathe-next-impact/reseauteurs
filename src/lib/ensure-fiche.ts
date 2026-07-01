import type { Payload } from 'payload'
import type { User } from '@/payload-types'

/**
 * Garantit qu'un user `fournisseur` possede une fiche. Si aucune n'existe,
 * en cree une en `publiee` SANS activitePrincipale (l'utilisateur la complete
 * depuis /dashboard/fiche). Pas de fallback "premiere categorie par ordre" :
 * cela trompait l'utilisateur en lui attribuant une activite qu'il n'avait
 * jamais choisie. Appelable a la demande pour rattraper les comptes dont la
 * creation auto a echoue dans Users.afterChange.
 */
export async function ensureFournisseurFiche(payload: Payload, user: User): Promise<void> {
  if (user.role !== 'fournisseur') return

  const { totalDocs } = await payload.count({
    collection: 'fournisseurs',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })
  if (totalDocs > 0) return

  await payload.create({
    collection: 'fournisseurs',
    data: {
      user: user.id,
      raisonSociale: user.nomSociete,
      ville: user.ville,
      statut: 'publiee',
    },
    overrideAccess: true,
  })
}

/**
 * Garantit qu'un user `organisateur` possede une fiche organisateur.
 */
export async function ensureOrganisateurFiche(payload: Payload, user: User): Promise<void> {
  if (user.role !== 'organisateur') return

  const { totalDocs } = await payload.count({
    collection: 'organisateurs-evenements',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })
  if (totalDocs > 0) return

  await payload.create({
    collection: 'organisateurs-evenements',
    data: {
      user: user.id,
      nom: user.nomSociete,
      ville: user.ville,
      statut: 'publiee',
    },
    overrideAccess: true,
  })
}
