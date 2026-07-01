/**
 * POST /api/stripe/preview-change-plan — RETIRÉ (ADR-0011)
 * Retourne 410 Gone.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Cette route a été retirée (ADR-0011).',
      code: 'route_removed',
    },
    { status: 410 },
  )
}
