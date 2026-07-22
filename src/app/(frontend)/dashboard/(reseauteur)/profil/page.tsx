/**
 * Dashboard réseauteur — Édition du profil
 * Auth vérifiée côté serveur. Rôle vérifié.
 * Formulaire branché (ProfilForm — Client Component).
 * Actions RGPD : export JSON, suppression de compte, opt-out noindex.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import Image from 'next/image'
import { User, MapPin, Globe, Phone, Mail, Network, Shield, ExternalLink } from 'lucide-react'
import { BadgeReseauteur } from '@/components/ui/BadgeReseauteur'
import { ProfilForm } from './ProfilForm'
import { DeleteAccountButton } from './DeleteAccountButton'
import Reveal from '@/components/home/Reveal'
import type { Reseauteur, Media } from '@/types/reseauteurs-domain'

export const metadata = {
  title: 'Mon profil — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function DashboardProfilPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  // Vérification rôle : cette page est réservée aux réseauteurs
  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role === 'admin') redirect('/admin')

  // Charge le profil réseauteur lié
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  const reseauteur = (docs[0] as Reseauteur | undefined) ?? null
  const photoMedia = reseauteur?.photo as Media | null | undefined
  const photoUrl = photoMedia?.sizes?.thumbnail?.url ?? photoMedia?.url

  // Affiliation ouverte aux têtes de réseau ET aux groupes locaux publiés
  // (décision 2026-07-17 — annuaire des réseaux nationaux sélectionnable).
  // + référentiel des secteurs d'activité (`categories`) pour le sélecteur du profil.
  const [{ docs: reseauxLocauxDocs }, { docs: secteursDocs }] = await Promise.all([
    payload.find({
      collection: 'reseaux',
      where: { statut: { equals: 'publiee' } },
      select: { id: true, nom: true, ville: true } as Record<string, boolean>,
      limit: 1000,
      sort: 'nom',
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'categories',
      select: { id: true, label: true } as Record<string, boolean>,
      limit: 200,
      sort: 'label',
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const reseauxLocaux = (reseauxLocauxDocs as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as number | string,
    nom: r.nom as string,
    ville: (r.ville as string | null | undefined) ?? null,
  }))

  const secteurs = (secteursDocs as unknown as Record<string, unknown>[])
    .map((c) => ({ id: c.id as number | string, label: (c.label as string | null) ?? '' }))
    .filter((c) => c.label)

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2">
              <User size={20} aria-hidden />
              Mon profil
            </h1>
            {reseauteur?.slug && (
              <Link
                href={`/reseauteur/${reseauteur.slug}`}
                className="text-sm text-[#035AA6] hover:text-[#02467F] font-medium no-underline transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir ma fiche publique →
              </Link>
            )}
          </div>
        </Reveal>

        {!reseauteur ? (
          /* État vide — le profil est auto-créé au signup. S'il manque, c'est une anomalie. */
          <div className="rsn-card rounded-2xl border-dashed p-10 text-center">
            <User size={36} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#4E5155] mb-2">
              Profil en cours d&apos;initialisation…
            </p>
            <p className="text-sm text-[#6E7175] mb-6">
              Votre profil réseauteur est créé automatiquement. Rechargez la page dans quelques
              secondes.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Résumé profil */}
            <div className="rsn-card rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-5">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={`Photo de profil de ${reseauteur.prenom} ${reseauteur.nom}`}
                    width={72}
                    height={72}
                    className="w-16 h-16 rounded-xl object-cover border border-[#DFE0E1] shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl bg-[#A9C9E4]/30 flex items-center justify-center text-[#035AA6] font-bold text-xl shrink-0"
                    aria-hidden
                  >
                    {reseauteur.prenom?.charAt(0)}
                    {reseauteur.nom?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-bold text-[#012A4A]">
                      {reseauteur.prenom} {reseauteur.nom}
                    </p>
                    {reseauteur.badge && <BadgeReseauteur badge={reseauteur.badge} />}
                  </div>
                  {reseauteur.fonction && (
                    <p className="text-sm text-[#4E5155]">{reseauteur.fonction}</p>
                  )}
                  {reseauteur.entreprise && (
                    <p className="text-sm text-[#6E7175]">{reseauteur.entreprise}</p>
                  )}
                  {reseauteur.ville && (
                    <p className="text-xs text-[#6E7175] flex items-center gap-1 mt-1">
                      <MapPin size={11} aria-hidden />
                      {reseauteur.ville}
                    </p>
                  )}
                </div>
                <div
                  className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                    reseauteur.statut === 'valide'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : reseauteur.statut === 'suspendu'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {reseauteur.statut === 'valide'
                    ? 'Validé'
                    : reseauteur.statut === 'suspendu'
                      ? 'Suspendu'
                      : 'En attente'}
                </div>
              </div>

              {reseauteur.statut === 'en_attente' && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-4"
                  role="status"
                >
                  <Shield size={14} className="shrink-0 mt-0.5" aria-hidden />
                  <p>
                    Votre profil n&apos;est pas encore visible sur la carte. Renseignez au moins
                    votre prénom et votre nom : il sera publié automatiquement.
                  </p>
                </div>
              )}

              {/* Aperçu contacts publics */}
              <div className="pt-4 border-t border-[#DFE0E1]">
                <p className="text-xs text-[#6E7175] mb-3 flex items-center gap-1">
                  <Shield size={12} aria-hidden />
                  Contacts facultatifs — visibles publiquement si renseignés
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FieldPreview
                    icon={<Phone size={12} />}
                    label="Téléphone"
                    value={reseauteur.telephone}
                    muted="Non partagé"
                  />
                  <FieldPreview
                    icon={<Mail size={12} />}
                    label="Email public"
                    value={reseauteur.emailContact}
                    muted="Non partagé"
                  />
                  <FieldPreview
                    icon={<Globe size={12} />}
                    label="Site web"
                    value={reseauteur.site}
                    muted="Non renseigné"
                  />
                  <FieldPreview
                    icon={<ExternalLink size={12} />}
                    label="LinkedIn"
                    value={reseauteur.linkedin ? 'Renseigné' : undefined}
                    muted="Non renseigné"
                  />
                </div>
              </div>
            </div>

            {/* Badge networking */}
            <div className="rsn-card rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
                <Network size={14} aria-hidden />
                Badge réseauteur
              </h2>
              <div className="flex items-center gap-3">
                <BadgeReseauteur badge={reseauteur.badge} />
                <p className="text-xs text-[#6E7175]">
                  Basé sur votre déclaration : {reseauteur.evenementsParMois ?? 0} événement
                  {(reseauteur.evenementsParMois ?? 0) > 1 ? 's' : ''}/mois
                </p>
              </div>
            </div>

            {/* Formulaire d'édition */}
            <div className="rsn-card rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-[#1D1E21] mb-5">Modifier mon profil</h2>
              <ProfilForm
                reseauteur={reseauteur}
                reseauxLocaux={reseauxLocaux}
                secteurs={secteurs}
              />
            </div>

            {/* Confidentialité & RGPD */}
            <div className="rsn-card rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#1D1E21] mb-2 flex items-center gap-1.5">
                <Shield size={14} aria-hidden />
                Confidentialité & RGPD
              </h2>
              <p className="text-xs text-[#6E7175] mb-4">
                Votre géolocalisation est au niveau de la ville (pas d&apos;adresse exacte).
                Téléphone et email ne sont partagés que si vous les renseignez.
              </p>
              <div className="space-y-2">
                <a
                  href="/api/account/export"
                  download
                  className="text-xs text-[#6E7175] hover:text-[#035AA6] transition-colors block"
                >
                  Exporter mes données (RGPD — JSON)
                </a>
                <DeleteAccountButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldPreview({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
  muted: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[#999A9D]" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[#6E7175] font-medium">{label}</p>
        <p className={`truncate ${value ? 'text-[#4E5155]' : 'text-[#999A9D] italic'}`}>
          {value || muted}
        </p>
      </div>
    </div>
  )
}
