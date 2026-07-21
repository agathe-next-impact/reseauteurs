import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GET /api/cron/downgrade-expires — recalibré sur les 3 produits B2B (ADR-0011).
 *
 * La route ne touche plus `users.plan`/`groupe` (caduc — pas de palier
 * réseauteur payant). Elle traite deux collections indépendantes :
 *   1. reseaux     : partenaire=true et partenaireExpireAt < now → partenaire=false
 *                    (+ statut='suspendue' si tête revendiquée — ADR-0014)
 *   2. partenaires : statut=actif et abonnementExpireAt < now → statut=expire
 *
 * Réf. implémentation réelle : src/app/api/cron/downgrade-expires/route.ts
 */

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFind, mockUpdate, mockFindByID, mockSendEmail } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindByID: vi.fn(),
  mockSendEmail: vi.fn(async () => ({ sent: true })),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    update: mockUpdate,
    findByID: mockFindByID,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

// Import after mocks
import { GET } from '@/app/api/cron/downgrade-expires/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(cronSecret?: string): Request {
  const headers: Record<string, string> = {}
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`
  return new Request('http://localhost/api/cron/downgrade-expires', { headers })
}

/** Filtre le find du cron principal (reseaux) des find() secondaires (blacklist email...). */
function isReseauxCronQuery(args: { collection?: string; where?: { and?: Array<Record<string, unknown>> } }) {
  return args.collection === 'reseaux' && args.where?.and?.some((c) => 'partenaireExpireAt' in c)
}
function isPartenairesCronQuery(args: { collection?: string; where?: { and?: Array<Record<string, unknown>> } }) {
  return args.collection === 'partenaires' && args.where?.and?.some((c) => 'abonnementExpireAt' in c)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/cron/downgrade-expires', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
    // find() par défaut : vide pour tout appel non explicitement mocké (y compris
    // le lookup blacklist email dans sendEmail réel — mais celui-ci est mocké aussi).
    mockFind.mockResolvedValue({ docs: [] })
    mockUpdate.mockResolvedValue({})
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns {reseauxDowngraded: 0, partenairesDowngraded: 0} when nothing is expired', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reseauxDowngraded: 0, partenairesDowngraded: 0 })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Réseaux partenaires expirés ────────────────────────────────────────────

  it('downgrades une tête REVENDIQUÉE expirée : partenaire=false + statut=suspendue', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return { docs: [{ id: 10, niveau: 'national', source: 'revendique', partenaire: true }] }
      }
      return { docs: [] }
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reseauxDowngraded: 1, partenairesDowngraded: 0 })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'reseaux',
        id: 10,
        data: { partenaire: false, statut: 'suspendue' },
        overrideAccess: true,
        context: { webhookTrusted: true },
      }),
    )
  })

  it('ne dépublie PAS une fiche importée (source != revendique) : partenaire=false uniquement', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return { docs: [{ id: 11, niveau: 'national', source: 'annuaire', partenaire: true }] }
      }
      return { docs: [] }
    })

    await GET(makeRequest('test-cron-secret'))

    const call = mockUpdate.mock.calls.find((c) => c[0].collection === 'reseaux' && c[0].id === 11)
    expect(call![0].data).toEqual({ partenaire: false })
  })

  it('ne dépublie jamais un réseau local (niveau=local), même source=revendique', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return { docs: [{ id: 12, niveau: 'local', source: 'revendique', partenaire: true }] }
      }
      return { docs: [] }
    })

    await GET(makeRequest('test-cron-secret'))

    const call = mockUpdate.mock.calls.find((c) => c[0].collection === 'reseaux' && c[0].id === 12)
    expect(call![0].data).toEqual({ partenaire: false })
  })

  it('notifie l\'organisateur par email quand le réseau a un user lié', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return {
          docs: [{ id: 13, niveau: 'national', source: 'revendique', partenaire: true, user: 77, nom: 'BNI Paris' }],
        }
      }
      return { docs: [] }
    })
    mockFindByID.mockResolvedValue({ id: 77, email: 'owner@x.com', nomSociete: 'Owner Co' })

    await GET(makeRequest('test-cron-secret'))

    expect(mockFindByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 77 }),
    )
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'plan-downgraded', to: 'owner@x.com', userId: 77 }),
    )
  })

  it('gère un user relié populé (depth>=1, objet plutôt que simple ID)', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return {
          docs: [{ id: 14, niveau: 'national', source: 'revendique', partenaire: true, user: { id: 88 } }],
        }
      }
      return { docs: [] }
    })
    mockFindByID.mockResolvedValue({ id: 88, email: 'owner2@x.com', nomSociete: 'Owner Co 2' })

    await GET(makeRequest('test-cron-secret'))

    expect(mockFindByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 88 }),
    )
  })

  it('aucun email si le réseau n\'a pas de user lié (fiche importée sans compte)', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return { docs: [{ id: 15, niveau: 'national', source: 'annuaire', partenaire: true, user: null }] }
      }
      return { docs: [] }
    })

    await GET(makeRequest('test-cron-secret'))

    expect(mockFindByID).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('échec de mise à jour d\'un réseau n\'arrête pas le traitement des autres', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return {
          docs: [
            { id: 20, niveau: 'national', source: 'revendique', partenaire: true },
            { id: 21, niveau: 'national', source: 'revendique', partenaire: true },
          ],
        }
      }
      return { docs: [] }
    })
    mockUpdate.mockImplementation(async (args: { collection: string; id: number }) => {
      if (args.collection === 'reseaux' && args.id === 20) throw new Error('DB down')
      return {}
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    const json = await res.json()
    // 1 seul comptabilisé (l'autre a échoué) — la boucle continue malgré l'erreur
    expect(json.reseauxDowngraded).toBe(1)
  })

  it('pagine tant que la page renvoie PAGE_SIZE éléments (auto-drainant : les docs traités sortent du filtre)', async () => {
    const page = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      niveau: 'national' as const,
      source: 'annuaire' as const,
      partenaire: true,
    }))
    let callNb = 0
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        callNb += 1
        return callNb === 1 ? { docs: page } : { docs: [] }
      }
      return { docs: [] }
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reseauxDowngraded).toBe(500)
    expect(callNb).toBe(2)
  })

  it('utilise le filtre partenaire=true AND partenaireExpireAt < now, depth=1, limit=500', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest('test-cron-secret'))

    const reseauxCall = mockFind.mock.calls.find((c) => c[0].collection === 'reseaux')
    expect(reseauxCall).toBeDefined()
    const args = reseauxCall![0] as {
      where: { and: Array<Record<string, unknown>> }
      limit: number
      depth?: number
    }
    expect(args.limit).toBe(500)
    expect(args.depth).toBe(1)
    expect(args.where.and).toEqual(
      expect.arrayContaining([
        { partenaire: { equals: true } },
        { partenaireExpireAt: { less_than: expect.any(String) } },
      ]),
    )
  })

  // ── Partenaires annonceurs expirés ─────────────────────────────────────────

  it('downgrades un partenaire annonceur expiré : statut=actif → expire', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isPartenairesCronQuery(args)) {
        return { docs: [{ id: 30, statut: 'actif' }] }
      }
      return { docs: [] }
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reseauxDowngraded: 0, partenairesDowngraded: 1 })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'partenaires',
        id: 30,
        data: { statut: 'expire' },
        overrideAccess: true,
      }),
    )
  })

  it('utilise le filtre statut=actif AND abonnementExpireAt < now pour les partenaires', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest('test-cron-secret'))

    const partenairesCall = mockFind.mock.calls.find((c) => c[0].collection === 'partenaires')
    expect(partenairesCall).toBeDefined()
    const args = partenairesCall![0] as { where: { and: Array<Record<string, unknown>> }; limit: number }
    expect(args.limit).toBe(500)
    expect(args.where.and).toEqual(
      expect.arrayContaining([
        { statut: { equals: 'actif' } },
        { abonnementExpireAt: { less_than: expect.any(String) } },
      ]),
    )
  })

  it('traite réseaux ET partenaires dans le même run (comptes indépendants)', async () => {
    mockFind.mockImplementation(async (args: Parameters<typeof mockFind>[0]) => {
      if (isReseauxCronQuery(args)) {
        return { docs: [{ id: 40, niveau: 'national', source: 'annuaire', partenaire: true }] }
      }
      if (isPartenairesCronQuery(args)) {
        return { docs: [{ id: 50, statut: 'actif' }] }
      }
      return { docs: [] }
    })

    const res = await GET(makeRequest('test-cron-secret'))

    expect(await res.json()).toEqual({ reseauxDowngraded: 1, partenairesDowngraded: 1 })
  })
})
