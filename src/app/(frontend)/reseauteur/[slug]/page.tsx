/**
 * Fiche réseauteur SSR/ISR — /reseauteur/<prenom-nom>
 * RGPD : téléphone/email uniquement si renseignés par le réseauteur (champs facultatifs).
 * noindex : propagé si seo.noindex === true (profil non validé ou opt-out réseauteur).
 * JSON-LD Person : injecté par seo-engineer (champs publics uniquement, RGPD).
 */
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Globe, Phone, Mail, Users, ArrowRight, Building2, ExternalLink } from 'lucide-react'
import { buildMetadata, applySeoOverrides } from '@/lib/seo'
import { buildPersonJsonLd, buildBreadcrumbListJsonLd } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { MaillageReseauteur } from '@/components/seo/MaillageReseauteur'
import MiniMapLoader from '@/components/maps/MiniMapLoader'
import { BadgeReseauteur } from '@/components/ui/BadgeReseauteur'
import { SITE_NAME } from '@/lib/site'
import type { Metadata } from 'next'
import type { Reseauteur, Media, Reseau, Categorie } from '@/types/reseauteurs-domain'

export const revalidate = 300

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { statut: { equals: 'valide' } },
    select: { slug: true } as Record<string, boolean>,
    limit: 500,
    overrideAccess: true,
  })
  return docs
    .filter((d): d is typeof d & { slug: string } => Boolean(d.slug))
    .map((d) => ({ slug: d.slug }))
}

async function getReseauteur(slug: string): Promise<Reseauteur | null> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: {
      and: [
        { slug: { equals: slug } },
        { statut: { equals: 'valide' } },
      ],
    },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as Reseauteur | undefined) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = await getReseauteur(slug)
  if (!r) {
    return buildMetadata({
      title: 'Réseauteur introuvable',
      description: 'Ce profil n\'est plus disponible.',
      path: `/reseauteur/${slug}`,
      noindex: true,
    })
  }
  const secteurDoc = r.secteur as Categorie | null | undefined
  const defaults = {
    title: `${r.prenom} ${r.nom}${r.fonction ? ` — ${r.fonction}` : ''}${r.entreprise ? `, ${r.entreprise}` : ''} | ${SITE_NAME}`,
    description: r.description?.slice(0, 155) || `${r.prenom} ${r.nom} est réseauteur à ${r.ville}${secteurDoc ? ` dans le secteur ${secteurDoc.label}` : ''}. Retrouvez son profil sur ${SITE_NAME}.`,
    path: `/reseauteur/${slug}`,
    ogType: 'profile' as const,
    noindex: r.seo?.noindex ?? false,
  }
  return buildMetadata(applySeoOverrides(defaults, r.seo ?? null))
}

