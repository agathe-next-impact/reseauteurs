import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFind, mockUpdate, mockRecalculerPalier } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockUpdate: vi.fn(),
  mockRecalculerPalier: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    update: mockUpdate,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/groupes', () => ({
  recalculerEtAppliquerPalier: mockRecalculerPalier,
}))

// Import after mocks
import { GET } from '@/app/api/cron/downgrade-expires/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(cronSecret?: string): Request {
  const headers: Record<string, string> = {}
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`
  return new Request('http://localhost/api/cron/downgrade-expires', { headers })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/cron/downgrade-expires', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns {downgraded: 0, checked: 0} when no users are expired', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ downgraded: 0, checked: 0 })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('downgrades 1 expired user without groupe', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [
        { id: 42, plan: 'premium', planExpiresAt: '2025-01-01T00:00:00Z', groupe: null },
      ],
    })
    mockUpdate.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ downgraded: 1, checked: 1 })

    // User downgraded — only the new plan + Stripe fields
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 42,
        data: {
          plan: 'gratuit',
          stripeSubscriptionId: null,
          planExpiresAt: null,
        },
      }),
    )

    // No groupe → no palier recalculation
    expect(mockRecalculerPalier).not.toHaveBeenCalled()
  })

  it('downgrades expired user and recalculates groupe palier', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [
        { id: 42, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 7 },
      ],
    })
    mockUpdate.mockResolvedValue({})
    mockRecalculerPalier.mockResolvedValue(undefined)

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ downgraded: 1, checked: 1 })

    // Groupe palier recalculated
    expect(mockRecalculerPalier).toHaveBeenCalledTimes(1)
    expect(mockRecalculerPalier).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('handles populated groupe object (depth>=1)', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [
        {
          id: 42,
          plan: 'premium',
          planExpiresAt: '2025-01-01T00:00:00Z',
          groupe: { id: 9, nom: 'Groupe Test' },
        },
      ],
    })
    mockUpdate.mockResolvedValue({})
    mockRecalculerPalier.mockResolvedValue(undefined)

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(mockRecalculerPalier).toHaveBeenCalledWith(expect.anything(), 9)
  })

  it('downgrades multiple expired users', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [
        { id: 10, plan: 'premium', planExpiresAt: '2025-06-01T00:00:00Z', groupe: null },
        { id: 20, plan: 'infinite', planExpiresAt: '2025-03-01T00:00:00Z', groupe: null },
      ],
    })
    mockUpdate.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ downgraded: 2, checked: 2 })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 10 }),
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 20 }),
    )
  })

  // ── Comportements de batch ──────────────────────────────────────────────

  it('N users du meme groupe expirent : 1 SEUL recalc en fin de batch (dedup)', async () => {
    // Le cron passe skipGroupePalierRecalc=true a downgradeUserAndClearFields,
    // collecte les groupeIds touches dans un Set, puis recalc UNE fois par
    // groupe a la fin. Cela evite N transitions intermediaires d'emails palier
    // (3/3, 2/3, 1/3, 0/3) quand plusieurs membres expirent ensemble.
    let cronCallNb = 0
    mockFind.mockImplementation(async (args: { where?: { and?: Array<Record<string, unknown>> } }) => {
      const isCronQuery = args.where?.and?.some((c) => 'planExpiresAt' in c)
      if (isCronQuery) {
        cronCallNb += 1
        if (cronCallNb === 1) {
          return {
            docs: [
              { id: 1, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 7 },
              { id: 2, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 7 },
              { id: 3, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 7 },
            ],
          }
        }
        return { docs: [] }
      }
      return { docs: [] }
    })
    mockUpdate.mockResolvedValue({})
    mockRecalculerPalier.mockResolvedValue(undefined)

    await GET(makeRequest('test-cron-secret'))

    // 1 SEUL appel recalc (dedup) sur groupeId=7
    expect(mockRecalculerPalier).toHaveBeenCalledTimes(1)
    expect(mockRecalculerPalier).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('plusieurs groupes touches : 1 recalc par groupe unique', async () => {
    let cronCallNb = 0
    mockFind.mockImplementation(async (args: { where?: { and?: Array<Record<string, unknown>> } }) => {
      const isCronQuery = args.where?.and?.some((c) => 'planExpiresAt' in c)
      if (isCronQuery) {
        cronCallNb += 1
        if (cronCallNb === 1) {
          return {
            docs: [
              { id: 1, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 7 },
              { id: 2, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 8 },
              { id: 3, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 7 }, // doublon
              { id: 4, plan: 'premium', planExpiresAt: '2025-01-01T00:00:00Z', groupe: null }, // sans groupe
            ],
          }
        }
        return { docs: [] }
      }
      return { docs: [] }
    })
    mockUpdate.mockResolvedValue({})

    await GET(makeRequest('test-cron-secret'))

    // 2 appels recalc : groupe 7 (dedup de 2 users) + groupe 8 (1 user)
    expect(mockRecalculerPalier).toHaveBeenCalledTimes(2)
    const groupeIds = mockRecalculerPalier.mock.calls.map((c) => c[1]).sort()
    expect(groupeIds).toEqual([7, 8])
  })

  it('erreur recalc d\'un groupe n\'arrete pas les autres recalcs', async () => {
    let cronCallNb = 0
    mockFind.mockImplementation(async (args: { where?: { and?: Array<Record<string, unknown>> } }) => {
      const isCronQuery = args.where?.and?.some((c) => 'planExpiresAt' in c)
      if (isCronQuery) {
        cronCallNb += 1
        if (cronCallNb === 1) {
          return {
            docs: [
              { id: 1, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 1 },
              { id: 2, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 2 },
              { id: 3, plan: 'infinite', planExpiresAt: '2025-01-01T00:00:00Z', groupe: 3 },
            ],
          }
        }
        return { docs: [] }
      }
      return { docs: [] }
    })
    mockUpdate.mockResolvedValue({})
    mockRecalculerPalier.mockImplementation(async (_p: unknown, gId: number) => {
      if (gId === 2) throw new Error('Stripe outage')
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    // les 3 users ont ete downgrades (try/catch englobe le recalc final)
    const json = await res.json()
    expect(json.downgraded).toBe(3)
    // les 3 recalcs (1 par groupe unique) ont eu lieu (pas de short-circuit)
    expect(mockRecalculerPalier).toHaveBeenCalledTimes(3)
  })

  it('pagine si plus de PAGE_SIZE users expires (boucle while)', async () => {
    // 1ere page : 500 users (capacite max), 2e page : 0 → break.
    // downgradeUserAndClearFields fait aussi des find() (fournisseurs etc.) :
    // on filtre uniquement les find correspondant a la query du cron principal
    // (where.and contenant planExpiresAt).
    const page1 = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      plan: 'premium',
      planExpiresAt: '2025-01-01T00:00:00Z',
      groupe: null,
    }))
    let cronCallNb = 0
    mockFind.mockImplementation(async (args: { where?: { and?: Array<Record<string, unknown>> } }) => {
      const isCronQuery = args.where?.and?.some((c) => 'planExpiresAt' in c)
      if (isCronQuery) {
        cronCallNb += 1
        return cronCallNb === 1 ? { docs: page1 } : { docs: [] }
      }
      // tout autre find (fournisseurs, organisateurs...) : vide
      return { docs: [] }
    })
    mockUpdate.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.checked).toBe(500)
    expect(json.downgraded).toBe(500)
    // 2 pages cron lues : 500 puis 0 → break
    expect(cronCallNb).toBe(2)
  })

  it('utilise le filtre planExpiresAt < now AND plan != gratuit', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest('test-cron-secret'))

    const findCall = mockFind.mock.calls[0][0] as {
      collection: string
      where: { and: Array<Record<string, unknown>> }
      limit: number
    }
    expect(findCall.collection).toBe('users')
    expect(findCall.limit).toBe(500)
    // verrou : plan != gratuit (sinon on re-downgrade des gratuits a chaque run)
    const planClause = findCall.where.and.find((c) => 'plan' in c)
    expect(planClause).toEqual({ plan: { not_equals: 'gratuit' } })
    // verrou : less_than (pas <=) sur planExpiresAt
    const expiresClause = findCall.where.and.find((c) => 'planExpiresAt' in c)
    expect(expiresClause).toMatchObject({ planExpiresAt: { less_than: expect.any(String) } })
  })
})
