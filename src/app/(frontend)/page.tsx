/**
 * Page d'accueil RÉSEAUTEURS — modèle 3 entités (ADR-0011).
 * Objectif : comprise en < 30 s par un nouvel arrivant (CLAUDE.md §10, DESIGN.md §5).
 *
 * Structure « bento » inspirée d'un tableau de bord SaaS (grille de cellules
 * bordées, charts, micro-interactions) portée sur les tokens RÉSEAUTEURS :
 *   Hero + tableau de bord → Bandeau réseaux (marquee) → Bande d'accès →
 *   Trois piliers → Vue d'ensemble (donut badges) → Classement réseaux (bars) →
 *   Comment ça fonctionne → Chiffres clés (compteurs + courbe) →
 *   Couverture nationale → Partenaires → Newsletter.
 */
import Link from 'next/link'
import Image from 'next/image'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import {
  ArrowRight,
  Users,
  Calendar,
  Network,
  MapPin,
  Star,
  Building2,
  Search,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react'
import { withDbRetry } from '@/lib/db-retry'
import { buildMetadata } from '@/lib/seo'
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/site'
import Reveal from '@/components/home/Reveal'
import CountUp from '@/components/home/CountUp'
import DonutChart, { type DonutSegment } from '@/components/home/DonutChart'
import DonutWithLegend from '@/components/home/DonutWithLegend'
import BarMini, { type BarDatum } from '@/components/home/BarMini'
import TrendArea from '@/components/home/TrendArea'
import type { Metadata } from 'next'
import type { Media, Reseau, Partenaire } from '@/types/reseauteurs-domain'

export const revalidate = 300 // ISR 5 min

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  path: '/',
  keywords: [
    'networking',
    'réseauteurs',
    'événements business',
    "réseaux d'affaires",
    'BNI',
    'DCF',
    'CJD',
    'plateforme networking France',
  ],
})

// Noms de réseaux connus (amorçage avant que la DB soit peuplée)
const RESEAUX_CONNUS = [
  'BNI',
  'DCF',
  'CJD',
  'Dynabuy',
  'CPME',
  'Rotary',
  'Medef',
  'Réseau Entreprendre',
  'Lions Club',
  'Initiative France',
]

// Palette de charts (tokens marque : bleu → ciel → orange → violet → vert → jaune)
const CHART_COLORS = ['#2563EB', '#0284c7', '#f5851f', '#a855f7', '#22c55e', '#eab308']

const BADGE_META = [
  { key: 'bronze', label: 'Bronze', color: '#b45309' },
  { key: 'argent', label: 'Argent', color: '#71717a' },
  { key: 'gold', label: 'Gold', color: '#f5851f' },
  { key: 'platinum', label: 'Platinum', color: '#2563EB' },
] as const

type TopReseau = { nom: string; slug?: string | null; nbReseauteurs: number; nbEvenements: number }

/** Série de croissance déterministe (aucun Math.random → pas de mismatch SSR). */
function buildGrowthSeries(total: number): number[] {
  if (total <= 0) return [4, 9, 15, 22, 31, 42]
  const factors = [0.32, 0.45, 0.58, 0.71, 0.85, 1]
  return factors.map((f) => Math.max(1, Math.round(total * f)))
}

