/**
 * Tests — Cron downgrade-expires B2B (ADR-0011)
 *
 * Chemins critiques :
 * 1. Sécurité CRON_SECRET (401/403)
 * 2. Réseaux expirés → partenaire=false
 * 3. Partenaires annonceurs expirés → statut=expire
 * 4. Réseaux et partenaires non expirés → inchangés
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

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

vi.mock('@/lib/emails', () => ({
  planDowngradedEmail: vi.fn(() => '<html>downgraded</html>'),
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: vi.fn(),
}))

// Import après les mocks
import { GET } from '@/app/api/cron/downgrade-expires/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(secret?: string): Request {
  const hdrs: Record<string, string> = {}
  if (secret) hdrs['authorization'] = `Bearer ${secret}`
  return new Request('http://localhost/api/cron/downgrade-expires', { headers: hdrs })
}

const PAST_DATE = '2025-01-01T00:00:00Z'
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/cron/downgrade-expires — B2B', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret-b2b'
    mockUpdate.mockResolvedValue({})
  })

  // ── Sécurité ─────────────────────────────────────────────────────────────

  it('retourne 401 sans header d\'autorisation', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retourne 401 avec un mauvais secret', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  // ── Réseaux partenaires expirés ───────────────────────────────────────────

  describe('Réseaux partenaires expirés', () => {
    it('désactive partenaire=false sur un réseau expiré', async () => {
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return {
            docs: [{
              id: 10,
              nom: 'BNI Bordeaux',
              partenaire: true,
              partenaireExpireAt: PAST_DATE,
              user: { id: 99, email: 'orga@test.fr', nomSociete: 'BNI Bordeaux' },
            }],
          }
        }
        return { docs: [] }
      })

      const res = await GET(makeRequest('test-secret-b2b'))
      expect(res.status).toBe(200)

      const json = await res.json() as { reseauxDowngraded?: number }
      expect(json.reseauxDowngraded).toBeGreaterThanOrEqual(1)

      const updateCall = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux' &&
                (c[0] as { id?: number }).id === 10
      )
      expect(updateCall).toBeDefined()
      expect((updateCall![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(false)
    })

    it('ne touche pas les réseaux dont l\'abonnement n\'est pas expiré', async () => {
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return { docs: [] } // aucun réseau expiré
        }
        return { docs: [] }
      })

      const res = await GET(makeRequest('test-secret-b2b'))
      expect(res.status).toBe(200)

      const reseauUpdates = mockUpdate.mock.calls.filter(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdates).toHaveLength(0)
    })
  })

  // ── Partenaires annonceurs expirés ────────────────────────────────────────

  describe('Partenaires annonceurs expirés', () => {
    it('pose statut=expire sur un partenaire annonceur expiré', async () => {
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return { docs: [] }
        }
        if (args.collection === 'partenaires') {
          return {
            docs: [{
              id: 5,
              nom: 'Acme Corp',
              statut: 'actif',
              abonnementExpireAt: PAST_DATE,
            }],
          }
        }
        return { docs: [] }
      })

      const res = await GET(makeRequest('test-secret-b2b'))
      expect(res.status).toBe(200)

      const json = await res.json() as { partenairesDowngraded?: number }
      expect(json.partenairesDowngraded).toBeGreaterThanOrEqual(1)

      const updateCall = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'partenaires' &&
                (c[0] as { id?: number }).id === 5
      )
      expect(updateCall).toBeDefined()
      expect((updateCall![0] as { data: { statut?: string } }).data.statut).toBe('expire')
    })
  })

  // ── Aucune expiration ─────────────────────────────────────────────────────

  it('retourne des compteurs à 0 si rien n\'est expiré', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const res = await GET(makeRequest('test-secret-b2b'))
    expect(res.status).toBe(200)

    const json = await res.json() as { reseauxDowngraded?: number; partenairesDowngraded?: number }
    expect(json.reseauxDowngraded).toBe(0)
    expect(json.partenairesDowngraded).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Multi-entités ─────────────────────────────────────────────────────────

  it('traite simultanément réseaux et partenaires expirés', async () => {
    mockFind.mockImplementation(async (args: { collection?: string }) => {
      if (args.collection === 'reseaux') {
        return {
          docs: [
            { id: 1, partenaire: true, partenaireExpireAt: PAST_DATE, nom: 'R1', user: null },
            { id: 2, partenaire: true, partenaireExpireAt: PAST_DATE, nom: 'R2', user: null },
          ],
        }
      }
      if (args.collection === 'partenaires') {
        return {
          docs: [
            { id: 10, statut: 'actif', abonnementExpireAt: PAST_DATE, nom: 'P1' },
          ],
        }
      }
      return { docs: [] }
    })

    const res = await GET(makeRequest('test-secret-b2b'))
    expect(res.status).toBe(200)

    const json = await res.json() as { reseauxDowngraded?: number; partenairesDowngraded?: number }
    expect(json.reseauxDowngraded).toBe(2)
    expect(json.partenairesDowngraded).toBe(1)

    // 2 updates reseaux + 1 update partenaire = 3 total
    expect(mockUpdate).toHaveBeenCalledTimes(3)
  })
})
