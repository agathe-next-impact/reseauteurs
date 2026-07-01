/**
 * Page d'accueil RÉSEAUTEURS — modèle 3 entités (ADR-0011).
 * Objectif : comprise en < 30 s par un nouvel arrivant (CLAUDE.md §10, DESIGN.md §5).
 * Structure : Hero → Bandeau réseaux → Trois piliers → Comment ça fonctionne
 *             → Chiffres clés → Bandeau partenaires → Newsletter → Footer
 */
import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ArrowRight, Users, Calendar, Network, MapPin, Star, Building2 } from 'lucide-react'
import { withDbRetry } from '@/lib/db-retry'
import { buildMetadata } from '@/lib/seo'
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/site'
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

export default async function HomePage() {
  const payload = await getPayload({ config })

  const [
    { totalDocs: reseauteurCount },
    { totalDocs: evenementCount },
    { totalDocs: reseauCount },
    { docs: reseauxPartenaires },
    { docs: partenaires },
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
  ])

  // Réseaux à afficher dans le bandeau (partenaires réels + noms connus en fallback)
  const reseauxBandeau = reseauxPartenaires as Reseau[]
  const partenairesActifs = partenaires as Partenaire[]

  return (
    <div className="ir-atlas-page">
      <section className="ir-atlas-hero" aria-labelledby="home-hero-title">
        <div className="ir-atlas-hero-inner">
          <div className="ir-atlas-hero-copy">
            <p className="ir-atlas-eyebrow">
              <Star size={12} aria-hidden />
              La plateforme nationale du networking
            </p>

            <h1 id="home-hero-title" className="ir-atlas-title">
              Tous les pros. Tous les événements. Tous les réseaux.{' '}
              <span className="text-[#2563EB]">Au même endroit.</span>
            </h1>

            <p className="ir-atlas-lead">
              {SITE_NAME} ne remplace aucun réseau — il les rassemble. Trouvez les professionnels
              qui réseautent près de chez vous, leurs événements, leurs réseaux.
            </p>

            <div className="ir-atlas-actions">
              <Link href="/carte/reseauteurs" className="ir-atlas-primary">
                <MapPin size={16} aria-hidden />
                Explorer la carte des réseauteurs
              </Link>
              <Link href="/carte/evenements" className="ir-atlas-secondary">
                <Calendar size={16} aria-hidden />
                Voir les événements
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>

            <p className="ir-atlas-microcopy">
              Inscription gratuite · Aucune carte bancaire requise · Visible sur la carte
              immédiatement
            </p>
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
      </section>

      {/* ─── BANDEAU RÉSEAUX (« on les rassemble ») ──────────── */}
      <section
        className="bg-white border-b border-[#e4e4e7] py-10"
        aria-label="Réseaux d'affaires référencés"
      >
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#71717a] mb-6">
            Tous les réseaux réunis
          </p>
          {reseauxBandeau.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-4">
              {reseauxBandeau.map((r) => {
                const logoMedia = r.logo as Media | null | undefined
                const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url
                return (
                  <Link
                    key={r.id}
                    href={`/reseau/${r.slug}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e4e4e7] bg-[#faf9f5] hover:border-[#2563EB]/40 hover:bg-[#bfdbfe]/10 transition-all no-underline group"
                    title={r.nom}
                  >
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt={r.nom}
                        width={24}
                        height={24}
                        className="w-6 h-6 object-contain rounded"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded bg-[#bfdbfe]/50 flex items-center justify-center text-[#2563EB] text-xs font-bold">
                        {r.nom.charAt(0)}
                      </span>
                    )}
                    <span className="text-sm font-medium text-[#52525b] group-hover:text-[#2563EB] transition-colors">
                      {r.nom}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            // Fallback : noms connus (avant peuplement DB)
            <div className="flex flex-wrap justify-center gap-3">
              {RESEAUX_CONNUS.map((nom) => (
                <span
                  key={nom}
                  className="px-4 py-2 rounded-xl border border-[#e4e4e7] bg-[#faf9f5] text-sm font-medium text-[#71717a]"
                >
                  {nom}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── TROIS PILIERS (cœur du message — le test des 30 s) ─ */}
      <section className="py-16 md:py-20" aria-labelledby="trois-piliers-titre">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2
              id="trois-piliers-titre"
              className="text-2xl sm:text-3xl font-bold text-[#16284f] mb-3"
            >
              Trois entités, une plateforme
            </h2>
            <p className="text-[#52525b] max-w-xl mx-auto">
              Réseauteurs, événements, réseaux — tout ce que vous cherchez dans le networking
              professionnel, au même endroit.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Pilier 1 : Réseauteurs */}
            <div className="bg-white rounded-2xl border border-[#e4e4e7] p-6 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#bfdbfe]/40 flex items-center justify-center text-[#2563EB]">
                <Users size={24} aria-hidden />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#16284f] mb-2">Réseauteurs</h3>
                <p className="text-sm text-[#52525b] leading-relaxed">
                  Trouvez les professionnels qui réseautent près de chez vous. Entrepreneurs,
                  dirigeants, indépendants — visibles sur la carte.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <Link
                  href="/reseauteurs"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8] no-underline transition-colors"
                >
                  Voir les réseauteurs
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>

            {/* Pilier 2 : Événements */}
            <div className="bg-white rounded-2xl border border-[#e4e4e7] p-6 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#e0f2fe]/60 flex items-center justify-center text-[#0284c7]">
                <Calendar size={24} aria-hidden />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#16284f] mb-2">Événements</h3>
                <p className="text-sm text-[#52525b] leading-relaxed">
                  Tous les événements business — afterworks, petits-déjeuners, conférences, réunions
                  de réseaux — sur une seule carte.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <Link
                  href="/evenements"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0284c7] hover:text-[#0369a1] no-underline transition-colors"
                >
                  Voir les événements
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>

            {/* Pilier 3 : Réseaux */}
            <div className="bg-white rounded-2xl border border-[#e4e4e7] p-6 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#ffedd5]/60 flex items-center justify-center text-[#f5851f]">
                <Network size={24} aria-hidden />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#16284f] mb-2">Réseaux</h3>
                <p className="text-sm text-[#52525b] leading-relaxed">
                  Découvrez tous les réseaux d&apos;affaires (BNI, DCF, CJD, Dynabuy…), leurs
                  membres, leurs événements et leurs spécialités.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <Link
                  href="/reseaux"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#f5851f] hover:text-[#e07710] no-underline transition-colors"
                >
                  Voir les réseaux
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMMENT ÇA FONCTIONNE ───────────────────────────── */}
      <section className="bg-white border-y border-[#e4e4e7] py-16" aria-labelledby="comment-titre">
        <div className="max-w-4xl mx-auto px-6">
          <h2
            id="comment-titre"
            className="text-2xl sm:text-3xl font-bold text-[#16284f] text-center mb-12"
          >
            Comment ça fonctionne
          </h2>
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
                desc: 'Votre profil est visible sur la carte des réseauteurs de votre ville. Les professionnels peuvent vous trouver par métier, secteur ou réseau.',
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
              <li key={step} className="flex flex-col items-center text-center gap-4">
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
          <div className="text-center mt-10">
            <Link
              href="/inscription"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
            >
              Créer mon profil — c&apos;est gratuit
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CHIFFRES CLÉS ───────────────────────────────────── */}
      <section className="section-dark py-16" aria-labelledby="chiffres-titre">
        <div className="max-w-5xl mx-auto px-6">
          <h2
            id="chiffres-titre"
            className="text-2xl sm:text-3xl font-bold text-[#fafafa] text-center mb-12"
          >
            La plateforme nationale du networking
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            <StatCounter
              value={reseauteurCount || 0}
              label="Réseauteurs"
              suffix="+"
              color="#93c5fd"
            />
            <StatCounter
              value={evenementCount || 0}
              label="Événements"
              suffix="+"
              color="#c4b5fd"
            />
            <StatCounter
              value={reseauCount || 0}
              label="Réseaux référencés"
              suffix="+"
              color="#fed7aa"
            />
            <StatCounter
              value={0}
              label="Villes couvertes"
              suffix="+"
              color="#86efac"
              placeholder="Bientôt"
            />
          </div>
        </div>
      </section>

      {/* ─── BANDEAU PARTENAIRES (orange — B2B) ─────────────── */}
      <section
        className="py-16 bg-[#fff7ed] border-y border-[#fed7aa]"
        aria-labelledby="partenaires-titre"
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#c2410c] mb-2">
              Nos partenaires
            </p>
            <h2 id="partenaires-titre" className="text-2xl font-bold text-[#16284f]">
              Ils soutiennent le networking français
            </h2>
          </div>

          {partenairesActifs.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {partenairesActifs.map((p) => {
                const logoMedia = p.logo as Media | null | undefined
                const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url
                return p.lien ? (
                  <a
                    key={p.id}
                    href={p.lien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#fed7aa] bg-white hover:border-[#f5851f] hover:shadow-sm transition-all no-underline"
                    title={p.nom}
                  >
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt={p.nom}
                        width={80}
                        height={40}
                        className="h-8 w-auto object-contain"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[#c2410c]">{p.nom}</span>
                    )}
                  </a>
                ) : (
                  <span
                    key={p.id}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#fed7aa] bg-white"
                  >
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt={p.nom}
                        width={80}
                        height={40}
                        className="h-8 w-auto object-contain"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[#c2410c]">{p.nom}</span>
                    )}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-[#c2410c] text-sm mb-6">
              Vous souhaitez être visible auprès des professionnels du networking en France ?
            </p>
          )}

          {/* Encart B2B discret */}
          <div className="text-center">
            <p className="text-sm text-[#71717a] mb-3">
              Vous représentez un réseau d&apos;affaires ou une entreprise ?
            </p>
            <Link
              href="/partenaires"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f5851f] text-white font-semibold text-sm hover:bg-[#e07710] transition-colors no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5851f]"
            >
              <Building2 size={16} aria-hidden />
              Devenez partenaire
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER ──────────────────────────────────────── */}
      <section
        className="py-16 bg-white border-b border-[#e4e4e7]"
        aria-labelledby="newsletter-titre"
      >
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
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#e4e4e7] text-sm bg-[#f4f4f5] text-[#a1a1aa] placeholder:text-[#a1a1aa] cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="px-5 py-2.5 rounded-xl bg-[#a1a1aa] text-white font-semibold text-sm cursor-not-allowed"
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

/* ─── Compteur statique (pas de JS côté client nécessaire en SSR) ─ */
function StatCounter({
  value,
  label,
  suffix = '',
  color,
  placeholder,
}: {
  value: number
  label: string
  suffix?: string
  color: string
  placeholder?: string
}) {
  const display = placeholder || (value > 0 ? `${value.toLocaleString('fr-FR')}${suffix}` : '—')
  return (
    <div className="text-center">
      <p
        className="text-3xl sm:text-4xl font-extrabold mb-1"
        style={{ color }}
        aria-label={`${display} ${label}`}
      >
        {display}
      </p>
      <p className="text-sm text-[#a1a1aa] font-medium">{label}</p>
    </div>
  )
}
