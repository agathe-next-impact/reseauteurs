import type { Payload } from 'payload'
import type { Fournisseur } from '@/payload-types'

type FournisseurIdentity = Pick<Fournisseur, 'raisonSociale' | 'ville' | 'user'>

const MAX_ORPHAN_CLAIM_CANDIDATES = 5000

export function normalizeFournisseurIdentity(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getFournisseurIdentityKey(fournisseur: Pick<Fournisseur, 'raisonSociale' | 'ville'>): string {
  return [
    normalizeFournisseurIdentity(fournisseur.raisonSociale),
    normalizeFournisseurIdentity(fournisseur.ville),
  ].join('|')
}

export function hasLinkedUser(fournisseur: Pick<Fournisseur, 'user'>): boolean {
  return fournisseur.user != null
}

export function filterClaimedDuplicateOrphans<T extends FournisseurIdentity>(docs: T[]): T[] {
  const claimedKeys = new Set(
    docs
      .filter(hasLinkedUser)
      .map((doc) => getFournisseurIdentityKey(doc))
      .filter((key) => key !== '|'),
  )

  return docs.filter((doc) => hasLinkedUser(doc) || !claimedKeys.has(getFournisseurIdentityKey(doc)))
}

export async function findUniqueClaimableFournisseur(
  payload: Payload,
  identity: Pick<Fournisseur, 'raisonSociale' | 'ville'>,
): Promise<Pick<Fournisseur, 'id' | 'raisonSociale' | 'ville'> | null> {
  const targetKey = getFournisseurIdentityKey(identity)
  if (targetKey === '|') return null

  const { docs } = await payload.find({
    collection: 'fournisseurs',
    where: {
      and: [
        { statut: { equals: 'publiee' } },
        { user: { exists: false } },
      ],
    },
    depth: 0,
    limit: MAX_ORPHAN_CLAIM_CANDIDATES,
    overrideAccess: true,
    select: {
      raisonSociale: true,
      ville: true,
    },
  })

  const matches = docs.filter((doc) => getFournisseurIdentityKey(doc) === targetKey)
  return matches.length === 1 ? matches[0] : null
}
