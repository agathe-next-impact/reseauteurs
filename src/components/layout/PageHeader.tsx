import type { ReactNode } from 'react'
import Reveal from '@/components/home/Reveal'
import StatStrip, { type Stat } from './StatStrip'

/**
 * En-tête de page standard RÉSEAUTEURS — même langage visuel que l'accueil :
 * fond de marque + grille discrète, eyebrow, titre, chapô, actions et
 * bandeau de compteurs optionnel. Theme-adaptatif (clair/sombre) via --ir-*.
 *
 * Usage :
 *   <PageHeader
 *     eyebrow="Réseaux" icon={<Network size={13} />} tone="orange"
 *     title={<>Réseaux d'affaires</>}
 *     lead="Tous les réseaux et leurs groupes locaux."
 *     actions={<Link className="ir-atlas-primary" href="…">…</Link>}
 *     stats={[{ value: 120, label: 'Réseaux' }]}
 *   />
 */
export default function PageHeader({
  eyebrow,
  title,
  lead,
  icon,
  tone = 'blue',
  actions,
  stats,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  icon?: ReactNode
  tone?: 'blue' | 'orange' | 'navy'
  actions?: ReactNode
  stats?: Stat[]
  children?: ReactNode
}) {
  return (
    <section className="rsn-pagehead" data-tone={tone}>
      <div className="rsn-pagehead-inner">
        <Reveal>
          {eyebrow && (
            <p className={`rsn-eyebrow ${tone === 'orange' ? 'rsn-pagehead-eyebrow--orange' : ''}`}>
              {icon}
              {eyebrow}
            </p>
          )}
          <h1 className="rsn-pagehead-title">{title}</h1>
          {lead && <p className="rsn-pagehead-lead">{lead}</p>}
          {actions && (
            <div className="ir-atlas-actions" style={{ marginTop: 28 }}>
              {actions}
            </div>
          )}
          {stats && stats.length > 0 && <StatStrip stats={stats} />}
          {children}
        </Reveal>
      </div>
    </section>
  )
}
