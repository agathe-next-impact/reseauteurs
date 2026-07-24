/**
 * PlusUpsell — panneau commercial affiché à un réseauteur GRATUIT sur une page
 * réservée à Réseauteur Plus (« Mes événements », « Mes réseaux »).
 *
 * Remplace l'ancien `redirect('/dashboard/plus')` silencieux : l'utilisateur reste
 * sur la section qu'il a demandée et comprend clairement — et commercialement —
 * ce qu'elle débloque, à quel prix, avec un CTA vers l'abonnement. Le gate réel
 * (accès à la fonctionnalité) reste posé côté serveur ; ce panneau n'ouvre rien.
 *
 * Prix affiché : PRIX_PLUS_HT (source `lib/tarifs`, à maintenir égale au Price Stripe).
 */
import Link from 'next/link'
import { Sparkles, Check, ArrowRight, type LucideIcon } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { PRIX_PLUS_HT } from '@/lib/tarifs'

export default function PlusUpsell({
  icon: Icon,
  titre,
  accroche,
  avantages,
}: {
  icon: LucideIcon
  /** Nom de la section demandée (ex. « Mes événements »). */
  titre: string
  /** Phrase d'accroche sous le titre. */
  accroche: string
  /** Ce que débloque le passage à Plus. */
  avantages: string[]
}) {
  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          {/* Bandeau d'en-tête — même repère visuel que la page /dashboard/plus */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5E050] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#012A4A]">
              <Sparkles size={12} aria-hidden />
              Réseauteur Plus
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2 mb-2">
            <Icon size={22} className="text-[#8A6D0B]" aria-hidden />
            {titre}
          </h1>
          <p className="text-sm text-[#4E5155] mb-6">{accroche}</p>
        </Reveal>

        <Reveal delay={70}>
          <section
            aria-label={`Débloquer ${titre} avec Réseauteur Plus`}
            className="rounded-2xl border-2 border-[#F5E050] bg-[#FEFDF3] p-6 sm:p-7"
          >
            <p className="text-sm font-semibold text-[#012A4A]">
              Cette fonctionnalité est réservée à <strong>Réseauteur Plus</strong>.
            </p>

            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-extrabold text-[#8A6D0B]">{PRIX_PLUS_HT} €</span>
              <span className="text-sm font-semibold text-[#6E7175]">HT / an</span>
            </div>

            <ul className="flex flex-col gap-2.5 mt-5">
              {avantages.map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-sm text-[#4E5155]">
                  <Check size={16} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard/plus"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5E050] px-5 py-3 text-base font-bold text-[#012A4A] hover:bg-[#E3CB2E] transition-colors no-underline shadow-md shadow-[#F5E050]/30"
            >
              Passer à Réseauteur Plus
              <ArrowRight size={16} aria-hidden />
            </Link>

            <p className="text-xs text-[#6E7175] text-center mt-3">
              Abonnement annuel, sans engagement — résiliable à tout moment.
            </p>
          </section>
        </Reveal>

        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-[#6E7175] hover:text-[#012A4A] no-underline transition-colors"
          >
            ← Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  )
}
