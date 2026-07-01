/**
 * /dashboard/groupe — Fonctionnalité dormante.
 * Les groupes sont conservés dans le modèle de données (ADR-0009 inchangé)
 * mais ne sont pas développés en V1 (ADR-0011 §12).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { Clock } from 'lucide-react'
import Reveal from '@/components/home/Reveal'

export const metadata: Metadata = {
  title: 'Groupes — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function GroupePage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <Reveal>
          <p className="rsn-eyebrow mb-4 justify-center">Espace connecté</p>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-100 mb-6">
            <Clock size={28} className="text-zinc-400" aria-hidden />
          </div>
          <h1 className="text-2xl font-extrabold text-[#16284f] mb-3">
            Groupes — bientôt disponible
          </h1>
          <p className="text-[#52525b] leading-relaxed">
            La fonctionnalité de groupes sera disponible dans une prochaine version de RÉSEAUTEURS.
            Votre réseau et vos événements sont déjà accessibles depuis le tableau de bord.
          </p>
        </Reveal>
      </div>
    </div>
  )
}
