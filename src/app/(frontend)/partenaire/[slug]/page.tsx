/**
 * Fiche partenaire publique — /partenaire/<slug>
 * Visible uniquement si l'abonnement est actif (statut='actif').
 * L'offre promotionnelle est réservée aux réseauteurs connectés (RGPD/ciblage B2B).
 */
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { buildMetadata } from '@/lib/seo'
import { SITE_NAME } from '@/lib/site'
import OffreReservee from '@/components/partenaire/OffreReservee'
import { ContactCTA } from '@/components/fiche/ContactCTA'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { Partenaire, Media } from '@/types/reseauteurs-domain'

export const revalidate = 300

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { statut: { equals: 'actif' } },
    select: { slug: true } as Record<string, boolean>,
    limit: 200,
    overrideAccess: true,
  })
  return docs
    .filter((d): d is typeof d & { slug: string } => Boolean(d.slug))
    .map((d) => ({ slug: d.slug }))
}

const getPartenaire = cache(async (slug: string): Promise<Partenaire | null> => {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { and: [{ slug: { equals: slug } }, { statut: { equals: 'actif' } }] },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as Partenaire | undefined) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = await getPartenaire(slug)
  if (!p) {
    return buildMetadata({ title: 'Entreprise introuvable', description: 'Cette fiche n\'est plus disponible.', path: `/partenaire/${slug}`, noindex: true })
  }
  return buildMetadata({
    title: `${p.nom} — Entreprise | ${SITE_NAME}`,
    description: p.description?.slice(0, 155) || `${p.nom}, partenaire de ${SITE_NAME}, la plateforme nationale du networking.`,
    path: `/partenaire/${slug}`,
  })
}

export default async function FichePartenairePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await getPartenaire(slug)
  if (!p) notFound()

  // ISR/statique : PAS de headers()/auth() ici. L'offre réservée aux réseauteurs est
  // hydratée côté client (composant OffreReservee + API) → son contenu n'entre pas
  // dans le HTML statique et la visibilité per-user ne casse pas le cache.

  const logoMedia = p.logo as Media | null | undefined
  const logoUrl = logoMedia?.sizes?.card?.url ?? logoMedia?.url ?? null
  const offre = (p.offre as { titre?: string | null } | null | undefined) ?? null
  const hasOffre = !!(offre?.titre && offre.titre.trim())

  let lienSafe: string | null = null
  if (p.lien) {
    try {
      const u = new URL(p.lien)
      if (u.protocol === 'https:' || u.protocol === 'http:') lienSafe = p.lien
    } catch { /* ignore */ }
  }

  return (
    <div className="rsn-page">
      <section className="rsn-pagehead" data-tone="orange">
        <div className="rsn-pagehead-inner">
          {/* Tone orange = fond clair (pas de bande navy) : couleurs de texte via les
              variables du thème — sombres en mode clair, claires en .ir-plasma. */}
          <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-[var(--ir-text-4)] flex items-center gap-1.5">
            <Link href="/" className="hover:text-[var(--ir-text)] no-underline transition-colors">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/partenaires" className="hover:text-[var(--ir-text)] no-underline transition-colors">Entreprises</Link>
            <span aria-hidden>/</span>
            <span className="text-[var(--ir-text-3)]" aria-current="page">{p.nom}</span>
          </nav>
          <Reveal>
            <p className="rsn-eyebrow" style={{ color: '#8A6D0B' }}>Entreprise</p>
            <div className="flex items-center gap-4 mt-3.5">
              {logoUrl ? (
                <Image src={logoUrl} alt={`Logo ${p.nom}`} width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white p-2 border border-white/15" priority />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[rgba(var(--ir-line-rgb),0.06)] flex items-center justify-center border border-[rgba(var(--ir-line-rgb),0.15)]">
                  <Building2 size={28} className="text-[var(--ir-text-3)]" aria-hidden />
                </div>
              )}
              <h1 className="rsn-pagehead-title !mt-0 !text-[28px] sm:!text-[38px]">{p.nom}</h1>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="rsn-card rsn-lift rounded-2xl overflow-hidden">
          <div className="px-6 py-6 space-y-8">
            {p.description && (
              <Reveal>
                <section aria-labelledby="pres-titre">
                  <h2 id="pres-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">À propos</h2>
                  <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line">{p.description}</p>
                </section>
              </Reveal>
            )}

            {/* Offre réservée aux réseauteurs — hydratée côté client (garde l'ISR de la page) */}
            {hasOffre && (
              <Reveal>
                <OffreReservee slug={p.slug ?? slug} />
              </Reveal>
            )}

            {/* ADR-0015 : la section « Réseauteurs affiliés » (licences) est supprimée. */}

            {/* CTA prendre contact — email + téléphone + site web */}
            <Reveal>
              <ContactCTA
                email={p.emailContact}
                telephone={p.telephone}
                site={lienSafe}
                entityName={p.nom}
                siteLabel="Visiter le site"
              />
            </Reveal>
          </div>

          <div className="px-6 py-5 border-t border-[#DFE0E1] bg-[#F2F2F2]">
            <Link href="/partenaires" className="rsn-linkrow text-sm text-[#8A6D0B] font-medium hover:text-[#8A6D0B] no-underline transition-colors flex items-center gap-1">
              ← Toutes les entreprises
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
