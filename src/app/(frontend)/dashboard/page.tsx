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
import { User, Network, Calendar, ArrowRight, Shield } from 'lucide-react'
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
          <h1 className="text-2xl font-extrabold text-[#16284f]">Tableau de bord</h1>
        </Reveal>

        {/* Rôle réseauteur */}
        {role === 'reseauteur' && (
          <div className="space-y-4">
            {!reseauteur ? (
              <Reveal>
                <div className="rsn-card rounded-2xl border-dashed p-8 text-center">
                  <User size={32} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
                  <p className="text-sm font-medium text-[#52525b] mb-4">Bienvenue ! Créez votre profil réseauteur pour apparaître sur la carte.</p>
                  <Link
                    href="/dashboard/profil"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors no-underline"
                  >
                    Créer mon profil
                    <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
              </Reveal>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Reveal>
                  <Link
                    href="/dashboard/profil"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-3 flex items-center gap-1.5">
                      <User size={13} aria-hidden />
                      Mon profil
                    </h2>
                    <p className="font-bold text-[#16284f] mb-1">{reseauteur.prenom} {reseauteur.nom}</p>
                    {reseauteur.ville && <p className="text-sm text-[#71717a]">{reseauteur.ville}</p>}
                    <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      reseauteur.statut === 'valide'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {reseauteur.statut === 'valide' ? 'Publié' : 'À compléter'}
                    </div>
                    <div className="mt-4">
                      <span className="text-sm text-[#2563EB] font-medium flex items-center gap-1">
                        Modifier mon profil <ArrowRight size={12} aria-hidden className="rsn-arrow" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
                <Reveal delay={70}>
                  <div className="rsn-card rounded-2xl p-5 h-full">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-3 flex items-center gap-1.5">
                      <Shield size={13} aria-hidden />
                      Mon compte
                    </h2>
                    <p className="text-sm text-[#52525b] mb-1">{user.email}</p>
                    <p className="text-xs text-[#a1a1aa]">Réseauteur — gratuit</p>
                    <div className="mt-4">
                      <a href="/api/account/export" download className="text-xs text-[#71717a] hover:text-[#2563EB] transition-colors block">
                        Exporter mes données (RGPD)
                      </a>
                    </div>
                  </div>
                </Reveal>
              </div>
            )}
          </div>
        )}

        {/* Rôle organisateur */}
        {role === 'organisateur' && (
          <div className="space-y-4">
            {!reseau ? (
              <Reveal>
                <div className="rsn-card rounded-2xl border-dashed p-8 text-center">
                  <Network size={32} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
                  <p className="text-sm font-medium text-[#52525b] mb-4">Créez la fiche de votre réseau pour commencer.</p>
                  <Link
                    href="/dashboard/reseau"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f5851f] text-white font-semibold text-sm hover:bg-[#e07710] transition-colors no-underline"
                  >
                    Créer ma fiche réseau
                    <ArrowRight size={14} aria-hidden />
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
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-3 flex items-center gap-1.5">
                      <Network size={13} aria-hidden />
                      Mon réseau
                    </h2>
                    <p className="font-bold text-[#16284f] mb-1">{reseau.nom}</p>
                    <div className="flex gap-3 text-xs text-[#71717a] mt-1">
                      <span>{reseau.nbReseauteurs ?? 0} réseauteurs</span>
                      <span>{reseau.nbEvenements ?? 0} événements</span>
                    </div>
                    {reseau.partenaire ? (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
                        Partenaire actif
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Abonnement requis
                      </div>
                    )}
                    <div className="mt-4">
                      <span className="text-sm text-[#2563EB] font-medium flex items-center gap-1">
                        Gérer mon réseau <ArrowRight size={12} aria-hidden className="rsn-arrow" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
                <Reveal delay={70}>
                  <Link
                    href="/dashboard/reseau"
                    className="rsn-card rsn-lift rsn-linkrow block rounded-2xl p-5 no-underline h-full"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-3 flex items-center gap-1.5">
                      <Calendar size={13} aria-hidden />
                      Événements
                    </h2>
                    <p className="text-sm text-[#52525b]">{reseau.nbEvenements ?? 0} événement{(reseau.nbEvenements ?? 0) !== 1 ? 's' : ''} publié{(reseau.nbEvenements ?? 0) !== 1 ? 's' : ''}</p>
                    <div className="mt-4">
                      <span className="text-sm text-[#2563EB] font-medium flex items-center gap-1">
                        Gérer mes événements <ArrowRight size={12} aria-hidden className="rsn-arrow" />
                      </span>
                    </div>
                    {!reseau.partenaire && (
                      <div className="mt-3">
                        <span className="text-xs text-[#f5851f] font-medium">
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
              <p className="text-sm text-[#52525b] mb-4">Vous êtes administrateur. Accédez au back-office Payload pour gérer la plateforme.</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16284f] text-white font-semibold text-sm hover:bg-[#1e3a6e] transition-colors no-underline"
              >
                Accéder au back-office
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  )
}
