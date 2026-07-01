import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests fonctionnels de l'integration Stripe ↔ groupes apres l'application de
 * la regle "seuls les comptes Infinite alimentent le palier" :
 *
 *  1. Le checkout d'un Premium membre d'un groupe NE PAS appliquer de coupon
 *     (Premium ne compte pas, donc pas de remise mutualisee).
 *  2. Le checkout d'un Infinite membre d'un groupe applique le coupon projete
 *     correspondant au palier futur (count infinite + 1).
 *  3. Le checkout d'un Infinite deja compte (alreadyCounted = 1) NE PAS
 *     bumper le palier (+0).
 *  4. /api/groupes/create refuse les comptes non-Infinite (403).
 *  5. /api/groupes/join refuse les comptes non-Infinite (403).
 *  6. recalculerEtAppliquerPalier ne sync que les subscriptions Infinite.
 */

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockAuth,
  mockFindByID,
  mockUpdate,
  mockFind,
  mockCount,
  mockCustomersCreate,
  mockSubsRetrieve,
  mockSubsUpdate,
  mockSessionsCreate,
  mockCouponsRetrieve,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockUpdate: vi.fn(),
  mockFind: vi.fn(),
  mockCount: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockSubsRetrieve: vi.fn(),
  mockSubsUpdate: vi.fn(),
  mockSessionsCreate: vi.fn(),
  mockCouponsRetrieve: vi.fn(),
  mockSendEmail: vi.fn(async (..._args: any[]) => ({ sent: true })),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    update: mockUpdate,
    find: mockFind,
    count: mockCount,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: mockCustomersCreate },
    subscriptions: { retrieve: mockSubsRetrieve, update: mockSubsUpdate },
    checkout: { sessions: { create: mockSessionsCreate } },
    coupons: { retrieve: mockCouponsRetrieve },
  },
  PLANS: {
    premium: { label: 'Premium', price: 9900, priceId: 'price_premium' },
    infinite: { label: 'Infinite', price: 21900, priceId: 'price_infinite' },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers({ authorization: 'Bearer t' })),
}))

// Email-sender mock pour eviter d'envoyer des emails reels
vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

// Imports apres les mocks
import { POST as checkoutPOST } from '@/app/api/stripe/checkout/route'
import { POST as createPOST } from '@/app/api/groupes/create/route'
import { POST as joinPOST } from '@/app/api/groupes/join/route'
import { recalculerEtAppliquerPalier } from '@/lib/groupes'
import type { Payload } from 'payload'

function makeReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_COUPON_5_ID = 'coupon_5'
  process.env.STRIPE_COUPON_10_ID = 'coupon_10'
  process.env.STRIPE_COUPON_15_ID = 'coupon_15'
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
})

// ── Checkout × groupe × plan ────────────────────────────────────────────────

