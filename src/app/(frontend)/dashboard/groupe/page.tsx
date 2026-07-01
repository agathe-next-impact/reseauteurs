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
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-100 mb-6">
        <Clock size={28} className="text-zinc-400" />
      </div>
      <h1 className="text-2xl font-bold text-[#18181b] mb-3">
        Groupes — bientôt disponible
      </h1>
      <p className="text-[#52525b] leading-relaxed">
        La fonctionnalité de groupes sera disponible dans une prochaine version de RÉSEAUTEURS.
        Votre réseau et vos événements sont déjà accessibles depuis le tableau de bord.
      </p>
    </div>
  )
}
