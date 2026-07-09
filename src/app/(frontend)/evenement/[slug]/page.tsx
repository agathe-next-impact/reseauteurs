/**
 * Fiche événement SSR/ISR — /evenement/<slug>
 * Bouton « S'inscrire » = lien externe vers lienInscription (RÉSEAUTEURS n'organise pas).
 * ADR-0012 : événement Premium supprimé — un seul type de marqueur et aucun badge Premium.
 * JSON-LD Event : injecté par seo-engineer (organizer = réseau).
 */
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin, ExternalLink, Network, ArrowRight, Users } from 'lucide-react'
import { buildMetadata, applySeoOverrides } from '@/lib/seo'
import { buildEvenementRsnJsonLd, buildBreadcrumbListJsonLd } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { MaillageEvenement } from '@/components/seo/MaillageEvenement'
import MiniMapLoader from '@/components/maps/MiniMapLoader'
import { MAP_COLORS } from '@/lib/maplibre/config'
import { SITE_NAME } from '@/lib/site'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { EvenementRsn as Evenement, Media, Reseau, TypesEvenement, Reseauteur } from '@/types/reseauteurs-domain'

export const revalidate = 300

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'evenements',
    where: { statut: { equals: 'publie' } },
    select: { slug: true } as Record<string, boolean>,
    limit: 500,
    overrideAccess: true,
  })
  return docs
    .filter((d): d is typeof d & { slug: string } => Boolean(d.slug))
    .map((d) => ({ slug: d.slug }))
}

async function getEvenement(slug: string): Promise<Evenement | null> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'evenements',
    where: {
      and: [
        { slug: { equals: slug } },
        { statut: { equals: 'publie' } },
      ],
    },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as Evenement | undefined) ?? null
}

/**
 * Réseauteurs (validés) ayant signalé leur présence à cet événement.
 * RGPD : uniquement les profils publics (statut === 'valide').
 */
async function getParticipants(eventId: number | string): Promise<Reseauteur[]> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: {
      and: [
        { evenementsParticipes: { in: [eventId] } },
        { statut: { equals: 'valide' } },
      ],
    },
    depth: 1,
    limit: 60,
    overrideAccess: true,
    select: {
      prenom: true,
      nom: true,
      slug: true,
      entreprise: true,
      photo: true,
      badge: true,
    } as Record<string, boolean>,
  })
  return docs as unknown as Reseauteur[]
}

