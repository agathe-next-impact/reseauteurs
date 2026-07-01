import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

const PLAN_META = {
  premium: { label: 'Premium', price: '99 EUR/an' },
  infinite: { label: 'Infinite', price: '219 EUR/an' },
} as const

interface UnlockBannerProps {
  plan: 'premium' | 'infinite'
  className?: string
}

/**
 * Bannière amber "Débloquer avec Premium/Infinite · XX EUR/an"
 * Utilisee sur les sections verrouillees du dashboard (fiche, evenements, etc.)
 */
export function UnlockBanner({ plan, className = '' }: UnlockBannerProps) {
  const meta = PLAN_META[plan]
  return (
    <Link
      href={`/dashboard/abonnement?plan=${plan}#plan-${plan}`}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-amber-300 bg-gradient-to-r from-orange-50 to-amber-100 text-amber-900 text-sm no-underline transition-transform hover:-translate-y-px ${className}`}
    >
      <Sparkles size={16} className="text-amber-600 shrink-0" />
      <span className="flex-1">
        Débloquer avec <strong>{meta.label}</strong>{' '}
        <span className="text-amber-700">· {meta.price}</span>
      </span>
      <ArrowRight size={14} className="shrink-0" />
    </Link>
  )
}
