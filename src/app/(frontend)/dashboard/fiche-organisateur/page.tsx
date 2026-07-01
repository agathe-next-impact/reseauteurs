/**
 * /dashboard/fiche-organisateur — Route legacy PanoramaPub.
 * Remplacé par /dashboard/(organisateur)/reseau dans le modèle 3 entités (ADR-0011).
 */
import { redirect } from 'next/navigation'

export default function FicheOrganisateurRedirectPage() {
  redirect('/dashboard/reseau')
}
