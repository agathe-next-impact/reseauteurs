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
import { Building2, ExternalLink, Users, ArrowRight } from 'lucide-react'
import { buildMetadata } from '@/lib/seo'
import { SITE_NAME } from '@/lib/site'
import { getReseauteursAffilies } from '@/lib/affiliation'
import OffreReservee from '@/components/partenaire/OffreReservee'
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
    return buildMetadata({ title: 'Partenaire introuvable', description: 'Cette fiche n\'est plus disponible.', path: `/partenaire/${slug}`, noindex: true })
  }
  return buildMetadata({
    title: `${p.nom} — Partenaire | ${SITE_NAME}`,
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
  const payload = await getPayload({ config })

  // Réseauteurs affiliés = ceux qui ont activé une licence Plus de ce partenaire (ADR-0013).
  const affilies = await getReseauteursAffilies(payload, p.id)

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
          <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-white/60 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white no-underline transition-colors">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/partenaires" className="hover:text-white no-underline transition-colors">Partenaires</Link>
            <span aria-hidden>/</span>
            <span className="text-white/80" aria-current="page">{p.nom}</span>
          </nav>
          <Reveal>
            <p className="rsn-eyebrow" style={{ color: '#fed7aa' }}>Partenaire</p>
            <div className="flex items-center gap-4 mt-3.5">
              {logoUrl ? (
                <Image src={logoUrl} alt={`Logo ${p.nom}`} width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white p-2 border border-white/15" priority />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/15">
                  <Building2 size={28} className="text-white/70" aria-hidden />
                </div>
              )}
              <h1 className="rsn-pagehead-title !mt-0 !text-[28px] sm:!text-[38px]">{p.nom}</h1>
            </div>
            {lienSafe && (
              <div className="mt-6">
                <a href={lienSafe} target="_blank" rel="noopener noreferrer" className="ir-atlas-primary rsn-linkrow rsn-shine" aria-label={`Visiter le site de ${p.nom} (lien externe)`}>
                  <ExternalLink size={15} aria-hidden />
                  Visiter le site
                </a>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="rsn-card rsn-lift rounded-2xl overflow-hidden">
          <div className="px-6 py-6 space-y-8">
            {p.description && (
              <Reveal>
                <section aria-labelledby="pres-titre">
                  <h2 id="pres-titre" className="text-sm font-semibold text-[#18181b] mb-2">À propos</h2>
                  <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{p.description}</p>
                </section>
              </Reveal>
            )}

            {/* Offre réservée aux réseauteurs — hydratée côté client (garde l'ISR de la page) */}
            {hasOffre && (
              <Reveal>
                <OffreReservee slug={p.slug ?? slug} />
              </Reveal>
            )}

            {/* Réseauteurs affiliés (ont activé une licence Plus de ce partenaire) */}
            {affilies.length > 0 && (
              <Reveal>
                <section aria-labelledby="affilies-titre">
                  <h2 id="affilies-titre" className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
                    <Users size={14} className="text-[#f5851f]" aria-hidden />
                    Réseauteurs affiliés
                    <span className="text-xs font-normal text-[#a1a1aa]">({affilies.length})</span>
                  </h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list">
                    {affilies.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.slug ? `/reseauteur/${a.slug}` : '#'}
                          className="rsn-lift flex items-center gap-3 p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#2563EB]/40 no-underline transition-colors group"
                        >
                          {a.photoUrl ? (
                            <Image
                              src={a.photoUrl}
                              alt=""
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-full object-cover border border-[#e4e4e7] shrink-0"
                              aria-hidden
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563EB] font-bold text-xs shrink-0" aria-hidden>
                              {a.prenom.charAt(0)}{a.nom.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#18181b] truncate group-hover:text-[#2563EB] transition-colors">
                              {a.prenom} {a.nom}
                            </p>
                            <p className="text-xs text-[#71717a] truncate">
                              {a.fonction}{a.fonction && a.ville ? ' · ' : ''}{a.ville}
                            </p>
                          </div>
                          <ArrowRight size={14} className="text-[#a1a1aa] group-hover:text-[#2563EB] transition-colors shrink-0 rsn-arrow" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            )}
          </div>

          <div className="px-6 py-5 border-t border-[#e4e4e7] bg-[#faf9f5]">
            <Link href="/partenaires" className="rsn-linkrow text-sm text-[#f5851f] font-medium hover:text-[#c2410c] no-underline transition-colors flex items-center gap-1">
              ← Tous les partenaires
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
