import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
//
// RÉALIGNEMENT 2026-07-21 : la route surveille désormais DEUX collections
// (ADR-0011) — `reseaux` (partenaire=true, alerte via le user organisateur avec
// flags j30Sent/j7Sent) et `partenaires` (statut=actif, alerte vers CONTACT_EMAIL).
// Elle envoie via `sendEmail` de @/lib/email-sender (pas payload.sendEmail) et
// retourne { sent }. Les anciennes fixtures (find unique, nomSociete direct) sont
// caduques. Cf. src/app/api/cron/expiration-alertes/route.ts.

const { mockFind, mockFindByID, mockUpdate, mockSendEmail } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockFindByID: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendEmail: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    findByID: mockFindByID,
    update: mockUpdate,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/emails', () => ({
  expirationWarningEmail: vi.fn(() => '<html>expiration warning</html>'),
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

// Import after mocks
import { GET } from '@/app/api/cron/expiration-alertes/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(cronSecret?: string): Request {
  const headers: Record<string, string> = {}
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`
  return new Request('http://localhost/api/cron/expiration-alertes', { headers })
}

/**
 * Renvoie des `docs` par collection, en file (une entrée par appel `find` sur
 * cette collection). La route appelle `find(reseaux)` puis `find(partenaires)`
 * pour chacune des fenêtres J-30 puis J-7 (soit 2 appels par collection).
 */
function queueFinds(byCollection: Record<string, Array<{ docs: unknown[] }>>) {
  const queues: Record<string, Array<{ docs: unknown[] }>> = {}
  for (const [k, v] of Object.entries(byCollection)) queues[k] = [...v]
  mockFind.mockImplementation(async (args: { collection: string }) => {
    const q = queues[args.collection]
    if (q && q.length > 0) return q.shift()
    return { docs: [] }
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/cron/expiration-alertes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
    mockSendEmail.mockResolvedValue({ sent: true })
    mockUpdate.mockResolvedValue({})
    mockFind.mockResolvedValue({ docs: [] })
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns {sent: 0} when nothing expires', async () => {
    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 0 })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('alerts the organisateur when a partner reseau expires in 30 days', async () => {
    // Réseau partenaire avec relation user (organisateur)
    queueFinds({
      reseaux: [{ docs: [{ id: 500, nom: 'BNI Lyon', user: 7 }] }],
    })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'orga@test.fr',
      nomSociete: 'BNI Lyon',
      expirationAlerts: {},
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1 })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'orga@test.fr',
        subject: expect.stringContaining('30 jours'),
      }),
    )
    // Flag j30Sent posé sur le user pour éviter les doublons
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 7,
        data: expect.objectContaining({
          expirationAlerts: expect.objectContaining({ j30Sent: true }),
        }),
      }),
    )
  })

  it('skips the reseau alert when the j30Sent flag is already set', async () => {
    queueFinds({
      reseaux: [{ docs: [{ id: 500, nom: 'BNI Lyon', user: 7 }] }],
    })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'orga@test.fr',
      nomSociete: 'BNI Lyon',
      expirationAlerts: { j30Sent: true },
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(await res.json()).toEqual({ sent: 0 })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('alerts (CONTACT_EMAIL) when an annonceur partenaire expires', async () => {
    queueFinds({
      partenaires: [{ docs: [{ id: 900, nom: 'ACME Pub' }] }],
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1 })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('ACME Pub'),
      }),
    )
  })

  it('counts across both collections and windows', async () => {
    queueFinds({
      // J-30 : un réseau ; J-7 : un autre réseau
      reseaux: [
        { docs: [{ id: 500, nom: 'A', user: 7 }] },
        { docs: [{ id: 501, nom: 'B', user: 8 }] },
      ],
      // J-30 : un partenaire annonceur
      partenaires: [{ docs: [{ id: 900, nom: 'ACME' }] }],
    })
    mockFindByID.mockImplementation(async ({ id }: { id: number }) => ({
      id,
      email: `orga${id}@test.fr`,
      nomSociete: 'X',
      expirationAlerts: {},
    }))

    const res = await GET(makeRequest('test-cron-secret'))

    // 2 réseaux + 1 partenaire = 3 emails
    expect(await res.json()).toEqual({ sent: 3 })
    expect(mockSendEmail).toHaveBeenCalledTimes(3)
  })

  it('continues even if one email send throws', async () => {
    queueFinds({
      reseaux: [{ docs: [{ id: 500, nom: 'A', user: 7 }] }],
      partenaires: [{ docs: [{ id: 900, nom: 'ACME' }] }],
    })
    mockFindByID.mockResolvedValue({
      id: 7,
      email: 'orga@test.fr',
      nomSociete: 'A',
      expirationAlerts: {},
    })
    // Le réseau échoue, le partenaire réussit
    mockSendEmail
      .mockRejectedValueOnce(new Error('Email failed'))
      .mockResolvedValue({ sent: true })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1 })
  })
})
