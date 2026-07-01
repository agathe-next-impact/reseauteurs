import Link from 'next/link'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'
import AuthShell from '@/components/layout/AuthShell'

export const metadata: Metadata = {
  title: 'Désabonnement — RÉSEAUTEURS',
  robots: { index: false, follow: false },
}

export default async function DesabonnementConfirmePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const ok = status === 'ok' || !status

  return (
    <AuthShell title={ok ? 'Désabonnement confirme' : 'Lien invalide'}>
      <div className="text-center">
        {ok ? (
          <>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-sm text-text-light mb-6">
              Vous ne recevrez plus d&apos;emails d&apos;information de RÉSEAUTEURS. Les emails
              liés à votre compte (confirmation de paiement, expiration, sécurité) continueront
              d&apos;être envoyés.
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-amber-600" />
            </div>
            <p className="text-sm text-text-light mb-6">
              Le lien de désabonnement est invalide ou a expire. Vous pouvez gérer vos
              préférences directement depuis votre espace personnel.
            </p>
          </>
        )}
        <Link
          href="/dashboard/compte"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
        >
          Gérer mes préférences
        </Link>
      </div>
    </AuthShell>
  )
}
