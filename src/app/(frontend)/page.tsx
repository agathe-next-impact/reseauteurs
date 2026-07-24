/**
 * Page d'accueil RÉSEAUTEURS — modèle 3 entités (ADR-0011).
 * Objectif : comprise en < 30 s par un nouvel arrivant (CLAUDE.md §10, DESIGN.md §5).
 *
 * Structure « bento » inspirée d'un tableau de bord SaaS (grille de cellules
 * bordées, charts, micro-interactions) portée sur les tokens RÉSEAUTEURS :
 *   Hero + tableau de bord → Partenaires (logos annonceurs) → Bandeau réseaux
 *   (marquee) → Bande d'accès → Avantages Réseauteur+ → Vue d'ensemble (donut
 *   badges) → Comment ça fonctionne → Chiffres clés (compteurs + courbe) → Newsletter.
 *
 * Retirées le 2026-07-23 (décision produit) : « Classement des réseaux » (bars),
 * « Couverture nationale » (carte animée), « Bandeau partenaires », puis
 * « Le cœur du modèle / Trois entités » — remplacée à sa place par la section
 * « Avantages Réseauteur+ ». Les requêtes qui ne servaient qu'à elles ont été
 * supprimées avec elles.
 */
import Link from 'next/link'
import Image from 'next/image'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { Users, Calendar, Network, Star, Search, TrendingUp, Award, Sparkles, Check, Mail } from 'lucide-react'
import { withDbRetry } from '@/lib/db-retry'
import { buildMetadata } from '@/lib/seo'
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/site'
import { PRIX_PLUS_HT } from '@/lib/tarifs'
import { AVANTAGES_GRATUIT, AVANTAGES_PLUS } from '@/lib/offres-reseauteur'
import CTAInscrireReseau from '@/components/cta/CTAInscrireReseau'
import Reveal from '@/components/home/Reveal'
import CountUp from '@/components/home/CountUp'
import DonutChart, { type DonutSegment } from '@/components/home/DonutChart'
import DonutWithLegend from '@/components/home/DonutWithLegend'
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

// Palette de charts — dérivée de la palette de marque
// (bleu profond → bleu médian → bleu clair → jaune → or foncé → gris)
const CHART_COLORS = ['#035AA6', '#3E7CA6', '#8BB4D9', '#F5E050', '#8A6D0B', '#999A9D']

