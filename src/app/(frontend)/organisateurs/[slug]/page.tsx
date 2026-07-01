/**
 * /organisateurs/[slug] — Ancienne route PanoramaPub (fiche organisateur).
 * L'entité « organisateur-événement » est fusionnée dans « réseau » (ADR-0011).
 * Redirige vers l'annuaire des réseaux.
 */
import { permanentRedirect } from 'next/navigation'

export default function OldOrganisateurSlugPage() {
  permanentRedirect('/reseaux')
}
