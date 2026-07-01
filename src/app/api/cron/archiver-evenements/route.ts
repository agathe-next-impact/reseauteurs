/**
 * GET /api/cron/archiver-evenements — NEUTRALISÉ (ADR-0011)
 *
 * Retourne 200 no-op. Ce cron ne s'exécute plus.
 *
 * Raison : l'ancien cycle d'archivage automatique des occurrences récurrentes
 * (modèle Réseau→Occurrences) est caduc. Le modèle RÉSEAUTEURS (ADR-0011) n'a
 * pas de statut 'archive' sur les événements (seulement 'publie' / 'suspendu').
 * Les événements passés restent visibles — chaque fiche est un actif SEO.
 *
 * À supprimer du scheduler Vercel Crons (vercel.json) lors de la mise en prod.
 */
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // No-op intentionnel — voir commentaire en tête de fichier.
  return NextResponse.json({ archived: 0, note: 'cron neutralisé (ADR-0011)' })
}
