/**
 * Page Partenaires — /partenaires
 * Annonceurs B2B actifs (collection `partenaires`).
 * Accent orange — renvoi B2B, pas un paiement réseauteur.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Building2, ArrowRight, Tag } from 'lucide-react'
import { buildMetadata } from '@/lib/seo'
import { ContactChips } from '@/components/fiche/ContactChips'
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
        title={
          <>
            Elles soutiennent <span>le networking français</span>
          </>
        }
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
            <Building2 size={40} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#4E5155] mb-2">
              Aucune entreprise pour l&apos;instant
            </p>
            <p className="text-sm text-[#6E7175] mb-5">Soyez la première à les rejoindre.</p>
            <Link
              href="/inscription?type=partenaire"
              className="ir-atlas-primary rsn-linkrow w-max mx-auto"
            >
              <Building2 size={15} aria-hidden />
              Devenir partenaire
            </Link>
          </div>
        ) : (
          <Reveal className="mb-16">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              role="list"
              aria-label="Les entreprises partenaires"
            >
              {docs.map((p) => {
                const logoMedia = p.logo as Media | null | undefined
                const logoUrl = logoMedia?.sizes?.card?.url ?? logoMedia?.url

                // Le teaser de l'offre (titre) est public — on affiche « Voir l'offre
                // partenaire » (lien vers l'ancre #offre de la fiche) dès qu'une offre existe.
                const hasOffre = !!(p.offre?.titre && p.offre.titre.trim())
                const ficheHref = hasOffre
                  ? `/partenaire/${p.slug}#offre`
                  : `/partenaire/${p.slug}`

                const inner = (
                  <div className="flex flex-col items-center gap-3 p-5 pb-3 h-full">
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
                        <span className="text-sm font-bold text-[#8A6D0B]">{p.nom}</span>
                      </div>
                    )}
                    {logoUrl && (
                      <p className="text-xs font-medium text-[#4E5155] text-center">{p.nom}</p>
                    )}
                    {p.description && (
                      <p className="text-xs text-[#6E7175] text-center line-clamp-2">
                        {p.description}
                      </p>
                    )}
                    <span className="text-xs text-[#8A6D0B] flex items-center gap-1 mt-auto group-hover:underline font-medium">
                      {hasOffre ? (
                        <>
                          <Tag size={11} aria-hidden />
                          Voir l&apos;offre partenaire
                        </>
                      ) : (
                        <>
                          Voir la fiche
                          <ArrowRight size={11} aria-hidden />
                        </>
                      )}
                    </span>
                  </div>
                )

                return (
                  // Le cadre porte le style de carte : les coordonnées restent DANS la
                  // carte tout en étant des liens frères du <Link> (pas d'<a> imbriqué).
                  <div
                    key={p.id}
                    role="listitem"
                    className="flex flex-col bg-white border border-[#DFE0E1] rsn-lift rsn-shine h-full group"
                  >
                    {p.slug ? (
                      <Link
                        href={ficheHref}
                        className="block no-underline flex-1"
                        aria-label={hasOffre ? `Voir l'offre de ${p.nom}` : `Voir la fiche de ${p.nom}`}
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                    <ContactChips
                      email={p.emailContact}
                      telephone={p.telephone}
                      site={p.lien}
                      entityName={p.nom}
                      className="justify-center px-4 pb-4"
                    />
                  </div>
                )
              })}
            </div>
          </Reveal>
        )}

        {/* Bloc CTA B2B — devenir partenaire */}
        <Reveal>
          <div className="bg-[#3E7CA6] p-8 md:p-10 text-[#012A4A] text-center flex flex-col gap-4">
            <Building2 size={32} className="mx-auto mb-4 opacity-80" aria-hidden />
            <h2 className="text-white text-xl sm:text-2xl font-bold mb-3">
              Vous représentez une entreprise ?
            </h2>
            <p className="text-white text-sm sm:text-base opacity-90 mx-auto mb-6">
              Référencez votre entreprise sur RÉSEAUTEURS et touchez des milliers de professionnels
              du networking partout en France : logo en page d&apos;accueil, fiche dédiée, et une
              offre réservée aux réseauteurs visible dans leur espace.
            </p>
            <Link
              href="/inscription?type=partenaire"
              className="w-max mx-auto inline-flex items-center gap-2 px-6 py-3 bg-white text-[#8A6D0B] font-bold text-sm hover:bg-[#FEFBE6] transition-colors no-underline rsn-linkrow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Building2 size={15} aria-hidden />
              Devenir partenaire
            </Link>
            {/* Un réseau d'affaires n'est pas un annonceur : parcours distinct (ADR-0014). */}
            <p className="text-white/80 text-xs mt-4">
              Vous gérez un réseau d&apos;affaires ?{' '}
              <Link
                href="/inscription?type=organisateur"
                className="font-semibold text-white underline"
              >
                Inscrivez votre réseau
              </Link>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
