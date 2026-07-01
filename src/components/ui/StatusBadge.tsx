import type { LucideIcon } from 'lucide-react'

type StatusVariant = 'publiee' | 'suspendue' | 'archive'
type BadgeSize = 'sm' | 'md' | 'lg'

interface StatusBadgeProps {
  statut: StatusVariant
  size?: BadgeSize
  icon?: LucideIcon
  className?: string
}

const variantClasses: Record<StatusVariant, string> = {
  publiee: 'bg-green-100 text-green-800 border-green-200',
  suspendue: 'bg-gray-100 text-gray-600 border-gray-200',
  archive: 'bg-slate-100 text-slate-600 border-slate-200',
}

const labels: Record<StatusVariant, string> = {
  publiee: 'Publiee',
  suspendue: 'Suspendue',
  archive: 'Archive',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-sm px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
  lg: 'text-sm px-4 py-1.5 gap-2',
}

const iconSizes: Record<BadgeSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
}

export function StatusBadge({ statut, size = 'md', icon: Icon, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${variantClasses[statut]} ${sizeClasses[size]} ${className}`}
    >
      {Icon && <Icon size={iconSizes[size]} />}
      {labels[statut]}
    </span>
  )
}
