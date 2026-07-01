/**
 * Fiche réseau SSR/ISR — /reseau/<slug>
 * Compteurs : nb réseauteurs / nb événements (dérivés, stockés en DB).
 * Badge partenaire si reseau.partenaire.
 * JSON-LD Organization : injecté par seo-engineer.
 */
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Users, Calendar, Globe, ArrowRight, MapPin, Network } from 'lucide-react'
import { buildMetadata, applySeoOverrides } from '@/lib/seo'
import { buildReseauOrganizationJsonLd, buildBreadcrumbListJsonLd, type ReseauLocalLite } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { MaillageReseau } from '@/components/seo/MaillageReseau'
import { BadgePartenaire, BadgeReseauteur } from '@/components/ui/BadgeReseauteur'
import MiniMapLoader from '@/components/maps/MiniMapLoader'
import { SITE_NAME } from '@/lib/site'
import type { Metadata } from 'next'
import type { Reseau, Media, Reseauteur, EvenementRsn as Evenement } from '@/types/reseauteurs-domain'
import { withDbRetry } from '@/lib/db-retry'

export const revalidate = 300

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseaux',
    where: { statut: { equals: 'publiee' } },
    select: { slug: true } as Record<string, boolean>,
    limit: 200,
    overrideAccess: true,
  })
  return docs
    .filter((d): d is typeof d & { slug: string } => Boolean(d.slug))
    .map((d) => ({ slug: d.slug }))
}

async function getReseau(slug: string): Promise<Reseau | null> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        { slug: { equals: slug } },
        { statut: { equals: 'publiee' } },
      ],
    },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as Reseau | undefined) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = await getReseau(slug)
  if (!r) {
    return buildMetadata({
      title: 'Réseau introuvable',
      description: 'Ce réseau n\'est plus disponible.',
      path: `/reseau/${slug}`,
      noindex: true,
    })
  }
  const defaults = {
    title: `${r.nom}${r.ville ? ` — ${r.ville}` : ''} | ${SITE_NAME}`,
    description: r.description?.slice(0, 155) || `Découvrez le réseau ${r.nom}${r.ville ? ` à ${r.ville}` : ''} sur ${SITE_NAME} : membres, événements et actualités.`,
    path: `/reseau/${slug}`,
    ogType: 'website' as const,
  }
  return buildMetadata(applySeoOverrides(defaults, r.seo ?? null))
}

