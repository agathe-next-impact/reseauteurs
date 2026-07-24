'use client'

/**
 * SlideOverEvenementNew — Panneau de prévisualisation d'un événement (modèle RÉSEAUTEURS).
 *
 * Distinct de SlideOverEvenement.tsx (ancien modèle PanoramaPub).
 *
 * CTA principal : « S'inscrire » = lien externe vers le site du réseau organisateur.
 * RÉSEAUTEURS n'organise PAS les événements et ne gère PAS l'inscription (ADR-0011 §1).
 *
 * Les événements Premium ont un badge distinctif (orange accent) (ADR-0011 §4).
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin, AlertTriangle, Calendar } from 'lucide-react'
import SlideOver from './SlideOver'
import SlideOverContacts from './SlideOverContacts'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * ADR-0012 : l'événement Premium est supprimé. Le champ `premium` a été retiré
 * de l'interface et de l'affichage. La propriété peut encore être présente dans
 * la réponse API (toujours `false` après le drop de colonne) mais est ignorée.
 */
interface EvenementDetail {
  id: number | string
  slug: string | null
  titre: string
  description: string | null
  dateDebut: string | null
  dateFin: string | null
  isPast: boolean
  lieuNom: string | null
  lieuAdresse: string | null
  lieuCodePostal: string | null
  lieuVille: string | null
  lieuDepartement: string | null
  lienInscription: string | null
  /** Contact de l'organisateur pour cet événement (facultatif). */
  contactNom: string | null
  contactEmail: string | null
  contactTelephone: string | null
  image: { url: string | null; cardUrl: string | null; alt: string | null } | null
  reseau: {
    id: number | string
    slug: string | null
    nom: string | null
    siteWeb: string | null
    logoUrl: string | null
  } | null
  /** ADR-0013 : organisateur réseauteur Plus (exclusif avec reseau). */
  organisateurReseauteur: {
    id: number | string
    slug: string | null
    prenom: string | null
    nom: string | null
    ville: string | null
    photoUrl: string | null
  } | null
  type: { label: string | null; couleur: string | null } | null
}

