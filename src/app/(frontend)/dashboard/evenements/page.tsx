/**
 * /dashboard/evenements — Route legacy PanoramaPub.
 * La gestion des événements est intégrée dans /dashboard/(organisateur)/reseau (ADR-0011).
 */
import { redirect } from 'next/navigation'

export default function EvenementsRedirectPage() {
  redirect('/dashboard/reseau')
}
