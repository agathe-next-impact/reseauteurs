/**
 * Fiche réseau SSR/ISR — /reseau/<slug>
 * Compteurs : nb réseauteurs / nb événements (dérivés, stockés en DB).
 * Badge partenaire si reseau.partenaire.
 * JSON-LD Organization : injecté par seo-engineer.
 */
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Users, Calendar, ArrowRight, MapPin, Network, User, FileText, ExternalLink } from 'lucide-react'
import { ContactCTA } from '@/components/fiche/ContactCTA'
import { buildMetadata, applySeoOverrides } from '@/lib/seo'
import { buildReseauOrganizationJsonLd, buildBreadcrumbListJsonLd, type ReseauLocalLite } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { MaillageReseau } from '@/components/seo/MaillageReseau'
import { BadgePartenaire, BadgeReseauteur } from '@/components/ui/BadgeReseauteur'
import MiniMapLoader from '@/components/maps/MiniMapLoader'
import { SITE_NAME } from '@/lib/site'
import Reveal from '@/components/home/Reveal'
import BarMini, { type BarDatum } from '@/components/home/BarMini'
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

const getReseau = cache(async (slug: string): Promise<Reseau | null> => {
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
})

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
  const parentBrut =
    typeof reseau.parent === 'object' && reseau.parent !== null
      ? (reseau.parent as Reseau)
      : null
  // ADR-0014 : liens (fil d'Ariane, en-tête, maillage) uniquement vers une tête
  // PUBLIÉE — une tête suspendue (abonnement expiré) renverrait un 404 public.
  const parentDoc = parentBrut && parentBrut.statut === 'publiee' ? parentBrut : null

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
    // Locaux d'une tête (non-local) — JSON-LD subOrganization + compteurs agrégés SSR (Q7)
    reseau.niveau !== 'local'
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

  // ── Fiche complète (spec 2026-07-13) : médias, responsable, fonctionnement, réseaux sociaux
  const mediaUrl = (m: unknown, size: 'thumbnail' | 'card' | 'full' = 'card'): string | null => {
    if (!m || typeof m !== 'object') return null
    const mm = m as Media
    return mm.sizes?.[size]?.url ?? mm.url ?? null
  }
  const respPhotoUrl = mediaUrl(reseau.responsablePhoto, 'thumbnail')
  const illustrations = (reseau.illustrations ?? [])
    .map((i) => mediaUrl(i?.image, 'card'))
    .filter((u): u is string => Boolean(u))
  const socials = (reseau.reseauxSociaux ?? []).filter(
    (s): s is { plateforme: string; url: string } => Boolean(s?.plateforme && s?.url),
  )
  const ouiNon = (v: 'oui' | 'non' | null | undefined): string | null =>
    v === 'oui' ? 'Oui' : v === 'non' ? 'Non' : null
  const TYPE_JURIDIQUE_LABEL: Record<string, string> = {
    association: 'Association', prive: 'Privé / société', franchise: 'Franchise', institution: 'Institution', autre: 'Autre',
  }
  const NIVEAU_LABEL: Record<string, string> = {
    local: 'Local', regional: 'Régional', national: 'National', international: 'International',
  }
  // Table « Fonctionnement » : uniquement les lignes renseignées.
  const fonctionnementRows: Array<{ label: string; value: string }> = [
    reseau.publicConcerne ? { label: 'Public concerné', value: reseau.publicConcerne } : null,
    reseau.typeJuridique ? { label: 'Type de structure', value: TYPE_JURIDIQUE_LABEL[reseau.typeJuridique] ?? reseau.typeJuridique } : null,
    reseau.niveau ? { label: 'Échelle', value: NIVEAU_LABEL[reseau.niveau] ?? reseau.niveau } : null,
    // ADR-0014 : un local est affilié à une tête ou indépendant
    reseau.niveau === 'local'
      ? { label: 'Rattachement', value: parentBrut ? parentBrut.nom : 'Réseau indépendant' }
      : null,
    ouiNon(reseau.ouvertATous) ? { label: 'Ouvert à tous', value: ouiNon(reseau.ouvertATous)! } : null,
    ouiNon(reseau.participationInvite) ? { label: 'Participation en invité', value: ouiNon(reseau.participationInvite)! } : null,
    ouiNon(reseau.adhesionObligatoire) ? { label: 'Adhésion obligatoire', value: ouiNon(reseau.adhesionObligatoire)! } : null,
    ouiNon(reseau.uneProfessionParGroupe) ? { label: 'Une profession par groupe', value: ouiNon(reseau.uneProfessionParGroupe)! } : null,
    typeof reseau.nombreMembres === 'number' ? { label: 'Membres (déclaré)', value: String(reseau.nombreMembres) } : null,
    reseau.cotisation ? { label: 'Cotisation', value: reseau.cotisation } : null,
  ].filter((r): r is { label: string; value: string } => r !== null)
  // ID vidéo YouTube (watch / youtu.be / embed)
  const ytId = (() => {
    const raw = reseau.videoYoutube
    if (!raw) return null
    const m = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
    return m?.[1] ?? null
  })()
  let plaquetteSafe: string | null = null
  if (reseau.plaquetteUrl) {
    try {
      const u = new URL(reseau.plaquetteUrl)
      if (u.protocol === 'https:' || u.protocol === 'http:') plaquetteSafe = reseau.plaquetteUrl
    } catch { /* ignore */ }
  }

  const reseauteursDocs = reseauteurs as Reseauteur[]
  const evenementsDocs = evenements as Evenement[]
  const locauxDocs = locauxRes?.docs as ReseauLocalLite[] | undefined

  // Compteurs agrégés SSR pour un national (Q7 ADR-0012)
  const isNational = reseau.niveau !== 'local'
  const aggNbReseauteurs = isNational
    ? (locauxDocs ?? []).reduce((sum, l) => sum + ((l as unknown as Reseau).nbReseauteurs ?? 0), 0)
    : (reseau.nbReseauteurs ?? 0)
  const aggNbEvenements = isNational
    ? (locauxDocs ?? []).reduce((sum, l) => sum + ((l as unknown as Reseau).nbEvenements ?? 0), 0)
    : (reseau.nbEvenements ?? 0)

  // Chart « groupes locaux » — uniquement si données réelles (nbReseauteurs par groupe).
  const groupesBars: BarDatum[] = (locauxDocs ?? [])
    .map((l) => ({ label: l.nom, value: (l as unknown as Reseau).nbReseauteurs ?? 0 }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

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
    <div className="rsn-page">
      {/* Données structurées JSON-LD (seo-engineer) */}
      <JsonLd
        data={[
          buildReseauOrganizationJsonLd(reseau, locauxDocs),
          buildBreadcrumbListJsonLd(breadcrumbItems),
        ]}
      />

      {/* Héros de fiche — fond de marque navy (même token que PageHeader) */}
      <section className="rsn-pagehead" data-tone="navy">
        <div className="rsn-pagehead-inner">
          {/* Fil d'Ariane */}
          <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-white/60 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white no-underline transition-colors">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/reseaux" className="hover:text-white no-underline transition-colors">Réseaux</Link>
            {parentDoc && (
              <>
                <span aria-hidden>/</span>
                <Link
                  href={`/reseau/${parentDoc.slug ?? ''}`}
                  className="hover:text-white no-underline transition-colors"
                >
                  {parentDoc.nom}
                </Link>
              </>
            )}
            <span aria-hidden>/</span>
            <span className="text-white/80" aria-current="page">{reseau.nom}</span>
          </nav>

          <Reveal>
            <p className="rsn-eyebrow" style={{ color: '#fdba74' }}>Réseau d&apos;affaires</p>

            <div className="flex items-start gap-5 mt-3.5">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`Logo ${reseau.nom}`}
                  width={88}
                  height={88}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain border border-white/15 shrink-0 bg-white p-1"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center text-white font-extrabold text-xl border border-white/15 shrink-0">
                  <Network size={24} aria-hidden />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="rsn-pagehead-title !mt-0 !text-[28px] sm:!text-[38px]">{reseau.nom}</h1>
                  {reseau.partenaire && <BadgePartenaire />}
                </div>
                {(reseau.ville || reseau.departement || reseau.region) && (
                  <p className="text-sm text-white/65 flex items-center gap-1.5 mt-1.5">
                    <MapPin size={13} aria-hidden />
                    {[reseau.ville, reseau.departement, reseau.region].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {reseau.niveau && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/85 border border-white/15">
                      {NIVEAU_LABEL[reseau.niveau] ?? reseau.niveau}
                    </span>
                  )}
                  {reseau.typeJuridique && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/85 border border-white/15">
                      {TYPE_JURIDIQUE_LABEL[reseau.typeJuridique] ?? reseau.typeJuridique}
                    </span>
                  )}
                </div>
                {/* Compteurs — agrégés pour un national, directs pour un local */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-sm text-white/80">
                    <Users size={14} className="text-[#93c5fd]" aria-hidden />
                    <strong className="font-semibold text-white">{aggNbReseauteurs}</strong>
                    <span>réseauteur{aggNbReseauteurs > 1 ? 's' : ''}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-white/80">
                    <Calendar size={14} className="text-[#7dd3fc]" aria-hidden />
                    <strong className="font-semibold text-white">{aggNbEvenements}</strong>
                    <span>événement{aggNbEvenements > 1 ? 's' : ''}</span>
                  </span>
                  {isNational && (locauxDocs?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5 text-sm text-white/80">
                      <Network size={14} className="text-[#d8b4fe]" aria-hidden />
                      <strong className="font-semibold text-white">{locauxDocs!.length}</strong>
                      <span>groupe{(locauxDocs?.length ?? 0) > 1 ? 's' : ''}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="rsn-card rsn-lift rounded-2xl overflow-hidden">
          {/* Corps */}
          <div className="px-6 py-6 space-y-8">
            {/* Description */}
            {reseau.description && (
              <Reveal>
                <section aria-labelledby="desc-reseau-titre">
                  <h2 id="desc-reseau-titre" className="text-sm font-semibold text-[#18181b] mb-2">À propos</h2>
                  <p className="text-sm text-[#52525b] leading-relaxed">{reseau.description}</p>
                </section>
              </Reveal>
            )}

            {/* Présentation détaillée */}
            {reseau.presentation && (
              <Reveal>
                <section aria-labelledby="pres-reseau-titre">
                  <h2 id="pres-reseau-titre" className="text-sm font-semibold text-[#18181b] mb-2">Présentation</h2>
                  <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{reseau.presentation}</p>
                </section>
              </Reveal>
            )}

            {/* Objectif */}
            {reseau.objectif && (
              <Reveal>
                <section aria-labelledby="objectif-titre">
                  <h2 id="objectif-titre" className="text-sm font-semibold text-[#18181b] mb-2">Objectif du réseau</h2>
                  <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{reseau.objectif}</p>
                </section>
              </Reveal>
            )}

            {/* Ce qui le différencie */}
            {reseau.differenciateur && (
              <Reveal>
                <section aria-labelledby="diff-titre">
                  <h2 id="diff-titre" className="text-sm font-semibold text-[#18181b] mb-2">Ce qui le différencie</h2>
                  <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{reseau.differenciateur}</p>
                </section>
              </Reveal>
            )}

            {/* Fonctionnement (fiche descriptive) */}
            {fonctionnementRows.length > 0 && (
              <Reveal>
                <section aria-labelledby="fonctionnement-titre">
                  <h2 id="fonctionnement-titre" className="text-sm font-semibold text-[#18181b] mb-3">Fonctionnement</h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {fonctionnementRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 border-b border-[#f4f4f5] py-1.5">
                        <dt className="text-xs text-[#71717a]">{row.label}</dt>
                        <dd className="text-xs font-semibold text-[#18181b] text-right">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </Reveal>
            )}

            {/* Galerie photos */}
            {illustrations.length > 0 && (
              <Reveal>
                <section aria-labelledby="galerie-titre">
                  <h2 id="galerie-titre" className="text-sm font-semibold text-[#18181b] mb-3">En images</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {illustrations.map((url, i) => (
                      <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#e4e4e7]">
                        <Image src={url} alt={`Photo ${i + 1} du réseau ${reseau.nom}`} fill className="object-cover" sizes="(max-width: 640px) 50vw, 240px" />
                      </div>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Vidéo de présentation */}
            {ytId && (
              <Reveal>
                <section aria-labelledby="video-titre">
                  <h2 id="video-titre" className="text-sm font-semibold text-[#18181b] mb-3">Vidéo de présentation</h2>
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-[#e4e4e7] bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                      title={`Vidéo de présentation du réseau ${reseau.nom}`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </section>
              </Reveal>
            )}

            {/* Groupes locaux — classement par nombre de réseauteurs (données réelles) */}
            {isNational && groupesBars.length > 1 && (
              <Reveal>
                <div className="rsn-panel rounded-xl">
                  <div className="rsn-panel-head">
                    <h2 className="rsn-panel-title">Groupes les plus suivis</h2>
                    <span className="rsn-tag">par réseauteurs</span>
                  </div>
                  <div className="rsn-panel-body">
                    <BarMini bars={groupesBars} height={180} color="#a855f7" valueSuffix=" membres" />
                  </div>
                </div>
              </Reveal>
            )}

            {/* Réseauteurs membres */}
            {reseauteursDocs.length > 0 && (
              <Reveal>
                <section aria-labelledby="membres-titre">
                  <div className="flex items-center justify-between mb-3">
                    <h2 id="membres-titre" className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
                      <Users size={14} aria-hidden />
                      Réseauteurs membres
                    </h2>
                    {(reseau.nbReseauteurs ?? 0) > 12 && (
                      <Link
                        href={`/reseauteurs?reseau=${reseau.slug}`}
                        className="rsn-linkrow text-xs text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
                      >
                        Voir tous ({reseau.nbReseauteurs})
                        <ArrowRight size={12} aria-hidden className="rsn-arrow inline-block ml-0.5" />
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
                          className="rsn-lift flex items-center gap-3 p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#2563EB]/40 transition-colors no-underline group"
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
                </section>
              </Reveal>
            )}

            {reseauteursDocs.length === 0 && (
              <Reveal>
                <div className="py-4 text-center bg-[#faf9f5] rounded-xl border border-dashed border-[#e4e4e7]">
                  <p className="text-sm text-[#71717a] mb-2">Aucun réseauteur dans ce réseau pour l&apos;instant.</p>
                  <Link href="/inscription" className="rsn-linkrow text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] no-underline transition-colors">
                    Créer mon profil et rejoindre ce réseau
                    <ArrowRight size={13} aria-hidden className="rsn-arrow inline-block ml-1" />
                  </Link>
                </div>
              </Reveal>
            )}

            {/* Événements */}
            {evenementsDocs.length > 0 && (
              <Reveal>
                <section aria-labelledby="events-titre">
                  <div className="flex items-center justify-between mb-3">
                    <h2 id="events-titre" className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
                      <Calendar size={14} aria-hidden />
                      Prochains événements
                    </h2>
                    {(reseau.nbEvenements ?? 0) > 6 && (
                      <Link
                        href={`/evenements?reseau=${reseau.slug}`}
                        className="rsn-linkrow text-xs text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
                      >
                        Voir tous ({reseau.nbEvenements})
                        <ArrowRight size={12} aria-hidden className="rsn-arrow inline-block ml-0.5" />
                      </Link>
                    )}
                  </div>
                  <div className="space-y-2" role="list" aria-label="Événements du réseau">
                    {evenementsDocs.map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/evenement/${ev.slug}`}
                        role="listitem"
                        className="rsn-lift flex items-center gap-3 p-3 rounded-xl border border-[#e4e4e7] hover:border-[#2563EB]/40 transition-colors no-underline group"
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
                        <ArrowRight size={13} className="text-[#a1a1aa] group-hover:text-[#2563EB] transition-colors shrink-0 rsn-arrow" aria-hidden />
                      </Link>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

              {/* Groupes locaux (uniquement pour un national — ADR-0012) */}
            {isNational && locauxDocs && locauxDocs.length > 0 && (
              <Reveal>
                <section aria-labelledby="locaux-titre">
                  <div className="flex items-center justify-between mb-3">
                    <h2 id="locaux-titre" className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
                      <Network size={14} className="text-[#a855f7]" aria-hidden />
                      Groupes locaux
                      <span className="text-[#a1a1aa] font-normal">({locauxDocs.length})</span>
                    </h2>
                    {locauxDocs.length > 8 && (
                      <Link
                        href={`/reseaux?vue=carte`}
                        className="rsn-linkrow text-xs text-[#a855f7] hover:text-[#9333ea] no-underline font-medium transition-colors"
                      >
                        Voir sur la carte
                        <ArrowRight size={12} aria-hidden className="rsn-arrow inline-block ml-0.5" />
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list" aria-label="Groupes locaux">
                    {(locauxDocs as ReseauLocalLite[]).slice(0, 8).map((local) => (
                      <Link
                        key={local.id}
                        href={`/reseau/${local.slug ?? ''}`}
                        role="listitem"
                        className="rsn-lift flex items-center gap-2 p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#a855f7]/40 transition-colors no-underline group"
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
                      et {locauxDocs.length - 8} autre{locauxDocs.length - 8 > 1 ? 's' : ''} groupe{locauxDocs.length - 8 > 1 ? 's' : ''}
                    </p>
                  )}
                </section>
              </Reveal>
            )}

          {/* CTA prendre contact — email + téléphone + site web */}
            <Reveal>
              <ContactCTA
                email={reseau.emailContact}
                telephone={reseau.telephone}
                site={reseau.siteWeb}
                entityName={reseau.nom}
              />
            </Reveal>

          {/* Contact & responsable local — détails complémentaires (responsable, plaquette, réseaux sociaux) */}
            {(reseau.responsableNom || socials.length > 0 || plaquetteSafe) && (
              <Reveal>
                <section aria-labelledby="contact-titre">
                  <h2 id="contact-titre" className="text-sm font-semibold text-[#18181b] mb-3">Responsable &amp; ressources</h2>

                  {reseau.responsableNom && (
                    <div className="flex items-center gap-3 mb-3 p-3 rounded-xl border border-[#e4e4e7]">
                      {respPhotoUrl ? (
                        <Image src={respPhotoUrl} alt={`Photo de ${reseau.responsableNom}`} width={44} height={44} className="w-11 h-11 rounded-full object-cover border border-[#e4e4e7] shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563EB] shrink-0" aria-hidden>
                          <User size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#18181b] truncate">{reseau.responsableNom}</p>
                        {reseau.responsableFonction && <p className="text-xs text-[#71717a] truncate">{reseau.responsableFonction}</p>}
                        <p className="text-[11px] text-[#a1a1aa]">Responsable local</p>
                      </div>
                    </div>
                  )}

                  {plaquetteSafe && (
                    <div className="flex flex-wrap gap-2">
                      <a href={plaquetteSafe} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] no-underline transition-colors">
                        <FileText size={13} aria-hidden />Plaquette PDF
                      </a>
                    </div>
                  )}

                  {socials.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2" aria-label="Réseaux sociaux">
                      {socials.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e4e4e7] text-sm text-[#52525b] hover:border-[#2563EB] hover:text-[#2563EB] no-underline transition-colors capitalize">
                          <ExternalLink size={13} aria-hidden />{s.plateforme}
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              </Reveal>
            )}

          {/* Localisation — mini-carte (siège du réseau) */}
            {typeof reseau.latitude === 'number' && typeof reseau.longitude === 'number' && (
              <Reveal>
                <section aria-labelledby="loc-reseau-titre">
                  <h2 id="loc-reseau-titre" className="text-sm font-semibold text-[#18181b] mb-2 flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden />
                    Localisation
                  </h2>
                  {(reseau.adresse || reseau.codePostal) && (
                    <p className="text-xs text-[#71717a] mb-2">
                      {[reseau.adresse, [reseau.codePostal, reseau.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <MiniMapLoader
                    latitude={reseau.latitude}
                    longitude={reseau.longitude}
                    zoom={12}
                    label={`Localisation du réseau ${reseau.nom}${reseau.ville ? ` à ${reseau.ville}` : ''}`}
                  />
                </section>
              </Reveal>
            )}
          </div>

          {/* Maillage interne — autres groupes du même national (seo-engineer — ADR-0012) */}
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
              className="rsn-linkrow text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] no-underline transition-colors"
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
          {/* Ligne de validation (dernière mise à jour + auteur de la fiche) */}
          {(reseau.updatedAt || reseau.rempliPar) && (
            <div className="px-6 py-2.5 border-t border-[#e4e4e7] bg-white text-[11px] text-[#a1a1aa] flex flex-wrap gap-x-3 gap-y-0.5">
              {reseau.updatedAt && (
                <span>Mis à jour le {new Date(reseau.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              )}
              {reseau.rempliPar && <span>· Fiche renseignée par {reseau.rempliPar}</span>}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
