/**
 * GET /api/geo/revendeurs — RETIRÉ (ADR-0011)
 *
 * La carte des revendeurs (PanoramaPub) est remplacée par les deux cartes RÉSEAUTEURS :
 * /api/geo/reseauteurs et /api/geo/evenements.
 *
 * Retourne 410 Gone pour signaler proprement son retrait.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error: 'Cette route a été retirée (ADR-0011). Utilisez /api/geo/reseauteurs ou /api/geo/evenements.',
      code: 'route_removed',
    },
    { status: 410 },
  )
}