const BADGE_META = [
  { key: 'bronze', label: 'Bronze', color: '#8A6D0B' },
  { key: 'argent', label: 'Argent', color: '#6E7175' },
  { key: 'gold', label: 'Gold', color: '#F5E050' },
  { key: 'platinum', label: 'Platinum', color: '#035AA6' },
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
    { docs: topReseauxDocs },
    { docs: partenairesDocs },
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
    // Partenaires annonceurs actifs — alimentent le bandeau sous le hero.
    withDbRetry(
      () =>
        payload.find({
          collection: 'partenaires',
          where: { statut: { equals: 'actif' } },
          select: { nom: true, logo: true, slug: true, lien: true } as Record<string, boolean>,
          depth: 1,
          limit: 12,
          sort: 'nom',
          overrideAccess: true,
        }),
      { label: 'home:find partenaires' },
    ),
    withDbRetry(
      () =>
        payload.count({
          collection: 'reseauteurs',
          where: badgeWhere('bronze'),
          overrideAccess: true,
        }),
      { label: 'home:count bronze' },
    ),
    withDbRetry(
      () =>
        payload.count({
          collection: 'reseauteurs',
          where: badgeWhere('argent'),
          overrideAccess: true,
        }),
      { label: 'home:count argent' },
    ),
    withDbRetry(
      () =>
        payload.count({
          collection: 'reseauteurs',
          where: badgeWhere('gold'),
          overrideAccess: true,
        }),
      { label: 'home:count gold' },
    ),
    withDbRetry(
      () =>
        payload.count({
          collection: 'reseauteurs',
          where: badgeWhere('platinum'),
          overrideAccess: true,
        }),
      { label: 'home:count platinum' },
    ),
  ])

  const reseauxBandeau = reseauxPartenaires as Reseau[]
  const partenairesActifs = partenairesDocs as Partenaire[]
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
                Explorer la carte des réseauteurs
              </Link>
              <Link href="/carte/evenements" className="ir-atlas-secondary rsn-linkrow">
                Voir les événements
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
                      <TrendArea data={growthSeries} height={88} color="#8BB4D9" showDots />
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

      {/* ─── PARTENAIRES (sous le hero — alimenté par les comptes annonceurs) ─── */}
      {/* Rendu uniquement s'il y a des partenaires actifs : un bandeau de logos
          vide juste sous le hero ferait « cassé ». Espacement des logos via
          `style={{ gap }}` : `.ir-atlas-page :where(.flex-wrap){gap:0}` neutralise
          les `gap-*` de Tailwind, mais un style inline l'emporte. */}
      {partenairesActifs.length > 0 && (
        <section
          className="bg-white border-b border-[#DFE0E1] py-10"
          aria-labelledby="home-partenaires-titre"
        >
          <div className="px-6">
            <Reveal>
              <p
                id="home-partenaires-titre"
                className="text-center text-xs font-semibold uppercase tracking-widest text-[#8A6D0B] mb-6"
              >
                Ils soutiennent le networking français
              </p>
              <div className="flex flex-wrap items-center justify-center" style={{ gap: 12 }}>
                {partenairesActifs.map((p) => {
                  const logoMedia = p.logo as Media | null | undefined
                  const logoUrl =
                    logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.sizes?.card?.url ?? logoMedia?.url
                  const inner = logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={p.nom}
                      width={120}
                      height={48}
                      className="h-9 w-auto object-contain"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-[#8A6D0B]">{p.nom}</span>
                  )
                  const box =
                    'flex items-center justify-center px-5 py-3 border border-[#EFE08F] bg-white'
                  // Lien interne vers la fiche partenaire (maillage) ; repli sur le
                  // site externe, sinon simple libellé.
                  return p.slug ? (
                    <Link
                      key={p.id}
                      href={`/partenaire/${p.slug}`}
                      className={`${box} rsn-lift no-underline`}
                      title={p.nom}
                    >
                      {inner}
                    </Link>
                  ) : p.lien ? (
                    <a
                      key={p.id}
                      href={p.lien}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${box} rsn-lift no-underline`}
                      title={p.nom}
                    >
                      {inner}
                    </a>
                  ) : (
                    <span key={p.id} className={box}>
                      {inner}
                    </span>
                  )
                })}
              </div>
              <div className="text-center mt-6">
                <Link
                  href="/partenaires"
                  className="text-sm font-semibold text-[#035AA6] no-underline hover:underline"
                >
                  Voir tous les partenaires →
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ─── BANDEAU RÉSEAUX (marquee — « on les rassemble ») ─── */}
      {/* Même gabarit de section que ses voisines : py-16 md:py-20, en-tête
          `rsn-eyebrow` + `rsn-h2` + `rsn-sub` dans un `Reveal`, puis mb-12 avant
          le contenu. Le marquee reste full-bleed (sans `px-6`) : son masque
          dégradé gère les bords, une gouttière couperait l'effet de défilement. */}
      <section
        className="bg-white border-b border-[#DFE0E1] py-16 md:py-20"
        aria-labelledby="reseaux-reunis-titre"
      >
        <div className="px-6">
          <Reveal>
            <div className="text-center mb-12">
              <p className="rsn-eyebrow justify-center">
                <Network size={13} aria-hidden />
                Les réseaux d&apos;affaires
              </p>
              <h2 id="reseaux-reunis-titre" className="rsn-h2 mx-auto">
                Tous les réseaux <span>réunis</span>
              </h2>
              <p className="rsn-sub mx-auto">
                RÉSEAUTEURS ne remplace aucun réseau : il les rassemble. BNI, DCF, CJD, Dynabuy,
                Rotary, CPME — retrouvez-les tous au même endroit.
              </p>
            </div>
          </Reveal>
        </div>

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

        <Reveal>
          <CTAInscrireReseau className="px-6 mt-12" />
        </Reveal>
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
            <Link
              key={href}
              href={href}
              className="rsn-strip-cell rsn-shine rsn-linkrow no-underline"
            >
              <span className="rsn-strip-ico">
                <Icon size={20} aria-hidden />
              </span>
              <span className="rsn-strip-title">{title}</span>
              <span className="rsn-strip-desc">{desc}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#035AA6] mt-1">
                Découvrir
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── AVANTAGES RÉSEAUTEUR+ (2 colonnes) ───────────────── */}
      {/* Remplace « Le cœur du modèle / Trois entités » (retiré le 2026-07-23).
          `rsn-split` = la grille 2 colonnes du site (bordée, flush, repliée en
          1 colonne sous 900px) — même gabarit que « Vue d'ensemble ». */}
      <section className="py-16 md:py-20" aria-labelledby="avantages-plus-titre">
        <div className="px-6">
          <Reveal>
            <div className="rsn-split">
              <div>
                <p className="rsn-eyebrow">
                  <Star size={13} aria-hidden />
                  Réseauteur+
                </p>
                <h2 id="avantages-plus-titre" className="rsn-h2">
                  Les avantages <span>Réseauteur+</span>
                </h2>
                <p className="rsn-sub">
                  Avec Réseauteur+, vous ne vous contentez plus de participer aux événements : vous
                  les créez. Invitez la communauté à découvrir votre entreprise, partager un café ou
                  un déjeuner, et développez votre réseau tout au long de l&apos;année.
                </p>
                <p className="text-3xl font-extrabold text-[#8A6D0B] mt-8">
                  {PRIX_PLUS_HT} € <span className="text-base font-semibold">HT / an</span>
                </p>
                <div className="ir-atlas-actions">
                  <Link href="/inscription?type=reseauteur" className="ir-atlas-primary rsn-linkrow">
                    <Star size={15} aria-hidden />
                    Devenir Réseauteur+
                  </Link>
                </div>
              </div>

              <div>
                <p className="rsn-panel-title mb-5">Tout le compte gratuit, plus :</p>
                <ul className="flex flex-col gap-4">
                  {AVANTAGES_PLUS.map((a) => (
                    <li key={a} className="flex items-start gap-3 text-[#4E5155] leading-relaxed">
                      <Check size={18} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
                <p className="ir-atlas-microcopy">
                  Petit-déjeuner networking, afterwork, visite d&apos;entreprise, atelier — les
                  autres réseauteurs s&apos;inscrivent directement à vos événements depuis la
                  plateforme.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── VUE D'ENSEMBLE (donut badges — style « gauge ») ──── */}
      <section className="bg-white border-y border-[#DFE0E1] py-16" aria-labelledby="apercu-titre">
        <div className="px-6">
          <Reveal>
            <div className="rsn-split">
              <div>
                <p className="rsn-eyebrow">
                  <TrendingUp size={13} aria-hidden />
                  Vue d&apos;ensemble
                </p>
                <h2 id="apercu-titre" className="rsn-h2">
                  La communauté <span>en un coup d&apos;œil</span>
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
                  centerValue={badgePreview ? 'Aperçu' : reseauteurCount.toLocaleString('fr-FR')}
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

      {/* ─── COMMENT ÇA FONCTIONNE ────────────────────────────── */}
      {/* Mise en page « atlas » comme le reste de la page : les cellules d'une
          .grid sont FLUSH (`.ir-atlas-page :where(.grid){gap:0}` neutralise les
          `gap-*` de Tailwind), l'espacement vient donc du PADDING des cellules,
          pas d'un gap. Les `max-w-*` / `mx-auto` sont eux aussi neutralisés. */}
      <section
        className="bg-white border-y border-[#DFE0E1] py-16 md:py-20"
        aria-labelledby="comment-titre"
      >
        <div className="px-6">
          <Reveal>
            <div className="text-center mb-12">
              <p className="rsn-eyebrow justify-center">
                <Sparkles size={13} aria-hidden />
                Comment ça marche
              </p>
              <h2 id="comment-titre" className="rsn-h2 mx-auto">
                Trois étapes, <span>deux niveaux de compte</span>
              </h2>
              <p className="rsn-sub mx-auto">
                L&apos;inscription est gratuite et prend moins de deux minutes. Le niveau
                Réseauteur+ s&apos;ajoute quand vous voulez organiser vos propres rencontres.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <ol className="grid grid-cols-1 sm:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Créez votre profil gratuit',
                  desc: 'Renseignez votre prénom, nom, ville, métier et les réseaux que vous fréquentez. Gratuit, en moins de 2 minutes.',
                  color: '#035AA6',
                  bg: '#A9C9E4',
                },
                {
                  step: '2',
                  title: 'Apparaissez sur la carte',
                  desc: 'Votre profil est visible sur la carte des réseauteurs de votre ville. Les professionnels vous trouvent par métier, secteur ou réseau.',
                  color: '#8A6D0B',
                  bg: '#FBF4D3',
                },
                {
                  step: '3',
                  title: 'Trouvez et soyez trouvé',
                  desc: 'Explorez les profils, parcourez les événements de networking, et rejoignez les réseaux qui vous correspondent.',
                  color: '#3E7CA6',
                  bg: '#E7F0F7',
                },
              ].map(({ step, title, desc, color, bg }) => (
                <li
                  key={step}
                  className="flex flex-col items-center text-center gap-4 list-none p-6 sm:p-8"
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-extrabold"
                    style={{ background: bg, color }}
                    aria-label={`Étape ${step}`}
                  >
                    {step}
                  </span>
                  <div>
                    <h3 className="font-bold text-[#012A4A] mb-1.5">{title}</h3>
                    <p className="text-sm text-[#4E5155] leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          {/* Les deux niveaux du compte réseauteur (§4.1). Copie partagée avec le
              tunnel d'inscription (`lib/offres-reseauteur`) : une seule promesse. */}
          <Reveal>
            <div className="text-center mt-16 mb-12">
              <p className="rsn-eyebrow justify-center">
                <Star size={13} aria-hidden />
                Deux niveaux de compte
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#012A4A] mt-3">
                Ce que vous obtenez en devenant réseauteur
              </h3>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* ── Réseauteur (gratuit) ── */}
            <Reveal>
              <section
                aria-labelledby="offre-gratuit-titre"
                className="bg-white border border-[#DFE0E1] p-6 sm:p-8 flex flex-col gap-4 h-full"
              >
                <div>
                  <h4 id="offre-gratuit-titre" className="text-lg font-bold text-[#012A4A]">
                    Réseauteur
                  </h4>
                  <p className="text-2xl font-extrabold text-[#012A4A] mt-1">Gratuit</p>
                </div>
                <p className="text-sm text-[#4E5155] leading-relaxed">
                  Pour développer votre réseau professionnel et vous rendre visible partout en
                  France.
                </p>
                <ul className="flex flex-col gap-2.5 text-sm text-[#4E5155] flex-1">
                  {AVANTAGES_GRATUIT.map((a) => (
                    <li key={a} className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#035AA6] shrink-0 mt-0.5" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  <Link href="/inscription?type=reseauteur" className="ir-atlas-secondary rsn-linkrow">
                    Créer mon profil — c&apos;est gratuit
                  </Link>
                </div>
              </section>
            </Reveal>

            {/* ── Réseauteur+ (abonnement) ── */}
            <Reveal delay={90}>
              <section
                aria-labelledby="offre-plus-titre"
                className="relative bg-white border-2 border-[#F5E050] p-6 sm:p-8 flex flex-col gap-4 h-full"
              >
                <span className="absolute -top-3 left-6 sm:left-8 bg-[#F5E050] text-[#012A4A] text-xs font-bold uppercase tracking-wide px-3 py-1">
                  Recommandé
                </span>
                <div>
                  <h4 id="offre-plus-titre" className="text-lg font-bold text-[#012A4A]">
                    Réseauteur+
                  </h4>
                  <p className="text-2xl font-extrabold text-[#8A6D0B] mt-1">
                    {PRIX_PLUS_HT} € <span className="text-base font-semibold">HT / an</span>
                  </p>
                </div>
                <p className="text-sm text-[#4E5155] leading-relaxed">
                  Tout le compte gratuit, <strong className="text-[#012A4A]">plus :</strong>
                </p>
                <ul className="flex flex-col gap-2.5 text-sm text-[#4E5155] flex-1">
                  {AVANTAGES_PLUS.map((a) => (
                    <li key={a} className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  <Link href="/inscription?type=reseauteur" className="ir-atlas-primary rsn-linkrow">
                    Devenir Réseauteur+
                  </Link>
                </div>
              </section>
            </Reveal>
          </div>

          <p className="ir-atlas-microcopy text-center mt-10">
            Vous gérez un réseau d&apos;affaires ?{' '}
            <Link href="/inscription?type=organisateur" className="font-semibold text-[#035AA6]">
              Inscrivez votre réseau national
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ─── CHIFFRES CLÉS (bande sombre — compteurs + courbe) ── */}
      <section className="section-dark py-16" aria-labelledby="chiffres-titre">
        <div className="px-6">
          <Reveal>
            <h2
              id="chiffres-titre"
              className="text-2xl sm:text-3xl font-bold text-[#fafafa] text-center mb-12"
            >
              La plateforme nationale du networking
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-14">
            <DarkStat value={reseauteurCount} label="Réseauteurs" color="#8BB4D9" />
            <DarkStat value={evenementCount} label="Événements" color="#F5E050" />
            <DarkStat value={reseauCount} label="Réseaux référencés" color="#6BA0CD" />
            <DarkStat value={0} label="Villes couvertes" color="#86efac" placeholder="Bientôt" />
          </div>

          <Reveal>
            <div
              className="border border-white/10 p-6 sm:p-8"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#CFD0D2]">
                  Croissance de la communauté
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#86efac]">
                  <TrendingUp size={12} aria-hidden />
                  {reseauteurCount > 0 ? 'en progression' : 'aperçu'}
                </span>
              </div>
              <TrendArea data={growthSeries} height={150} color="#6BA0CD" showDots />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── NEWSLETTER (bande accent — dernière bande avant le pied) ─ */}
      {/* Aplat #012A4A (navy — le bleu sombre des bandeaux dans la palette) +
          texte blanc : ≈ 14:1 de contraste. Le jaune #F5E050 puis le bleu vif
          #035AA6 ont été écartés (trop agressifs sur une pleine largeur).
          La bande « Chiffres clés » juste au-dessus étant elle aussi sombre
          (#0C1219), un filet `border-t` blanc à 12 % marque la séparation.
          Couleurs FIGÉES (pas de token `--ir-*`) : la bande doit rester
          identique en thème sombre.
          NB : `.ir-atlas-page` neutralise `max-w-lg/xl/4xl…` et `mx-auto` — d'où
          les largeurs en valeurs arbitraires et le centrage par `items-center`. */}
      <section
        className="py-16 md:py-20 bg-[#012A4A] border-t border-white/12"
        aria-labelledby="newsletter-titre"
      >
        <div className="px-6">
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 border border-white/25 text-white text-xs font-bold uppercase tracking-widest">
                <Mail size={13} aria-hidden />
                La lettre des réseauteurs
              </span>

              <h2
                id="newsletter-titre"
                className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mt-5 max-w-[36rem]"
              >
                Ne ratez plus un rendez-vous business près de chez vous
              </h2>

              <p className="text-base sm:text-lg text-white/85 leading-relaxed mt-4 max-w-[40rem]">
                Chaque mois : les événements à venir dans votre département, les nouveaux
                réseauteurs de votre ville et l&apos;actualité des réseaux d&apos;affaires.
              </p>

              <ul className="flex flex-col sm:flex-row items-center gap-x-7 gap-y-2 mt-7 text-sm font-semibold text-white">
                {['Un seul email par mois', '100 % networking, zéro spam', 'Désinscription en un clic'].map(
                  (arg) => (
                    <li key={arg} className="flex items-center gap-2">
                      <Check size={16} className="text-[#8BB4D9]" aria-hidden />
                      {arg}
                    </li>
                  ),
                )}
              </ul>

              {/* Newsletter à venir (décision produit 2026-06-29) — collecte non branchée,
                  champ et bouton désactivés ; pas de <form> pour éviter toute soumission.
                  L'état désactivé reste VISIBLE : rendre la bande plus engageante ne doit
                  pas faire passer un formulaire mort pour un formulaire actif. */}
              <div
                className="flex flex-col sm:flex-row gap-2 w-full max-w-[34rem] mt-8"
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
                  className="flex-1 min-w-0 px-4 py-3 text-sm bg-white/10 border border-white/25 text-white placeholder:text-white/50 cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="px-5 py-3 text-sm font-bold bg-white/15 text-white/75 border border-white/25 cursor-not-allowed whitespace-nowrap"
                >
                  Bientôt disponible
                </button>
              </div>

              <p className="text-xs text-white/70 mt-3">
                Le formulaire s&apos;activera à l&apos;ouverture de la lettre.
              </p>

              {/* La bande gagne en visibilité : autant qu'elle propose une action
                  qui, elle, fonctionne dès aujourd'hui. */}
              <p className="text-sm text-white/90 mt-8">
                En attendant,{' '}
                <Link
                  href="/inscription?type=reseauteur"
                  className="font-bold text-white underline underline-offset-2"
                >
                  créez votre profil gratuit
                </Link>{' '}
                et explorez les événements dès maintenant.
              </p>
            </div>
          </Reveal>
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
      <p className="text-sm text-[#999A9D] font-medium">{label}</p>
    </div>
  )
}
