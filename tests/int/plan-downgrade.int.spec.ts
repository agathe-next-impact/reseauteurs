import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests fonctionnels de `downgradeUserAndClearFields` (lib/plan-downgrade.ts).
 *
 * Couvre :
 *  - downgradeToGratuit : champs Premium fiche vides, detach groupe, transfert
 *    ownership / soft-delete, recalc palier, emails auto-left + ownership.
 *  - downgradeToPremium : nettoyage Infinite-only (videoYoutube, description >
 *    100 mots, illustrations > 1), archivage des evenements actifs.
 *
 * Les invariants verifies sont ceux qui sont impossibles a tester en manuel sans
 * monter une recette complete : effet en cascade sur le groupe, idempotence
 * best-effort, robustesse aux throws.
 */

const {
  mockFindByID,
  mockFind,
  mockUpdate,
  mockCreate,
  mockRecalc,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockFindByID: vi.fn(),
  mockFind: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockRecalc: vi.fn(async (..._args: any[]) => undefined),
  mockSendEmail: vi.fn(async (..._args: any[]) => ({ sent: true })),
}))

vi.mock('@/lib/groupes', () => ({
  recalculerEtAppliquerPalier: mockRecalc,
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/emails', () => ({
  groupeAutoLeftDowngradeEmail: vi.fn(() => '<html>auto-left</html>'),
  groupeOwnershipTransferredEmail: vi.fn(() => '<html>transfer</html>'),
}))

import { downgradeUserAndClearFields } from '@/lib/plan-downgrade'
import type { Payload } from 'payload'

function makePayload(): Payload {
  return {
    findByID: mockFindByID,
    find: mockFind,
    update: mockUpdate,
    create: mockCreate,
  } as unknown as Payload
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── downgradeToGratuit — sans groupe ─────────────────────────────────────────

describe('downgradeToGratuit — utilisateur sans groupe', () => {
  it('vide tous les champs Premium de la fiche fournisseur', async () => {
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return { id: 7, email: 'u@x.com', nomSociete: 'Acme', groupe: null }
      }
      return null
    })
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') return { docs: [{ id: 99 }] }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' })

    // 1. update users : plan gratuit, sub null, planExpiresAt null, PAS de detach (pas de groupe)
    const userUpdate = mockUpdate.mock.calls.find(
      (c) => c[0].collection === 'users' && c[0].id === 7,
    )
    expect(userUpdate).toBeDefined()
    expect(userUpdate![0].data).toMatchObject({
      plan: 'gratuit',
      stripeSubscriptionId: null,
      planExpiresAt: null,
    })
    expect(userUpdate![0].data).not.toHaveProperty('groupe')
    expect(userUpdate![0].context).toMatchObject({ webhookTrusted: true })

    // 2. update fournisseurs : tous les champs Premium vides
    const ficheUpdate = mockUpdate.mock.calls.find(
      (c) => c[0].collection === 'fournisseurs' && c[0].id === 99,
    )
    expect(ficheUpdate).toBeDefined()
    expect(ficheUpdate![0].data).toMatchObject({
      adresse: '',
      codePostal: '',
      siteWeb: '',
      boutiqueEnLigne: '',
      lienDevis: '',
      emailContact: '',
      telephone: '',
      description: '',
      descriptionRSE: '',
      videoYoutube: '',
      banniere: null,
      activitesSecondaires: [],
      labelsRSE: [],
      reseauxSociaux: [],
      illustrations: [],
    })

    // 3. recalc palier non appele (pas de groupe)
    expect(mockRecalc).not.toHaveBeenCalled()
    // 4. aucun email envoye
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('ne crash pas si la fiche fournisseur n\'existe pas', async () => {
    mockFindByID.mockResolvedValue({ id: 7, email: 'u@x.com', nomSociete: 'Acme', groupe: null })
    mockFind.mockResolvedValue({ docs: [] })

    await expect(
      downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' }),
    ).resolves.toBeUndefined()

    // user.update a quand meme eu lieu
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 7 }),
    )
    // pas d'update fournisseurs
    expect(
      mockUpdate.mock.calls.find((c) => c[0].collection === 'fournisseurs'),
    ).toBeUndefined()
  })

  it('reste robuste si payload.find(fournisseurs) throw — le user est quand meme downgrade', async () => {
    mockFindByID.mockResolvedValue({ id: 7, email: 'u@x.com', nomSociete: 'Acme', groupe: null })
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') throw new Error('DB read failed')
      return { docs: [] }
    })

    await expect(
      downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' }),
    ).resolves.toBeUndefined()

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 7 }),
    )
  })
})

