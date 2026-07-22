import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SITE_NAME } from '@/lib/site'

/**
 * Coquille des pages d'authentification (login, inscription, reset…) :
 * carte centrée dans le cadre de marque, theme-adaptative. La logique du
 * formulaire reste dans la page ; on ne fournit que le décor.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Élargit la carte (écrans à deux colonnes, ex. choix Gratuit / Réseauteur+). */
  wide?: boolean
}) {
  return (
    <div className="rsn-auth">
      <div className="rsn-auth-card" style={wide ? { maxWidth: '960px' } : undefined}>
        <div className="text-center mb-6">
          <Link href="/" className="rsn-auth-brand" aria-label={`Accueil ${SITE_NAME}`}>
            <Image src="/img/logo.png" alt="" width={34} height={34} priority />
            <span>{SITE_NAME.toUpperCase()}</span>
          </Link>
          {subtitle && <p className="text-sm text-[#6E7175] mt-2">{subtitle}</p>}
        </div>
        <h1 className="text-xl font-bold text-[#012A4A] mb-6">{title}</h1>
        {children}
      </div>
      {footer && <div className="text-center text-sm text-[#6E7175]">{footer}</div>}
    </div>
  )
}
