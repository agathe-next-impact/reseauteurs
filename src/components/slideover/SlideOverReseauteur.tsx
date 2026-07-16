'use client'

/**
 * SlideOverReseauteur — Panneau de prévisualisation d'un réseauteur.
 *
 * Ouvert au clic sur un marqueur carte ou une carte de liste.
 * Affiche : photo, nom, entreprise, badge, secteur, réseaux fréquentés, contacts.
 * CTA principal : « Voir le profil » → /reseauteur/:slug (SSR ISR, SEO Person).
 *
 * Confidentialité (ADR-0011 §7) :
 *   - Téléphone et email affichés seulement si renseignés par le réseauteur.
 *   - Position au niveau ville, jamais adresse exacte.
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Globe, ExternalLink, Phone, Mail, AlertTriangle, RefreshCw, User } from 'lucide-react'
import SlideOver from './SlideOver'
import { Skeleton } from '@/components/ui/Skeleton'

const BADGE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  bronze: { label: 'Bronze', bg: '#fef3c7', text: '#92400e' },
  argent: { label: 'Argent', bg: '#f1f5f9', text: '#475569' },
  gold: { label: 'Gold', bg: '#fef9c3', text: '#a16207' },
  platinum: { label: 'Platinum', bg: '#dbeafe', text: '#1d4ed8' },
}

interface ReseauteurDetail {
  id: number | string
  slug: string | null
  prenom: string
  nom: string
  fonction: string | null
  entreprise: string | null
  description: string | null
  ville: string
  departement: string | null
  badge: string | null
  telephone: string | null
  emailContact: string | null
  site: string | null
  linkedin: string | null
  photo: { url: string | null; thumbnailUrl: string | null; alt: string | null } | null
  secteur: { label: string | null; couleur: string | null } | null
  reseauxFrequentes: Array<{ id: number | string; slug: string | null; nom: string | null; logoUrl: string | null }>
  competences: string[]
}

interface SlideOverReseauteurProps {
  slug: string | null
  onClose: () => void
}

export default function SlideOverReseauteur({ slug, onClose }: SlideOverReseauteurProps) {
  const [data, setData] = useState<ReseauteurDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [prevSlug, setPrevSlug] = useState<string | null>(null)

  // Reset et fetch quand le slug change
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
    fetch(`/api/reseauteurs/public/${encodeURIComponent(targetSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json ?? null))
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

  const badgeStyle = data?.badge ? BADGE_STYLES[data.badge] : null
  const secteurColor = data?.secteur?.couleur ?? '#2563EB'

  return (
    <SlideOver isOpen={!!slug} onClose={onClose} mobileBottomSheet>
      {/* Chargement */}
      {loading && (
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" className="w-16 h-16 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="h-5 w-3/4" />
              <Skeleton variant="text" className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="text" lines={3} />
        </div>
      )}

      {/* Erreur */}
      {!loading && error && slug && (
        <div className="pt-12 text-center text-[#71717a]">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm mb-1 font-medium">Impossible de charger ce profil.</p>
          <button
            onClick={() => fetchData(slug)}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8] transition-colors mt-2 cursor-pointer"
          >
            <RefreshCw size={13} />
            Réessayer
          </button>
        </div>
      )}

      {/* Introuvable */}
      {!loading && !error && !data && slug && (
        <div className="pt-12 text-center text-[#71717a]">
          <User size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Réseauteur introuvable.</p>
        </div>
      )}

      {/* Contenu */}
      {data && !loading && (
        <div>
          {/* En-tête avec couleur de secteur */}
          <div
            className="relative -mx-6 -mt-4 mb-5 h-20"
            style={{ background: `linear-gradient(135deg, ${secteurColor}30, ${secteurColor}10)` }}
          >
            {/* Photo */}
            <div className="absolute -bottom-8 left-6">
              {data.photo?.thumbnailUrl ? (
                <div className="w-16 h-16 rounded-2xl border-4 border-white bg-white overflow-hidden">
                  <Image
                    src={data.photo.thumbnailUrl}
                    alt={data.photo.alt ?? `${data.prenom} ${data.nom}`}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl border-4 border-white bg-white flex items-center justify-center"
                  style={{ background: `${secteurColor}20` }}
                >
                  <span
                    className="text-xl font-bold"
                    style={{ color: secteurColor }}
                  >
                    {data.prenom[0]}{data.nom[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Identité */}
          <div className="pt-10 pb-4 border-b border-[#e4e4e7]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#18181b]">
                  {data.prenom} {data.nom}
                </h2>
                {data.fonction && (
                  <p className="text-sm text-[#71717a]">{data.fonction}</p>
                )}
                {data.entreprise && (
                  <p className="text-sm font-medium text-[#52525b]">{data.entreprise}</p>
                )}
              </div>
              {/* Badge */}
              {badgeStyle && (
                <span
                  className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: badgeStyle.bg, color: badgeStyle.text }}
                >
                  {badgeStyle.label}
                </span>
              )}
            </div>

            {/* Ville */}
            <div className="flex items-center gap-1.5 mt-2 text-sm text-[#71717a]">
              <MapPin size={13} className="shrink-0" />
              <span>{data.ville}{data.departement ? ` (${data.departement})` : ''}</span>
            </div>

            {/* Secteur */}
            {data.secteur?.label && (
              <div className="mt-2">
                <span
                  className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full text-white"
                  style={{ background: data.secteur.couleur ?? '#2563EB' }}
                >
                  {data.secteur.label}
                </span>
              </div>
            )}
          </div>

          {/* CTA principal */}
          {data.slug && (
            <div className="py-4 border-b border-[#e4e4e7]">
              <Link
                href={`/reseauteur/${data.slug}`}
                className="flex items-center justify-center gap-2 w-full bg-[#2563EB] text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm"
              >
                Voir le profil complet
              </Link>
            </div>
          )}

          {/* Description */}
          {data.description && (
            <div className="py-4 border-b border-[#e4e4e7]">
              <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">
                {data.description}
              </p>
            </div>
          )}

          {/* Réseaux fréquentés */}
          {data.reseauxFrequentes.length > 0 && (
            <div className="py-4 border-b border-[#e4e4e7]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
                Réseaux fréquentés
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.reseauxFrequentes.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#bfdbfe] text-[#1d4ed8]"
                  >
                    {r.logoUrl && (
                      <img
                        src={r.logoUrl}
                        alt={r.nom ?? ''}
                        width={12}
                        height={12}
                        className="rounded-sm object-contain"
                      />
                    )}
                    {r.nom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Compétences */}
          {data.competences.length > 0 && (
            <div className="py-4 border-b border-[#e4e4e7]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
                Compétences
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.competences.map((c, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-[#52525b]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contacts (facultatifs) */}
          {(data.telephone || data.emailContact || data.site || data.linkedin) && (
            <div className="py-4 border-b border-[#e4e4e7] space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-2">
                Contact
              </h3>
              {data.telephone && (
                <a
                  href={`tel:${data.telephone}`}
                  className="flex items-center gap-2 text-sm text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                >
                  <Phone size={14} className="shrink-0" />
                  {data.telephone}
                </a>
              )}
              {data.emailContact && (
                <a
                  href={`mailto:${data.emailContact}`}
                  className="flex items-center gap-2 text-sm text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                >
                  <Mail size={14} className="shrink-0" />
                  {data.emailContact}
                </a>
              )}
              {data.site && (
                <a
                  href={data.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                >
                  <Globe size={14} className="shrink-0" />
                  {data.site.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              {data.linkedin && (
                <a
                  href={data.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                >
                  <ExternalLink size={14} className="shrink-0" />
                  LinkedIn
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </SlideOver>
  )
}