describe('POST /api/stripe/checkout × groupe', () => {
  it('Premium dans un groupe : aucun coupon applique (Premium ne compte pas)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7, email: 'p@x.com' } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'p@x.com',
      role: 'fournisseur',
      groupe: 42,
      stripeCustomerId: 'cus_7',
      stripeSubscriptionId: null,
    })
    mockSessionsCreate.mockResolvedValue({ url: 'https://stripe/session' })

    const res = await checkoutPOST(makeReq('http://l/api/stripe/checkout', { plan: 'premium' }))

    expect(res.status).toBe(200)
    // Aucune projection palier ne doit etre faite (count jamais appele)
    expect(mockCount).not.toHaveBeenCalled()
    // La session Stripe est creee SANS clause `discounts`
    const sessionArg = mockSessionsCreate.mock.calls[0][0]
    expect(sessionArg).not.toHaveProperty('discounts')
  })

  it('Infinite dans un groupe avec 2 Infinite existants : applique coupon_5 (palier projete 3)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7, email: 'i@x.com' } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'i@x.com',
      role: 'fournisseur',
      groupe: 42,
      stripeCustomerId: 'cus_7',
      stripeSubscriptionId: null,
    })
    // 1ere call (calculerPalierGroupe) → 2 Infinite existants ; 2e call
    // (alreadyCounted) → 0 (l'utilisateur n'est pas encore Infinite).
    let n = 0
    mockCount.mockImplementation(async () => {
      n += 1
      return { totalDocs: n === 1 ? 2 : 0 }
    })
    mockSessionsCreate.mockResolvedValue({ url: 'https://stripe/session' })

    const res = await checkoutPOST(makeReq('http://l/api/stripe/checkout', { plan: 'infinite' }))

    expect(res.status).toBe(200)
    const sessionArg = mockSessionsCreate.mock.calls[0][0]
    expect(sessionArg.discounts).toEqual([{ coupon: 'coupon_5' }])
  })

  it('Infinite deja compte (alreadyCounted=1) : pas de bump, coupon du palier actuel', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7, email: 'i@x.com' } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'i@x.com',
      role: 'fournisseur',
      groupe: 42,
      stripeCustomerId: 'cus_7',
      stripeSubscriptionId: null,
    })
    // 5 Infinite (incluant l'utilisateur), alreadyCounted=1
    let n = 0
    mockCount.mockImplementation(async () => {
      n += 1
      return { totalDocs: n === 1 ? 5 : 1 }
    })
    mockSessionsCreate.mockResolvedValue({ url: 'https://stripe/session' })

    await checkoutPOST(makeReq('http://l/api/stripe/checkout', { plan: 'infinite' }))

    const sessionArg = mockSessionsCreate.mock.calls[0][0]
    // 5 sans bump → palier 10 → coupon_10
    expect(sessionArg.discounts).toEqual([{ coupon: 'coupon_10' }])
  })

  it('Sans groupe : pas de projection ni de coupon', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7, email: 'n@x.com' } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'n@x.com',
      role: 'fournisseur',
      groupe: null,
      stripeCustomerId: 'cus_7',
      stripeSubscriptionId: null,
    })
    mockSessionsCreate.mockResolvedValue({ url: 'https://stripe/session' })

    await checkoutPOST(makeReq('http://l/api/stripe/checkout', { plan: 'infinite' }))

    expect(mockCount).not.toHaveBeenCalled()
    const sessionArg = mockSessionsCreate.mock.calls[0][0]
    expect(sessionArg).not.toHaveProperty('discounts')
  })
})

// ── Gating /api/groupes/create ───────────────────────────────────────────────

describe('POST /api/groupes/create — gating Infinite uniquement', () => {
  it('refuse Premium avec 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'p@x.com',
      nomSociete: 'Acme',
      role: 'fournisseur',
      plan: 'premium',
      planExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      groupe: null,
    })

    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'Mon groupe' }))

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Infinite/i)
  })

  it('refuse Gratuit avec 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'g@x.com',
      nomSociete: 'Acme',
      role: 'fournisseur',
      plan: 'gratuit',
      groupe: null,
    })

    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'Mon groupe' }))

    expect(res.status).toBe(403)
  })

  it('refuse meme un Premium dont planExpiresAt est dans le futur (effectif premium)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'p@x.com',
      nomSociete: 'Acme',
      role: 'fournisseur',
      plan: 'premium',
      planExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      groupe: null,
    })

    const res = await createPOST(makeReq('http://l/api/groupes/create', { nom: 'Mon groupe' }))

    expect(res.status).toBe(403)
  })
})

// ── Gating /api/groupes/join ─────────────────────────────────────────────────

describe('POST /api/groupes/join — gating Infinite uniquement', () => {
  it('refuse Premium avec 403 (avant l\'evolution de regle Premium pouvait rejoindre)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'p@x.com',
      nomSociete: 'Acme',
      role: 'fournisseur',
      plan: 'premium',
      planExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      groupe: null,
    })

    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-XYZAB1' }))

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Infinite/i)
  })

  it('refuse Gratuit avec 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 7 } })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'g@x.com',
      nomSociete: 'Acme',
      role: 'fournisseur',
      plan: 'gratuit',
      groupe: null,
    })

    const res = await joinPOST(makeReq('http://l/api/groupes/join', { code: 'GRP-XYZAB1' }))

    expect(res.status).toBe(403)
  })
})

