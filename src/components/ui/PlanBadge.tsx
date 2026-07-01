type Plan = 'gratuit' | 'premium' | 'infinite'
type BadgeSize = 'sm' | 'md' | 'lg'

interface PlanBadgeProps {
  plan: Plan
  size?: BadgeSize
  className?: string
}

const planLabels: Record<Plan, string> = {
  gratuit: 'Gratuit',
  premium: 'Premium',
  infinite: 'Infinite',
}

const variantClasses: Record<Plan, string> = {
  gratuit: 'bg-gray-50 text-gray-500 border border-dashed border-gray-300',
  premium: 'bg-primary text-white border border-solid border-primary',
  infinite:
    'bg-gradient-to-r from-amber-400 via-orange-500 to-blue-600 text-white border-none',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-sm px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
  lg: 'text-sm px-4 py-1.5 gap-2',
}

export function PlanBadge({ plan, size = 'md', className = '' }: PlanBadgeProps) {
  const label = planLabels[plan]
  const showShimmer = plan === 'infinite'

  return (
    <span
      className={`relative overflow-hidden inline-flex items-center font-semibold rounded-full ${variantClasses[plan]} ${sizeClasses[size]} ${className}`}
    >
      {showShimmer && (
        <span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%]"
          aria-hidden="true"
        />
      )}
      <span className="relative">{label}</span>
    </span>
  )
}
