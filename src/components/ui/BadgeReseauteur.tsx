/**
 * BadgeReseauteur — 4 variantes (Bronze/Argent/Gold/Platinum)
 * Pills déclaratives, purement visuelles (CLAUDE.md §5).
 * Pas de paiement réseauteur — ce badge est gratuit et déclaratif.
 */

type BadgeVariant = 'bronze' | 'argent' | 'gold' | 'platinum'

interface BadgeReseauteurProps {
  badge: BadgeVariant | string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

const BADGE_CONFIG: Record<BadgeVariant, { label: string; bg: string; text: string; border: string }> = {
  bronze: {
    label: 'Bronze',
    bg: '#fef9c3',
    text: '#92400e',
    border: '#fde047',
  },
  argent: {
    label: 'Argent',
    bg: '#f4f4f5',
    text: '#3f3f46',
    border: '#d4d4d8',
  },
  gold: {
    label: 'Gold',
    bg: '#fff7ed',
    text: '#c2410c',
    border: '#fed7aa',
  },
  platinum: {
    label: 'Platinum',
    bg: '#dbeafe',
    text: '#1d4ed8',
    border: '#93c5fd',
  },
}

export function BadgeReseauteur({ badge, size = 'md', className = '' }: BadgeReseauteurProps) {
  if (!badge) return null
  const key = badge.toLowerCase() as BadgeVariant
  const config = BADGE_CONFIG[key]
  if (!config) return null

  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${sizeClass} ${className}`}
      style={{ background: config.bg, color: config.text, borderColor: config.border }}
      aria-label={`Badge réseauteur : ${config.label}`}
    >
      {config.label}
    </span>
  )
}

export function BadgePartenaire({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${className}`}
      style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}
      aria-label="Réseau partenaire"
    >
      Partenaire
    </span>
  )
}

export function BadgePremium({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${className}`}
      style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#f5851f' }}
      aria-label="Événement Premium"
    >
      Premium
    </span>
  )
}
