/**
 * /dashboard/photos — Route legacy PanoramaPub.
 * La galerie photos fournisseur est supprimée du périmètre RÉSEAUTEURS V1 (ADR-0011 §12).
 * Les visuels du réseau sont gérés dans la fiche réseau : /dashboard/(organisateur)/reseau
 */
import { redirect } from 'next/navigation'

export default function PhotosRedirectPage() {
  redirect('/dashboard')
}