// ── downgradeToGratuit — membre simple d'un groupe ────────────────────────────

describe('downgradeToGratuit — membre simple d\'un groupe (non-owner)', () => {
  it('detach le groupe, recalc le palier, envoie l\'email auto-left', async () => {
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7,
          email: 'u@x.com',
          nomSociete: 'Acme',
          groupe: { id: 42, nom: 'Mon Groupe' },
        }
      }
      if (collection === 'groupes') {
        return {
          id: 42,
          nom: 'Mon Groupe',
          code: 'GRP-AAAAAA',
          owner: 99, // pas le user 7
          palierActuel: '5',
          deletedAt: null,
        }
      }
      return null
    })
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') return { docs: [{ id: 88 }] }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' })

    // detach : data contient groupe: null
    const userUpdate = mockUpdate.mock.calls.find(
      (c) => c[0].collection === 'users' && c[0].id === 7,
    )
    expect(userUpdate![0].data).toMatchObject({ plan: 'gratuit', groupe: null })

    // pas de transfert ni soft-delete (l'utilisateur n'etait pas owner)
    const groupeUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'groupes')
    expect(groupeUpdate).toBeUndefined()
    const auditCreate = mockCreate.mock.calls.find((c) => c[0].collection === 'audit-logs')
    expect(auditCreate).toBeUndefined()

    // recalc palier appele avec le groupeId capture AVANT detach
    expect(mockRecalc).toHaveBeenCalledTimes(1)
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)

    // email auto-left envoye au user
    const autoLeftCall = mockSendEmail.mock.calls.find(
      (c) => c[0].kind === 'groupe-auto-left-downgrade',
    )
    expect(autoLeftCall).toBeDefined()
    expect(autoLeftCall![0].to).toBe('u@x.com')
    expect(autoLeftCall![0].userId).toBe(7)
  })

  it('n\'envoie pas l\'email auto-left si groupeNom n\'a pas pu etre resolu (depth=1 a echoue)', async () => {
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        // groupe n'est qu'un id (pas resolu en objet)
        return { id: 7, email: 'u@x.com', nomSociete: 'Acme', groupe: 42 }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'X', code: 'GRP-X', owner: 99, palierActuel: '0', deletedAt: null }
      }
      return null
    })
    mockFind.mockResolvedValue({ docs: [] })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' })

    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
    // pas d'email auto-left (groupeNom null car groupe non resolu en objet)
    const autoLeft = mockSendEmail.mock.calls.find(
      (c) => c[0].kind === 'groupe-auto-left-downgrade',
    )
    expect(autoLeft).toBeUndefined()
  })
})

// ── downgradeToGratuit — owner avec membres restants ──────────────────────────

describe('downgradeToGratuit — owner avec membres restants', () => {
  it('transfere l\'ownership au plus ancien membre, audit-log, email transfert', async () => {
    let groupesRead = 0
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7,
          email: 'owner@x.com',
          nomSociete: 'Owner Co',
          groupe: { id: 42, nom: 'Mon Groupe' },
        }
      }
      if (collection === 'groupes') {
        groupesRead += 1
        // 1er read = groupeBefore (avant transfert), 2e = refreshed (apres)
        const refreshed = groupesRead >= 2
        return {
          id: 42,
          nom: 'Mon Groupe',
          code: 'GRP-AAAAAA',
          owner: refreshed ? 8 : 7,
          palierActuel: '10',
          deletedAt: null,
        }
      }
      return null
    })
    mockFind.mockImplementation(
      async ({ collection, sort }: { collection: string; sort?: string }) => {
        if (collection === 'users' && sort === 'createdAt') {
          // plus ancien membre restant (apres detach du user 7)
          return { docs: [{ id: 8, email: 'next@x.com', nomSociete: 'Next Co' }] }
        }
        if (collection === 'fournisseurs') return { docs: [] }
        return { docs: [] }
      },
    )

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' })

    // transfert ownership : update du groupe avec owner = 8
    const ownerUpdate = mockUpdate.mock.calls.find(
      (c) => c[0].collection === 'groupes' && c[0].id === 42,
    )
    expect(ownerUpdate).toBeDefined()
    expect(ownerUpdate![0].data).toEqual({ owner: 8 })

    // audit-log groupe_ownership_transferred
    const auditCall = mockCreate.mock.calls.find(
      (c) => c[0].collection === 'audit-logs',
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![0].data).toMatchObject({
      type: 'groupe_ownership_transferred',
      metadata: expect.objectContaining({
        groupeId: '42',
        reason: 'previous_owner_downgraded',
      }),
    })

    // email envoye au nouveau owner (kind group-left-owner)
    const transferEmail = mockSendEmail.mock.calls.find(
      (c) => c[0].kind === 'group-left-owner',
    )
    expect(transferEmail).toBeDefined()
    expect(transferEmail![0].to).toBe('next@x.com')
    expect(transferEmail![0].userId).toBe(8)

    // recalc palier appele apres
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
  })
})