export default async function HomePage() {
  const payload = await getPayload({ config })

  const badgeWhere = (badge: string): Where => ({
    and: [{ statut: { equals: 'valide' } }, { badge: { equals: badge } }],
  })

  const [
    { totalDocs: reseauteurCount },
    { totalDocs: evenementCount },
    { totalDocs: reseauCount },
    { docs: reseauxPartenaires },
    { docs: partenaires },
    { docs: topReseauxDocs },
    { totalDocs: bronzeCount },
    { totalDocs: argentCount },
    { totalDocs: goldCount },
    { totalDocs: platinumCount },
  ] = await Promise.all([
    withDbRetry(
      () =>
        payload.count({
          collection: 'reseauteurs',
          where: { statut: { equals: 'valide' } },
          overrideAccess: true,
        }),
      { label: 'home:count reseauteurs' },
    ),
    withDbRetry(
      () =>
        payload.count({
          collection: 'evenements',
          where: { statut: { equals: 'publie' } },
          overrideAccess: true,
        }),
      { label: 'home:count evenements' },
    ),
    withDbRetry(
      () =>
        payload.count({
          collection: 'reseaux',
          where: { statut: { equals: 'publiee' } },
          overrideAccess: true,
        }),
      { label: 'home:count reseaux' },
    ),
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: { and: [{ statut: { equals: 'publiee' } }, { partenaire: { equals: true } }] },
          select: { nom: true, logo: true, slug: true } as Record<string, boolean>,
          depth: 1,
          limit: 10,
          overrideAccess: true,
        }),
      { label: 'home:find reseaux partenaires' },
    ),
    withDbRetry(
      () =>
        payload.find({
          collection: 'partenaires',
          where: { statut: { equals: 'actif' } },
          select: { nom: true, logo: true, lien: true, description: true } as Record<
            string,
            boolean
          >,
          depth: 1,
          limit: 12,
          overrideAccess: true,
        }),
      { label: 'home:find partenaires' },
    ),
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: { statut: { equals: 'publiee' } },
          select: { nom: true, slug: true, nbReseauteurs: true, nbEvenements: true } as Record<
            string,
            boolean
          >,
          sort: '-nbReseauteurs',
          depth: 0,
          limit: 6,
          overrideAccess: true,
        }),
      { label: 'home:find top reseaux' },
    ),
    withDbRetry(
      () => payload.count({ collection: 'reseauteurs', where: badgeWhere('bronze'), overrideAccess: true }),
      { label: 'home:count bronze' },
    ),
    withDbRetry(
      () => payload.count({ collection: 'reseauteurs', where: badgeWhere('argent'), overrideAccess: true }),
      { label: 'home:count argent' },
    ),
    withDbRetry(
      () => payload.count({ collection: 'reseauteurs', where: badgeWhere('gold'), overrideAccess: true }),
      { label: 'home:count gold' },
    ),
    withDbRetry(
      () => payload.count({ collection: 'reseauteurs', where: badgeWhere('platinum'), overrideAccess: true }),
      { label: 'home:count platinum' },
    ),
  ])

  const reseauxBandeau = reseauxPartenaires as Reseau[]
  const partenairesActifs = partenaires as Partenaire[]
  const topReseaux = (topReseauxDocs as Reseau[]).map((r) => ({
    nom: r.nom,
    slug: r.slug,
    nbReseauteurs: r.nbReseauteurs ?? 0,
    nbEvenements: r.nbEvenements ?? 0,
  })) as TopReseau[]

  const totalReseauteursLabel =
    reseauteurCount > 0 ? reseauteurCount.toLocaleString('fr-FR') : 'Aperçu'

  // ── Donut « adhésions par réseau » (hero) ──────────────────────────
  const reseauxAvecMembres = topReseaux.filter((r) => r.nbReseauteurs > 0)
  const reseauSegmentsPreview = reseauxAvecMembres.length === 0
  const reseauSegments: DonutSegment[] = reseauSegmentsPreview
    ? [38, 29, 22, 16, 11].map((value, i) => ({
        label: RESEAUX_CONNUS[i],
        value,
        color: CHART_COLORS[i],
      }))
    : reseauxAvecMembres.slice(0, 6).map((r, i) => ({
        label: r.nom,
        value: r.nbReseauteurs,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))

  // ── Donut « réseauteurs par badge » (flagship) ─────────────────────
  const badgeCounts = [bronzeCount, argentCount, goldCount, platinumCount]
  const badgeTotal = badgeCounts.reduce((s, n) => s + n, 0)
  const badgePreview = badgeTotal === 0
  const badgeValues = badgePreview ? [14, 21, 9, 5] : badgeCounts
  const badgeSegments: DonutSegment[] = BADGE_META.map((b, i) => ({
    label: b.label,
    value: badgeValues[i],
    color: b.color,
  }))
  const badgeSum = badgeValues.reduce((s, n) => s + n, 0)

  // ── Bars « classement des réseaux » ────────────────────────────────
  const reseauxBarsSource = reseauxAvecMembres.length > 0 ? reseauxAvecMembres : []
  const reseauBarsPreview = reseauxBarsSource.length === 0
  const reseauBars: BarDatum[] = reseauBarsPreview
    ? RESEAUX_CONNUS.slice(0, 6).map((nom, i) => ({
        label: nom,
        value: [42, 34, 27, 19, 13, 8][i],
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : reseauxBarsSource.slice(0, 6).map((r, i) => ({
        label: r.nom,
        value: r.nbReseauteurs,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))

  // ── Courbe de croissance ───────────────────────────────────────────
  const growthSeries = buildGrowthSeries(reseauteurCount)

  // ── Bandeau réseaux (partenaires réels complétés par les noms connus) ─
  const bandeauReels = reseauxBandeau.map((r) => ({
    key: `r-${r.id}`,
    nom: r.nom,
    slug: r.slug,
    logo: (r.logo as Media | null | undefined) ?? null,
  }))
  const nomsPresents = new Set(bandeauReels.map((r) => r.nom))
  const bandeauFallback = RESEAUX_CONNUS.filter((n) => !nomsPresents.has(n)).map((nom) => ({
    key: `f-${nom}`,
    nom,
    slug: null as string | null,
    logo: null as Media | null,
  }))
  const bandeauItems = [...bandeauReels, ...bandeauFallback].slice(0, 12)
  const marqueeItems = [...bandeauItems, ...bandeauItems] // boucle sans couture

  const heroTiles = [
    { icon: Users, label: 'Réseauteurs', value: reseauteurCount, delta: 'gratuit' },
    { icon: Calendar, label: 'Événements', value: evenementCount, delta: 'à venir' },
    { icon: Network, label: 'Réseaux', value: reseauCount, delta: 'référencés' },
  ]

  return (
    <div className="ir-atlas-page">
      {/* ─── HERO + TABLEAU DE BORD ───────────────────────────── */}
      <section className="ir-atlas-hero" aria-labelledby="home-hero-title">
        <div className="ir-atlas-hero-inner">
          <div className="ir-atlas-hero-copy">
            <p className="ir-atlas-eyebrow">
              <Star size={12} aria-hidden />
              La plateforme nationale du networking
            </p>

            <h1 id="home-hero-title" className="ir-atlas-title">
              Tous les pros, tous les événements,
              <span>tous les réseaux.</span>
            </h1>

            <p className="ir-atlas-lead">
              {SITE_NAME} ne remplace aucun réseau — il les rassemble. Trouvez les professionnels
              qui réseautent près de chez vous, leurs événements et leurs réseaux, au même endroit.
            </p>

            <div className="ir-atlas-actions">
              <Link href="/carte/reseauteurs" className="ir-atlas-primary rsn-linkrow">
                <MapPin size={16} aria-hidden />
                Explorer la carte des réseauteurs
              </Link>
              <Link href="/carte/evenements" className="ir-atlas-secondary rsn-linkrow">
                <Calendar size={16} aria-hidden />
                Voir les événements
                <ArrowRight size={14} aria-hidden className="rsn-arrow" />
              </Link>
            </div>

            <p className="ir-atlas-microcopy">
              Inscription gratuite · Aucune carte bancaire requise · Visible sur la carte
              immédiatement
            </p>
          </div>

          <div className="rsn-hero-dash-wrap">
            <Reveal>
              <div className="rsn-hero-dash">
                <div className="rsn-hero-dash-bar">
                  <span>Tableau de bord national</span>
                  <span className="rsn-live">Live</span>
                </div>
                <div className="rsn-hero-dash-body">
                  <div className="rsn-hero-dash-main">
                    <div className="rsn-hd-cell">
                      <p className="rsn-hd-cell-title">Adhésions par réseau</p>
                      <div className="rsn-hd-donut">
                        <DonutChart
                          segments={reseauSegments}
                          size={188}
                          thickness={22}
                          centerValue={totalReseauteursLabel}
                          centerLabel="réseauteurs"
                        />
                      </div>
                    </div>
                    <div className="rsn-hd-trend">
                      <p className="rsn-hd-cell-title">Croissance de la communauté</p>
                      <TrendArea data={growthSeries} height={88} color="#38bdf8" showDots />
                    </div>
                  </div>
                  <div className="rsn-hero-dash-side">
                    {heroTiles.map(({ icon: Icon, label, value, delta }) => (
                      <div key={label} className="rsn-hd-tile">
                        <span className="rsn-hd-tile-top">
                          <Icon size={12} aria-hidden />
                          {label}
                        </span>
                        <span className="rsn-hd-tile-val">
                          {value > 0 ? <CountUp value={value} suffix="+" /> : '—'}
                        </span>
                        <span className="rsn-hd-delta">
                          <TrendingUp size={11} aria-hidden />
                          {delta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── BANDEAU RÉSEAUX (marquee — « on les rassemble ») ─── */}
      <section
        className="bg-white border-b border-[#e4e4e7] py-10"
        aria-label="Réseaux d'affaires référencés"
      >
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#71717a] mb-6">
          Tous les réseaux réunis
        </p>
        <div className="rsn-marquee-mask">
          <div className="rsn-marquee-track">
            {marqueeItems.map((item, idx) => {
              const logoUrl = item.logo?.sizes?.thumbnail?.url ?? item.logo?.url
              const inner = (
                <>
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={item.nom}
                      width={24}
                      height={24}
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <span className="rsn-chip-mark">{item.nom.charAt(0)}</span>
                  )}
                  <span>{item.nom}</span>
                </>
              )
              return item.slug ? (
                <Link
                  key={`${item.key}-${idx}`}
                  href={`/reseau/${item.slug}`}
                  className="rsn-chip"
                  aria-hidden={idx >= bandeauItems.length ? true : undefined}
                  tabIndex={idx >= bandeauItems.length ? -1 : undefined}
                  title={item.nom}
                >
                  {inner}
                </Link>
              ) : (
                <span
                  key={`${item.key}-${idx}`}
                  className="rsn-chip"
                  aria-hidden={idx >= bandeauItems.length ? true : undefined}
                >
                  {inner}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── BANDE D'ACCÈS (bento 4 colonnes) ─────────────────── */}
      <section aria-label="Ce que vous pouvez faire sur Réseauteurs">
        <div className="rsn-strip">
          {[
            {
              href: '/carte/reseauteurs',
              icon: Users,
              title: 'Carte des réseauteurs',
              desc: 'Repérez les pros qui réseautent près de chez vous, par métier et par réseau.',
            },
            {
              href: '/carte/evenements',
              icon: Calendar,
              title: 'Carte des événements',
              desc: 'Afterworks, petits-déjeuners, conférences — tous les rendez-vous business.',
            },
            {
              href: '/reseaux',
              icon: Network,
              title: 'Annuaire des réseaux',
              desc: 'BNI, DCF, CJD, Dynabuy… découvrez chaque réseau, ses membres et ses dates.',
            },
            {
              href: '/reseauteurs',
              icon: Search,
              title: 'Recherche par filtres',
              desc: 'Ville, secteur, réseau, badge : trouvez la bonne personne en quelques clics.',
            },
          ].map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href} className="rsn-strip-cell rsn-shine rsn-linkrow no-underline">
              <span className="rsn-strip-ico">
                <Icon size={20} aria-hidden />
              </span>
              <span className="rsn-strip-title">{title}</span>
              <span className="rsn-strip-desc">{desc}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] mt-1">
                Découvrir
                <ArrowRight size={14} aria-hidden className="rsn-arrow" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── TROIS PILIERS (le test des 30 s) ─────────────────── */}
      <section className="py-16 md:py-20" aria-labelledby="trois-piliers-titre">
        <div className="px-6">
          <Reveal>
            <div className="text-center mb-12">
              <p className="rsn-eyebrow justify-center">
                <Sparkles size={13} aria-hidden />
                Le cœur du modèle
              </p>
              <h2 id="trois-piliers-titre" className="rsn-h2 mx-auto">
                Trois entités, une plateforme
              </h2>
              <p className="rsn-sub mx-auto">
                Réseauteurs, événements, réseaux — tout ce que vous cherchez dans le networking
                professionnel, au même endroit.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: 'Réseauteurs',
                desc: 'Trouvez les professionnels qui réseautent près de chez vous. Entrepreneurs, dirigeants, indépendants — visibles sur la carte.',
                href: '/reseauteurs',
                cta: 'Voir les réseauteurs',
                color: '#2563EB',
                bg: 'bg-[#bfdbfe]/40',
              },
              {
                icon: Calendar,
                title: 'Événements',
                desc: 'Tous les événements business — afterworks, petits-déjeuners, conférences, réunions de réseaux — sur une seule carte.',
                href: '/evenements',
                cta: 'Voir les événements',
                color: '#0284c7',
                bg: 'bg-[#e0f2fe]/60',
              },
              {
                icon: Network,
                title: 'Réseaux',
                desc: "Découvrez tous les réseaux d'affaires (BNI, DCF, CJD, Dynabuy…), leurs membres, leurs événements et leurs spécialités.",
                href: '/reseaux',
                cta: 'Voir les réseaux',
                color: '#f5851f',
                bg: 'bg-[#ffedd5]/60',
              },
            ].map(({ icon: Icon, title, desc, href, cta, color, bg }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="bg-white border border-[#e4e4e7] p-6 flex flex-col gap-4 rsn-lift h-full">
                  <div
                    className={`w-12 h-12 ${bg} flex items-center justify-center`}
                    style={{ color }}
                  >
                    <Icon size={24} aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#16284f] mb-2">{title}</h3>
                    <p className="text-sm text-[#52525b] leading-relaxed">{desc}</p>
                  </div>
                  <div className="mt-auto pt-2">
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold no-underline rsn-linkrow"
                      style={{ color }}
                    >
                      {cta}
                      <ArrowRight size={14} aria-hidden className="rsn-arrow" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VUE D'ENSEMBLE (donut badges — style « gauge ») ──── */}
      <section className="bg-white border-y border-[#e4e4e7] py-16" aria-labelledby="apercu-titre">
        <div className="px-6">
        <Reveal>
          <div className="rsn-split">
            <div>
              <p className="rsn-eyebrow">
                <TrendingUp size={13} aria-hidden />
                Vue d&apos;ensemble
              </p>
              <h2 id="apercu-titre" className="rsn-h2">
                La communauté en un coup d&apos;œil
              </h2>
              <p className="rsn-sub">
                Chaque réseauteur affiche un badge selon son activité de networking : plus il
                fréquente d&apos;événements, plus son badge monte. Une communauté vivante, lisible
                d&apos;un regard.
              </p>

              <div className="rsn-kpis">
                <div className="rsn-kpi">
                  <span className="rsn-kpi-val">
                    {reseauteurCount > 0 ? <CountUp value={reseauteurCount} suffix="+" /> : '—'}
                  </span>
                  <span className="rsn-kpi-label">Réseauteurs inscrits</span>
                </div>
                <div className="rsn-kpi">
                  <span className="rsn-kpi-val">
                    {evenementCount > 0 ? <CountUp value={evenementCount} suffix="+" /> : '—'}
                  </span>
                  <span className="rsn-kpi-label">Événements référencés</span>
                </div>
                <div className="rsn-kpi">
                  <span className="rsn-kpi-val">
                    {reseauCount > 0 ? <CountUp value={reseauCount} suffix="+" /> : '—'}
                  </span>
                  <span className="rsn-kpi-label">Réseaux d&apos;affaires</span>
                </div>
                <div className="rsn-kpi">
                  <span className="rsn-kpi-val">
                    <CountUp value={4} />
                  </span>
                  <span className="rsn-kpi-label">Niveaux de badge</span>
                </div>
              </div>

              <div className="mt-8">
                <Link href="/inscription" className="ir-atlas-primary rsn-linkrow">
                  Créer mon profil — gratuit
                  <ArrowRight size={15} aria-hidden className="rsn-arrow" />
                </Link>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="rsn-panel-title">Réseauteurs par badge</span>
                <span className="rsn-tag">
                  <Award size={11} aria-hidden />
                  {badgePreview ? 'aperçu' : 'live'}
                </span>
              </div>
              <DonutWithLegend
                segments={badgeSegments}
                centerValue={
                  badgePreview ? 'Aperçu' : reseauteurCount.toLocaleString('fr-FR')
                }
                centerLabel="réseauteurs"
                total={badgeSum}
                size={216}
                thickness={26}
              />
            </div>
          </div>
        </Reveal>
        </div>
      </section>

      {/* ─── CLASSEMENT DES RÉSEAUX (bars) ────────────────────── */}
      <section className="py-16" aria-labelledby="classement-titre">
        <div className="px-6">
        <Reveal>
          <div className="rsn-panel">
            <div className="rsn-panel-head">
              <div>
                <h2 id="classement-titre" className="rsn-panel-title text-base">
                  Les réseaux les plus suivis
                </h2>
              </div>
              <span className="rsn-tag">
                {reseauBarsPreview ? 'aperçu' : 'par nombre de membres'}
              </span>
            </div>
            <div className="rsn-panel-body">
              <BarMini bars={reseauBars} height={210} valueSuffix=" membres" />
            </div>
          </div>
        </Reveal>
        </div>
      </section>

      {/* ─── COMMENT ÇA FONCTIONNE ────────────────────────────── */}
      <section className="bg-white border-y border-[#e4e4e7] py-16" aria-labelledby="comment-titre">
        <div className="px-6">
          <Reveal>
            <h2 id="comment-titre" className="rsn-h2 text-center mx-auto mb-12">
              Comment ça fonctionne
            </h2>
          </Reveal>
          <Reveal>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Créez votre profil gratuit',
                  desc: 'Renseignez votre prénom, nom, ville, métier et les réseaux que vous fréquentez. Gratuit, en moins de 2 minutes.',
                  color: '#2563EB',
                  bg: '#bfdbfe',
                },
                {
                  step: '2',
                  title: 'Apparaissez sur la carte',
                  desc: 'Votre profil est visible sur la carte des réseauteurs de votre ville. Les professionnels vous trouvent par métier, secteur ou réseau.',
                  color: '#0284c7',
                  bg: '#e0f2fe',
                },
                {
                  step: '3',
                  title: 'Trouvez et soyez trouvé',
                  desc: 'Explorez les profils, parcourez les événements de networking, et rejoignez les réseaux qui vous correspondent.',
                  color: '#f5851f',
                  bg: '#ffedd5',
                },
              ].map(({ step, title, desc, color, bg }) => (
                <li key={step} className="flex flex-col items-center text-center gap-4 list-none">
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-extrabold"
                    style={{ background: bg, color }}
                    aria-label={`Étape ${step}`}
                  >
                    {step}
                  </span>
                  <div>
                    <h3 className="font-bold text-[#16284f] mb-1.5">{title}</h3>
                    <p className="text-sm text-[#52525b] leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <div className="text-center mt-10">
            <Link href="/inscription" className="ir-atlas-primary rsn-linkrow">
              Créer mon profil — c&apos;est gratuit
              <ArrowRight size={16} aria-hidden className="rsn-arrow" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CHIFFRES CLÉS (bande sombre — compteurs + courbe) ── */}
      <section className="section-dark py-16" aria-labelledby="chiffres-titre">
        <div className="px-6">
          <Reveal>
            <h2 id="chiffres-titre" className="text-2xl sm:text-3xl font-bold text-[#fafafa] text-center mb-12">
              La plateforme nationale du networking
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-14">
            <DarkStat value={reseauteurCount} label="Réseauteurs" color="#93c5fd" />
            <DarkStat value={evenementCount} label="Événements" color="#c4b5fd" />
            <DarkStat value={reseauCount} label="Réseaux référencés" color="#fed7aa" />
            <DarkStat value={0} label="Villes couvertes" color="#86efac" placeholder="Bientôt" />
          </div>

          <Reveal>
            <div
              className="border border-white/10 p-6 sm:p-8"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#d4d4d8]">
                  Croissance de la communauté
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#86efac]">
                  <TrendingUp size={12} aria-hidden />
                  {reseauteurCount > 0 ? 'en progression' : 'aperçu'}
                </span>
              </div>
              <TrendArea data={growthSeries} height={150} color="#60a5fa" showDots />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── COUVERTURE NATIONALE (carte animée) ──────────────── */}
      <section className="py-16" aria-labelledby="couverture-titre">
        <div className="px-6">
        <Reveal>
          <div className="rsn-split">
            <div>
              <p className="rsn-eyebrow">
                <MapPin size={13} aria-hidden />
                Couverture nationale
              </p>
              <h2 id="couverture-titre" className="rsn-h2">
                Partout où l&apos;on réseaute en France
              </h2>
              <p className="rsn-sub">
                De Paris à Marseille, de Lyon à Lille : les réseauteurs, les événements et les
                réseaux se rejoignent sur deux cartes nationales. Cherchez par ville, département ou
                région — ou explorez autour de vous.
              </p>
              <div className="ir-atlas-actions mt-8">
                <Link href="/carte/reseauteurs" className="ir-atlas-primary rsn-linkrow">
                  <MapPin size={16} aria-hidden />
                  Ouvrir la carte
                </Link>
                <Link href="/reseaux" className="ir-atlas-secondary rsn-linkrow">
                  Parcourir les réseaux
                  <ArrowRight size={14} aria-hidden className="rsn-arrow" />
                </Link>
              </div>
            </div>
            <div className="ir-atlas-map-panel" aria-hidden="true">
              <div className="ir-atlas-map-toolbar">
                <span>Carte nationale</span>
                <span>Live</span>
              </div>
              <div className="ir-atlas-map-canvas">
                <span className="ir-atlas-map-node ir-atlas-map-node-a" />
                <span className="ir-atlas-map-node ir-atlas-map-node-b" />
                <span className="ir-atlas-map-node ir-atlas-map-node-c" />
                <span className="ir-atlas-map-node ir-atlas-map-node-d" />
                <span className="ir-atlas-route ir-atlas-route-a" />
                <span className="ir-atlas-route ir-atlas-route-b" />
                <span className="ir-atlas-route ir-atlas-route-c" />
              </div>
              <div className="ir-atlas-map-dock">
                <div>
                  <span>{reseauteurCount || 0}+</span>
                  <small>réseauteurs</small>
                </div>
                <div>
                  <span>{evenementCount || 0}+</span>
                  <small>événements</small>
                </div>
                <div>
                  <span>{reseauCount || 0}+</span>
                  <small>réseaux</small>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        </div>
      </section>

      {/* ─── BANDEAU PARTENAIRES (orange — B2B) ───────────────── */}
      <section
        className="py-16 bg-[#fff7ed] border-y border-[#fed7aa]"
        aria-labelledby="partenaires-titre"
      >
        <div className="px-6">
          <Reveal>
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#c2410c] mb-2">
                Nos partenaires
              </p>
              <h2 id="partenaires-titre" className="text-2xl font-bold text-[#16284f]">
                Ils soutiennent le networking français
              </h2>
            </div>
          </Reveal>

          {partenairesActifs.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {partenairesActifs.map((p) => {
                const logoMedia = p.logo as Media | null | undefined
                const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url
                const inner = logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={p.nom}
                    width={80}
                    height={40}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <span className="text-sm font-semibold text-[#c2410c]">{p.nom}</span>
                )
                return p.lien ? (
                  <a
                    key={p.id}
                    href={p.lien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 border border-[#fed7aa] bg-white rsn-lift no-underline"
                    title={p.nom}
                  >
                    {inner}
                  </a>
                ) : (
                  <span
                    key={p.id}
                    className="flex items-center gap-2 px-4 py-3 border border-[#fed7aa] bg-white"
                  >
                    {inner}
                  </span>
                )
              })}
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-[#71717a] mb-3">
              Vous représentez un réseau d&apos;affaires ou une entreprise ?
            </p>
            <Link href="/partenaires" className="ir-atlas-secondary rsn-linkrow" style={{ margin: '0 auto' }}>
              <Building2 size={16} aria-hidden />
              Devenez partenaire
              <ArrowRight size={14} aria-hidden className="rsn-arrow" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER ───────────────────────────────────────── */}
      <section className="py-16 bg-white border-b border-[#e4e4e7]" aria-labelledby="newsletter-titre">
        <div className="max-w-lg mx-auto px-6 text-center">
          <h2 id="newsletter-titre" className="text-xl font-bold text-[#16284f] mb-2">
            Restez informé
          </h2>
          <p className="text-sm text-[#52525b] mb-6">
            Nouveaux réseauteurs, événements à venir, actualités du networking près de chez vous.
          </p>
          {/* Newsletter à venir (décision produit 2026-06-29) — collecte non branchée,
              champ et bouton désactivés ; pas de <form> pour éviter toute soumission. */}
          <div
            className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto"
            aria-label="Inscription à la newsletter (bientôt disponible)"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Votre adresse email
            </label>
            <input
              id="newsletter-email"
              type="email"
              name="email"
              placeholder="votre@email.fr"
              disabled
              autoComplete="email"
              className="flex-1 px-4 py-2.5 border border-[#e4e4e7] text-sm bg-[#f4f4f5] text-[#a1a1aa] placeholder:text-[#a1a1aa] cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="px-5 py-2.5 bg-[#a1a1aa] text-white font-semibold text-sm cursor-not-allowed"
            >
              Bientôt disponible
            </button>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-3">
            Inscription à la newsletter bientôt disponible.
          </p>
        </div>
      </section>
    </div>
  )
}

/* ─── Compteur (bande sombre) — animé au scroll ─────────────────── */
function DarkStat({
  value,
  label,
  color,
  placeholder,
}: {
  value: number
  label: string
  color: string
  placeholder?: string
}) {
  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-extrabold mb-1" style={{ color }}>
        {placeholder ? placeholder : value > 0 ? <CountUp value={value} suffix="+" /> : '—'}
      </p>
      <p className="text-sm text-[#a1a1aa] font-medium">{label}</p>
    </div>
  )
}
