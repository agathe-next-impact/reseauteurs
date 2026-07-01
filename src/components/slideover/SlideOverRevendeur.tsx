'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  ImageOff,
  Navigation,
  CalendarDays,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  FileText,
  Leaf,
  Briefcase,
} from 'lucide-react'
import SlideOver from './SlideOver'
import DirectionsPanel from './DirectionsPanel'
import type { DirectionsState } from './DirectionsPanel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { SPECIAL_COLORS } from '@/lib/colors'
import { CONTACT_EMAIL } from '@/lib/site'
import { SocialLinks } from '@/components/ui/SocialLinks'
import { safeUrl } from '@/lib/safe-url'
import type { SocialLinkData } from '@/lib/socials'
import type { Fournisseur, User, Media, CategoriesActivite } from '@/payload-types'

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  return match?.[1] ?? null
}

export type { DirectionsState }

interface SlideOverRevendeurProps {
  slug: string | null
  onClose: () => void
  directions: DirectionsState
  onItineraire?: (coords: [number, number]) => void
  onStepClick?: (location: [number, number]) => void
  ownFicheSlug?: string | null
}

export default function SlideOverRevendeur({
  slug,
  onClose,
  directions,
  onItineraire,
  onStepClick,
  ownFicheSlug,
}: SlideOverRevendeurProps) {
  const [data, setData] = useState<Fournisseur | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [prevSlug, setPrevSlug] = useState<string | null>(null)

  // Reset state when slug changes (during render, avoids sync setState in effect)
  if (slug !== prevSlug) {
    setPrevSlug(slug)
    if (slug) {
      setData(null)
      setLoading(true)
      setError(false)
    }
  }

  const fetchData = (targetSlug: string) => {
    setLoading(true)
    setError(false)
    fetch(`/api/fournisseurs/public/${encodeURIComponent(targetSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setData(json ?? null)
      })
      .catch(() => {
        setData(null)
        setError(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!slug) return
    fetchData(slug)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const user = data?.user as (User & { email?: string | null }) | undefined
  const contactEmailGratuit = user?.email ?? null
  const isOrphan = (data as { isOrphan?: boolean } | null)?.isOrphan === true
  const plan: 'gratuit' | 'premium' | 'infinite' = (() => {
    const rawPlan = (user?.plan ?? 'gratuit') as string
    if (rawPlan !== 'premium' && rawPlan !== 'infinite') return 'gratuit'
    if (user?.planExpiresAt) {
      const expiresAt = new Date(user.planExpiresAt as string)
      if (expiresAt < new Date()) return 'gratuit'
    }
    return rawPlan
  })()
  const activiteCat = data?.activitePrincipale as CategoriesActivite | null | undefined
  const activiteColor = activiteCat?.couleur ?? SPECIAL_COLORS['gratuit']
  const bannière = data?.banniere as Media | null | undefined
  const banniereUrl = bannière?.sizes?.full?.url ?? bannière?.url
  const logo = data?.logo as Media | null | undefined
  const logoUrl = logo?.sizes?.card?.url ?? logo?.sizes?.thumbnail?.url ?? logo?.url
  const illustrations = ((data?.illustrations ?? []) as Array<{ image: Media }>)
    .map((it) => it.image as Media)
    .filter((m): m is Media => !!m)
  const reseauxSociaux =
    (data as { reseauxSociaux?: SocialLinkData[] } | null)?.reseauxSociaux ?? []
  const evenements =
    (
      data as {
        evenements?: Array<{
          id: number
          slug?: string | null
          titre: string
          dateDebut: string
          lieuVille: string
        }>
      } | null
    )?.evenements ?? []
  const offresEmploi =
    (
      data as {
        offresEmploi?: Array<{ titre: string; lien: string; datePublication: string }>
      } | null
    )?.offresEmploi ?? []
  const boutiqueEnLigne =
    ((data as unknown as Record<string, unknown> | null)?.boutiqueEnLigne as
      | string
      | null
      | undefined) ?? null
  const lienDevis =
    ((data as unknown as Record<string, unknown> | null)?.lienDevis as string | null | undefined) ??
    null

  const showDirections = directions.isOpen && data

  return (
    <SlideOver isOpen={!!slug} onClose={onClose} mobileBottomSheet={!!showDirections}>
      {/* Loading state */}
      {loading && (
        <div className="space-y-4 pt-8">
          <Skeleton variant="text" className="h-6 w-3/4" />
          <Skeleton variant="text" className="h-4 w-1/2" />
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="text" lines={3} />
        </div>
      )}

      {/* Error state */}
      {!loading && error && slug && (
        <div className="pt-12 text-center text-text-light">
          <AlertTriangle size={40} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm mb-1">Impossible de charger cette fiche.</p>
          <p className="text-sm text-text-light mb-4">Verifiez votre connexion et réessayez.</p>
          <button
            onClick={() => fetchData(slug)}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            Réessayer
          </button>
        </div>
      )}

      {/* Not found */}
      {!loading && !error && !data && slug && (
        <div className="pt-12 text-center text-text-light">
          <ImageOff size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Revendeur introuvable.</p>
        </div>
      )}

      {/* ==================== DIRECTIONS MODE ==================== */}
      {showDirections && (
        <DirectionsPanel
          directions={directions}
          destinationLabel={data.raisonSociale}
          destinationSub={data.ville}
          accentColor={activiteColor}
          onBack={directions.close}
          backLabel={`Fiche ${data.raisonSociale}`}
          onStepClick={onStepClick}
        />
      )}

      {/* ==================== FICHE MODE ==================== */}
      {data && !loading && !showDirections && (
        <div>
          {/* Bannière ou gradient */}
          <div className="relative -mx-6 -mt-4 mb-5">
            {banniereUrl ? (
              <Image
                src={banniereUrl}
                alt={`${data.raisonSociale} — bannière`}
                width={1200}
                height={400}
                className="w-full aspect-[3/1] object-cover"
              />
            ) : (
              <div
                className="w-full aspect-[3/1]"
                style={{
                  background: `linear-gradient(135deg, ${activiteColor}30, ${activiteColor}10)`,
                }}
              />
            )}
            {logoUrl && (
              <div className="absolute -bottom-8 left-6 w-16 h-16 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden">
                <Image
                  src={logoUrl}
                  alt={`${data.raisonSociale} — logo`}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* CTA — Itineraire + Voir la fiche */}
          {plan !== 'gratuit' && (
            <div className={`flex gap-2 mb-4 ${logoUrl ? 'mt-10' : 'mt-2'}`}>
              {data.latitude != null && data.longitude != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-text-dark border border-gray-300 font-medium py-2 px-3 rounded-lg hover:border-gray-400 hover:text-text-dark transition-colors text-sm"
                >
                  <Navigation size={15} />
                  Itineraire
                </a>
              )}
              <a
                href={`/revendeurs/${data.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-amber-400 text-white font-medium py-2 px-3 rounded-lg hover:bg-amber-500 transition-colors text-sm"
              >
                Voir la fiche
              </a>
            </div>
          )}

          <div
            className={`px-6 pb-5 mb-5 ${logoUrl && plan === 'gratuit' ? 'pt-10' : 'pt-2'}`}
            style={{ borderBottom: `3px solid ${activiteColor}30` }}
          >
            {data.statut && data.statut !== 'publiee' && (
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge
                  statut={data.statut as 'publiee' | 'suspendue' | 'archive'}
                  size="sm"
                />
              </div>
            )}

            {/* Title */}
            <h2 className="text-xl font-bold text-text-dark leading-tight">{data.raisonSociale}</h2>
            <div className="flex items-center gap-1.5 mt-1.5 text-text-medium text-sm">
              <MapPin size={14} className="shrink-0" />
              <span>{data.ville}</span>
            </div>

            {/* Activity badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              {activiteCat && (
                <span
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full text-white"
                  style={{ background: activiteColor }}
                >
                  {activiteCat.label}
                </span>
              )}
              {data.activitesSecondaires &&
                data.activitesSecondaires.length > 0 &&
                data.activitesSecondaires.map((act) => {
                  const cat = act as unknown as CategoriesActivite
                  return (
                    <span
                      key={cat.id ?? String(act)}
                      className="inline-flex items-center text-sm font-medium px-2.5 py-1 rounded-full bg-gray-100 text-text-medium"
                    >
                      {cat.label ?? String(act)}
                    </span>
                  )
                })}
            </div>
          </div>

          {/* Premium + Infinite content: contact info */}
          {(plan === 'premium' || plan === 'infinite') && (
            <div className="space-y-3 mb-5">
              {data.adresse && (
                <p className="text-sm text-text-dark">
                  {data.adresse}
                  {data.codePostal && `, ${data.codePostal} ${data.ville}`}
                </p>
              )}

              <div className="flex flex-col gap-2">
                {data.telephone && (
                  <a
                    href={`tel:${data.telephone}`}
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    <Phone size={15} className="shrink-0" />
                    {data.telephone}
                  </a>
                )}
                {data.emailContact && (
                  <a
                    href={`mailto:${data.emailContact}`}
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    <Mail size={15} className="shrink-0" />
                    {data.emailContact}
                  </a>
                )}
                {data.siteWeb && (
                  <a
                    href={data.siteWeb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    <Globe size={15} className="shrink-0" />
                    {data.siteWeb.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {boutiqueEnLigne && (
                  <a
                    href={boutiqueEnLigne}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    <ShoppingCart size={15} className="shrink-0" />
                    Boutique en ligne
                  </a>
                )}
                {lienDevis && (
                  <a
                    href={lienDevis}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    <FileText size={15} className="shrink-0" />
                    Demander un devis
                  </a>
                )}
              </div>

              {/* Social links */}
              {reseauxSociaux.length > 0 && (
                <div className="mt-3">
                  <SocialLinks links={reseauxSociaux} />
                </div>
              )}
            </div>
          )}

          {/* Premium+ content: description + gallery */}
          {(plan === 'premium' || plan === 'infinite') && (
            <>
              {data.description && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Description</h3>
                  <p className="text-sm text-text-medium leading-relaxed whitespace-pre-line">
                    {data.description}
                  </p>
                </div>
              )}
              {illustrations.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Photos</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {illustrations.map((media, i) => {
                      const src = media.sizes?.card?.url ?? media.sizes?.full?.url ?? media.url
                      return src ? (
                        <Image
                          key={media.id ?? i}
                          src={src}
                          alt={`${data.raisonSociale} — photo ${i + 1}`}
                          width={300}
                          height={300}
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* RSE section (Premium+) */}
          {(plan === 'premium' || plan === 'infinite') &&
            (() => {
              const dataAny = data as unknown as Record<string, unknown>
              const rseLabels = dataAny.labelsRSE as
                | Array<{
                    id: number
                    label: string
                    value: string
                    logo: { url?: string; sizes?: { thumbnail?: { url?: string } } } | null
                  }>
                | undefined
              const rseDescription = dataAny.descriptionRSE as string | null | undefined
              if ((!rseLabels || rseLabels.length === 0) && !rseDescription) return null
              return (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-text-dark mb-2 flex items-center gap-1.5">
                    <Leaf size={14} />
                    Engagements RSE
                  </h3>
                  {rseLabels && rseLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {rseLabels.map((l) => {
                        const logoSrc = l.logo?.sizes?.thumbnail?.url ?? l.logo?.url
                        return (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                          >
                            {logoSrc && (
                              <img
                                src={logoSrc}
                                alt={l.label}
                                width={16}
                                height={16}
                                className="object-contain"
                              />
                            )}
                            {l.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {rseDescription && (
                    <p className="text-sm text-text-medium leading-relaxed whitespace-pre-line">
                      {rseDescription}
                    </p>
                  )}
                </div>
              )
            })()}

          {/* Infinite content: vidéo YouTube */}
          {plan === 'infinite' &&
            (data as { videoYoutube?: string | null }).videoYoutube &&
            (() => {
              const videoUrl = (data as { videoYoutube?: string | null }).videoYoutube!
              const videoId = extractYouTubeId(videoUrl)
              if (!videoId) return null
              return (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Vidéo</h3>
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                      title="Vidéo YouTube"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full rounded-lg"
                      style={{ border: 0 }}
                    />
                  </div>
                </div>
              )
            })()}

          {/* Infinite content: events */}
          {plan === 'infinite' && (
            <>
              {evenements.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-text-dark mb-2 flex items-center gap-1.5">
                    <CalendarDays size={14} />
                    Événements à venir
                  </h3>
                  <div className="space-y-2">
                    {evenements.map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/evenements/${ev.slug ?? ev.id}`}
                        className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all"
                      >
                        <span className="text-sm font-medium text-text-dark truncate">
                          {ev.titre}
                        </span>
                        <span className="text-sm text-text-light shrink-0">
                          {new Date(ev.dateDebut).toLocaleDateString('fr-FR')} — {ev.lieuVille}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {offresEmploi.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-text-dark mb-2 flex items-center gap-1.5">
                    <Briefcase size={14} />
                    Offres d&apos;emploi
                  </h3>
                  <div className="space-y-2">
                    {[...offresEmploi]
                      .filter((o) => o.datePublication)
                      .sort(
                        (a, b) =>
                          new Date(b.datePublication).getTime() - new Date(a.datePublication).getTime(),
                      )
                      .map((offre, i) => {
                        const href = safeUrl(offre.lien)
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg"
                          >
                            <div className="min-w-0">
                              <span className="block text-sm font-medium text-text-dark truncate">
                                {offre.titre}
                              </span>
                              <span className="block text-sm text-text-light">
                                Publiée le {new Date(offre.datePublication).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-sm font-medium text-primary hover:underline"
                              >
                                Voir l&apos;offre
                              </a>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Orphan : CTA revendication. Le flow d'inscription revalide la disponibilite. */}
          {isOrphan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-sm text-text-dark font-medium mb-1">
                C&apos;est votre entreprise ?
              </p>
              <p className="text-sm text-text-medium mb-3">
                Revendiquez cette fiche pour la compléter et contrôler les informations affichees.
              </p>
              <a
                href={`/inscription?claim=${data.id}`}
                className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
              >
                Revendiquer ma fiche
              </a>
            </div>
          )}

          {/* Gratuit revendique : limited info message */}
          {!isOrphan &&
            plan === 'gratuit' &&
            (() => {
              const isOwn = !!ownFicheSlug && ownFicheSlug === data.slug
              return (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  {isOwn ? (
                    <>
                      <p className="text-sm text-text-dark font-medium mb-1">
                        C&apos;est votre fiche.
                      </p>
                      <p className="text-sm text-text-light mb-3">
                        Passez à un plan payant pour la compléter et débloquer toutes les
                        informations visibles par vos prospects.
                      </p>
                      <Link
                        href="/dashboard/fiche"
                        className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                      >
                        Compléter ma fiche
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-text-medium mb-1">
                        Ce revendeur est présent sur l&apos;annuaire.
                      </p>
                      <p className="text-sm text-text-light mb-3">
                        Contactez-le directement pour plus d&apos;informations sur ses produits et
                        services.
                      </p>
                      {contactEmailGratuit && (
                        <a
                          href={`mailto:${contactEmailGratuit}`}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
                        >
                          <Mail size={15} />
                          Contacter ce fournisseur
                        </a>
                      )}
                    </>
                  )}
                </div>
              )
            })()}

          {/* Footer — signaler */}
          <div className="mt-6 pt-4 border-t border-border-light">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Signalement fiche ${data.raisonSociale}`}
              className="block w-full text-center text-sm text-text-light hover:text-text-medium transition-colors py-1.5"
            >
              Signaler une erreur
            </a>
          </div>
        </div>
      )}
    </SlideOver>
  )
}
