/**
 * GET /api/fournisseurs/public/[slug] — RETIRÉ (ADR-0011)
 *
 * L'objet publicitaire `fournisseurs` (annuaire revendeurs PanoramaPub) est démonté.
 * Le modèle à 3 entités expose réseauteurs / événements / réseaux via leurs propres routes.
 *
 * Retourne 410 Gone pour signaler proprement son retrait.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Cette route a été retirée (ADR-0011).', code: 'route_removed' },
    { status: 410 },
  )
}
