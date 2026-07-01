/**
 * /dashboard/fiche — Route legacy PanoramaPub.
 * Remplacé par /dashboard/(reseauteur)/profil dans le modèle 3 entités (ADR-0011).
 */
import { redirect } from 'next/navigation'

export default function FicheRedirectPage() {
  redirect('/dashboard/profil')
}
