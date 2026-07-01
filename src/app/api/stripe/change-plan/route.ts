/**
 * POST /api/stripe/change-plan — RETIRÉ (ADR-0011)
 *
 * Le changement de palier premium/infinite est caduc : le modèle B2B n'a pas de
 * multi-paliers côté réseauteur. Les 3 produits B2B (réseau partenaire,
 * événement premium, partenaire annonceur) sont gérés par /api/stripe/checkout.
 *
 * Cette route retourne 410 Gone pour signaler proprement son retrait.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Cette route a été retirée (ADR-0011). Utilisez /api/stripe/checkout.',
      code: 'route_removed',
    },
    { status: 410 },
  )
}