// ── recalculerEtAppliquerPalier × Stripe : sync uniquement les Infinite ─────

describe('recalculerEtAppliquerPalier × Stripe', () => {
  function makePayloadForPalier(opts: {
    initialPalier: '0' | '5' | '10' | '15'
    infiniteCount: number
    infiniteMembers: Array<{ id: number; email: string; nomSociete: string; stripeSubscriptionId: string | null }>
    ownerId: number
  }): Payload {
    return {
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'groupes') {
          return {
            id: 1,
            nom: 'Groupe Test',
            owner: opts.ownerId,
            palierActuel: opts.initialPalier,
          }
        }
        return null
      }),
      count: vi.fn(async () => ({ totalDocs: opts.infiniteCount })),
      find: vi.fn(async () => ({ docs: opts.infiniteMembers })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    } as unknown as Payload
  }

  it('avec 3 Infinite (palier 0 → 5) : applique coupon_5 a chaque sub Infinite', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_b' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadForPalier({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // 3 retrieves + 3 updates, tous avec coupon_5
    expect(mockSubsRetrieve).toHaveBeenCalledTimes(3)
    expect(mockSubsUpdate).toHaveBeenCalledTimes(3)
    for (const call of mockSubsUpdate.mock.calls) {
      expect(call[1]).toEqual({ discounts: [{ coupon: 'coupon_5' }] })
    }
    // DB update du palier
    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'groupes',
        data: expect.objectContaining({ palierActuel: '5', stripeCouponId: 'coupon_5' }),
      }),
    )
  })

  it('passage palier 5 → 0 : retire les coupons (discounts: [])', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_b' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})

    const p = makePayloadForPalier({
      initialPalier: '5',
      infiniteCount: 2,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // Aucun retrieve coupon (palier 0 → couponId null)
    expect(mockCouponsRetrieve).not.toHaveBeenCalled()
    expect(mockSubsUpdate).toHaveBeenCalledTimes(2)
    for (const call of mockSubsUpdate.mock.calls) {
      expect(call[1]).toEqual({ discounts: [] })
    }
  })

  it('palier inchange : aucun appel Stripe ni update DB', async () => {
    const p = makePayloadForPalier({
      initialPalier: '5',
      infiniteCount: 4, // toujours dans la fenetre 3-4 → palier 5
      infiniteMembers: [],
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    expect(mockSubsRetrieve).not.toHaveBeenCalled()
    expect(mockSubsUpdate).not.toHaveBeenCalled()
    expect(mockCouponsRetrieve).not.toHaveBeenCalled()
    expect(p.update).not.toHaveBeenCalled()
  })

  it('skip une sub canceled cote Stripe (NON_UPDATABLE_SUB_STATUSES) sans echec', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_canceled' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({
      id,
      status: id === 'sub_canceled' ? 'canceled' : 'active',
    }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadForPalier({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // 3 retrieves, mais seulement 2 updates (sub_canceled est skippee)
    expect(mockSubsRetrieve).toHaveBeenCalledTimes(3)
    expect(mockSubsUpdate).toHaveBeenCalledTimes(2)
    expect(mockSubsUpdate).toHaveBeenCalledWith('sub_a', expect.anything())
    expect(mockSubsUpdate).toHaveBeenCalledWith('sub_c', expect.anything())
    // DB update applique malgre le skip (skip != echec)
    expect(p.update).toHaveBeenCalled()
  })

  it('coupon Stripe invalide (resource_missing) : alerte admin + audit log + DB inchangee', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_b' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    const errMissing = Object.assign(new Error('No such coupon'), {
      code: 'resource_missing',
      param: 'coupon',
    })
    mockCouponsRetrieve.mockRejectedValue(errMissing)

    const p = makePayloadForPalier({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // Aucune sync Stripe lancee, audit log groupe_sync_failed cree, palier non persiste
    expect(mockSubsUpdate).not.toHaveBeenCalled()
    expect(p.update).not.toHaveBeenCalled()
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'audit-logs',
        data: expect.objectContaining({ type: 'groupe_sync_failed' }),
      }),
    )
  })
})

