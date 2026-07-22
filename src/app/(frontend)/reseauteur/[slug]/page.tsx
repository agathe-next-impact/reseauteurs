/**
 * Fiche réseauteur SSR/ISR — /reseauteur/<prenom-nom>
 * RGPD : téléphone/email uniquement si renseignés par le réseauteur (champs facultatifs).
 * noindex : propagé si seo.noindex === true (profil non validé ou opt-out réseauteur).
 * JSON-LD Person : injecté par seo-engineer (champs publics uniquement, RGPD).
 */
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Users, Building2, CalendarDays } from 'lucide-react'
import { ContactCTA } from '@/components/fiche/ContactCTA'
import { buildMetadata, applySeoOverrides } from '@/lib/seo'
import { buildPersonJsonLd, buildBreadcrumbListJsonLd } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { MaillageReseauteur } from '@/components/seo/MaillageReseauteur'
import MiniMapLoader from '@/components/maps/MiniMapLoader'
import { BadgeReseauteur } from '@/components/ui/BadgeReseauteur'
import { SITE_NAME } from '@/lib/site'
import { todayParisDateString } from '@/lib/dates'
import { listerEvenementsInscrits } from '@/lib/inscriptions'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { Reseauteur, Media, Reseau, Categorie, EvenementRsn } from '@/types/reseauteurs-domain'

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

