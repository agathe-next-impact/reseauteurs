/**
 * Espace réseauteur — Réseauteur Plus (/dashboard/plus) — ADR-0013 P2.B.
 * Activation par abonnement Stripe (39 € HT/an). ADR-0015 : le code promo partenaire est supprimé.
 * Le statut est lu FRAIS côté serveur (jamais le JWT).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Network } from 'lucide-react'
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

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
  if (freshUser.role === 'admin') redirect('/admin')
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role === 'partenaire') redirect('/dashboard/partenaire')

  const u = freshUser as unknown as {
    plusActif?: boolean
    plusExpireAt?: string | null
    plusSource?: string | null
  }
  const actif = estPlus({ id: freshUser.id, plusActif: u.plusActif, plusExpireAt: u.plusExpireAt })

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          <Link
            href="/dashboard/profil"
            className="text-sm text-[#6E7175] hover:text-[#035AA6] no-underline inline-flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden /> Mon profil
          </Link>
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2 mb-2">
            <Sparkles size={20} className="text-[#8A6D0B]" aria-hidden />
            Réseauteur Plus
          </h1>
          <p className="text-sm text-[#6E7175] mb-8">
            Créez et publiez vos propres événements de networking, visibles sur la carte et
            référencés sur la plateforme.
          </p>
        </Reveal>

        <PlusClient
          actif={actif}
          expireAt={u.plusExpireAt ?? null}
          source={(u.plusSource as 'abonnement' | 'licence' | null) ?? null}
        />

        {/* Réseaux locaux possédés (ADR-0014 — remplace la déclaration de groupes administrés) */}
        {actif && (
          <div className="mt-6 rsn-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#1D1E21] mb-1 flex items-center gap-1.5">
              <Network size={14} className="text-[#3E7CA6]" aria-hidden />
              Mes réseaux locaux
            </h2>
            <p className="text-xs text-[#6E7175] mb-3">
              Créez vos fiches de réseaux locaux (affiliées à un réseau national ou indépendantes)
              et publiez leurs événements.
            </p>
            <Link
              href="/dashboard/mes-reseaux"
              className="inline-flex items-center gap-1.5 text-xs bg-[#3E7CA6] text-white hover:bg-[#2E6389] p-2.5 rounded-xl font-semibold transition-colors no-underline"
            >
              Gérer mes réseaux →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