// ── Echec partiel & cas limites Stripe ──────────────────────────────────────

describe('recalculerEtAppliquerPalier — invariants en cas d\'echec', () => {
  // Helper local pour palier-changement avec membres mixtes (sub OK / KO / null)
  function makePayloadForFailure(opts: {
    initialPalier: '0' | '5' | '10' | '15'
    infiniteCount: number
    infiniteMembers: Array<{
      id: number
      email: string
      nomSociete: string
      stripeSubscriptionId: string | null
    }>
    ownerId: number
  }) {
    return {
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'groupes') {
          return {
            id: 1,
            nom: 'Groupe Test',
            owner: opts.ownerId,
            palierActuel: opts.initialPalier,
          }
        }
        return null
      }),
      count: vi.fn(async () => ({ totalDocs: opts.infiniteCount })),
      find: vi.fn(async () => ({ docs: opts.infiniteMembers })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    } as unknown as Payload
  }

  it('echec partiel sur 1 membre / 3 : DB inchangee + audit-log avec failedMemberIds', async () => {
    // Invariant central : "la DB ne ment jamais sur un palier non-applique Stripe".
    // Si meme un seul membre Stripe echoue, on ne persiste PAS le nouveau palier.
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_b' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockImplementation(async (id: string) => {
      if (id === 'sub_b') {
        const err = Object.assign(new Error('Stripe API down'), { code: 'api_error' })
        throw err
      }
      return {}
    })
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadForFailure({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // 3 retrieves, 3 updates tentes (1 echoue)
    expect(mockSubsUpdate).toHaveBeenCalledTimes(3)
    // DB NON mise a jour (verrou critique)
    const groupeUpdate = (p.update as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0].collection === 'groupes',
    )
    expect(groupeUpdate).toBeUndefined()
    // Audit-log groupe_sync_failed avec details classifies
    const audit = (p.create as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0].collection === 'audit-logs',
    )
    expect(audit).toBeDefined()
    expect(audit![0].data).toMatchObject({
      type: 'groupe_sync_failed',
      metadata: expect.objectContaining({
        targetPalier: '5',
        ancienPalier: '0',
        failedMemberIds: ['2'],
        failuresByReason: { api_error: 1 },
      }),
    })
    // Pas d'email de transition (palier non applique)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('membre payant sans stripeSubscriptionId : skip silencieux, autres synchronises', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: null }, // sub manquante
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadForFailure({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // Seuls 2 retrieves + 2 updates (le membre sans subId est skippe)
    expect(mockSubsRetrieve).toHaveBeenCalledTimes(2)
    expect(mockSubsUpdate).toHaveBeenCalledTimes(2)
    // DB mise a jour quand meme (skip != echec)
    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'groupes',
        data: expect.objectContaining({ palierActuel: '5' }),
      }),
    )
  })

  it('sub incomplete_expired : skip comme canceled (NON_UPDATABLE_SUB_STATUSES)', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_expired' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({
      id,
      status: id === 'sub_expired' ? 'incomplete_expired' : 'active',
    }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadForFailure({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    expect(mockSubsRetrieve).toHaveBeenCalledTimes(3)
    expect(mockSubsUpdate).toHaveBeenCalledTimes(2) // sub_expired skippe
    expect(mockSubsUpdate).not.toHaveBeenCalledWith('sub_expired', expect.anything())
    expect(p.update).toHaveBeenCalled() // DB mise a jour
  })

  it('erreur Stripe "canceled subscription" : reason=sub_not_updatable dans l\'audit', async () => {
    const members = [
      { id: 1, email: 'a@x.com', nomSociete: 'A', stripeSubscriptionId: 'sub_a' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_b' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_c' },
    ]
    // Pas de retrieve qui detecte canceled : le retrieve renvoie active (race
    // possible, ex. la sub est canceled juste apres le retrieve). L'erreur arrive
    // sur l'update avec un message contenant "canceled subscription".
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockImplementation(async (id: string) => {
      if (id === 'sub_b') {
        throw new Error('Cannot update a canceled subscription')
      }
      return {}
    })
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadForFailure({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    const audit = (p.create as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0].collection === 'audit-logs',
    )
    expect(audit).toBeDefined()
    expect(audit![0].data.metadata.failuresByReason).toEqual({ sub_not_updatable: 1 })
  })
})

