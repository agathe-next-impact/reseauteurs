import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests fonctionnels des 4 routes API groupes :
 *   POST /api/groupes/create
 *   POST /api/groupes/join
 *   POST /api/groupes/leave
 *   POST /api/groupes/invite
 *
 * Couvre les chemins difficiles a tester en manuel : transitions ownership,
 * soft-delete, dedup emails, skip silencieux (anti-enumeration), normalisation
 * du code (uppercase + trim), rate-limit utilisateur 50/24h.
 *
 * Le palier Stripe est mocke ici (recalculerEtAppliquerPalier), il a son
 * propre fichier de tests dans groupes-stripe.int.spec.ts.
 */

const {
  mockAuth,
  mockFindByID,
  mockFind,
  mockUpdate,
  mockCreate,
  mockDelete,
  mockSendEmail,
  mockRecalc,
  mockSubsUpdate,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockFind: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(async (..._args: any[]) => ({})),
  mockSendEmail: vi.fn(async (..._args: any[]) => ({ sent: true })),
  mockRecalc: vi.fn(async (..._args: any[]) => undefined),
  mockSubsUpdate: vi.fn(async (..._args: any[]) => ({})),
  mockRateLimit: vi.fn((..._args: any[]) => ({ success: true, remaining: 9 })),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    find: mockFind,
    update: mockUpdate,
    create: mockCreate,
    // Route /api/groupes/leave hard-delete le groupe (payload.delete) quand
    // l'owner quitte sans membre restant — plus un soft-delete (deletedAt) :
    // le soft-delete laissait owner_id pointer sur le user parti, et la FK
    // ON DELETE SET NULL (colonne NOT NULL) bloquait la suppression de compte
    // (cf. commentaire src/app/api/groupes/leave/route.ts:121-127).
    delete: mockDelete,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers({ authorization: 'Bearer t' })),
}))

vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit }))
vi.mock('@/lib/email-sender', () => ({ sendEmail: mockSendEmail }))
vi.mock('@/lib/groupes', () => ({ recalculerEtAppliquerPalier: mockRecalc }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { update: mockSubsUpdate },
  },
}))

vi.mock('@/lib/emails', () => ({
  groupeCreatedEmail: vi.fn(() => '<html>created</html>'),
  groupeJoinedOwnerEmail: vi.fn(() => '<html>joined</html>'),
  groupeLeftOwnerEmail: vi.fn(() => '<html>left</html>'),
  groupeOwnershipTransferredEmail: vi.fn(() => '<html>transferred</html>'),
  groupInvitationEmail: vi.fn(() => '<html>invite</html>'),
}))

import { POST as createPOST } from '@/app/api/groupes/create/route'
import { POST as joinPOST } from '@/app/api/groupes/join/route'
import { POST as leavePOST } from '@/app/api/groupes/leave/route'
import { POST as invitePOST } from '@/app/api/groupes/invite/route'

function makeReq(url: string, body?: unknown): Request {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new Request(url, init)
}

const futureISO = () => new Date(Date.now() + 86_400_000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimit.mockReturnValue({ success: true, remaining: 9 })
})

