import { describe, it, expect } from 'vitest'

// La route /api/geo/revendeurs (carte des revendeurs PanoramaPub) a été RETIRÉE (ADR-0011).
// Elle est remplacée par /api/geo/reseauteurs et /api/geo/evenements et renvoie désormais
// 410 Gone. Les anciennes assertions (200 GeoJSON, mock payload.find, statut=publiee) sont
// caduques : la route n'accède plus à la base. On vérifie donc le retrait propre.
import { GET } from '@/app/api/geo/revendeurs/route'

describe('GET /api/geo/revendeurs (retirée — ADR-0011)', () => {
  it('returns 410 Gone', async () => {
    const res = await GET()
    expect(res.status).toBe(410)
  })

  it('signals the removal with code route_removed and points to the new maps', async () => {
    const res = await GET()
    const body = await res.json()

    expect(body.code).toBe('route_removed')
    expect(body.error).toContain('ADR-0011')
    expect(body.error).toContain('/api/geo/reseauteurs')
    expect(body.error).toContain('/api/geo/evenements')
  })
})
