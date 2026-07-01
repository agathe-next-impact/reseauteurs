import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFind } = vi.hoisted(() => ({
  mockFind: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/geojson', () => ({
  toFeature: vi.fn((lng, lat, props) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props,
  })),
  toFeatureCollection: vi.fn((features) => ({
    type: 'FeatureCollection',
    features,
  })),
}))

// Import after mocks
import { GET } from '@/app/api/geo/evenements/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/geo/evenements')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/geo/evenements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a valid GeoJSON FeatureCollection', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 1,
          titre: 'Salon Pro',
          type: { value: 'salon', couleur: '#dc2626', label: 'Salon' },
          dateDebut: '2026-06-01',
          dateFin: '2026-06-03',
          lieuVille: 'Paris',
          lieuLatitude: 48.86,
          lieuLongitude: 2.35,
          fournisseur: {
            slug: 'acme',
            raisonSociale: 'ACME',
            activitePrincipale: { value: 'goodies', couleur: '#1e40af' },
          },
        },
      ],
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.type).toBe('FeatureCollection')
    expect(body.features).toHaveLength(1)
    expect(body.features[0].properties.titre).toBe('Salon Pro')
  })

  it('excludes events without coordinates', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 1,
          titre: 'NoGeo',
          type: null,
          lieuLatitude: null,
          lieuLongitude: null,
          fournisseur: null,
        },
      ],
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.features).toHaveLength(0)
  })

  it('only includes statut=publie events', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest())

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { statut: { equals: 'publie' } },
          ]),
        }),
      }),
    )
  })

  it('resolves type filter slugs to IDs', async () => {
    mockFind
      .mockResolvedValueOnce({ docs: [{ id: 3 }] }) // resolve type slugs
      .mockResolvedValueOnce({ docs: [] }) // no events

    await GET(makeRequest({ type: 'salon' }))

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'types-evenement',
        where: { value: { in: ['salon'] } },
      }),
    )
  })

  it('resolves activite filter slugs to IDs', async () => {
    mockFind
      .mockResolvedValueOnce({ docs: [{ id: 7 }, { id: 9 }] }) // resolve activite slugs
      .mockResolvedValueOnce({ docs: [] }) // no events

    await GET(makeRequest({ activite: 'textile,goodies' }))

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'categories-activite',
        where: { value: { in: ['textile', 'goodies'] } },
      }),
    )
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([
                { activites: { contains: 7 } },
                { activites: { contains: 9 } },
                { 'fournisseur.activitePrincipale': { in: [7, 9] } },
                { 'fournisseur.activitesSecondaires': { contains: 7 } },
                { 'fournisseur.activitesSecondaires': { contains: 9 } },
              ]),
            }),
          ]),
        }),
      }),
    )
  })

  it('keeps period filtering on upcoming or ongoing events', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest({ periode: '2026-06,2026-08' }))

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([
                expect.objectContaining({
                  dateFin: expect.objectContaining({ greater_than_equal: expect.any(String) }),
                }),
              ]),
            }),
            { dateDebut: { less_than: '2026-09-01T00:00:00.000Z' } },
          ]),
        }),
      }),
    )
  })

  it('marks events without fournisseur as national', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 1,
          titre: 'Event National',
          type: { value: 'salon', couleur: '#000', label: 'Salon' },
          dateDebut: '2026-06-01',
          lieuVille: 'Paris',
          lieuLatitude: 48.86,
          lieuLongitude: 2.35,
          fournisseur: null,
        },
      ],
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.features[0].properties.isNational).toBe(true)
    expect(body.features[0].properties.fournisseurSlug).toBeNull()
  })
})
