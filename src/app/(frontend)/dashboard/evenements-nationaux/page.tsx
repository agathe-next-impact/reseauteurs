/**
 * /dashboard/evenements-nationaux — Route legacy PanoramaPub.
 * La fonctionnalité « participer aux événements nationaux » (participantsSignales) est supprimée
 * du périmètre RÉSEAUTEURS V1 (ADR-0011 §12 — retiré).
 */
import { redirect } from 'next/navigation'

export default function EvenementsNationauxRedirectPage() {
  redirect('/dashboard')
}
