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
//
// RÉALIGNEMENT 2026-07-21 : la route d'archivage est NEUTRALISÉE (ADR-0011).
// Le modèle RÉSEAUTEURS n'a pas de statut 'archive' — les événements passés
// restent visibles (actif SEO). La route est un no-op qui renvoie
// { archived: 0, note: 'cron neutralisé (ADR-0011)' } et ne touche jamais la DB.
// Cf. src/app/api/cron/archiver-evenements/route.ts. Les anciennes assertions
// (archives past events, query publie, etc.) sont caduques et supprimées.

describe('GET /api/cron/archiver-evenements (neutralisé — ADR-0011)', () => {
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

  it('is a no-op: returns {archived: 0, note} and never touches the DB', async () => {
    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      archived: 0,
      note: 'cron neutralisé (ADR-0011)',
    })
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