// ── Transitions de palier intermediaires (5→10, 10→15) ──────────────────────

describe('recalculerEtAppliquerPalier — transitions de palier intermediaires', () => {
  function makePayloadForTransition(opts: {
    initialPalier: '0' | '5' | '10' | '15'
    infiniteCount: number
    infiniteMembers: Array<{
      id: number
      email: string
      nomSociete: string
      stripeSubscriptionId: string | null
    }>
    ownerId: number
  }) {
    return {
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'groupes') {
          return {
            id: 1,
            nom: 'Groupe Test',
            owner: opts.ownerId,
            palierActuel: opts.initialPalier,
          }
        }
        return null
      }),
      count: vi.fn(async () => ({ totalDocs: opts.infiniteCount })),
      find: vi.fn(async () => ({ docs: opts.infiniteMembers })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    } as unknown as Payload
  }

  it('palier 5 → 10 (passage de 4 a 5 Infinite) : applique coupon_10 partout', async () => {
    const members = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      email: `m${i}@x.com`,
      nomSociete: `M${i}`,
      stripeSubscriptionId: `sub_${i}`,
    }))
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_10' })

    const p = makePayloadForTransition({
      initialPalier: '5',
      infiniteCount: 5,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    expect(mockSubsUpdate).toHaveBeenCalledTimes(5)
    for (const call of mockSubsUpdate.mock.calls) {
      expect(call[1]).toEqual({ discounts: [{ coupon: 'coupon_10' }] })
    }
    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ palierActuel: '10', stripeCouponId: 'coupon_10' }),
      }),
    )
  })

  it('palier 10 → 15 (passage de 9 a 10 Infinite) : applique coupon_15 partout', async () => {
    const members = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      email: `m${i}@x.com`,
      nomSociete: `M${i}`,
      stripeSubscriptionId: `sub_${i}`,
    }))
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_15' })

    const p = makePayloadForTransition({
      initialPalier: '10',
      infiniteCount: 10,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    expect(mockSubsUpdate).toHaveBeenCalledTimes(10)
    for (const call of mockSubsUpdate.mock.calls) {
      expect(call[1]).toEqual({ discounts: [{ coupon: 'coupon_15' }] })
    }
    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ palierActuel: '15', stripeCouponId: 'coupon_15' }),
      }),
    )
  })
})

// ── Emails de transition palier ─────────────────────────────────────────────

