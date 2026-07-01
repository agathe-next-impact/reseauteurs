type SkeletonVariant = 'text' | 'card' | 'map-marker' | 'avatar'

interface SkeletonProps {
  variant?: SkeletonVariant
  lines?: number
  className?: string
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded-md',
  card: 'h-48 w-full rounded-xl',
  'map-marker': 'h-8 w-8 rounded-full',
  avatar: 'h-10 w-10 rounded-full',
}

const shimmerClass =
  'relative overflow-hidden bg-gray-200 before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1.5s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent'

const lineWidths = ['w-full', 'w-4/5', 'w-3/5', 'w-full', 'w-4/5']

export function Skeleton({ variant = 'text', lines = 1, className = '' }: SkeletonProps) {
  const base = `${shimmerClass} ${variantClasses[variant]} ${className}`

  if (variant === 'text' && lines > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`${shimmerClass} h-4 rounded-md ${lineWidths[i % lineWidths.length]} ${className}`}
          />
        ))}
      </div>
    )
  }

  return <div className={base} />
}
