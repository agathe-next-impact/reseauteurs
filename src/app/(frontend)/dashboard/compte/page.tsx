import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Card, CardBody } from '@/components/ui/Card'
import DeleteAccountButton from '@/components/dashboard/DeleteAccountButton'
import MarketingPreferencesToggle from '@/components/dashboard/MarketingPreferencesToggle'
import ChangeEmailForm from '@/components/dashboard/ChangeEmailForm'
import EmailChangeBanner from '@/components/dashboard/EmailChangeBanner'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import { UserCog, AlertTriangle, ShieldCheck, Download, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Mon compte — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function ComptePage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    select: {
      email: true,
      nomSociete: true,
      ville: true,
      createdAt: true,
      optInMarketing: true,
      cguAcceptedAt: true,
      confidentialiteAcceptedAt: true,
      optInMarketingAt: true,
      optOutMarketingAt: true,
    },
    overrideAccess: true,
  })

  return (
    <div className="rsn-page">
      <div className="max-w-4xl mx-auto px-6 py-8">
      <Suspense fallback={null}>
        <EmailChangeBanner />
      </Suspense>

      <Reveal className="mb-6">
        <p className="rsn-eyebrow mb-2">Espace connecté</p>
        <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2">
          <UserCog size={22} aria-hidden />
          Mon compte
        </h1>
      </Reveal>

      {/* Account info */}
      <Card className="rsn-card hover:translate-y-0 mb-6">
        <CardBody>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-4">
            Informations du compte
          </h3>
          <dl className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-2 border-b border-border-light">
              <dt className="text-sm text-text-light shrink-0">Email</dt>
              <dd className="flex-1 sm:max-w-md">
                <ChangeEmailForm currentEmail={freshUser.email} />
              </dd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-light">
              <dt className="text-sm text-text-light">Société</dt>
              <dd className="text-sm font-medium text-text-dark">{freshUser.nomSociete}</dd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-light">
              <dt className="text-sm text-text-light">Ville</dt>
              <dd className="text-sm font-medium text-text-dark">{freshUser.ville}</dd>
            </div>
            <div className="flex justify-between items-center py-2">
              <dt className="text-sm text-text-light">Inscrit le</dt>
              <dd className="text-sm font-medium text-text-dark">
                {new Date(freshUser.createdAt).toLocaleDateString('fr-FR')}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* RGPD / Privacy section */}
      <Card className="rsn-card hover:translate-y-0 mb-6">
        <CardBody>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-4 flex items-center gap-1.5">
            <ShieldCheck size={14} />
            Données personnelles & consentements
          </h3>

          <div className="space-y-5">
            <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-5 border-b border-border-light">
              <div className="flex-1">
                <p className="text-sm font-medium text-text-dark flex items-center gap-1.5">
                  <Mail size={14} />
                  Emails d&apos;information et conseils
                </p>
                <p className="text-sm text-text-light mt-1 leading-relaxed">
                  Nouveautés RÉSEAUTEURS, conseils pour enrichir votre profil, lancements de
                  fonctionnalités. Les emails liés à votre compte (sécurité, expiration) sont
                  envoyés indépendamment.
                </p>
              </div>
              <MarketingPreferencesToggle initialValue={freshUser.optInMarketing === true} />
            </div>

            <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-5 border-b border-border-light">
              <div className="flex-1">
                <p className="text-sm font-medium text-text-dark flex items-center gap-1.5">
                  <Download size={14} />
                  Télécharger mes données (RGPD)
                </p>
                <p className="text-sm text-text-light mt-1 leading-relaxed">
                  Exportez l&apos;ensemble de vos données personnelles au format JSON (compte,
                  fiche, evenements, groupe) — droit à la portabilite.
                </p>
              </div>
              <a
                href="/api/account/export"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors no-underline shrink-0"
              >
                <Download size={13} />
                Télécharger
              </a>
            </div>

            <div>
              <p className="text-sm font-medium text-text-dark mb-2">
                Historique des consentements
              </p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex flex-col md:flex-row justify-between">
                  <dt className="text-text-light">CGU acceptées le</dt>
                  <dd className="text-text-medium">
                    {freshUser.cguAcceptedAt
                      ? new Date(freshUser.cguAcceptedAt as string).toLocaleString('fr-FR')
                      : '—'}
                  </dd>
                </div>
                <div className="flex flex-col md:flex-row justify-between">
                  <dt className="text-text-light">Politique de confidentialité acceptée le</dt>
                  <dd className="text-text-medium">
                    {freshUser.confidentialiteAcceptedAt
                      ? new Date(freshUser.confidentialiteAcceptedAt as string).toLocaleString(
                          'fr-FR',
                        )
                      : '—'}
                  </dd>
                </div>
                {freshUser.optInMarketingAt && (
                  <div className="flex justify-between">
                    <dt className="text-text-light">Consentement emails donné le</dt>
                    <dd className="text-text-medium">
                      {new Date(freshUser.optInMarketingAt as string).toLocaleString('fr-FR')}
                    </dd>
                  </div>
                )}
                {freshUser.optOutMarketingAt && (
                  <div className="flex justify-between">
                    <dt className="text-text-light">Desinscription emails le</dt>
                    <dd className="text-text-medium">
                      {new Date(freshUser.optOutMarketingAt as string).toLocaleString('fr-FR')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="rsn-card hover:translate-y-0 border-red-200">
        <CardBody>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-red-500 mb-4 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            Zone de danger
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-dark">Supprimer mon compte</p>
              <p className="text-sm text-text-light mt-0.5">
                Supprime définitivement votre compte et votre profil RÉSEAUTEURS. Action irréversible.
              </p>
            </div>
            <DeleteAccountButton />
          </div>
        </CardBody>
      </Card>
      </div>
    </div>
  )
}
