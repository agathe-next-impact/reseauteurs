import { Lock } from 'lucide-react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  locked?: boolean
  lockMessage?: string
  upgradePlan?: 'premium' | 'infinite'
  children: React.ReactNode
}

interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export function Card({
  locked = false,
  lockMessage = 'Disponible en Premium',
  upgradePlan = 'premium',
  children,
  className = '',
  ...rest
}: CardProps) {
  const ctaLabel = upgradePlan === 'infinite' ? 'Passer Infinite' : 'Passer Premium'
  return (
    <div
      className={`ir-card relative bg-white border border-gray-200 rounded-xl transition-all duration-200 hover:-translate-y-px ${className}`}
      {...rest}
    >
      {children}
      {locked && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] rounded-xl z-10 flex flex-col items-center justify-center gap-3">
          <Lock size={24} className="text-gray-400" />
          <p className="text-sm text-gray-500 font-medium">{lockMessage}</p>
          <a
            href={`/dashboard/abonnement?plan=${upgradePlan}#plan-${upgradePlan}`}
            className="inline-flex items-center p-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors duration-150"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </div>
  )
}

export function CardHeader({ children, className = '', ...rest }: CardSectionProps) {
  return (
    <div className={`px-5 py-4 border-b border-gray-100 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '', ...rest }: CardSectionProps) {
  return (
    <div className={`px-5 py-4 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...rest }: CardSectionProps) {
  return (
    <div className={`px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl ${className}`} {...rest}>
      {children}
    </div>
  )
}
