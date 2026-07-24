'use client'

/**
 * SlideOverReseau — Panneau de prévisualisation d'un réseau local.
 *
 * Ouvert au clic sur un marqueur de la carte des réseaux locaux (ADR-0012).
 * Affiche : logo, nom, ville, description, réseau national parent, compteurs.
 * CTA principal : « Voir la fiche du réseau » → /reseau/:slug (SSR ISR, SEO Organization).
 *
 * Confidentialité :
 *   - Le statut partenaire est évalué côté serveur uniquement (webhook Stripe).
 *   - Aucun statut payant n'est jamais déduit depuis le client (invariant ADR-0011/0012).
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Users, CalendarDays, AlertTriangle, Building2 } from 'lucide-react'
import SlideOver from './SlideOver'
import SlideOverContacts from './SlideOverContacts'
import { Skeleton } from '@/components/ui/Skeleton'

interface ReseauParent {
  id: number | string
  slug: string | null
  nom: string | null
  partenaire: boolean
  logoUrl: string | null
}

interface ReseauDetail {
  id: number | string
  slug: string | null
  nom: string
  niveau: 'national' | 'local'
  ville: string
  departement: string | null
  adresse: string | null
  codePostal: string | null
  description: string | null
  logoUrl: string | null
  siteWeb: string | null
  emailContact: string | null
  telephone: string | null
  partenaire: boolean
  nbReseauteurs: number
  nbEvenements: number
  parentNational: ReseauParent | null
}

interface SlideOverReseauProps {
  slug: string | null
  onClose: () => void
}

export default function SlideOverReseau({ slug, onClose }: SlideOverReseauProps) {
  const [data, setData] = useState<ReseauDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [prevSlug, setPrevSlug] = useState<string | null>(null)

  // Reset et fetch quand le slug change (pattern identique à SlideOverReseauteur)
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
    fetch(`/api/reseaux/public/${encodeURIComponent(targetSlug)}`)
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

  // Le badge "Partenaire" s'affiche si le national parent est abonné
  const isPartenaire = data?.parentNational?.partenaire === true

  return (
    <SlideOver isOpen={!!slug} onClose={onClose} mobileBottomSheet contentKey={slug}>
      {/* Chargement */}
      {loading && (
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" className="w-14 h-14 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="h-5 w-3/4" />
              <Skeleton variant="text" className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton variant="text" lines={3} />
          <Skeleton variant="card" className="h-16" />
        </div>
      )}

      {/* Erreur */}
      {!loading && error && slug && (
        <div className="pt-12 text-center text-[#6E7175]">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm mb-1 font-medium">Impossible de charger ce réseau.</p>
          <button
            onClick={() => fetchData(slug)}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#3E7CA6] hover:text-[#2E6389] transition-colors mt-2 cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Introuvable */}
      {!loading && !error && !data && slug && (
        <div className="pt-12 text-center text-[#6E7175]">
          <Building2 size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Réseau introuvable.</p>
        </div>
      )}

      {/* Contenu */}
      {data && !loading && (
        <div>
          {/* En-tête */}
          <div className="pb-4 border-b border-[#DFE0E1]">
            <div className="flex items-start gap-3">
              {/* Logo */}
              {data.logoUrl ? (
                <div className="w-14 h-14 rounded-xl border border-[#DFE0E1] bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center p-1">
                  <Image
                    src={data.logoUrl}
                    alt={data.nom}
                    width={56}
                    height={56}
                    className="object-contain w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 border border-[#DFE0E1] shrink-0 flex items-center justify-center">
                  <Building2 size={24} className="text-[#3E7CA6]" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {/* Nom + badge Partenaire */}
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[#1D1E21] leading-tight">
                    {data.nom}
                  </h2>
                  {isPartenaire && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E7F0F7] text-[#2E6389] border border-[#A9C9E4] shrink-0">
                      Partenaire
                    </span>
                  )}
                </div>

                {/* Ville */}
                <div className="flex items-center gap-1.5 mt-1 text-sm text-[#6E7175]">
                  <MapPin size={12} className="shrink-0" />
                  <span>
                    {data.ville}
                    {data.departement ? ` (${data.departement})` : ''}
                  </span>
                </div>

                {/* Réseau national parent */}
                {data.parentNational && (
                  <div className="mt-1.5">
                    {data.parentNational.slug ? (
                      <Link
                        href={`/reseau/${data.parentNational.slug}`}
                        className="text-xs text-[#035AA6] hover:underline"
                      >
                        {data.parentNational.nom ?? 'Réseau national'}
                      </Link>
                    ) : (
                      <span className="text-xs text-[#6E7175]">
                        {data.parentNational.nom ?? 'Réseau national'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA principal */}
          {data.slug && (
            <div className="py-4 border-b border-[#DFE0E1]">
              <Link
                href={`/reseau/${data.slug}`}
                className="flex items-center justify-center gap-2 w-full bg-[#3E7CA6] text-white font-semibold p-2.5 rounded-xl hover:bg-[#2E6389] transition-colors text-sm"
              >
                Voir la fiche du réseau
              </Link>
            </div>
          )}

          {/* Compteurs */}
          {(data.nbReseauteurs > 0 || data.nbEvenements > 0) && (
            <div className="py-4 border-b border-[#DFE0E1]">
              <div className="flex items-center gap-5">
                {data.nbReseauteurs > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-[#4E5155]">
                    <Users size={14} className="text-[#3E7CA6] shrink-0" />
                    <span>
                      <strong className="font-semibold text-[#1D1E21]">
                        {data.nbReseauteurs}
                      </strong>{' '}
                      réseauteur{data.nbReseauteurs !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {data.nbEvenements > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-[#4E5155]">
                    <CalendarDays size={14} className="text-[#3E7CA6] shrink-0" />
                    <span>
                      <strong className="font-semibold text-[#1D1E21]">
                        {data.nbEvenements}
                      </strong>{' '}
                      événement{data.nbEvenements !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {data.description && (
            <div className="py-4 border-b border-[#DFE0E1]">
              <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line line-clamp-5">
                {data.description}
              </p>
            </div>
          )}

          {/* Contact — email / téléphone / site web (mêmes canaux que la fiche) */}
          <SlideOverContacts
            email={data.emailContact}
            telephone={data.telephone}
            site={data.siteWeb}
          />
        </div>
      )}
    </SlideOver>
  )
}
