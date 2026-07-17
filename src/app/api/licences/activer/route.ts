/**
 * POST /api/licences/activer — RETIRÉE (ADR-0015, 2026-07-17).
 *
 * L'achat de packs de licences par les partenaires et l'activation par code promo
 * sont supprimés. Le seul chemin vers Réseauteur Plus est l'abonnement individuel
 * (checkout type 'reseauteur_plus'). Les licences déjà activées restent portées par
 * users.plusActif/plusExpireAt et s'éteignent via le cron expiration-plus.
 *
 * 410 Gone (précédent : /api/stripe/change-plan).
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'L\'activation par code partenaire n\'est plus disponible. Passez Réseauteur Plus via l\'abonnement depuis votre tableau de bord.',
    },
    { status: 410 },
  )
}