// ── downgradeToGratuit — owner sans membre restant ────────────────────────────

describe('downgradeToGratuit — owner sans membre restant', () => {
  it('soft-delete le groupe, audit-log, pas de transfert', async () => {
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7,
          email: 'owner@x.com',
          nomSociete: 'Owner Co',
          groupe: { id: 42, nom: 'Mon Groupe' },
        }
      }
      if (collection === 'groupes') {
        return {
          id: 42,
          nom: 'Mon Groupe',
          code: 'GRP-SOLO',
          owner: 7,
          palierActuel: '0',
          deletedAt: null,
        }
      }
      return null
    })
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') return { docs: [] } // aucun membre restant
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' })

    // groupe.update avec deletedAt set
    const groupeUpdate = mockUpdate.mock.calls.find(
      (c) => c[0].collection === 'groupes' && c[0].id === 42,
    )
    expect(groupeUpdate).toBeDefined()
    expect(groupeUpdate![0].data).toHaveProperty('deletedAt')
    expect(typeof groupeUpdate![0].data.deletedAt).toBe('string')
    // pas de transfert d'ownership (pas de champ owner)
    expect(groupeUpdate![0].data).not.toHaveProperty('owner')

    // audit-log groupe_soft_deleted
    const auditCall = mockCreate.mock.calls.find(
      (c) => c[0].collection === 'audit-logs',
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![0].data).toMatchObject({
      type: 'groupe_soft_deleted',
      metadata: expect.objectContaining({
        groupeId: '42',
        groupeNom: 'Mon Groupe',
        groupeCode: 'GRP-SOLO',
        reason: 'owner_downgraded_no_members',
      }),
    })

    // pas d'email de transfert
    const transferEmail = mockSendEmail.mock.calls.find(
      (c) => c[0].kind === 'group-left-owner',
    )
    expect(transferEmail).toBeUndefined()

    // recalc palier appele quand meme (idempotent sur groupe vide)
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
  })
})

// ── downgradeToGratuit — groupe deja soft-deleted ─────────────────────────────

describe('downgradeToGratuit — owner d\'un groupe deja soft-deleted', () => {
  it('ne re-soft-delete pas et ne transfere pas l\'ownership', async () => {
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7,
          email: 'owner@x.com',
          nomSociete: 'Owner Co',
          groupe: { id: 42, nom: 'Mon Groupe' },
        }
      }
      if (collection === 'groupes') {
        return {
          id: 42,
          nom: 'Mon Groupe',
          code: 'GRP-DEAD',
          owner: 7,
          palierActuel: '0',
          deletedAt: '2026-01-01T00:00:00Z', // deja soft-deleted
        }
      }
      return null
    })
    mockFind.mockResolvedValue({ docs: [] })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'gratuit' })

    // pas d'update groupes (ni soft-delete ni transfert)
    const groupeUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'groupes')
    expect(groupeUpdate).toBeUndefined()

    // pas d'audit groupe_soft_deleted ni groupe_ownership_transferred
    const audit = mockCreate.mock.calls.find((c) => c[0].collection === 'audit-logs')
    expect(audit).toBeUndefined()

    // recalc palier toujours appele
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
  })
})

// ── downgradeToPremium — nettoyage Infinite-only ─────────────────────────────