describe('recalculerEtAppliquerPalier — emails de transition palier', () => {
  function makePayloadWithMembersIncludingOwner(opts: {
    initialPalier: '0' | '5' | '10' | '15'
    infiniteCount: number
    infiniteMembers: Array<{
      id: number
      email: string
      nomSociete: string
      stripeSubscriptionId: string | null
    }>
    ownerId: number
  }) {
    return {
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'groupes') {
          return {
            id: 1,
            nom: 'Groupe Demo',
            owner: opts.ownerId,
            palierActuel: opts.initialPalier,
          }
        }
        return null
      }),
      count: vi.fn(async () => ({ totalDocs: opts.infiniteCount })),
      find: vi.fn(async () => ({ docs: opts.infiniteMembers })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    } as unknown as Payload
  }

  it('UPGRADE 0 → 5 : owner recoit upgrade-owner UNE fois, autres recoivent upgrade-member', async () => {
    const members = [
      { id: 1, email: 'owner@x.com', nomSociete: 'Owner', stripeSubscriptionId: 'sub_1' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_2' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_3' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadWithMembersIncludingOwner({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    // 1 email upgrade-owner pour le owner
    const ownerEmails = mockSendEmail.mock.calls.filter(
      (c) => c[0].kind === 'groupe-palier-upgrade-owner',
    )
    expect(ownerEmails).toHaveLength(1)
    expect(ownerEmails[0][0].to).toBe('owner@x.com')
    expect(ownerEmails[0][0].userId).toBe(1)

    // 2 emails upgrade-member pour les autres (PAS le owner)
    const memberEmails = mockSendEmail.mock.calls.filter(
      (c) => c[0].kind === 'groupe-palier-upgrade-member',
    )
    expect(memberEmails).toHaveLength(2)
    const memberEmailsTos = memberEmails.map((c) => c[0].to).sort()
    expect(memberEmailsTos).toEqual(['b@x.com', 'c@x.com'])
    // verrou anti-doublon owner
    expect(memberEmailsTos).not.toContain('owner@x.com')
  })

  it('DOWNGRADE 10 → 5 : owner recoit downgrade-owner, autres recoivent downgrade-member', async () => {
    const members = [
      { id: 1, email: 'owner@x.com', nomSociete: 'Owner', stripeSubscriptionId: 'sub_1' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_2' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_3' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })

    const p = makePayloadWithMembersIncludingOwner({
      initialPalier: '10',
      infiniteCount: 3, // descend a palier 5
      infiniteMembers: members,
      ownerId: 1,
    })

    await recalculerEtAppliquerPalier(p, 1)

    expect(
      mockSendEmail.mock.calls.filter((c) => c[0].kind === 'groupe-palier-downgrade-owner'),
    ).toHaveLength(1)
    expect(
      mockSendEmail.mock.calls.filter((c) => c[0].kind === 'groupe-palier-downgrade-member'),
    ).toHaveLength(2)
    // aucun email upgrade
    expect(
      mockSendEmail.mock.calls.filter((c) => c[0].kind === 'groupe-palier-upgrade-owner'),
    ).toHaveLength(0)
  })

  it('echec d\'envoi d\'email de transition : ne re-ecrit pas le palier (best-effort, non bloquant)', async () => {
    const members = [
      { id: 1, email: 'owner@x.com', nomSociete: 'Owner', stripeSubscriptionId: 'sub_1' },
      { id: 2, email: 'b@x.com', nomSociete: 'B', stripeSubscriptionId: 'sub_2' },
      { id: 3, email: 'c@x.com', nomSociete: 'C', stripeSubscriptionId: 'sub_3' },
    ]
    mockSubsRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active' }))
    mockSubsUpdate.mockResolvedValue({})
    mockCouponsRetrieve.mockResolvedValue({ id: 'coupon_5' })
    // sendEmail throw a chaque appel
    mockSendEmail.mockRejectedValue(new Error('Resend down'))

    const p = makePayloadWithMembersIncludingOwner({
      initialPalier: '0',
      infiniteCount: 3,
      infiniteMembers: members,
      ownerId: 1,
    })

    await expect(recalculerEtAppliquerPalier(p, 1)).resolves.toBeUndefined()

    // p.update appele EXACTEMENT 1 fois (le palier, pas un re-write)
    const groupeUpdates = (p.update as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0].collection === 'groupes',
    )
    expect(groupeUpdates).toHaveLength(1)
    expect(groupeUpdates[0][0].data).toMatchObject({ palierActuel: '5' })
    // pas d'audit groupe_sync_failed (l'echec email est non-bloquant)
    const audit = (p.create as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0].collection === 'audit-logs' &&
        (c[0].data as { type: string }).type === 'groupe_sync_failed',
    )
    expect(audit).toBeUndefined()
  })
})
