import type { ReactNode } from 'react'
import CountUp from '@/components/home/CountUp'

export type Stat = {
  value: number
  label: string
  suffix?: string
  icon?: ReactNode
  /** Texte affiché à la place de la valeur (ex. « Bientôt »). */
  placeholder?: string
}

/**
 * Bandeau de compteurs animés (réutilisable sous un <PageHeader> ou en section).
 * Anime chaque nombre au scroll ; affiche « — » si la valeur est 0.
 */
export default function StatStrip({
  stats,
  className = '',
}: {
  stats: Stat[]
  className?: string
}) {
  return (
    <div className={`rsn-statstrip ${className}`}>
      {stats.map((s, i) => (
        <div key={i}>
          <span className="rsn-statstrip-val">
            {s.icon}
            {s.placeholder ? (
              s.placeholder
            ) : s.value > 0 ? (
              <CountUp value={s.value} suffix={s.suffix ?? ''} />
            ) : (
              '—'
            )}
          </span>
          <span className="rsn-statstrip-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
