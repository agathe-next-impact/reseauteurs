/**
 * AgencyCreditBanner — bandeau d'attribution, juste au-dessus du pied de page.
 *
 * Crédite l'agence qui a réalisé le site et renvoie vers son site.
 * Server Component (lien statique, aucun état). Couleurs sur tokens `--ir-*` pour
 * suivre la bascule clair ⇄ sombre, comme le pied de page qu'il surplombe.
 *
 * Lien SORTANT vers un site tiers → `target="_blank"` + `rel="noopener noreferrer"`.
 */
import { Code2, ArrowUpRight } from 'lucide-react'

const AGENCY_URL = 'https://next-impact.digital'

export default function AgencyCreditBanner() {
  return (
    <aside
      aria-label="Réalisation du site"
      className="border-t border-[rgba(var(--ir-line-rgb),0.08)] bg-[var(--ir-surface)]"
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-2 text-center">
        <p className="inline-flex items-center gap-2 text-sm text-[var(--ir-text-4)]">
          <Code2 size={15} className="text-[var(--ir-accent-text)]" aria-hidden />
          <span>
            Site créé avec{' '}
            <span className="font-semibold text-[var(--ir-text-2)]">Next Impact</span> — Conseil et
            services web
          </span>
        </p>
        <a
          href={AGENCY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ir-accent-text)] no-underline hover:underline"
        >
          next-impact.digital
          <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
    </aside>
  )
}