function formatDatetimeFR(dateStr: string): string {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} à ${time}`
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const e = await getEvenement(slug)
  if (!e) {
    return buildMetadata({
      title: 'Événement introuvable',
      description: 'Cet événement n\'est plus disponible.',
      path: `/evenement/${slug}`,
      noindex: true,
    })
  }
  const dateTxt = formatDateShort(e.dateDebut)
  const defaults = {
    title: `${e.titre} — ${dateTxt} à ${e.lieuVille} | ${SITE_NAME}`,
    description: e.description?.slice(0, 155) || `Événement networking : ${e.titre} le ${dateTxt} à ${e.lieuVille}.`,
    path: `/evenement/${slug}`,
    ogType: 'article' as const,
    publishedTime: e.createdAt,
    modifiedTime: e.updatedAt,
  }
  return buildMetadata(applySeoOverrides(defaults, e.seo ?? null))
}

export default async function FicheEvenementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = await getEvenement(slug)
  if (!e) notFound()

  const participants = await getParticipants(e.id)

  const imageMedia = e.image as Media | null | undefined
  const imageUrl = imageMedia?.sizes?.full?.url ?? imageMedia?.url ?? null
  const reseau = e.reseau as Reseau | null | undefined
  const reseauLogoMedia = reseau?.logo as Media | null | undefined
  const reseauLogoUrl = reseauLogoMedia?.sizes?.thumbnail?.url ?? reseauLogoMedia?.url
  const typeDoc = e.type as TypesEvenement | null | undefined

  // Validation de l'URL externe (sécurité)
  let lienInscriptionSafe: string | null = null
  if (e.lienInscription) {
    try {
      const u = new URL(e.lienInscription)
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        lienInscriptionSafe = e.lienInscription
      }
    } catch { /* ignore */ }
  }

  // JSON-LD Event + BreadcrumbList (seo-engineer)
  const reseauForMaillage = reseau
  const reseauIdForMaillage =
    reseauForMaillage
      ? (typeof reseauForMaillage === 'object' ? reseauForMaillage.id : reseauForMaillage)
      : null

  return (
    <div className="rsn-page">
      {/* Données structurées JSON-LD (seo-engineer) */}
      <JsonLd
        data={[
          buildEvenementRsnJsonLd(e),
          buildBreadcrumbListJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Événements', url: '/evenements' },
            { name: e.titre, url: `/evenement/${e.slug ?? ''}` },
          ]),
        ]}
      />

      {/* Héros de fiche — fond de marque navy (même token que PageHeader) */}
      <section className="rsn-pagehead" data-tone="navy">
        <div className="rsn-pagehead-inner">
          {/* Fil d'Ariane */}
          <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-white/60 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white no-underline transition-colors">Accueil</Link>
            <span aria-hidden>/</span>
            <Link href="/evenements" className="hover:text-white no-underline transition-colors">Événements</Link>
            <span aria-hidden>/</span>
            <span className="text-white/80" aria-current="page">{e.titre}</span>
          </nav>

          <Reveal>
            <p className="rsn-eyebrow" style={{ color: '#93c5fd' }}>
              {typeDoc?.label ?? 'Événement business'}
            </p>
            <h1 className="rsn-pagehead-title">{e.titre}</h1>

            {/* Date et lieu */}
            <div className="space-y-2.5 mt-6">
              <div className="flex items-start gap-2">
                <CalendarDays size={15} className="text-white/50 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white capitalize">
                    {formatDatetimeFR(e.dateDebut)}
                  </p>
                  {e.dateFin && (
                    <p className="text-xs text-white/60">
                      Fin : {formatDatetimeFR(e.dateFin)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-white/50 shrink-0 mt-0.5" aria-hidden />
                <div>
                  {e.lieuNom && <p className="text-sm font-medium text-white">{e.lieuNom}</p>}
                  <p className="text-sm text-white/70">
                    {e.lieuAdresse && `${e.lieuAdresse}, `}{e.lieuCodePostal && `${e.lieuCodePostal} `}{e.lieuVille}
                  </p>
                </div>
              </div>
            </div>

            {/* CTA S'inscrire (lien externe) */}
            {lienInscriptionSafe && (
              <div className="mt-7">
                <a
                  href={lienInscriptionSafe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ir-atlas-primary rsn-linkrow rsn-shine"
                  aria-label={`S'inscrire à l'événement ${e.titre} (lien externe)`}
                >
                  <ExternalLink size={15} aria-hidden />
                  S&apos;inscrire
                  <span className="text-xs opacity-75 font-normal">— sur le site du réseau</span>
                </a>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="rsn-card rsn-lift rounded-2xl overflow-hidden">
          {/* Image bannière */}
          {imageUrl ? (
            <div className="relative">
              <Image
                src={imageUrl}
                alt={`Bannière de l'événement ${e.titre}`}
                width={1200}
                height={450}
                className="w-full aspect-[2.5/1] object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          ) : (
            <div className="w-full aspect-[3/1] bg-gradient-to-br from-[#bfdbfe]/30 to-[#e0f2fe]/20" />
          )}

          {/* Description */}
          <div className="px-6 py-6 space-y-8">
            {e.description && (
              <Reveal>
                <section aria-labelledby="desc-titre">
                  <h2 id="desc-titre" className="text-sm font-semibold text-[#18181b] mb-2">À propos de cet événement</h2>
                  <p className="text-sm text-[#52525b] leading-relaxed whitespace-pre-line">{e.description}</p>
                </section>
              </Reveal>
            )}

            {/* Réseau organisateur */}
            {reseau && (
              <Reveal>
                <section aria-labelledby="reseau-titre">
                  <h2 id="reseau-titre" className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
                    <Network size={14} aria-hidden />
                    Réseau organisateur
                  </h2>
                  <Link
                    href={`/reseau/${reseau.slug}`}
                    className="rsn-lift flex items-center gap-3 p-3 rounded-xl border border-[#e4e4e7] hover:border-[#2563EB]/40 transition-colors no-underline group"
                  >
                    {reseauLogoUrl ? (
                      <Image
                        src={reseauLogoUrl}
                        alt={`Logo ${reseau.nom}`}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-contain border border-[#e4e4e7] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#bfdbfe]/30 flex items-center justify-center text-[#2563EB] font-bold text-sm shrink-0">
                        {reseau.nom.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#18181b] group-hover:text-[#2563EB] transition-colors">{reseau.nom}</p>
                      {reseau.ville && <p className="text-xs text-[#71717a]">{reseau.ville}</p>}
                    </div>
                    <ArrowRight size={14} className="text-[#a1a1aa] group-hover:text-[#2563EB] transition-colors shrink-0 rsn-arrow" aria-hidden />
                  </Link>
                </section>
              </Reveal>
            )}
            {/* Réseauteurs présents (participations signalées) */}
            {participants.length > 0 && (
              <Reveal>
                <section aria-labelledby="participants-titre">
                  <h2 id="participants-titre" className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
                    <Users size={14} aria-hidden />
                    Réseauteurs présents
                    <span className="text-[#a1a1aa] font-normal">({participants.length})</span>
                  </h2>
                  <div className="flex flex-wrap gap-2" role="list" aria-label="Réseauteurs présents">
                    {participants.map((p) => {
                      const pPhoto = p.photo as Media | null | undefined
                      const pPhotoUrl = pPhoto?.sizes?.thumbnail?.url ?? pPhoto?.url ?? null
                      return (
                        <Link
                          key={p.id}
                          href={`/reseauteur/${p.slug}`}
                          role="listitem"
                          className="rsn-linkrow inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] hover:border-[#2563EB] no-underline transition-colors group"
                        >
                          {pPhotoUrl ? (
                            <Image src={pPhotoUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" aria-hidden />
                          ) : (
                            <span
                              className="w-6 h-6 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-bold flex items-center justify-center"
                              aria-hidden
                            >
                              {p.prenom?.charAt(0)}{p.nom?.charAt(0)}
                            </span>
                          )}
                          <span className="text-xs font-medium text-[#52525b] group-hover:text-[#2563EB] transition-colors">
                            {p.prenom} {p.nom}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                  <p className="text-xs text-[#a1a1aa] mt-2">
                    Réseauteurs de la plateforme ayant signalé leur présence.
                  </p>
                </section>
              </Reveal>
            )}

            {/* Lieu — mini-carte de l'événement */}
            {typeof e.lieuLatitude === 'number' && typeof e.lieuLongitude === 'number' && (
              <Reveal>
                <section aria-labelledby="lieu-titre">
                  <h2 id="lieu-titre" className="text-sm font-semibold text-[#18181b] mb-2 flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden />
                    Lieu
                  </h2>
                  <MiniMapLoader
                    latitude={e.lieuLatitude}
                    longitude={e.lieuLongitude}
                    zoom={14}
                    color={MAP_COLORS.evenement}
                    label={`Lieu de l'événement ${e.titre}${e.lieuVille ? ` à ${e.lieuVille}` : ''}`}
                  />
                </section>
              </Reveal>
            )}
          </div>

          {/* Maillage interne : autres événements du même réseau (seo-engineer) */}
          <MaillageEvenement
            reseauId={reseauIdForMaillage}
            excludeId={e.id}
            reseauSlug={reseau?.slug}
            reseauNom={reseau?.nom}
          />

          {/* Pied de fiche */}
          <div className="px-6 py-5 border-t border-[#e4e4e7] bg-[#faf9f5] flex flex-wrap gap-4 justify-between items-center">
            <Link
              href="/evenements"
              className="rsn-linkrow text-sm text-[#2563EB] font-medium hover:text-[#1d4ed8] no-underline transition-colors flex items-center gap-1"
            >
              ← Tous les événements
            </Link>
            {/* CTA vers la carte des événements */}
            <Link
              href={`/evenements?vue=carte&ville=${encodeURIComponent(e.lieuVille ?? '')}`}
              className="rsn-linkrow inline-flex items-center gap-1.5 text-sm text-[#71717a] hover:text-[#2563EB] no-underline transition-colors"
            >
              <MapPin size={13} aria-hidden />
              Voir sur la carte
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
