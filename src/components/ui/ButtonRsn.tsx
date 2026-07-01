/**
 * ButtonRsn — Bouton primitif RÉSEAUTEURS (tokens DESIGN.md §4).
 * Variantes : primary (bleu), orange (CTA B2B/partenaires), outline, ghost.
 * Radius ~12px (rounded-xl) ; pills sur les badges (rounded-full).
 * Server Component-compatible : pas de 'use client' dans ce fichier.
 */

import type { LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'orange' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonRsnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: LucideIcon
  iconRight?: LucideIcon
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#2563EB] text-white hover:bg-[#1d4ed8] focus-visible:outline-[#2563EB] ir-btn-plasma',
  orange:
    'bg-[#f5851f] text-white hover:bg-[#e07710] focus-visible:outline-[#f5851f] ir-btn-plasma',
  outline:
    'bg-white text-[#2563EB] border border-[#2563EB] hover:bg-[#bfdbfe]/20 focus-visible:outline-[#2563EB] ir-btn-outline-plasma',
  ghost:
    'bg-transparent text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b] focus-visible:outline-[#2563EB]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
}

const iconSizes: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 }

export function ButtonRsn({
  variant = 'primary',
  size = 'md',
  iconLeft: IconLeft,
  iconRight: IconRight,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonRsnProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold rounded-xl transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {IconLeft && <IconLeft size={iconSizes[size]} aria-hidden />}
      {children}
      {IconRight && <IconRight size={iconSizes[size]} aria-hidden />}
    </button>
  )
}
