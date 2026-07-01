import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFind, mockSendEmail } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockSendEmail: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    sendEmail: mockSendEmail,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/emails', () => ({
  expirationWarningEmail: vi.fn(() => '<html>expiration warning</html>'),
}))

// Import after mocks
import { GET } from '@/app/api/cron/expiration-alertes/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(cronSecret?: string): Request {
  const headers: Record<string, string> = {}
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`
  return new Request('http://localhost/api/cron/expiration-alertes', { headers })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/cron/expiration-alertes', () => {
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

  it('returns {sent: 0} when no users expire in 30 or 7 days', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 0 })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('sends emails for users expiring in 30 days', async () => {
    mockFind
      .mockResolvedValueOnce({
        // 30-day query
        docs: [{ id: 1, email: 'user30@test.fr', nomSociete: 'ACME' }],
      })
      .mockResolvedValueOnce({ docs: [] }) // 7-day query

    mockSendEmail.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1 })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user30@test.fr',
        subject: expect.stringContaining('30 jours'),
      }),
    )
  })

  it('sends emails for users expiring in 7 days', async () => {
    mockFind
      .mockResolvedValueOnce({ docs: [] }) // 30-day query
      .mockResolvedValueOnce({
        // 7-day query
        docs: [{ id: 2, email: 'user7@test.fr', nomSociete: 'Beta' }],
      })

    mockSendEmail.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1 })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user7@test.fr',
        subject: expect.stringContaining('7 jours'),
      }),
    )
  })

  it('sends multiple emails and counts correctly', async () => {
    mockFind
      .mockResolvedValueOnce({
        docs: [
          { id: 1, email: 'a@test.fr', nomSociete: 'A' },
          { id: 2, email: 'b@test.fr', nomSociete: 'B' },
        ],
      })
      .mockResolvedValueOnce({
        docs: [{ id: 3, email: 'c@test.fr', nomSociete: 'C' }],
      })

    mockSendEmail.mockResolvedValue({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(await res.json()).toEqual({ sent: 3 })
    expect(mockSendEmail).toHaveBeenCalledTimes(3)
  })

  it('continues sending even if one email fails', async () => {
    mockFind
      .mockResolvedValueOnce({
        docs: [
          { id: 1, email: 'fail@test.fr', nomSociete: 'Fail' },
          { id: 2, email: 'ok@test.fr', nomSociete: 'Ok' },
        ],
      })
      .mockResolvedValueOnce({ docs: [] })

    mockSendEmail
      .mockRejectedValueOnce(new Error('Email failed'))
      .mockResolvedValueOnce({})

    const res = await GET(makeRequest('test-cron-secret'))

    expect(await res.json()).toEqual({ sent: 1 })
  })
})
