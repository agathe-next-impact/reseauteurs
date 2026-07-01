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

vi.mock('@/collections/access', () => ({
  getEffectiveFeatureLevel: vi.fn(() => 'standard'),
}))

// Import after mocks
import { GET } from '@/app/api/geo/revendeurs/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/geo/revendeurs')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/geo/revendeurs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a valid GeoJSON FeatureCollection', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          slug: 'acme',
          raisonSociale: 'ACME',
          ville: 'Paris',
          codePostal: '75001',
          latitude: 48.86,
          longitude: 2.35,
          activitePrincipale: { value: 'goodies', couleur: '#1e40af' },
          user: { plan: 'standard', planExpiresAt: null },
        },
      ],
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.type).toBe('FeatureCollection')
    expect(body.features).toHaveLength(1)
    expect(body.features[0].geometry.coordinates).toEqual([2.35, 48.86])
    expect(body.features[0].properties.raisonSociale).toBe('ACME')
  })

  it('excludes fournisseurs without coordinates', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          slug: 'no-geo',
          raisonSociale: 'NoGeo',
          ville: 'Lyon',
          latitude: null,
          longitude: null,
          activitePrincipale: null,
          user: {},
        },
      ],
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.features).toHaveLength(0)
  })

  it('passes activite filter to query', async () => {
    mockFind
      // First call: resolve category slugs to IDs
      .mockResolvedValueOnce({ docs: [{ id: 5 }, { id: 7 }] })
      // Second call: find fournisseurs
      .mockResolvedValueOnce({ docs: [] })

    await GET(makeRequest({ activite: 'goodies,textile' }))

    // First find: resolve slugs
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'categories-activite',
        where: { value: { in: ['goodies', 'textile'] } },
      }),
    )
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'fournisseurs',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([
                { activitePrincipale: { in: [5, 7] } },
                { activitesSecondaires: { contains: 5 } },
                { activitesSecondaires: { contains: 7 } },
              ]),
            }),
          ]),
        }),
      }),
    )
  })

  it('accepts one-letter search and ignores it in the Payload query', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const res = await GET(makeRequest({ search: 'a' }))

    expect(res.status).toBe(200)
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'fournisseurs',
        where: expect.objectContaining({
          and: expect.not.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([
                { raisonSociale: { like: 'a%' } },
              ]),
            }),
          ]),
        }),
      }),
    )
  })

  it('only includes statut=publiee fournisseurs', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest())

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { statut: { equals: 'publiee' } },
          ]),
        }),
      }),
    )
  })
})
