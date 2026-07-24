/**
 * PlusFeatureCard — carte d'une fonctionnalité réservée à Réseauteur Plus.
 *
 * Deux états, selon le niveau du compte (résolu côté serveur — `estPlus`) :
 *   • **actif** : la carte pointe vers la fonctionnalité (`href`) ;
 *   • **verrouillé** (réseauteur gratuit) : la carte devient un argumentaire —
 *     libellé « Réseauteur Plus », liste des avantages débloqués, et CTA vers
 *     `/dashboard/plus`. C'est là que se joue la conversion : l'utilisateur voit
 *     CE QU'IL GAGNE, pas seulement une porte fermée.
 *
 * Le verrouillage n'est qu'un affichage : l'accès réel est reposé par chaque page
 * cible (redirige vers /dashboard/plus si le statut n'est pas actif) et par les
 * hooks serveur. Cette carte ne garde rien.
 */
import Link from 'next/link'
import { Lock, ArrowRight, type LucideIcon } from 'lucide-react'
import { PRIX_PLUS_HT } from '@/lib/tarifs'

export default function PlusFeatureCard({
  icon: Icon,
  title,
  actif,
  href,
  ctaActif,
  descriptionActif,
  avantages,
}: {
  icon: LucideIcon
  title: string
  actif: boolean
  /** Destination quand le Plus est actif. */
  href: string
  /** Libellé du lien quand actif (ex. « Gérer mes événements »). */
  ctaActif: string
  /** Phrase courte affichée quand actif. */
  descriptionActif: string
  /** Avantages débloqués — affichés quand verrouillé. */
  avantages: string[]
}) {
  // ── Actif : carte-lien classique vers la fonctionnalité ──
  if (actif) {
    return (
      <Link
        href={href}
        className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
          <Icon size={14} className="text-[#035AA6]" aria-hidden />
          {title}
        </h3>
        <p className="text-sm text-[#4E5155]">{descriptionActif}</p>
        <div className="mt-4">
          <span className="text-sm text-[#035AA6] font-medium flex items-center gap-1">
            {ctaActif}
            <ArrowRight size={14} aria-hidden />
          </span>
        </div>
      </Link>
    )
  }

  // ── Verrouillé (gratuit) : argumentaire + CTA de conversion ──
  return (
    <Link
      href="/dashboard/plus"
      className="rsn-lift rsn-linkrow group block rounded-2xl p-5 no-underline h-full border border-[#EFE08F] bg-[#FEFBE6]"
      aria-label={`${title} — débloquer avec Réseauteur Plus`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8A6D0B] flex items-center gap-1.5">
          <Icon size={14} aria-hidden />
          {title}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5E050] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#012A4A]">
          <Lock size={10} aria-hidden />
          Plus
        </span>
      </div>

      <p className="text-sm font-semibold text-[#012A4A]">
        Réservé à Réseauteur Plus
      </p>
      <p className="text-xs text-[#6E7175] mb-3">
        <span className="font-bold text-[#8A6D0B]">{PRIX_PLUS_HT} € HT/an</span> pour débloquer :
      </p>

      <ul className="flex flex-col gap-1.5 mb-4">
        {avantages.map((a) => (
          <li key={a} className="flex items-start gap-2 text-sm text-[#4E5155]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8A6D0B]" aria-hidden />
            {a}
          </li>
        ))}
      </ul>

      <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F5E050] px-4 py-2.5 text-sm font-bold text-[#012A4A] group-hover:bg-[#E3CB2E] transition-colors">
        Passer à Réseauteur Plus
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