interface SlideOverEvenementNewProps {
  slug: string | null
  onClose: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const h = d.getHours()
    const m = d.getMinutes()
    if (h === 0 && m === 0) return ''
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function SlideOverEvenementNew({ slug, onClose }: SlideOverEvenementNewProps) {
  const [data, setData] = useState<EvenementDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [prevSlug, setPrevSlug] = useState<string | null>(null)

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
    fetch(`/api/evenements/public/v2/${encodeURIComponent(targetSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json ?? null))
      .catch(() => {
        setData(null)
        setError(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // Pas de setState synchrone ici (règle react-hooks/set-state-in-effect) :
    // loading/error sont déjà posés par le bloc prevSlug au rendu ; on ne fait
    // que la partie asynchrone. fetchData reste utilisé par le bouton Réessayer.
    if (!slug) return
    fetch(`/api/evenements/public/v2/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json ?? null))
      .catch(() => {
        setData(null)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <SlideOver isOpen={!!slug} onClose={onClose} mobileBottomSheet contentKey={slug}>
      {/* Chargement */}
      {loading && (
        <div className="space-y-4 pt-4">
          <Skeleton variant="card" className="h-40" />
          <Skeleton variant="text" className="h-5 w-4/5" />
          <Skeleton variant="text" className="h-4 w-3/5" />
          <Skeleton variant="text" lines={3} />
        </div>
      )}

      {/* Erreur */}
      {!loading && error && slug && (
        <div className="pt-12 text-center text-[#6E7175]">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm mb-1 font-medium">Impossible de charger cet événement.</p>
          <button
            onClick={() => fetchData(slug)}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#035AA6] hover:text-[#02467F] transition-colors mt-2 cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Introuvable */}
      {!loading && !error && !data && slug && (
        <div className="pt-12 text-center text-[#6E7175]">
          <Calendar size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Événement introuvable.</p>
        </div>
      )}

      {/* Contenu */}
      {data && !loading && (
        <div>
          {/* Image bannière */}
          {data.image?.cardUrl && (
            <div className="relative -mx-6 -mt-4 mb-4">
              <Image
                src={data.image.cardUrl}
                alt={data.image.alt ?? data.titre}
                width={800}
                height={300}
                className="w-full aspect-[3/1] object-cover"
              />
            </div>
          )}

          {/* Badges type + passé */}
          <div className="flex items-center gap-2 mb-3">
            {data.type?.label && (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full text-white"
                style={{ background: data.type.couleur ?? '#012A4A' }}
              >
                {data.type.label}
              </span>
            )}
            {data.isPast && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-[#6E7175]">
                Terminé
              </span>
            )}
          </div>

          {/* Titre */}
          <h2 className="text-lg font-bold text-[#012A4A] leading-tight mb-3">
            {data.titre}
          </h2>

          {/* Date & lieu */}
          <div className="space-y-2 mb-4 pb-4 border-b border-[#DFE0E1]">
            {data.dateDebut && (
              <div className="flex items-center gap-2 text-sm text-[#4E5155]">
                <CalendarDays size={14} className="shrink-0 text-[#6E7175]" />
                <span>
                  {formatDate(data.dateDebut)}
                  {formatTime(data.dateDebut) && ` à ${formatTime(data.dateDebut)}`}
                  {data.dateFin && ` → ${formatDate(data.dateFin)}`}
                </span>
              </div>
            )}
            {data.lieuVille && (
              <div className="flex items-start gap-2 text-sm text-[#4E5155]">
                <MapPin size={14} className="shrink-0 mt-0.5 text-[#6E7175]" />
                <div>
                  {data.lieuNom && <span className="font-medium">{data.lieuNom} — </span>}
                  {data.lieuAdresse && `${data.lieuAdresse}, `}
                  {data.lieuCodePostal && `${data.lieuCodePostal} `}
                  {data.lieuVille}
                  {data.lieuDepartement && ` (${data.lieuDepartement})`}
                </div>
              </div>
            )}
          </div>

          {/* CTA S'inscrire — lien externe vers le réseau */}
          {data.lienInscription && !data.isPast && (
            <div className="mb-4">
              <a
                href={data.lienInscription}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#F5E050] text-[#012A4A] font-semibold p-2.5 rounded-xl hover:bg-[#E3CB2E] transition-colors text-sm"
              >
                S&apos;inscrire à cet événement
              </a>
              <p className="text-xs text-[#6E7175] text-center mt-1.5">
                Redirige vers le site de {data.reseau?.nom ?? 'l&apos;organisateur'}
              </p>
            </div>
          )}

          {/* Description */}
          {data.description && (
            <div className="mb-4 pb-4 border-b border-[#DFE0E1]">
              <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line">
                {data.description}
              </p>
            </div>
          )}

          {/* Réseauteur organisateur (ADR-0013) */}
          {data.organisateurReseauteur && (
            <div className="mb-4 pb-4 border-b border-[#DFE0E1]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
                Organisé par
              </h3>
              <div className="flex items-center gap-3">
                {data.organisateurReseauteur.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.organisateurReseauteur.photoUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover border border-[#DFE0E1]"
                  />
                ) : (
                  // Accent orange = organisateur réseauteur Plus (vs bleu pour un réseau — ADR-0013)
                  <div className="w-10 h-10 rounded-full bg-[#FEFBE6] flex items-center justify-center text-[#8A6D0B] font-bold text-sm" aria-hidden>
                    {data.organisateurReseauteur.prenom?.charAt(0)}
                    {data.organisateurReseauteur.nom?.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#012A4A] truncate">
                    {data.organisateurReseauteur.prenom} {data.organisateurReseauteur.nom}
                  </p>
                  {data.organisateurReseauteur.slug && (
                    <Link
                      href={`/reseauteur/${data.organisateurReseauteur.slug}`}
                      className="text-xs text-[#8A6D0B] hover:underline"
                    >
                      Voir le profil réseauteur
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Réseau organisateur */}
          {data.reseau && (
            <div className="mb-4 pb-4 border-b border-[#DFE0E1]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
                Organisé par
              </h3>
              <div className="flex items-center gap-3">
                {data.reseau.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.reseau.logoUrl}
                    alt={data.reseau.nom ?? ''}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg object-contain bg-gray-50 p-0.5 border border-[#DFE0E1]"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#012A4A] truncate">
                    {data.reseau.nom}
                  </p>
                  {data.reseau.slug && (
                    <Link
                      href={`/reseau/${data.reseau.slug}`}
                      className="text-xs text-[#035AA6] hover:underline"
                    >
                      Voir la fiche réseau
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contact de l'organisateur — email / téléphone (mêmes canaux que la fiche) */}
          <SlideOverContacts
            nom={data.contactNom}
            email={data.contactEmail}
            telephone={data.contactTelephone}
          />

          {/* Lien vers la fiche événement */}
          {data.slug && (
            <div className="mt-2">
              <Link
                href={`/evenement/${data.slug}`}
                className="flex items-center justify-center gap-2 w-full border border-[#DFE0E1] text-[#4E5155] font-medium p-2.5 rounded-xl hover:border-[#035AA6] hover:text-[#035AA6] transition-colors text-sm"
              >
                Voir la fiche complète
              </Link>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  )
}
