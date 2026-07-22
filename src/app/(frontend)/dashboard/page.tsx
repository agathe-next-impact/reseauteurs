/**
 * Tableau de bord — Page d'accueil
 * Affiche le résumé du compte selon le rôle (réseauteur / organisateur / admin).
 * Auth vérifiée côté serveur.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { User, Network } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import type { Reseauteur, Reseau } from '@/types/reseauteurs-domain'

export const metadata = {
  title: 'Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function DashboardPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  // Le partenaire a son propre espace.
  if (freshUser.role === 'partenaire') redirect('/dashboard/partenaire')

  const role: 'reseauteur' | 'organisateur' | 'admin' =
    (freshUser.role as string) === 'organisateur' ? 'organisateur'
    : (freshUser.role as string) === 'admin' ? 'admin'
    : 'reseauteur'

  // Charge le profil lié selon le rôle
  let reseauteur: Reseauteur | null = null
  let reseau: Reseau | null = null

  if (role === 'reseauteur') {
    const { docs } = await payload.find({
      collection: 'reseauteurs',
      where: { user: { equals: user.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    reseauteur = (docs[0] as Reseauteur | undefined) ?? null
  } else if (role === 'organisateur') {
    const { docs } = await payload.find({
      collection: 'reseaux',
      where: { user: { equals: user.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    reseau = (docs[0] as Reseau | undefined) ?? null
  }

  return (
    <div className="rsn-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Reveal className="mb-6">
          <p className="rsn-eyebrow mb-2">Espace connecté</p>
          <h1 className="text-2xl font-extrabold text-[#012A4A]">Tableau de bord</h1>
        </Reveal>

        {/* Rôle réseauteur */}
        {role === 'reseauteur' && (
          <div className="space-y-4">
            {!reseauteur ? (
              <Reveal>
                <div className="rsn-card rounded-2xl border-dashed p-8 text-center">
                  <User size={32} className="text-[#CFD0D2] mx-auto mb-3" aria-hidden />
                  <p className="text-sm font-medium text-[#4E5155] mb-4">Bienvenue ! Créez votre profil réseauteur pour apparaître sur la carte.</p>
                  <Link
                    href="/dashboard/profil"
                    className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-[#035AA6] text-white font-semibold text-sm hover:bg-[#02467F] transition-colors no-underline"
                  >
                    Créer mon profil
                  </Link>
                </div>
              </Reveal>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Reveal>
                  <Link
                    href="/dashboard/profil"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
                      Mon profil
                    </h2>
                    <p className="font-bold text-[#012A4A] mb-1">{reseauteur.prenom} {reseauteur.nom}</p>
                    {reseauteur.ville && <p className="text-sm text-[#6E7175]">{reseauteur.ville}</p>}
                    <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      reseauteur.statut === 'valide'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {reseauteur.statut === 'valide' ? 'Publié' : 'À compléter'}
                    </div>
                    <div className="mt-4">
                      <span className="text-sm text-[#035AA6] font-medium flex items-center gap-1">
                        Modifier mon profil 
                      </span>
                    </div>
                  </Link>
                </Reveal>
                <Reveal delay={70}>
                  <Link
                    href="/dashboard/offres"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
                      Offres entreprises
                    </h2>
                    <p className="text-sm text-[#4E5155]">Avantages exclusifs réservés aux réseauteurs.</p>
                    <div className="mt-4">
                      <span className="text-sm text-[#8A6D0B] font-medium flex items-center gap-1">
                        Découvrir les offres 
                      </span>
                    </div>
                  </Link>
                </Reveal>
              </div>

              <Reveal delay={140}>
                <h2 className="rsn-eyebrow mt-8 mb-3">Événements</h2>
              </Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Reveal delay={140}>
                  <Link
                    href="/dashboard/participations"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
                      Mes participations
                    </h3>
                    <p className="text-sm text-[#4E5155]">Signalez votre présence aux événements de vos réseaux.</p>
                    <div className="mt-4">
                      <span className="text-sm text-[#035AA6] font-medium flex items-center gap-1">
                        Voir mes participations 
                      </span>
                    </div>
                  </Link>
                </Reveal>
                <Reveal delay={210}>
                  <Link
                    href="/dashboard/plus"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
                      Réseauteur Plus
                    </h3>
                    <p className="text-sm text-[#4E5155]">Créez vos propres événements avec l&apos;abonnement Réseauteur Plus.</p>
                    <div className="mt-4">
                      <span className="text-sm text-[#8A6D0B] font-medium flex items-center gap-1">
                        Mes événements Plus 
                      </span>
                    </div>
                  </Link>
                </Reveal>
              </div>
              </>
            )}
          </div>
        )}

        {/* Rôle organisateur */}
        {role === 'organisateur' && (
          <div className="space-y-4">
            {!reseau ? (
              <Reveal>
                <div className="rsn-card rounded-2xl border-dashed p-8 text-center">
                  <Network size={32} className="text-[#CFD0D2] mx-auto mb-3" aria-hidden />
                  <p className="text-sm font-medium text-[#4E5155] mb-4">Créez la fiche de votre réseau pour commencer.</p>
                  <Link
                    href="/dashboard/reseau"
                    className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-[#F5E050] text-[#012A4A] font-semibold text-sm hover:bg-[#E3CB2E] transition-colors no-underline"
                  >
                    Créer ma fiche réseau
                  </Link>
                </div>
              </Reveal>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Reveal>
                  <Link
                    href="/dashboard/reseau"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
                      Mon réseau
                    </h2>
                    <p className="font-bold text-[#012A4A] mb-1">{reseau.nom}</p>
                    <div className="flex gap-3 text-xs text-[#6E7175] mt-1">
                      <span>{reseau.nbReseauteurs ?? 0} réseauteurs</span>
                      <span>{reseau.nbEvenements ?? 0} événements</span>
                    </div>
                    {reseau.partenaire ? (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEFBE6] text-[#8A6D0B] border border-[#EFE08F]">
                        Partenaire actif
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Abonnement requis
                      </div>
                    )}
                    <div className="mt-4">
                      <span className="text-sm text-[#035AA6] font-medium flex items-center gap-1">
                        Gérer mon réseau 
                      </span>
                    </div>
                  </Link>
                </Reveal>
                <Reveal delay={70}>
                  <Link
                    href="/dashboard/reseau"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-3 flex items-center gap-1.5">
                      Événements
                    </h2>
                    <p className="text-sm text-[#4E5155]">{reseau.nbEvenements ?? 0} événement{(reseau.nbEvenements ?? 0) !== 1 ? 's' : ''} publié{(reseau.nbEvenements ?? 0) !== 1 ? 's' : ''}</p>
                    <div className="mt-4">
                      <span className="text-sm text-[#035AA6] font-medium flex items-center gap-1">
                        Gérer mes événements 
                      </span>
                    </div>
                    {!reseau.partenaire && (
                      <div className="mt-3">
                        <span className="text-xs text-[#8A6D0B] font-medium">
                          Devenir réseau partenaire →
                        </span>
                      </div>
                    )}
                  </Link>
                </Reveal>
              </div>
            )}
          </div>
        )}

        {/* Admin */}
        {role === 'admin' && (
          <Reveal>
            <div className="rsn-card rounded-2xl p-6 text-center">
              <p className="text-sm text-[#4E5155] mb-4">Vous êtes administrateur. Accédez au back-office Payload pour gérer la plateforme.</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-[#012A4A] text-white font-semibold text-sm hover:bg-[#02467F] transition-colors no-underline"
              >
                Accéder au back-office
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  )
}
