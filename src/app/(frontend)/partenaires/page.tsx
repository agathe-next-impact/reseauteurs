/**
 * Page Partenaires — /partenaires
 * Annonceurs B2B actifs (collection `partenaires`).
 * Accent orange — renvoi B2B, pas un paiement réseauteur.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Building2, ArrowRight } from 'lucide-react'
import { buildMetadata } from '@/lib/seo'
import { withDbRetry } from '@/lib/db-retry'
import { SITE_NAME } from '@/lib/site'
import PageHeader from '@/components/layout/PageHeader'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { Partenaire, Media } from '@/types/reseauteurs-domain'

export const revalidate = 300

export const metadata: Metadata = buildMetadata({
  title: `Entreprises — Elles soutiennent le networking français | ${SITE_NAME}`,
  description:
    'Découvrez les entreprises qui soutiennent le networking professionnel en France aux côtés de RÉSEAUTEURS.',
  path: '/partenaires',
})

export default async function PartenairesPage() {
  const payload = await getPayload({ config })

  const { docs: partenaires } = await withDbRetry(
    () =>
      payload.find({
        collection: 'partenaires',
        where: { statut: { equals: 'actif' } },
        depth: 1,
        limit: 50,
        sort: 'nom',
        overrideAccess: true,
      }),
    { label: 'partenaires:find' },
  )

  const docs = partenaires as Partenaire[]

  return (
    <div className="rsn-page">
      <PageHeader
        tone="orange"
        icon={<Building2 size={13} aria-hidden />}
        eyebrow="Entreprises"
        title={<>Elles soutiennent le networking français</>}
        lead={
          <>
            Ces entreprises croient en la valeur du networking professionnel et soutiennent{' '}
            <strong>RÉSEAUTEURS</strong> dans sa mission de rassembler tous les réseaux.
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Grille des partenaires */}
        {docs.length === 0 ? (
          <div className="text-center py-16">
            <Building2 size={40} className="text-[#d4d4d8] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#52525b] mb-2">
              Aucune entreprise pour l&apos;instant
            </p>
            <p className="text-sm text-[#71717a]">Vous souhaitez rejoindre ces entreprises ?</p>
          </div>
        ) : (
          <Reveal className="mb-16">
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
              role="list"
              aria-label="Les entreprises partenaires"
            >
              {docs.map((p) => {
                const logoMedia = p.logo as Media | null | undefined
                const logoUrl = logoMedia?.sizes?.card?.url ?? logoMedia?.url

                const inner = (
                  <div className="flex flex-col items-center gap-3 p-5 bg-white border border-[#e4e4e7] rsn-lift rsn-shine h-full group">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt={p.nom}
                        width={120}
                        height={60}
                        className="h-12 w-auto object-contain"
                      />
                    ) : (
                      <div className="h-12 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#c2410c]">{p.nom}</span>
                      </div>
                    )}
                    {logoUrl && (
                      <p className="text-xs font-medium text-[#52525b] text-center">{p.nom}</p>
                    )}
                    {p.description && (
                      <p className="text-xs text-[#71717a] text-center line-clamp-2">
                        {p.description}
                      </p>
                    )}
                    <span className="text-xs text-[#f5851f] flex items-center gap-0.5 mt-auto group-hover:underline">
                      Voir la fiche
                      <ArrowRight size={11} aria-hidden />
                    </span>
                  </div>
                )

                return (
                  <div key={p.id} role="listitem">
                    {p.slug ? (
                      <Link
                        href={`/partenaire/${p.slug}`}
                        className="block no-underline"
                        aria-label={`Voir la fiche de ${p.nom}`}
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </div>
                )
              })}
            </div>
          </Reveal>
        )}

        {/* Bloc CTA B2B — devenir partenaire */}
        <Reveal>
          <div className="bg-gradient-to-br from-[#f5851f] to-[#e07710] p-8 md:p-10 text-white text-center flex flex-col gap-4">
            <Building2 size={32} className="mx-auto mb-4 opacity-80" aria-hidden />
            <h2 className="text-xl sm:text-2xl font-bold mb-3">
              Vous représentez une entreprise ou un réseau ?
            </h2>
            <p className="text-sm sm:text-base opacity-90 mx-auto mb-6">
              Référencez votre entreprise sur RÉSEAUTEURS et touchez des milliers de professionnels
              du networking partout en France. Logo en page d&apos;accueil, page dédiée, visibilité
              maximale.
            </p>
            <Link
              href="/inscription?type=partenaire"
              className="w-xs mx-auto inline-flex items-center gap-2 px-6 py-3 bg-white text-[#c2410c] font-bold text-sm hover:bg-[#fff7ed] transition-colors no-underline rsn-linkrow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Référencer mon entreprise
              <ArrowRight size={16} aria-hidden className="rsn-arrow" />
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
