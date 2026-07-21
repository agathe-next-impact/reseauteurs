import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
//
// La route /api/geo/evenements a été refondue sur le modèle 3-entités (ADR-0011/0013).
// Elle lit `payload.db.drizzle` (SQL PostGIS paramétré : ST_MakeEnvelope pour la bbox,
// ST_DWithin pour le rayon) EN PLUS de `payload.find`. On mocke donc un exécuteur Drizzle
// (`execute` → `{ rows }`) renvoyant des lignes factices, et on réaligne les filtres sur
// ceux réellement implémentés (`reseau`, spatial), l'ancien modèle PanoramaPub
// (`types-evenement`, `categories-activite`, `fournisseur`, `activite`, `periode`) étant caduc.

const { mockFind, mockExecute } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockExecute: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    db: {
      // Exécuteur Drizzle sous-jacent : la route appelle drizzle.execute(sql`…`).then(r => r.rows)
      drizzle: {
        execute: mockExecute,
      },
    },
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
    // Défaut : aucun ID spatial (les tests spatiaux le surchargent).
    mockExecute.mockResolvedValue({ rows: [] })
  })

  it('returns a valid GeoJSON FeatureCollection', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 1,
          slug: 'salon-pro',
          titre: 'Salon Pro',
          dateDebut: '2026-06-01',
          dateFin: '2026-06-03',
          lieuVille: 'Paris',
          lieuLatitude: 48.86,
          lieuLongitude: 2.35,
          reseau: { id: 10, slug: 'bni', nom: 'BNI' },
          organisateurReseauteur: null,
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
          lieuLatitude: null,
          lieuLongitude: null,
          reseau: null,
          organisateurReseauteur: null,
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
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { statut: { equals: 'publie' } },
          ]),
        }),
      }),
    )
  })

  it('resolves reseau filter slugs to IDs', async () => {
    mockFind
      .mockResolvedValueOnce({ docs: [{ id: 3 }] }) // resolve reseau slugs
      .mockResolvedValueOnce({ docs: [] }) // no events

    await GET(makeRequest({ reseau: 'bni' }))

    // 1er find : résolution des slugs de réseau → IDs
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'reseaux',
        where: { slug: { in: ['bni'] } },
      }),
    )
    // 2e find : requête événements contrainte par le réseau organisateur résolu
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([{ reseau: { equals: 3 } }]),
            }),
          ]),
        }),
      }),
    )
  })

  it('applies a bounding-box spatial filter via PostGIS (Drizzle) and constrains ids', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest({ sw_lng: '2', sw_lat: '48', ne_lng: '3', ne_lat: '49' }))

    // Le filtre spatial passe par le driver Drizzle (SQL PostGIS paramétré).
    expect(mockExecute).toHaveBeenCalledTimes(1)
    // Les IDs retournés par PostGIS contraignent la requête Payload principale.
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([{ id: { in: [1, 2] } }]),
        }),
      }),
    )
  })

  it('applies a radius spatial filter (ST_DWithin) via Drizzle', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 5 }] })
    mockFind.mockResolvedValue({ docs: [] })

    await GET(makeRequest({ lat: '48.86', lng: '2.35', rayon: '10' }))

    expect(mockExecute).toHaveBeenCalledTimes(1)
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'evenements',
        where: expect.objectContaining({
          and: expect.arrayContaining([{ id: { in: [5] } }]),
        }),
      }),
    )
  })

  it('returns an empty collection when the spatial filter matches nothing', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] })

    const res = await GET(makeRequest({ sw_lng: '2', sw_lat: '48', ne_lng: '3', ne_lat: '49' }))
    const body = await res.json()

    expect(body.features).toHaveLength(0)
    // Court-circuit : pas de requête événements quand la bbox ne matche rien.
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('discriminates the organiser (reseau vs reseauteur Plus)', async () => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 1,
          slug: 'evt-reseau',
          titre: 'Event Réseau',
          dateDebut: '2026-06-01',
          lieuVille: 'Paris',
          lieuLatitude: 48.86,
          lieuLongitude: 2.35,
          reseau: { id: 10, slug: 'bni', nom: 'BNI' },
          organisateurReseauteur: null,
        },
        {
          id: 2,
          slug: 'evt-reseauteur',
          titre: 'Event Réseauteur',
          dateDebut: '2026-06-02',
          lieuVille: 'Lyon',
          lieuLatitude: 45.75,
          lieuLongitude: 4.85,
          reseau: null,
          organisateurReseauteur: 7,
        },
      ],
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.features).toHaveLength(2)
    expect(body.features[0].properties.organisateur).toBe('reseau')
    expect(body.features[0].properties.reseauNom).toBe('BNI')
    expect(body.features[1].properties.organisateur).toBe('reseauteur')
  })
})
