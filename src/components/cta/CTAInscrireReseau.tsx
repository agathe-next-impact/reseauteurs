/**
 * CTAInscrireReseau — les deux portes d'entrée pour référencer un réseau.
 *
 * Affiché sous les listes de réseaux (page d'accueil + /reseaux). Deux parcours
 * distincts (ADR-0014), à ne pas confondre :
 *   • **tête de réseau** (régional / national / international) → compte
 *     **organisateur** ; la fiche naît suspendue et n'est publiée que par
 *     l'abonnement réseau partenaire ;
 *   • **groupe local** → compte **réseauteur Plus**, qui crée jusqu'à
 *     MAX_LOCAUX_PLUS fiches locales depuis « Mes réseaux ».
 *
 * Ces liens ne font qu'orienter : les gates (rôle, propriété, abonnement, quota)
 * sont posés côté serveur — cf. `lib/reseau-hierarchie.ts`.
 */
import Link from 'next/link'
import { Network, MapPin } from 'lucide-react'

export default function CTAInscrireReseau({
  titre = "Votre réseau n'est pas encore là ?",
  className = '',
}: {
  titre?: string
  className?: string
}) {
  return (
    // Espacements sur les tokens du site : le gap d'un flex survit au reset
    // `.ir-atlas-page :where(.grid){gap:0}` (qui ne vise que les grilles), et
    // `.ir-atlas-microcopy` est la classe de note sous CTA employée par le hero.
    <div className={className}>
      <p className="text-center text-sm text-[#4E5155] mb-5">{titre}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/inscription?type=organisateur" className="ir-atlas-primary rsn-linkrow">
          <Network size={15} aria-hidden />
          Inscrire mon réseau national
        </Link>
        <Link href="/inscription?type=reseauteur" className="ir-atlas-secondary rsn-linkrow">
          <MapPin size={15} aria-hidden />
          Inscrire mon réseau local
        </Link>
      </div>
      <p className="ir-atlas-microcopy text-center">
        Une tête de réseau ouvre un compte organisateur ; un groupe local se crée depuis un compte
        Réseauteur+.
      </p>
    </div>
  )
}
