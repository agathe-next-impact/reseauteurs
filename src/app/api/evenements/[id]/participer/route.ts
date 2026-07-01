/**
 * POST /api/evenements/[id]/participer — RETIRÉ (ADR-0011 §12)
 *
 * La participation/quota (modèle PanoramaPub : fournisseur Infinite + participantsSignales)
 * est caduque. RÉSEAUTEURS n'organise pas et ne gère pas d'inscrits en V1 :
 * l'inscription se fait via le lien externe du réseau (evenement.lienInscription).
 *
 * Retourne 410 Gone pour signaler proprement son retrait.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Cette route a été retirée (ADR-0011).', code: 'route_removed' },
    { status: 410 },
  )
}
