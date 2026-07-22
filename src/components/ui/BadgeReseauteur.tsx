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
    bg: '#F3EFDC',
    text: '#6E5608',
    border: '#DCD3A8',
  },
  argent: {
    label: 'Argent',
    bg: '#E9E9EA',
    text: '#3F4247',
    border: '#CFD0D2',
  },
  gold: {
    label: 'Gold',
    bg: '#FBF4D3',
    text: '#8A6D0B',
    border: '#F5E050',
  },
  platinum: {
    label: 'Platinum',
    bg: '#DCEAF5',
    text: '#02467F',
    border: '#8BB4D9',
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
      style={{ background: '#F5E050', color: '#012A4A', borderColor: '#E3CB2E' }}
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
      style={{ background: '#FEFBE6', color: '#8A6D0B', borderColor: '#F5E050' }}
      aria-label="Événement Premium"
    >
      Premium
    </span>
  )
}
