import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindByID } = vi.hoisted(() => ({
  mockFindByID: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    findByID: mockFindByID,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/ical', () => ({
  generateICS: vi.fn(() => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'),
}))

// Import after mocks
import { GET } from '@/app/api/ical/[id]/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/ical/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when event is not found', async () => {
    mockFindByID.mockRejectedValue(new Error('Not found'))

    const req = new Request('http://localhost/api/ical/999')
    const res = await GET(req, makeParams('999'))

    expect(res.status).toBe(404)
  })

  it('returns 404 when event is not publie', async () => {
    mockFindByID.mockResolvedValue({
      id: 1,
      titre: 'Draft Event',
      statut: 'archive',
    })

    const req = new Request('http://localhost/api/ical/1')
    const res = await GET(req, makeParams('1'))

    expect(res.status).toBe(404)
  })

  it('returns .ics file with correct Content-Type for published event', async () => {
    mockFindByID.mockResolvedValue({
      id: 1,
      titre: 'Salon Pro',
      statut: 'publie',
      dateDebut: '2026-06-01',
      lieuVille: 'Paris',
    })

    const req = new Request('http://localhost/api/ical/1')
    const res = await GET(req, makeParams('1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toContain('event-1.ics')

    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
  })
})
