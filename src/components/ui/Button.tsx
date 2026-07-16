'use client'

import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: LucideIcon
  iconRight?: LucideIcon
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/80',
  secondary: 'bg-white text-primary hover:bg-white-90',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-2 py-1 gap-1',
  md: 'text-sm px-4 py-1.5 gap-2',
  lg: 'text-lg px-6 py-4 gap-2.5',
}

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={`group relative overflow-hidden inline-flex items-center justify-center font-medium rounded-full transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/30 to-transparent group-hover:animate-shine" />
      {loading ? (
        <Loader2 size={iconSizes[size]} className="animate-spin" />
      ) : (
        IconLeft && <IconLeft size={iconSizes[size]} />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSizes[size]} />}
    </button>
  )
}