export default async function FicheReseauPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const reseau = await getReseau(slug)
  if (!reseau) notFound()

  const payload = await getPayload({ config })

  // ADR-0012 — parent populé à depth 1 dans getReseau (pour parentOrganization JSON-LD)
  const parentDoc =
    typeof reseau.parent === 'object' && reseau.parent !== null
      ? (reseau.parent as Reseau)
      : null

  // Réseauteurs et événements liés (affichage limité à 12/6 en fiche)
  // + locaux du national (pour subOrganization JSON-LD — ADR-0012)
  const [{ docs: reseauteurs }, { docs: evenements }, locauxRes] = await Promise.all([
    withDbRetry(
      () => payload.find({
        collection: 'reseauteurs',
        where: {
          and: [
            { reseauxFrequentes: { contains: reseau.id } },
            { statut: { equals: 'valide' } },
          ],
        },
        depth: 0,
        limit: 12,
        overrideAccess: true,
      }),
      { label: `reseau:find reseauteurs ${slug}` },
    ),
    withDbRetry(
      () => payload.find({
        collection: 'evenements',
        where: {
          and: [
            { reseau: { equals: reseau.id } },
            { statut: { equals: 'publie' } },
          ],
        },
        depth: 0,
        sort: '-dateDebut',
        limit: 6,
        overrideAccess: true,
      }),
      { label: `reseau:find evenements ${slug}` },
    ),
    // Locaux d'un national — JSON-LD subOrganization (seo-engineer) + compteurs agrégés SSR (Q7)
    reseau.niveau === 'national'
      ? withDbRetry(
          () =>
            payload.find({
              collection: 'reseaux',
              where: {
                and: [
                  { parent: { equals: reseau.id } },
                  { statut: { equals: 'publiee' } },
                ],
              },
              depth: 0,
              sort: 'nom',
              limit: 500,
              overrideAccess: true,
              select: {
                id: true,
                slug: true,
                nom: true,
                nbReseauteurs: true,
                nbEvenements: true,
              } as Record<string, boolean>,
            }),
          { label: `reseau:find locaux ${slug}` },
        )
      : Promise.resolve(null),
  ])

  const logoMedia = reseau.logo as Media | null | undefined
  const logoUrl = logoMedia?.sizes?.card?.url ?? logoMedia?.url ?? null
  const reseauteursDocs = reseauteurs as Reseauteur[]
  const evenementsDocs = evenements as Evenement[]
  const locauxDocs = locauxRes?.docs as ReseauLocalLite[] | undefined

  // Compteurs agrégés SSR pour un national (Q7 ADR-0012)
  const isNational = reseau.niveau === 'national'
  const aggNbReseauteurs = isNational
    ? (locauxDocs ?? []).reduce((sum, l) => sum + ((l as unknown as Reseau).nbReseauteurs ?? 0), 0)
    : (reseau.nbReseauteurs ?? 0)
  const aggNbEvenements = isNational
    ? (locauxDocs ?? []).reduce((sum, l) => sum + ((l as unknown as Reseau).nbEvenements ?? 0), 0)
    : (reseau.nbEvenements ?? 0)

  // Fil d'Ariane enrichi : pour un local, on intercale le national
  const breadcrumbItems = parentDoc
    ? [
        { name: 'Accueil', url: '/' },
        { name: 'Réseaux', url: '/reseaux' },
        { name: parentDoc.nom, url: `/reseau/${parentDoc.slug ?? ''}` },
        { name: reseau.nom, url: `/reseau/${reseau.slug ?? ''}` },
      ]
    : [
        { name: 'Accueil', url: '/' },
        { name: 'Réseaux', url: '/reseaux' },
        { name: reseau.nom, url: `/reseau/${reseau.slug ?? ''}` },
      ]

  // JSON-LD Organization (+ parentOrganization/subOrganization ADR-0012) + BreadcrumbList
  return (
    <div className="bg-[#faf9f5] min-h-screen">
      {/* Données structurées JSON-LD (seo-engineer) */}
      <JsonLd
        data={[
          buildReseauOrganizationJsonLd(reseau, locauxDocs),
          buildBreadcrumbListJsonLd(breadcrumbItems),
        ]}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-[#71717a] flex items-center gap-1.5">
          <Link href="/" className="hover:text-[#2563EB] no-underline transition-colors">Accueil</Link>
          <span aria-hidden>/</span>
          <Link href="/reseaux" className="hover:text-[#2563EB] no-underline transition-colors">Réseaux</Link>
          {parentDoc && (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/reseau/${parentDoc.slug ?? ''}`}
                className="hover:text-[#2563EB] no-underline transition-colors"
              >
                {parentDoc.nom}
              </Link>
            </>
          )}
          <span aria-hidden>/</span>
          <span className="text-[#52525b]" aria-current="page">{reseau.nom}</span>
        </nav>

        <article className="bg-white rounded-2xl border border-[#e4e4e7] shadow-sm overflow-hidden">
          {/* En-tête réseau */}
          <div className="px-6 pt-8 pb-6 border-b border-[#e4e4e7]">
            <div className="flex items-start gap-5">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`Logo ${reseau.nom}`}
                  width={80}
                  height={80}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain border border-[#e4e4e7] shrink-0 bg-white p-1"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#bfdbfe]/30 flex items-center justify-center text-[#2563EB] font-extrabold text-xl border border-[#e4e4e7] shrink-0">
                  <Network size={24} aria-hidden />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#16284f]">{reseau.nom}</h1>
                  {reseau.partenaire && <BadgePartenaire />}
                </div>
                {reseau.ville && (
                  <p className="text-sm text-[#71717a] flex items-center gap-1.5">
                    <MapPin size={13} aria-hidden />
                    {reseau.ville}
                  </p>
                )}
                {/* Compteurs — agrégés pour un national, directs pour un local */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-sm text-[#52525b]">
                    <Users size={14} className="text-[#2563EB]" aria-hidden />
                    <strong className="font-semibold text-[#18181b]">{aggNbReseauteurs}</strong>
                    <span>réseauteur{aggNbReseauteurs > 1 ? 's' : ''}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-[#52525b]">
                    <Calendar size={14} className="text-[#0284c7]" aria-hidden />
                    <strong className="font-semibold text-[#18181b]">{aggNbEvenements}</strong>
                    <span>événement{aggNbEvenements > 1 ? 's' : ''}</span>
                  </span>
                  {isNational && (locauxDocs?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5 text-sm text-[#52525b]">
                      <Network size={14} className="text-[#a855f7]" aria-hidden />
                      <strong className="font-semibold text-[#18181b]">{locauxDocs!.length}</strong>
                      <span>chapitre{(locauxDocs?.length ?? 0) > 1 ? 's' : ''}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Lien site web */}
            {reseau.siteWeb && (
              <div className="mt-5">
                <a
                  href={reseau.siteWeb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors no-underline"
                >
                  <Globe size={14} aria-hidden />
                  {reseau.siteWeb.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          {/* Corps */}
          <div className="px-6 py-6 space-y-6">
            {/* Description */}
            {reseau.description && (
              <section aria-labelledby="desc-reseau-titre">
                <h2 id="desc-reseau-titre" className="text-sm font-semibold text-[#18181b] mb-2">À propos</h2>
                <p className="text-sm text-[#52525b] leading-relaxed">{reseau.description}</p>
              </section>
            )}

            {/* Présentation détaillée */}
            {reseau.presentation && (
              <section aria-labelledby="pres-reseau-titre">
                <h2 id="pres-reseau-titre" className="text-sm font-semibold text-[#18181b] mb-2">Présentation</h2>
                <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{reseau.presentation}</p>
              </section>
            )}

            {/* Réseauteurs membres */}
            {reseauteursDocs.length > 0 && (
              <section aria-labelledby="membres-titre">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="membres-titre" className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
                    <Users size={14} aria-hidden />
                    Réseauteurs membres
                  </h2>
                  {(reseau.nbReseauteurs ?? 0) > 12 && (
                    <Link
                      href={`/reseauteurs?reseau=${reseau.slug}`}
                      className="text-xs text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
                    >
                      Voir tous ({reseau.nbReseauteurs})
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list" aria-label="Membres du réseau">
                  {reseauteursDocs.map((r) => {
                    const photoMedia = r.photo as Media | null | undefined
                    const photoUrl = photoMedia?.sizes?.thumbnail?.url ?? photoMedia?.url
                    return (
                      <Link
                        key={r.id}
                        href={`/reseauteur/${r.slug}`}
                        role="listitem"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#2563EB]/40 hover:shadow-sm transition-all no-underline group"
                      >
                        {photoUrl ? (
                          <Image
                            src={photoUrl}
                            alt={`Photo de ${r.prenom} ${r.nom}`}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-full object-cover border border-[#e4e4e7] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#bfdbfe]/40 flex items-center justify-center text-[#2563EB] font-bold text-xs shrink-0">
                            {r.prenom.charAt(0)}{r.nom.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#18181b] truncate group-hover:text-[#2563EB] transition-colors">
                            {r.prenom} {r.nom}
                          </p>
                          {r.fonction && <p className="text-xs text-[#71717a] truncate">{r.fonction}</p>}
                        </div>
                        {r.badge && <BadgeReseauteur badge={r.badge} size="sm" />}
                      </Link>
                    )
                  })}
                </div>
                {reseauteursDocs.length === 0 && (
                  <p className="text-sm text-[#a1a1aa] py-4 text-center">
                    Aucun réseauteur dans ce réseau pour l&apos;instant.{' '}
                    <Link href="/inscription" className="text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium">
                      Soyez le premier !
                    </Link>
                  </p>
                )}
              </section>
            )}

            {reseauteursDocs.length === 0 && (
              <div className="py-4 text-center bg-[#faf9f5] rounded-xl border border-dashed border-[#e4e4e7]">
                <p className="text-sm text-[#71717a] mb-2">Aucun réseauteur dans ce réseau pour l&apos;instant.</p>
                <Link href="/inscription" className="text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] no-underline transition-colors">
                  Créer mon profil et rejoindre ce réseau →
                </Link>
              </div>
            )}

            {/* Événements */}
            {evenementsDocs.length > 0 && (
              <section aria-labelledby="events-titre">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="events-titre" className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
                    <Calendar size={14} aria-hidden />
                    Prochains événements
                  </h2>
                  {(reseau.nbEvenements ?? 0) > 6 && (
                    <Link
                      href={`/evenements?reseau=${reseau.slug}`}
                      className="text-xs text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
                    >
                      Voir tous ({reseau.nbEvenements})
                    </Link>
                  )}
                </div>
                <div className="space-y-2" role="list" aria-label="Événements du réseau">
                  {evenementsDocs.map((ev) => (
                    <Link
                      key={ev.id}
                      href={`/evenement/${ev.slug}`}
                      role="listitem"
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#e4e4e7] hover:border-[#2563EB]/40 hover:shadow-sm transition-all no-underline group"
                    >
                      <div className="shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-[#e0f2fe]/50 text-[#0284c7]">
                        <Calendar size={16} aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#18181b] truncate group-hover:text-[#2563EB] transition-colors">
                          {ev.titre}
                        </p>
                        <p className="text-xs text-[#71717a]">
                          {new Date(ev.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {ev.lieuVille && ` · ${ev.lieuVille}`}
                        </p>
                      </div>
                      <ArrowRight size={13} className="text-[#a1a1aa] group-hover:text-[#2563EB] transition-colors shrink-0" aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
            )}

              {/* Chapitres locaux (uniquement pour un national — ADR-0012) */}
            {reseau.niveau === 'national' && locauxDocs && locauxDocs.length > 0 && (
              <section aria-labelledby="locaux-titre">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="locaux-titre" className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
                    <Network size={14} className="text-[#a855f7]" aria-hidden />
                    Chapitres locaux
                    <span className="text-[#a1a1aa] font-normal">({locauxDocs.length})</span>
                  </h2>
                  {locauxDocs.length > 8 && (
                    <Link
                      href={`/reseaux?vue=carte`}
                      className="text-xs text-[#a855f7] hover:text-[#9333ea] no-underline font-medium transition-colors"
                    >
                      Voir sur la carte →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list" aria-label="Chapitres locaux">
                  {(locauxDocs as ReseauLocalLite[]).slice(0, 8).map((local) => (
                    <Link
                      key={local.id}
                      href={`/reseau/${local.slug ?? ''}`}
                      role="listitem"
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#a855f7]/40 hover:shadow-sm transition-all no-underline group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#f3e8ff]/50 flex items-center justify-center text-[#a855f7] shrink-0" aria-hidden>
                        <Network size={13} />
                      </div>
                      <p className="text-xs font-semibold text-[#18181b] truncate group-hover:text-[#a855f7] transition-colors">
                        {local.nom}
                      </p>
                    </Link>
                  ))}
                </div>
                {locauxDocs.length > 8 && (
                  <p className="text-xs text-[#a1a1aa] mt-2 text-center">
                    et {locauxDocs.length - 8} autre{locauxDocs.length - 8 > 1 ? 's' : ''} chapitre{locauxDocs.length - 8 > 1 ? 's' : ''}
                  </p>
                )}
              </section>
            )}

          {/* Localisation — mini-carte (siège du réseau) */}
            {typeof reseau.latitude === 'number' && typeof reseau.longitude === 'number' && (
              <section aria-labelledby="loc-reseau-titre">
                <h2 id="loc-reseau-titre" className="text-sm font-semibold text-[#18181b] mb-2 flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  Localisation
                </h2>
                <MiniMapLoader
                  latitude={reseau.latitude}
                  longitude={reseau.longitude}
                  zoom={12}
                  label={`Localisation du réseau ${reseau.nom}${reseau.ville ? ` à ${reseau.ville}` : ''}`}
                />
              </section>
            )}
          </div>

          {/* Maillage interne — autres chapitres du même national (seo-engineer — ADR-0012) */}
          {reseau.niveau === 'local' && parentDoc && (
            <MaillageReseau
              excludeId={reseau.id}
              nationalId={parentDoc.id}
              nationalSlug={parentDoc.slug}
              nationalNom={parentDoc.nom}
            />
          )}

          {/* Pied de fiche */}
          <div className="px-6 py-5 border-t border-[#e4e4e7] bg-[#faf9f5] flex flex-wrap gap-4 justify-between items-center">
            <Link
              href="/reseaux"
              className="text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] no-underline transition-colors"
            >
              ← Tous les réseaux
            </Link>
            {reseau.partenaire && (
              <span className="text-xs text-[#71717a]">
                Réseau partenaire{' '}
                <Link href="/partenaires" className="text-[#f5851f] hover:text-[#e07710] no-underline font-medium transition-colors">
                  RÉSEAUTEURS
                </Link>
              </span>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
