'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { CalendarDays, MapPin, Mail, ExternalLink, Building2, CalendarPlus, ImageOff, Navigation, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react'
import SlideOver from './SlideOver'
import DirectionsPanel from './DirectionsPanel'
import type { DirectionsState } from './DirectionsPanel'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Evenement, Fournisseur, TypesEvenement, CategoriesActivite, Media } from '@/payload-types'

type OrganisateurExterneLite = { id: number; nom: string; slug?: string | null; ville?: string | null; siteWeb?: string | null; emailContact?: string | null; logo?: MediaLite | null }
type FournisseurLite = Pick<Fournisseur, 'id' | 'slug' | 'raisonSociale' | 'ville'> & { logo?: MediaLite | null }
type MediaLite = Pick<Media, 'id' | 'url' | 'alt' | 'sizes'>
type EvenementLite = Omit<Evenement, 'fournisseursAssocies' | 'participantsSignales' | 'activites' | 'organisateurExterne' | 'banniere' | 'logo' | 'illustrations'> & {
  fournisseursAssocies?: FournisseurLite[]
  participantsSignales?: FournisseurLite[]
  activites: Array<Pick<CategoriesActivite, 'id' | 'label' | 'value' | 'couleur'>>
  organisateurExterne?: OrganisateurExterneLite | null
  banniere?: MediaLite | null
  logo?: MediaLite | null
  illustrations?: Array<{ id?: string | null; image: MediaLite }>
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface SlideOverEvenementProps {
  eventId: string | null
  onClose: () => void
  onItineraire?: (coords: [number, number]) => void
  directions?: DirectionsState
  onStepClick?: (location: [number, number]) => void
  canSignalParticipation?: boolean
}

export default function SlideOverEvenement({ eventId, onClose, onItineraire, directions, onStepClick, canSignalParticipation = false }: SlideOverEvenementProps) {
  const [data, setData] = useState<EvenementLite | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [prevEventId, setPrevEventId] = useState<string | null>(null)

  // Reset state when eventId changes (during render, avoids sync setState in effect)
  if (eventId !== prevEventId) {
    setPrevEventId(eventId)
    if (eventId) {
      setData(null)
      setLoading(true)
      setError(false)
    }
  }

  const fetchData = (targetId: string) => {
    setLoading(true)
    setError(false)
    fetch(`/api/evenements/public/${encodeURIComponent(targetId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => {
        setData(null)
        setError(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!eventId) return
    fetchData(eventId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const fournisseur = data?.fournisseur as Fournisseur | null | undefined
  const typeDoc = data?.type as TypesEvenement | null | undefined
  const typeColor = typeDoc?.couleur ?? '#6b7280'
  const banniereUrl = data?.banniere?.sizes?.full?.url ?? data?.banniere?.url
  const logoUrl = data?.logo?.sizes?.card?.url ?? data?.logo?.sizes?.thumbnail?.url ?? data?.logo?.url
  const illustrations = (data?.illustrations ?? []).map((it) => it.image).filter((m): m is MediaLite => !!m)

  const showDirections = directions?.isOpen && data

  return (
    <SlideOver isOpen={!!eventId} onClose={onClose} mobileBottomSheet={!!showDirections}>
      {/* Loading */}
      {loading && (
        <div className="space-y-4 pt-8">
          <Skeleton variant="text" className="h-5 w-1/3" />
          <Skeleton variant="text" className="h-6 w-3/4" />
          <Skeleton variant="text" className="h-4 w-1/2" />
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="text" lines={3} />
        </div>
      )}

      {/* Error state */}
      {!loading && error && eventId && (
        <div className="pt-12 text-center text-text-light">
          <AlertTriangle size={40} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm mb-1">Impossible de charger cet événement.</p>
          <p className="text-sm text-text-light mb-4">Verifiez votre connexion et réessayez.</p>
          <button
            onClick={() => fetchData(eventId)}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            Réessayer
          </button>
        </div>
      )}

      {/* Not found */}
      {!loading && !error && !data && eventId && (
        <div className="pt-12 text-center text-text-light">
          <ImageOff size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Événement introuvable.</p>
        </div>
      )}

      {/* ==================== DIRECTIONS MODE ==================== */}
      {showDirections && directions && (
        <DirectionsPanel
          directions={directions}
          destinationLabel={data.lieuNom || data.titre}
          destinationSub={data.lieuVille}
          accentColor={typeColor}
          onBack={directions.close}
          backLabel={`Événement ${data.titre}`}
          onStepClick={onStepClick}
        />
      )}

      {/* Content */}
      {data && !loading && !showDirections && (
        <div>
          {/* Bannière ou gradient */}
          <div className="relative -mx-6 -mt-4 mb-5">
            {banniereUrl ? (
              <Image
                src={banniereUrl}
                alt={`${data.titre} — bannière`}
                width={1200}
                height={400}
                className="w-full aspect-[3/1] object-cover"
              />
            ) : (
              <div
                className="w-full aspect-[3/1]"
                style={{
                  background: `linear-gradient(135deg, ${typeColor}30, ${typeColor}10)`,
                }}
              />
            )}
            {logoUrl && (
              <div className="absolute -bottom-8 left-6 w-16 h-16 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden">
                <Image
                  src={logoUrl}
                  alt={`${data.titre} — logo`}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* CTA — Itineraire + S'inscrire + Calendrier + Voir la fiche */}
          <div className={`flex flex-wrap gap-2 mb-4 ${logoUrl ? 'mt-10' : 'mt-2'}`}>
            {data.lienInscription && (
              <a
                href={data.lienInscription}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-amber-400 text-white font-medium py-2 px-3 rounded-lg hover:bg-amber-500 transition-colors text-sm"
              >
                <ExternalLink size={15} />
                Voir l&apos;événement
              </a>
            )}
            {data.lieuLatitude != null && data.lieuLongitude != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${data.lieuLatitude},${data.lieuLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-white text-text-dark border border-gray-300 font-medium py-2 px-3 rounded-lg hover:border-gray-400 hover:text-text-dark transition-colors text-sm"
              >
                <Navigation size={15} />
                Itineraire
              </a>
            )}
            <a
              href={`/api/ical/${data.id}`}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-text-dark border border-gray-300 font-medium py-2 px-3 rounded-lg hover:border-gray-400 hover:text-text-dark transition-colors text-sm"
            >
              <CalendarPlus size={14} />
              Calendrier
            </a>
          </div>

          {/* CTA Infinite — événement organisateur : signaler sa participation depuis le dashboard */}
          {canSignalParticipation && data.organisateurExterne && (
            <a
              href="/dashboard/evenements-nationaux"
              className="flex items-center justify-between gap-3 mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 hover:border-cyan-300 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserPlus size={16} className="text-cyan-700 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-cyan-900 leading-tight">Signalez votre participation</p>
                  <p className="text-sm text-cyan-700 leading-tight">Gérez-la depuis vos événements nationaux</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-cyan-700 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}

          <div
            className={`px-6 pb-5 mb-5 pt-2`}
            style={{ borderBottom: `3px solid ${typeColor}30` }}
          >
            {/* Type badge */}
            <span
              className="inline-flex items-center text-sm font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full text-white mb-3"
              style={{ background: typeColor }}
            >
              {typeDoc?.label ?? 'Événement'}
            </span>

            {/* Title */}
            <h2 className="text-xl font-bold text-text-dark leading-tight">{data.titre}</h2>

            {/* Date */}
            <div className="flex items-center gap-1.5 mt-2 text-sm text-text-medium">
              <CalendarDays size={14} className="shrink-0" />
              <span className="capitalize">
                {formatDate(data.dateDebut)}
                {data.dateFin && ` — ${formatDate(data.dateFin)}`}
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-text-dark mb-2 flex items-center gap-1.5">
              <MapPin size={14} />
              Lieu
            </h3>
            <div className="text-sm text-text-medium space-y-0.5 pl-5">
              {data.lieuNom && <p className="font-medium text-text-dark">{data.lieuNom}</p>}
              {data.lieuAdresse && <p>{data.lieuAdresse}</p>}
              <p>
                {data.lieuCodePostal && `${data.lieuCodePostal} `}
                {data.lieuVille}
              </p>
            </div>
          </div>

          {/* Description */}
          {data.descriptionCourte && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-text-dark mb-2">Description</h3>
              <p className="text-sm text-text-medium leading-relaxed whitespace-pre-line">
                {data.descriptionCourte}
              </p>
            </div>
          )}

          {/* Illustrations */}
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
                      alt={`${data.titre} — photo ${i + 1}`}
                      width={300}
                      height={300}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Contact */}
          {(data.emailContact || data.organisateurExterne?.emailContact) && (
            <div className="mb-5 space-y-1">
              {data.emailContact && (
                <a
                  href={`mailto:${data.emailContact}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                >
                  <Mail size={15} className="shrink-0" />
                  {data.emailContact}
                </a>
              )}
              {data.organisateurExterne?.emailContact && data.organisateurExterne.emailContact !== data.emailContact && (
                <a
                  href={`mailto:${data.organisateurExterne.emailContact}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                >
                  <Mail size={15} className="shrink-0" />
                  {data.organisateurExterne.emailContact}
                </a>
              )}
            </div>
          )}

          {/* Activités concernées */}
          {data.activites && data.activites.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-text-dark mb-2">Activités</h3>
              <div className="flex flex-wrap gap-2">
                {data.activites.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center text-sm font-medium px-2.5 py-1 rounded-full text-white"
                    style={{ background: a.couleur ?? '#6b7280' }}
                  >
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Organizer */}
          {(fournisseur || data.organisateurExterne) && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-text-dark mb-2 flex items-center gap-1.5">
                <Building2 size={14} />
                Organisateur
              </h3>
              {fournisseur ? (() => {
                const fLogo = fournisseur.logo && typeof fournisseur.logo === 'object' ? fournisseur.logo as MediaLite : null
                const logoUrl = fLogo?.sizes?.thumbnail?.url ?? fLogo?.url
                return (
                  <a
                    href={`/revendeurs/${fournisseur.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-sm hover:border-gray-300 transition-all group"
                  >
                    {logoUrl ? (
                      <Image src={logoUrl} alt={fournisseur.raisonSociale} width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {fournisseur.raisonSociale.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-dark truncate">{fournisseur.raisonSociale}</p>
                      <p className="text-sm text-text-light">{fournisseur.ville}</p>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                  </a>
                )
              })() : data.organisateurExterne ? (() => {
                const orgLogoUrl = data.organisateurExterne.logo?.sizes?.thumbnail?.url ?? data.organisateurExterne.logo?.url
                const content = (
                  <>
                    {orgLogoUrl ? (
                      <Image src={orgLogoUrl} alt={data.organisateurExterne.nom} width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${data.organisateurExterne.slug ? 'bg-cyan-50 text-cyan-700' : 'bg-gray-100 text-gray-600'} flex items-center justify-center font-bold text-sm shrink-0`}>
                        {data.organisateurExterne.nom.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-dark truncate">{data.organisateurExterne.nom}</p>
                      {data.organisateurExterne.ville && (
                        <p className="text-sm text-text-light">{data.organisateurExterne.ville}</p>
                      )}
                    </div>
                  </>
                )
                return data.organisateurExterne.slug ? (
                  <a
                    href={`/organisateurs/${data.organisateurExterne.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-sm hover:border-gray-300 transition-all group"
                  >
                    {content}
                    <ExternalLink size={14} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    {content}
                  </div>
                )
              })() : null}
            </div>
          )}

          {/* Fournisseurs participants */}
          {data.fournisseursAssocies && data.fournisseursAssocies.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-text-dark mb-2">Fournisseurs participants</h3>
              <div className="space-y-2">
                {data.fournisseursAssocies.map((f) => (
                  <a
                    key={f.id}
                    href={`/revendeurs/${f.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:shadow-sm hover:border-gray-300 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {f.raisonSociale.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-dark truncate">{f.raisonSociale}</p>
                      <p className="text-sm text-text-light">{f.ville}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Participants signalés */}
          {data.participantsSignales && data.participantsSignales.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-text-dark mb-2">Ils y seront aussi</h3>
              <div className="space-y-2">
                {data.participantsSignales.map((f) => (
                  <a
                    key={f.id}
                    href={`/revendeurs/${f.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:shadow-sm hover:border-gray-300 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-700 font-bold text-sm shrink-0">
                      {f.raisonSociale.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-dark truncate">{f.raisonSociale}</p>
                      <p className="text-sm text-text-light">{f.ville}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {data.lienInscription && (
            <div className="mt-6 pt-4 border-t border-border-light">
              <a
                href={data.lienInscription}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full text-sm text-primary hover:text-primary-hover transition-colors py-1.5 font-medium"
              >
                <ExternalLink size={14} />
                Voir le site de l&apos;événement
              </a>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  )
}
