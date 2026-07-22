/**
 * ButtonRsn — Bouton primitif RÉSEAUTEURS (tokens DESIGN.md §4).
 * Variantes : primary (bleu #035AA6), accent (jaune #F5E050 — CTA B2B/partenaires),
 * outline, ghost. La variante reste nommée `orange` par compatibilité d'API.
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
    'bg-[#035AA6] text-white hover:bg-[#02467F] focus-visible:outline-[#035AA6] ir-btn-plasma',
  orange:
    'bg-[#F5E050] text-[#012A4A] hover:bg-[#E3CB2E] focus-visible:outline-[#8A6D0B] ir-btn-plasma',
  outline:
    'bg-white text-[#035AA6] border border-[#035AA6] hover:bg-[#A9C9E4]/20 focus-visible:outline-[#035AA6] ir-btn-outline-plasma',
  ghost:
    'bg-transparent text-[#4E5155] hover:bg-[#E9E9EA] hover:text-[#1D1E21] focus-visible:outline-[#035AA6]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm p-2.5 gap-1.5',
  md: 'text-sm p-2.5 gap-2',
  lg: 'text-base p-2.5 gap-2',
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