const getReseauteur = cache(async (slug: string): Promise<Reseauteur | null> => {
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
})

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

  // Événements auxquels le réseauteur participe (publiés + à venir, triés par date).
  // DEUX sources fusionnées : présence signalée sur le profil (`evenementsParticipes`,
  // événements de réseau) + inscriptions en ligne aux événements organisés par un
  // réseauteur Plus (ADR-0013 §3bis). Dédoublonnage par id.
  // Borne "aujourd'hui" via lib (le "now" reste hors du rendu — règle de pureté).
  const todayStartMs = new Date(`${todayParisDateString()}T00:00:00.000Z`).getTime()
  const evenementsInscrits = await listerEvenementsInscrits(await getPayload({ config }), r.id)
  const evenementsParticipes = [
    ...((r.evenementsParticipes as EvenementRsn[] | null | undefined) ?? []),
    ...evenementsInscrits,
  ]
    .filter((e): e is EvenementRsn => !!e && typeof e === 'object' && e.statut === 'publie')
    .filter((e, i, arr) => arr.findIndex((o) => String(o.id) === String(e.id)) === i)
    .filter((e) => {
      const finMs = e.dateFin ? new Date(e.dateFin).getTime() : new Date(e.dateDebut).getTime()
      return finMs >= todayStartMs
    })
    .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())

  // ADR-0015 : le lien « partenaire d'appartenance » (licences) est supprimé.

  // JSON-LD Person + BreadcrumbList (seo-engineer)
  // RGPD : uniquement si le profil est indexable (noindex !== true).
  // telephone/emailContact sont délibérément absents du JSON-LD (structuré = scrapable).
  const isIndexable = !(r.seo?.noindex ?? false)
  const secteurIdForMaillage =
    typeof r.secteur === 'object' && r.secteur !== null
      ? (r.secteur as Categorie).id
      : (r.secteur as number | null | undefined) ?? null

  return (
    <div className="rsn-page">
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

      {/* Héros de fiche — fond de marque navy (même token que PageHeader) */}
      <section className="rsn-pagehead rsn-pagehead--compact" data-tone="navy">
        <div className="rsn-pagehead-inner">
          {/* Fil d'Ariane */}
          <nav aria-label="Fil d'Ariane" className="mb-4 text-xs text-white/60 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white no-underline transition-colors">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/reseauteurs" className="hover:text-white no-underline transition-colors">Réseauteurs</Link>
            <span aria-hidden>/</span>
            <span className="text-white/80" aria-current="page">{r.prenom} {r.nom}</span>
          </nav>

          <Reveal>
            <p className="rsn-eyebrow" style={{ color: '#8BB4D9' }}>Profil réseauteur</p>

            <div className="flex items-start gap-5 mt-3.5">
              {/* Avatar */}
              <div className="shrink-0">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={`Photo de profil de ${r.prenom} ${r.nom}`}
                    width={96}
                    height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-white/15"
                    priority
                  />
                ) : (
                  <div
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 flex items-center justify-center text-white font-extrabold text-2xl border border-white/15"
                    aria-label={`Initiales de ${r.prenom} ${r.nom}`}
                  >
                    {r.prenom.charAt(0)}{r.nom.charAt(0)}
                  </div>
                )}
              </div>

              {/* Identité */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="rsn-pagehead-title !mt-0 !text-[28px] sm:!text-[38px]">
                    {r.prenom} {r.nom}
                  </h1>
                  {r.badge && <BadgeReseauteur badge={r.badge} />}
                </div>
                {r.fonction && (
                  <p className="text-sm sm:text-base font-medium text-white/85 mt-1.5">{r.fonction}</p>
                )}
                {r.entreprise && (
                  <p className="text-sm text-white/65 flex items-center gap-1.5 mt-1">
                    <Building2 size={13} aria-hidden />
                    {r.entreprise}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={13} className="text-white/50 shrink-0" aria-hidden />
                  <span className="text-sm text-white/65">
                    {r.ville}{r.departement ? `, ${r.departement}` : ''}{r.region ? ` — ${r.region}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Liens externes — le contact (email/tél/site) est regroupé dans le CTA
                « Prendre contact » du corps ; le héros ne garde que le profil social. */}
            <div className="flex flex-wrap gap-2 mt-6">
              {r.linkedin && (
                <a
                  href={r.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 p-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white/85 hover:border-white/40 hover:bg-white/10 transition-colors no-underline"
                  aria-label={`Profil LinkedIn de ${r.prenom} ${r.nom}`}
                >
                  LinkedIn
                </a>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="rsn-card rsn-lift rounded-2xl overflow-hidden">
          {/* Corps de la fiche */}
          <div className="px-6 py-6 space-y-8">
            {/* Présentation */}
            {r.description && (
              <Reveal>
                <section aria-labelledby="presentation-titre">
                  <h2 id="presentation-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">Présentation</h2>
                  <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line">{r.description}</p>
                </section>
              </Reveal>
            )}

            {/* Secteur */}
            {secteurDoc && (
              <Reveal>
                <section aria-labelledby="secteur-titre">
                  <h2 id="secteur-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">Secteur d&apos;activité</h2>
                  <span className="rsn-tag" style={{ color: '#02467F', borderColor: 'rgba(3, 90, 166,0.3)' }}>
                    {secteurDoc.label}
                  </span>
                </section>
              </Reveal>
            )}

            {/* Compétences */}
            {competences.length > 0 && (
              <Reveal>
                <section aria-labelledby="competences-titre">
                  <h2 id="competences-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">Compétences</h2>
                  <div className="flex flex-wrap gap-2" role="list" aria-label="Compétences">
                    {competences.map((c, i) => (
                      <span
                        key={c.id ?? i}
                        role="listitem"
                        className="px-2.5 py-1 rounded-full bg-[#E9E9EA] text-[#4E5155] text-xs font-medium border border-[#DFE0E1]"
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Réseaux fréquentés */}
            {reseauxFrequentes.length > 0 && (
              <Reveal>
                <section aria-labelledby="reseaux-titre">
                  <h2 id="reseaux-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
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
                          className="rsn-linkrow inline-flex items-center gap-1.5 p-2.5 rounded-full bg-[#E9E9EA] border border-[#DFE0E1] text-xs font-medium text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] no-underline transition-colors"
                        >
                          {rLogoUrl && (
                            <Image src={rLogoUrl} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full object-cover" aria-hidden />
                          )}
                          {reseau.nom}
                          {reseau.partenaire && (
                            <span className="ml-0.5 text-[#8A6D0B]" title="Réseau partenaire" aria-label="Réseau partenaire">•</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Événements auxquels il participe */}
            {evenementsParticipes.length > 0 && (
              <Reveal>
                <section aria-labelledby="evenements-titre">
                  <h2 id="evenements-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
                    <CalendarDays size={14} aria-hidden />
                    Participe à ces événements
                  </h2>
                  <div className="space-y-2" role="list" aria-label="Événements">
                    {evenementsParticipes.map((ev) => {
                      const d = new Date(ev.dateDebut)
                      const jour = d.toLocaleDateString('fr-FR', { day: 'numeric' })
                      const mois = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
                      const evReseau = ev.reseau as Reseau | null | undefined
                      // ADR-0013 : événement organisé par un réseauteur Plus (XOR avec réseau)
                      const evOrganisateurRz = ev.organisateurReseauteur != null
                      return (
                        <Link
                          key={ev.id}
                          href={`/evenement/${ev.slug}`}
                          role="listitem"
                          className="rsn-lift flex items-center gap-3 p-2.5 rounded-xl border border-[#DFE0E1] hover:border-[#035AA6]/40 transition-colors no-underline group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-[#EFF5FA] flex flex-col items-center justify-center text-[#035AA6] shrink-0 leading-none">
                            <span className="text-sm font-extrabold">{jour}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wide">{mois}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1D1E21] group-hover:text-[#035AA6] transition-colors truncate">
                              {ev.titre}
                            </p>
                            <p className="text-xs text-[#6E7175] truncate">
                              {ev.lieuVille}
                              {evReseau?.nom
                                ? ` · ${evReseau.nom}`
                                : evOrganisateurRz
                                  ? ' · organisé par un réseauteur'
                                  : ''}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Localisation — mini-carte (centroïde ville, RGPD ADR-0011 §7) */}
            {typeof r.latitude === 'number' && typeof r.longitude === 'number' && (
              <Reveal>
                <section aria-labelledby="loc-titre">
                  <h2 id="loc-titre" className="text-sm font-semibold text-[#1D1E21] mb-2 flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden />
                    Localisation
                  </h2>
                  <MiniMapLoader
                    latitude={r.latitude}
                    longitude={r.longitude}
                    zoom={11}
                    label={`Localisation de ${r.prenom} ${r.nom}${r.ville ? ` à ${r.ville}` : ''}`}
                  />
                  <p className="text-xs text-[#999A9D] mt-1.5">Position au niveau de la ville (confidentialité).</p>
                </section>
              </Reveal>
            )}

            {/* CTA prendre contact — email + téléphone + site web (RGPD : canaux facultatifs) */}
            <Reveal>
              <ContactCTA
                email={r.emailContact}
                telephone={r.telephone}
                site={r.site}
                entityName={`${r.prenom} ${r.nom}`}
              />
            </Reveal>
          </div>

          {/* Maillage interne : proximité + même secteur (seo-engineer) */}
          <MaillageReseauteur
            villeActuelle={r.ville}
            secteurId={secteurIdForMaillage}
            excludeId={r.id}
          />

          {/* Pied de fiche — CTA carte */}
          <div className="px-6 py-5 border-t border-[#DFE0E1] bg-[#F2F2F2]">
            {/* CTA vers la carte plein écran des réseauteurs (map-engineer J2.B) */}
            <Link
              href={`/carte/reseauteurs?ville=${encodeURIComponent(r.ville ?? '')}`}
              className="rsn-linkrow inline-flex items-center gap-2 text-sm text-[#035AA6] font-medium hover:text-[#02467F] no-underline transition-colors"
            >
              Voir les réseauteurs à {r.ville} sur la carte
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
