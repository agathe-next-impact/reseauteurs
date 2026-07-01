import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFind, mockUpdate } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    update: mockUpdate,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Import after mocks
import { GET } from '@/app/api/cron/archiver-evenements/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(cronSecret?: string): Request {
  const headers: Record<string, string> = {}
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`
  return new Request('http://localhost/api/cron/archiver-evenements', { headers })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/cron/archiver-evenements', () => {
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

  it('returns {archived: 0} when no events need archiving', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ archived: 0 })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('archives past published events', async () => {
    mockFind.mockResolvedValue({
      docs: [
        { id: 1, titre: 'Old Event', statut: 'publie' },
        { id: 2, titre: 'Ancient Event', statut: 'publie' },
      ],
    })
    mockUpdate.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ archived: 2 })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        id: 1,
        data: { statut: 'archive' },
      }),
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        id: 2,
        data: { statut: 'archive' },
      }),
    )
  })

  it('only queries publie events with dateDebut before yesterday', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest('test-cron-secret'))

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { statut: { equals: 'publie' } },
          ]),
        }),
      }),
    )
  })

  it('continues archiving even if one update fails', async () => {
    mockFind.mockResolvedValue({
      docs: [
        { id: 1, titre: 'Failing' },
        { id: 2, titre: 'Succeeding' },
      ],
    })
    mockUpdate
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ archived: 1 })
  })
})
