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
  infinite: 'bg-[#012A4A] text-white border border-solid border-[#012A4A]',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-sm px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
  lg: 'text-sm px-4 py-1.5 gap-2',
}

export function PlanBadge({ plan, size = 'md', className = '' }: PlanBadgeProps) {
  const label = planLabels[plan]

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${variantClasses[plan]} ${sizeClasses[size]} ${className}`}
    >
      <span>{label}</span>
    </span>
  )
}