// ════════════════════════════════════════════════════════════════════════════
// POST /api/groupes/create
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/groupes/create', () => {
  it('401 si non authentifie', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'X' }))
    expect(res.status).toBe(401)
  })

  it('400 si body invalide (nom vide)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: '' }))
    expect(res.status).toBe(400)
  })

  it('400 si l\'utilisateur appartient deja a un groupe', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'fournisseur', plan: 'infinite', planExpiresAt: futureISO(),
      groupe: 99, email: 'x@x.com', nomSociete: 'Acme',
    })
    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'Mon Groupe' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/deja a un groupe/i)
  })

  it('429 si rate-limit IP depasse', async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 })
    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'X' }))
    expect(res.status).toBe(429)
    // pas d'auth si rate-limit deja KO
    expect(mockAuth).not.toHaveBeenCalled()
  })

  // Gate corrige (bug produit dormant) : `getEffectiveFeatureLevel`
  // (src/collections/access.ts:107-118, réécrite ADR-0011) ne retourne plus
  // jamais 'infinite' (seulement 'acces' | 'developpement' | 'premium'), alors
  // que la route comparait encore `!== 'infinite'` → 403 pour absolument tout
  // utilisateur, y compris un admin. La fonctionnalite groupes/affiliation
  // reste DORMANTE (ADR-0009 : aucun point d'entree UI public), donc le gate a
  // ete realigne sur `role === 'admin'` (§5 de l'ADR : conservee pour
  // l'exploitation/support) plutot que reintroduire une notion de palier
  // 'infinite' qui n'existe plus dans le modele 3-entites.
  it('403 si l\'utilisateur n\'est pas admin (fonctionnalite dormante, reservee a l\'exploitation)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'reseauteur', groupe: null, email: 'x@x.com', nomSociete: 'Acme',
    })
    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'Mon Groupe' }))
    expect(res.status).toBe(403)
  })

  it('200 succes (admin) : cree groupe + attache user + recalc + audit + email', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'admin',
      groupe: null, email: 'owner@x.com', nomSociete: 'Acme',
    })
    mockCreate.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'groupes') {
        return { id: 42, nom: 'Mon Groupe', code: 'GRP-AAAAAA' }
      }
      return { id: 1 } // audit-logs
    })

    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'Mon Groupe' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 42, code: 'GRP-AAAAAA', nom: 'Mon Groupe' })

    // Etapes verifiees
    const groupeCreate = mockCreate.mock.calls.find((c) => c[0].collection === 'groupes')
    expect(groupeCreate![0].data).toMatchObject({ nom: 'Mon Groupe', owner: 7, palierActuel: '0' })

    const userUpdate = mockUpdate.mock.calls.find((c) => c[0].collection === 'users')
    expect(userUpdate![0]).toMatchObject({ id: 7, data: { groupe: 42 } })

    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)

    const audit = mockCreate.mock.calls.find((c) => c[0].collection === 'audit-logs')
    expect(audit![0].data).toMatchObject({
      type: 'groupe_created',
      metadata: expect.objectContaining({ groupeId: '42', groupeCode: 'GRP-AAAAAA' }),
    })

    const email = mockSendEmail.mock.calls.find((c) => c[0].kind === 'group-created')
    expect(email).toBeDefined()
    expect(email![0].to).toBe('owner@x.com')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// POST /api/groupes/join
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/groupes/join', () => {
  it('400 si l\'utilisateur appartient deja a un groupe', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'fournisseur', plan: 'infinite', planExpiresAt: futureISO(),
      groupe: 88, email: 'x@x.com', nomSociete: 'Acme',
    })
    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-XYZAB1' }))
    expect(res.status).toBe(400)
  })

  // Gate corrige (meme bug/cause que create — voir annotation ci-dessus) :
  // src/app/api/groupes/join/route.ts realignee sur `role === 'admin'`
  // (fonctionnalite dormante ADR-0009, gate testable et coherente au lieu
  // du palier 'infinite' disparu).
  it('403 si l\'utilisateur n\'est pas admin (fonctionnalite dormante, reservee a l\'exploitation)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'reseauteur', groupe: null, email: 'x@x.com', nomSociete: 'Acme',
    })
    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-XYZAB1' }))
    expect(res.status).toBe(403)
    // le lookup du groupe par code n'est jamais atteint si la gate rejette
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('404 si le code n\'existe pas (admin)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'admin',
      groupe: null, email: 'x@x.com', nomSociete: 'Acme',
    })
    mockFind.mockResolvedValue({ docs: [] })
    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-NOPE00' }))
    expect(res.status).toBe(404)
  })

  it('404 sur un groupe soft-deleted (clause deletedAt: { exists: false }) (admin)', async () => {
    // On verrouille le filtre cote `where` : un code rattache a un groupe
    // soft-delete (deletedAt non-null) ne doit pas matcher. Le mock find
    // renvoie [] mais on inspecte la clause envoyee a payload.find pour
    // s'assurer que la regle n'est jamais relachee accidentellement.
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'admin',
      groupe: null, email: 'x@x.com', nomSociete: 'Acme',
    })
    mockFind.mockResolvedValue({ docs: [] })

    await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-DEAD00' }))

    const findCall = mockFind.mock.calls.find((c) => c[0].collection === 'groupes')
    expect(findCall).toBeDefined()
    const where = findCall![0].where as { and: Array<Record<string, unknown>> }
    expect(where.and).toEqual(
      expect.arrayContaining([
        { code: { equals: 'GRP-DEAD00' } },
        { deletedAt: { exists: false } },
      ]),
    )
  })

  it('normalise le code en uppercase + trim avant lookup (admin)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, role: 'admin',
      groupe: null, email: 'x@x.com', nomSociete: 'Acme',
    })
    mockFind.mockResolvedValue({ docs: [] })

    await joinPOST(makeReq('http://l/api/groupes/join', { code: '  grp-abcdef  ' }))

    const findCall = mockFind.mock.calls.find((c) => c[0].collection === 'groupes')
    const where = findCall![0].where as { and: Array<Record<string, unknown>> }
    const codeClause = where.and.find((c) => 'code' in c) as { code: { equals: string } }
    expect(codeClause.code.equals).toBe('GRP-ABCDEF')
  })

  it('200 succes (admin) : update + recalc + audit + email owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    // refreshed (apres recalc) renvoie le palier "post-bump". Le mock recalc
    // ne touche pas la DB ; on simule donc le post-recalc directement dans
    // findByID('groupes').
    mockFindByID.mockImplementation(async ({ collection, id }: { collection: string; id: unknown }) => {
      if (collection === 'users') {
        if (id === 7) {
          return {
            id: 7, role: 'admin',
            groupe: null, email: 'joiner@x.com', nomSociete: 'Joiner Co',
          }
        }
        if (id === 99) {
          return { id: 99, email: 'owner@x.com', nomSociete: 'Owner Co' }
        }
      }
      if (collection === 'groupes') {
        return {
          id: 42, nom: 'Mon Groupe', code: 'GRP-XYZAB1',
          owner: 99, palierActuel: '5', // palier post-recalc (3e Infinite vient d'arriver)
        }
      }
      return null
    })
    mockFind.mockResolvedValue({
      docs: [{ id: 42, nom: 'Mon Groupe', code: 'GRP-XYZAB1', owner: 99, palierActuel: '0' }],
    })

    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-XYZAB1' }))

    expect(res.status).toBe(200)

    // user attache au groupe
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 7, data: { groupe: 42 } }),
    )
    // recalc palier
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
    // audit groupe_joined avec palier APRES (refresh)
    const audit = mockCreate.mock.calls.find(
      (c) => c[0].collection === 'audit-logs',
    )
    expect(audit![0].data).toMatchObject({
      type: 'groupe_joined',
      metadata: expect.objectContaining({ groupeId: '42', palierAfter: '5' }),
    })
    // email owner (kind group-joined-owner) — destinataire = owner, pas joiner
    const email = mockSendEmail.mock.calls.find((c) => c[0].kind === 'group-joined-owner')
    expect(email).toBeDefined()
    expect(email![0].to).toBe('owner@x.com')
    expect(email![0].userId).toBe(99)
  })

  // Meme gate corrige que ci-dessus (auparavant, un 403 precoce produisait
  // "par accident" la meme absence d'email — l'assertion de statut garantit
  // desormais que le succes est bien atteint pour la bonne raison : admin).
  it('aucun email owner si owner == joiner (cas exotique : self-join, admin)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7, role: 'admin',
          groupe: null, email: 'self@x.com', nomSociete: 'Self',
        }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'G', code: 'GRP-SELF11', owner: 7, palierActuel: '0' }
      }
      return null
    })
    mockFind.mockResolvedValue({
      docs: [{ id: 42, nom: 'G', code: 'GRP-SELF11', owner: 7, palierActuel: '0' }],
    })

    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-SELF11' }))
    expect(res.status).toBe(200)

    const email = mockSendEmail.mock.calls.find((c) => c[0].kind === 'group-joined-owner')
    expect(email).toBeUndefined()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// POST /api/groupes/leave
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/groupes/leave', () => {
  it('400 si l\'utilisateur n\'appartient a aucun groupe', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({ id: 7, groupe: null, email: 'x@x.com', nomSociete: 'X' })
    const res = await leavePOST(makeReq('http://l/api/groupes/leave'))
    expect(res.status).toBe(400)
  })

  it('membre simple : detach + strip Stripe coupon + audit + recalc + email groupeLeftOwnerEmail', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection, id }: { collection: string; id: unknown }) => {
      if (collection === 'users' && id === 7) {
        return {
          id: 7, groupe: 42, email: 'me@x.com', nomSociete: 'Me Co',
          stripeSubscriptionId: 'sub_me',
        }
      }
      if (collection === 'users' && id === 99) {
        return { id: 99, email: 'owner@x.com', nomSociete: 'Owner Co' }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'G', code: 'GRP-X', owner: 99, palierActuel: '5' }
      }
      return null
    })

    const res = await leavePOST(makeReq('http://l/api/groupes/leave'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ left: true, groupeDeleted: false })

    // detach
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 7, data: { groupe: null } }),
    )
    // strip Stripe coupon (discounts: [])
    expect(mockSubsUpdate).toHaveBeenCalledWith('sub_me', { discounts: [] })
    // audit groupe_left
    const auditLeft = mockCreate.mock.calls.find(
      (c) => c[0].collection === 'audit-logs' && c[0].data.type === 'groupe_left',
    )
    expect(auditLeft).toBeDefined()
    // recalc
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
    // email owner avec template "left"
    const email = mockSendEmail.mock.calls.find((c) => c[0].kind === 'group-left-owner')
    expect(email).toBeDefined()
    expect(email![0].to).toBe('owner@x.com')
  })

  it('pas de strip Stripe si l\'utilisateur n\'a pas de stripeSubscriptionId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7, groupe: 42, email: 'me@x.com', nomSociete: 'Me Co',
          stripeSubscriptionId: null,
        }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'G', code: 'GRP-X', owner: 99, palierActuel: '0' }
      }
      return null
    })

    await leavePOST(makeReq('http://l/api/groupes/leave'))

    expect(mockSubsUpdate).not.toHaveBeenCalled()
  })

  it('owner avec membres restants : transfert au plus ancien (sort=createdAt + not_equals self)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection, id }: { collection: string; id: unknown }) => {
      if (collection === 'users' && id === 7) {
        return {
          id: 7, groupe: 42, email: 'owner@x.com', nomSociete: 'Owner Co',
          stripeSubscriptionId: 'sub_o',
        }
      }
      if (collection === 'users' && id === 8) {
        return { id: 8, email: 'next@x.com', nomSociete: 'Next Co' }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'G', code: 'GRP-X', owner: 7, palierActuel: '5' }
      }
      return null
    })
    mockFind.mockResolvedValue({ docs: [{ id: 8, email: 'next@x.com', nomSociete: 'Next Co' }] })

    await leavePOST(makeReq('http://l/api/groupes/leave'))

    // verrou sort + not_equals
    const findCall = mockFind.mock.calls.find((c) => c[0].collection === 'users')
    expect(findCall![0].sort).toBe('createdAt')
    expect(findCall![0].limit).toBe(1)
    const where = findCall![0].where as { and: Array<Record<string, unknown>> }
    expect(where.and).toEqual(
      expect.arrayContaining([
        { groupe: { equals: 42 } },
        { id: { not_equals: 7 } },
      ]),
    )

    // transfert
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'groupes', id: 42, data: { owner: 8 } }),
    )
    // audit groupe_ownership_transferred
    const audit = mockCreate.mock.calls.find(
      (c) => c[0].collection === 'audit-logs' && c[0].data.type === 'groupe_ownership_transferred',
    )
    expect(audit![0].data.metadata).toMatchObject({
      groupeId: '42',
      reason: 'previous_owner_left',
    })
    // recalc
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 42)
    // email avec template "transferred" (kind group-left-owner mais HTML transferred)
    const email = mockSendEmail.mock.calls.find((c) => c[0].kind === 'group-left-owner')
    expect(email).toBeDefined()
    expect(email![0].to).toBe('next@x.com')
    expect(email![0].userId).toBe(8)
  })

  it('owner sans membre restant : hard-delete + return immediat (pas de recalc, pas d\'email)', async () => {
    // Comportement actuel (route relue) : payload.delete, pas payload.update
    // avec deletedAt. Le soft-delete laissait owner_id pointer sur le user
    // parti (FK NOT NULL ON DELETE SET NULL bloquante) — voir route.ts:121-127.
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7, groupe: 42, email: 'solo@x.com', nomSociete: 'Solo Co',
          stripeSubscriptionId: null,
        }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'G', code: 'GRP-SOLO', owner: 7, palierActuel: '0' }
      }
      return null
    })
    mockFind.mockResolvedValue({ docs: [] }) // aucun membre restant

    const res = await leavePOST(makeReq('http://l/api/groupes/leave'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ left: true, groupeDeleted: true })

    // hard-delete (pas de soft-delete via update)
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'groupes', id: 42, overrideAccess: true }),
    )
    expect(mockUpdate.mock.calls.some((c) => c[0].collection === 'groupes')).toBe(false)

    // audit groupe_soft_deleted (nom d'enum conservé — hardDeleted:true dans les metadata)
    const audit = mockCreate.mock.calls.find(
      (c) => c[0].collection === 'audit-logs' && c[0].data.type === 'groupe_soft_deleted',
    )
    expect(audit![0].data.metadata).toMatchObject({ reason: 'last_member_left', hardDeleted: true })

    // PAS de recalc (return immediat)
    expect(mockRecalc).not.toHaveBeenCalled()
    // PAS d'email (groupe vide)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// POST /api/groupes/invite
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/groupes/invite', () => {
  it('400 si l\'utilisateur n\'appartient a aucun groupe', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7, groupe: null, email: 'me@x.com', nomSociete: 'Me Co',
    })
    const res = await invitePOST(makeReq('http://l/api/groupes/invite', { emails: ['a@x.com'] }))
    expect(res.status).toBe(400)
  })

  it('429 user 50/24h : rate-limit IP OK (1er call) mais user KO (2e call)', async () => {
    // Sequence : 1er call = IP (ok), 2e call = user (ko)
    mockRateLimit
      .mockReturnValueOnce({ success: true, remaining: 9 })
      .mockReturnValueOnce({ success: false, remaining: 0 })

    mockAuth.mockResolvedValue({ user: { id: 7 } })

    const res = await invitePOST(makeReq('http://l/api/groupes/invite', { emails: ['a@x.com'] }))
    expect(res.status).toBe(429)

    // verrou : la 2e clef est bien le user.id (pas l'IP) avec fenetre 24h
    expect(mockRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('groupes-invite-user:7'),
      expect.objectContaining({ limit: 50, windowMs: 24 * 60 * 60 * 1000 }),
    )
  })

  it('dedup emails + skip self + skip silencieux des deja-membres (anti-enumeration)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') {
        return {
          id: 7, groupe: 42, email: 'me@x.com', nomSociete: 'Me Co',
        }
      }
      if (collection === 'groupes') {
        return { id: 42, nom: 'G', code: 'GRP-X' }
      }
      return null
    })

    // Lookup users par email :
    //  alice@x.com → existe, NOT in groupe 42 → email envoye (CTA login)
    //  bob@x.com   → existe, IN groupe 42 → skip silencieux
    //  new@x.com   → n'existe pas → email envoye (CTA signup)
    //  me@x.com    → self, doit etre filtre AVANT lookup
    mockFind.mockImplementation(async ({ where }: { where: unknown }) => {
      const w = where as { email?: { equals?: string } }
      const email = w.email?.equals
      if (email === 'alice@x.com') {
        return { docs: [{ id: 100, groupe: 88 }] }
      }
      if (email === 'bob@x.com') {
        return { docs: [{ id: 101, groupe: 42 }] }
      }
      if (email === 'new@x.com') {
        return { docs: [] }
      }
      return { docs: [] }
    })

    const res = await invitePOST(
      makeReq('http://l/api/groupes/invite', {
        // duplicates + casse + self → on attend dedup + skip self + skip bob
        emails: ['alice@x.com', 'ALICE@x.com', 'bob@x.com', 'new@x.com', 'me@x.com'],
      }),
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sent).toBe(2) // alice + new
    expect(json.skipped).toBe(1) // bob (deja membre)
    expect(json.failed).toEqual([])

    // verrou anti-enumeration : sendEmail pas appele pour bob
    const recipients = mockSendEmail.mock.calls.map((c) => c[0].to).sort()
    expect(recipients).toEqual(['alice@x.com', 'new@x.com'])
    // self filtre AVANT le lookup (pas de find pour me@x.com)
    const findCalls = mockFind.mock.calls.map((c) => c[0].where as { email?: { equals?: string } })
    expect(findCalls.some((w) => w.email?.equals === 'me@x.com')).toBe(false)
  })

  it('compteur "failed" augmente si sendEmail.sent === false', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') return { id: 7, groupe: 42, email: 'me@x.com', nomSociete: 'Me' }
      if (collection === 'groupes') return { id: 42, nom: 'G', code: 'GRP-X' }
      return null
    })
    mockFind.mockResolvedValue({ docs: [] })
    mockSendEmail.mockResolvedValueOnce({ sent: true })
    mockSendEmail.mockResolvedValueOnce({ sent: false }) // ex: blacklist hard-bounce

    const res = await invitePOST(makeReq('http://l/api/groupes/invite', {
      emails: ['ok@x.com', 'blacklisted@x.com'],
    }))

    const json = await res.json()
    expect(json.sent).toBe(1)
    expect(json.failed).toEqual(['blacklisted@x.com'])
  })
})