describe('downgradeToPremium — nettoyage des champs Infinite-only', () => {
  it('vide videoYoutube, conserve description courte, conserve illustrations <= 1', async () => {
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') {
        return {
          docs: [
            {
              id: 99,
              description: 'Une description courte de 50 mots maximum.', // <= 100 mots
              illustrations: [{ image: 'media1' }], // 1 illustration
            },
          ],
        }
      }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    const ficheUpdate = mockUpdate.mock.calls.find(
      (c) => c[0].collection === 'fournisseurs' && c[0].id === 99,
    )
    expect(ficheUpdate).toBeDefined()
    expect(ficheUpdate![0].data).toEqual({ videoYoutube: '' })
    // description NON videe (<= 100 mots)
    expect(ficheUpdate![0].data).not.toHaveProperty('description')
    // illustrations NON tronquees (<= 1)
    expect(ficheUpdate![0].data).not.toHaveProperty('illustrations')
  })

  it('vide la description si > 100 mots (au lieu de tronquer au milieu d\'une phrase)', async () => {
    const longDescription = Array.from({ length: 150 }, (_, i) => `mot${i}`).join(' ')
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') {
        return { docs: [{ id: 99, description: longDescription, illustrations: [] }] }
      }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    const ficheUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'fournisseurs')
    expect(ficheUpdate![0].data.description).toBe('')
    // verrou : pas de troncature partielle
    expect(ficheUpdate![0].data.description).not.toContain('mot')
  })

  it('tronque les illustrations a 1 (slice 0..1) si > 1', async () => {
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') {
        return {
          docs: [
            {
              id: 99,
              description: '',
              illustrations: [
                { image: 'm1' },
                { image: 'm2' },
                { image: 'm3' },
                { image: 'm4' },
                { image: 'm5' },
                { image: 'm6' },
              ],
            },
          ],
        }
      }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    const ficheUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'fournisseurs')
    expect(ficheUpdate![0].data.illustrations).toHaveLength(1)
    expect(ficheUpdate![0].data.illustrations[0]).toEqual({ image: 'm1' })
  })

  it('archive les evenements actifs lies a la fiche fournisseur', async () => {
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') return { docs: [{ id: 99, illustrations: [] }] }
      if (collection === 'organisateurs-evenements') return { docs: [] }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    const eventUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'evenements')
    expect(eventUpdate).toBeDefined()
    expect(eventUpdate![0].data).toEqual({ statut: 'archive' })
    expect(eventUpdate![0].where).toEqual({
      and: [
        { statut: { not_equals: 'archive' } },
        { or: [{ fournisseur: { equals: 99 } }] },
      ],
    })
  })

  it('archive aussi les evenements lies a la fiche organisateur (si elle existe)', async () => {
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') return { docs: [{ id: 99, illustrations: [] }] }
      if (collection === 'organisateurs-evenements') return { docs: [{ id: 77 }] }
      return { docs: [] }
    })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    const eventUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'evenements')
    expect(eventUpdate).toBeDefined()
    const where = eventUpdate![0].where as { and: Array<Record<string, unknown>> }
    const orClause = where.and.find((c) => 'or' in c) as { or: Array<Record<string, unknown>> }
    expect(orClause.or).toEqual(
      expect.arrayContaining([
        { fournisseur: { equals: 99 } },
        { organisateurExterne: { equals: 77 } },
      ]),
    )
  })

  it('ne touche PAS a user.plan / stripeSubscriptionId / planExpiresAt (le webhook s\'en charge)', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    // aucun update sur la collection users
    const userUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'users')
    expect(userUpdate).toBeUndefined()
    // aucun email ni recalc (le user reste dans son groupe en Premium ou non — pas notre job ici)
    expect(mockRecalc).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('ne crash pas si la fiche fournisseur n\'existe pas (orgId seul)', async () => {
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'fournisseurs') return { docs: [] }
      if (collection === 'organisateurs-evenements') return { docs: [{ id: 77 }] }
      return { docs: [] }
    })

    await expect(
      downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' }),
    ).resolves.toBeUndefined()

    // pas d'update fournisseurs
    const ficheUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'fournisseurs')
    expect(ficheUpdate).toBeUndefined()
    // mais update evenements quand meme via orgId
    const eventUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'evenements')
    expect(eventUpdate).toBeDefined()
  })

  it('ne tente AUCUN update evenements si ni fiche fournisseur ni organisateur', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await downgradeUserAndClearFields(makePayload(), 7, { targetLevel: 'premium' })

    const eventUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'evenements')
    expect(eventUpdate).toBeUndefined()
  })
})

// ── targetLevel par defaut = 'gratuit' ───────────────────────────────────────

describe('downgradeUserAndClearFields — defaut targetLevel', () => {
  it('appelle downgradeToGratuit si options omises', async () => {
    mockFindByID.mockResolvedValue({ id: 7, email: 'u@x.com', nomSociete: 'Acme', groupe: null })
    mockFind.mockResolvedValue({ docs: [] })

    await downgradeUserAndClearFields(makePayload(), 7)

    const userUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'users')
    expect(userUpdate).toBeDefined()
    expect(userUpdate![0].data).toMatchObject({ plan: 'gratuit' })
  })
})
