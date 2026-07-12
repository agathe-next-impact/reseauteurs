/**
 * Espace réseauteur — Réseauteur Plus (/dashboard/plus) — ADR-0013 P2.B.
 * Deux chemins d'activation : abonnement Stripe (59 €/an) OU code promo partenaire.
 * Le statut est lu FRAIS côté serveur (jamais le JWT).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { estPlus } from '@/lib/acces-plus'
import { PlusClient } from './PlusClient'

export const metadata = {
  title: 'Réseauteur Plus — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function PlusPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
  if (freshUser.role === 'admin') redirect('/admin')
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role === 'partenaire') redirect('/dashboard/partenaire')

  const u = freshUser as unknown as {
    plusActif?: boolean
    plusExpireAt?: string | null
    plusSource?: string | null
  }

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          <Link
            href="/dashboard/profil"
            className="text-sm text-[#71717a] hover:text-[#2563EB] no-underline inline-flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden /> Mon profil
          </Link>
          <p className="rsn-eyebrow">Espace connecté</p>
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2 mb-2">
            <Sparkles size={20} className="text-[#f5851f]" aria-hidden />
            Réseauteur Plus
          </h1>
          <p className="text-sm text-[#71717a] mb-8">
            Créez et publiez vos propres événements de networking, visibles sur la carte et référencés
            sur la plateforme.
          </p>
        </Reveal>

        <PlusClient
          actif={estPlus({ id: freshUser.id, plusActif: u.plusActif, plusExpireAt: u.plusExpireAt })}
          expireAt={u.plusExpireAt ?? null}
          source={(u.plusSource as 'abonnement' | 'licence' | null) ?? null}
        />
      </div>
    </div>
  )
}