export default async function FicheReseauteurPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const r = await getReseauteur(slug)
  if (!r) notFound()

  const photoMedia = r.photo as Media | null | undefined
  const photoUrl = photoMedia?.sizes?.card?.url ?? photoMedia?.url ?? null
  const secteurDoc = r.secteur as Categorie | null | undefined
  const reseauxFrequentes = (r.reseauxFrequentes as Reseau[] | null | undefined) ?? []
  const competences = (r.competences as Array<{ label: string; id?: string }> | null | undefined) ?? []

  // JSON-LD Person + BreadcrumbList (seo-engineer)
  // RGPD : uniquement si le profil est indexable (noindex !== true).
  // telephone/emailContact sont délibérément absents du JSON-LD (structuré = scrapable).
  const isIndexable = !(r.seo?.noindex ?? false)
  const secteurIdForMaillage =
    typeof r.secteur === 'object' && r.secteur !== null
      ? (r.secteur as Categorie).id
      : (r.secteur as number | null | undefined) ?? null

  return (
    <div className="bg-[#faf9f5] min-h-screen">
      {/* Données structurées JSON-LD (seo-engineer) */}
      {isIndexable && (
        <JsonLd
          data={[
            buildPersonJsonLd(r),
            buildBreadcrumbListJsonLd([
              { name: 'Accueil', url: '/' },
              { name: 'Réseauteurs', url: '/reseauteurs' },
              { name: `${r.prenom} ${r.nom}`, url: `/reseauteur/${r.slug ?? ''}` },
            ]),
          ]}
        />
      )}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-[#71717a] flex items-center gap-1.5">
          <Link href="/" className="hover:text-[#2563EB] no-underline transition-colors">Accueil</Link>
          <span aria-hidden>/</span>
          <Link href="/reseauteurs" className="hover:text-[#2563EB] no-underline transition-colors">Réseauteurs</Link>
          <span aria-hidden>/</span>
          <span className="text-[#52525b]" aria-current="page">{r.prenom} {r.nom}</span>
        </nav>

        <article className="bg-white rounded-2xl border border-[#e4e4e7] shadow-sm overflow-hidden">
          {/* En-tête profil */}
          <div className="px-6 pt-8 pb-6 border-b border-[#e4e4e7]">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="shrink-0">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={`Photo de profil de ${r.prenom} ${r.nom}`}
                    width={88}
                    height={88}
                    className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border border-[#e4e4e7]"
                    priority
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl bg-[#bfdbfe]/40 flex items-center justify-center text-[#2563EB] font-extrabold text-2xl border border-[#e4e4e7]"
                    aria-label={`Initiales de ${r.prenom} ${r.nom}`}
                  >
                    {r.prenom.charAt(0)}{r.nom.charAt(0)}
                  </div>
                )}
              </div>

              {/* Identité */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#16284f]">
                    {r.prenom} {r.nom}
                  </h1>
                  {r.badge && <BadgeReseauteur badge={r.badge} />}
                </div>
                {r.fonction && (
                  <p className="text-sm font-medium text-[#52525b]">{r.fonction}</p>
                )}
                {r.entreprise && (
                  <p className="text-sm text-[#71717a] flex items-center gap-1.5 mt-0.5">
                    <Building2 size={13} aria-hidden />
                    {r.entreprise}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={13} className="text-[#a1a1aa] shrink-0" aria-hidden />
                  <span className="text-sm text-[#71717a]">
                    {r.ville}{r.departement ? `, ${r.departement}` : ''}{r.region ? ` — ${r.region}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Liens externes */}
            <div className="flex flex-wrap gap-2 mt-5">
              {/* RGPD : téléphone uniquement si renseigné (contrôle de confidentialité du réseauteur) */}
              {r.telephone && (
                <a
                  href={`tel:${r.telephone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors no-underline"
                  aria-label={`Appeler ${r.prenom} ${r.nom}`}
                >
                  <Phone size={13} aria-hidden />
                  {r.telephone}
                </a>
              )}
              {/* RGPD : email uniquement si renseigné */}
              {r.emailContact && (
                <a
                  href={`mailto:${r.emailContact}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors no-underline"
                  aria-label={`Écrire à ${r.prenom} ${r.nom}`}
                >
                  <Mail size={13} aria-hidden />
                  {r.emailContact}
                </a>
              )}
              {r.site && (
                <a
                  href={r.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors no-underline"
                  aria-label={`Site web de ${r.prenom} ${r.nom}`}
                >
                  <Globe size={13} aria-hidden />
                  {r.site.replace(/^https?:\/\//, '')}
                </a>
              )}
              {r.linkedin && (
                <a
                  href={r.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors no-underline"
                  aria-label={`Profil LinkedIn de ${r.prenom} ${r.nom}`}
                >
                  <ExternalLink size={13} aria-hidden />
                  LinkedIn
                </a>
              )}
            </div>
          </div>

          {/* Corps de la fiche */}
          <div className="px-6 py-6 space-y-6">
            {/* Présentation */}
            {r.description && (
              <section aria-labelledby="presentation-titre">
                <h2 id="presentation-titre" className="text-sm font-semibold text-[#18181b] mb-2">Présentation</h2>
                <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{r.description}</p>
              </section>
            )}

            {/* Secteur */}
            {secteurDoc && (
              <section aria-labelledby="secteur-titre">
                <h2 id="secteur-titre" className="text-sm font-semibold text-[#18181b] mb-2">Secteur d&apos;activité</h2>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#bfdbfe]/30 text-[#2563EB] text-xs font-medium border border-[#bfdbfe]">
                  {secteurDoc.label}
                </span>
              </section>
            )}

            {/* Compétences */}
            {competences.length > 0 && (
              <section aria-labelledby="competences-titre">
                <h2 id="competences-titre" className="text-sm font-semibold text-[#18181b] mb-2">Compétences</h2>
                <div className="flex flex-wrap gap-2" role="list" aria-label="Compétences">
                  {competences.map((c, i) => (
                    <span
                      key={c.id ?? i}
                      role="listitem"
                      className="px-2.5 py-1 rounded-full bg-[#f4f4f5] text-[#52525b] text-xs font-medium border border-[#e4e4e7]"
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Réseaux fréquentés */}
            {reseauxFrequentes.length > 0 && (
              <section aria-labelledby="reseaux-titre">
                <h2 id="reseaux-titre" className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
                  <Users size={14} aria-hidden />
                  Réseaux fréquentés
                </h2>
                <div className="flex flex-wrap gap-2" role="list" aria-label="Réseaux fréquentés">
                  {reseauxFrequentes.map((reseau) => {
                    const rLogoMedia = reseau.logo as Media | null | undefined
                    const rLogoUrl = rLogoMedia?.sizes?.thumbnail?.url ?? rLogoMedia?.url
                    return (
                      <Link
                        key={reseau.id}
                        href={`/reseau/${reseau.slug}`}
                        role="listitem"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] text-xs font-medium text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] no-underline transition-colors"
                      >
                        {rLogoUrl && (
                          <Image src={rLogoUrl} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full object-cover" aria-hidden />
                        )}
                        {reseau.nom}
                        {reseau.partenaire && (
                          <span className="ml-0.5 text-[#f5851f]" title="Réseau partenaire" aria-label="Réseau partenaire">•</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Localisation — mini-carte (centroïde ville, RGPD ADR-0011 §7) */}
            {typeof r.latitude === 'number' && typeof r.longitude === 'number' && (
              <section aria-labelledby="loc-titre">
                <h2 id="loc-titre" className="text-sm font-semibold text-[#18181b] mb-2 flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  Localisation
                </h2>
                <MiniMapLoader
                  latitude={r.latitude}
                  longitude={r.longitude}
                  zoom={11}
                  label={`Localisation de ${r.prenom} ${r.nom}${r.ville ? ` à ${r.ville}` : ''}`}
                />
                <p className="text-xs text-[#a1a1aa] mt-1.5">Position au niveau de la ville (confidentialité).</p>
              </section>
            )}
          </div>

          {/* Maillage interne : proximité + même secteur (seo-engineer) */}
          <MaillageReseauteur
            villeActuelle={r.ville}
            secteurId={secteurIdForMaillage}
            excludeId={r.id}
          />

          {/* Pied de fiche — CTA carte */}
          <div className="px-6 py-5 border-t border-[#e4e4e7] bg-[#faf9f5]">
            {/* CTA vers la carte plein écran des réseauteurs (map-engineer J2.B) */}
            <Link
              href={`/carte/reseauteurs?ville=${encodeURIComponent(r.ville ?? '')}`}
              className="inline-flex items-center gap-2 text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] no-underline transition-colors"
            >
              <MapPin size={14} aria-hidden />
              Voir les réseauteurs à {r.ville} sur la carte
              <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
