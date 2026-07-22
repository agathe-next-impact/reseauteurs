/**
 * Fiche événement SSR/ISR — /evenement/<slug>
 * Bouton « S'inscrire » = lien externe vers lienInscription (RÉSEAUTEURS n'organise pas).
 * ADR-0012 : événement Premium supprimé — un seul type de marqueur et aucun badge Premium.
 * JSON-LD Event : injecté par seo-engineer (organizer = réseau).
 */
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin, ExternalLink, Network, ArrowRight, Users } from 'lucide-react'
// (Users sert aussi à la section « Organisé par » — ADR-0013)
import { buildMetadata, applySeoOverrides } from '@/lib/seo'
import { buildEvenementRsnJsonLd, buildBreadcrumbListJsonLd } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { MaillageEvenement } from '@/components/seo/MaillageEvenement'
import MiniMapLoader from '@/components/maps/MiniMapLoader'
import { MAP_COLORS } from '@/lib/maplibre/config'
import { SITE_NAME } from '@/lib/site'
import { todayParisDateString } from '@/lib/dates'
import { compterInscrits } from '@/lib/inscriptions'
import InscriptionEvenement from '@/components/evenement/InscriptionEvenement'
import Reveal from '@/components/home/Reveal'
import type { Metadata } from 'next'
import type { EvenementRsn as Evenement, Media, Reseau, TypesEvenement, Reseauteur, Categorie } from '@/types/reseauteurs-domain'

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

const getEvenement = cache(async (slug: string): Promise<Evenement | null> => {
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
})

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

  // ADR-0013 §3bis : inscription en ligne pour les événements organisés par un réseauteur Plus.
  // Compteur public (ISR) ; l'état per-user est hydraté côté client (le CTA n'entre pas dans le cache).
  const isPlusEvent =
    typeof e.organisateurReseauteur === 'object'
      ? e.organisateurReseauteur !== null
      : e.organisateurReseauteur != null
  const inscritsTotal = isPlusEvent ? await compterInscrits(await getPayload({ config }), e.id) : 0
  const todayStartMs = new Date(`${todayParisDateString()}T00:00:00.000Z`).getTime()
  const evenementFinMs = e.dateFin ? new Date(e.dateFin).getTime() : new Date(e.dateDebut).getTime()
  const isPast = evenementFinMs < todayStartMs

  const imageMedia = e.image as Media | null | undefined
  const imageUrl = imageMedia?.sizes?.full?.url ?? imageMedia?.url ?? null
  const reseau = e.reseau as Reseau | null | undefined
  // ADR-0013 : événement organisé par un réseauteur Plus (XOR avec reseau)
  const organisateurRz =
    typeof e.organisateurReseauteur === 'object' && e.organisateurReseauteur !== null
      ? (e.organisateurReseauteur as Reseauteur)
      : null
  const organisateurPhoto = organisateurRz?.photo as Media | null | undefined
  const organisateurPhotoUrl = organisateurPhoto?.sizes?.thumbnail?.url ?? organisateurPhoto?.url ?? null
  const reseauLogoMedia = reseau?.logo as Media | null | undefined
  const reseauLogoUrl = reseauLogoMedia?.sizes?.thumbnail?.url ?? reseauLogoMedia?.url
  const typeDoc = e.type as TypesEvenement | null | undefined

  // ── Fiche complète (spec 2026-07-13) : catégorisation, participation, médias, pratiques
  const galerieUrls = ((e.galerie ?? []) as Array<{ image?: unknown }>)
    .map((g) => {
      const m = g?.image
      return m && typeof m === 'object' ? ((m as Media).sizes?.card?.url ?? (m as Media).url ?? null) : null
    })
    .filter((u): u is string => Boolean(u))
  const secteurDoc = e.secteur as Categorie | null | undefined
  const ouiNon = (v: 'oui' | 'non' | null | undefined): string | null => (v === 'oui' ? 'Oui' : v === 'non' ? 'Non' : null)
  const NIVEAU_PUBLIC_LABEL: Record<string, string> = { debutant: 'Débutant', confirme: 'Confirmé', tous: 'Tous niveaux' }
  const participationRows: Array<{ label: string; value: string }> = [
    { label: 'Tarif', value: e.gratuit === false ? (e.tarif || 'Payant') : 'Gratuit' },
    typeof e.nombrePlaces === 'number' ? { label: 'Places', value: String(e.nombrePlaces) } : null,
    e.dateLimiteInscription ? { label: 'Limite d\'inscription', value: new Date(e.dateLimiteInscription).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } : null,
    ouiNon(e.ouvertATous) ? { label: 'Ouvert à tous', value: ouiNon(e.ouvertATous)! } : null,
    ouiNon(e.reserveMembres) ? { label: 'Réservé aux membres', value: ouiNon(e.reserveMembres)! } : null,
    ouiNon(e.participationInvite) ? { label: 'Participation en invité', value: ouiNon(e.participationInvite)! } : null,
    e.niveauPublic ? { label: 'Niveau', value: NIVEAU_PUBLIC_LABEL[e.niveauPublic] ?? e.niveauPublic } : null,
    e.publicConcerne ? { label: 'Public concerné', value: e.publicConcerne } : null,
    secteurDoc?.label ? { label: 'Secteur', value: secteurDoc.label } : null,
  ].filter((r): r is { label: string; value: string } => r !== null)
  const pratiques: string[] = [
    e.parking ? 'Parking disponible' : null,
    e.accesPmr ? 'Accès PMR' : null,
  ].filter((x): x is string => Boolean(x))

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
            {/* Accent par organisateur (ADR-0013) : orange = réseauteur Plus, bleu = réseau */}
            <p className="rsn-eyebrow" style={{ color: isPlusEvent ? '#EAD673' : '#8BB4D9' }}>
              {typeDoc?.label ?? 'Événement business'}
              {isPlusEvent && ' · organisé par un réseauteur'}
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

            {/* CTA inscription : événement Plus → inscription en ligne ; réseau → lien externe (ADR-0013 §3bis) */}
            {isPlusEvent ? (
              <div className="mt-7">
                <InscriptionEvenement
                  evenementId={typeof e.id === 'number' ? e.id : Number(e.id)}
                  slug={e.slug ?? ''}
                  initialTotal={inscritsTotal}
                  isPast={isPast}
                  onDark
                />
              </div>
            ) : (
              lienInscriptionSafe && (
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
              )
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
            <div className="w-full aspect-[3/1] bg-[#E7F0F7]" />
          )}

          {/* Description */}
          <div className="px-6 py-6 space-y-8">
            {e.descriptionCourte && (
              <Reveal>
                <p className="text-base text-[#1D1E21] font-medium leading-relaxed">{e.descriptionCourte}</p>
              </Reveal>
            )}
            {e.description && (
              <Reveal>
                <section aria-labelledby="desc-titre">
                  <h2 id="desc-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">À propos de cet événement</h2>
                  <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line">{e.description}</p>
                </section>
              </Reveal>
            )}

            {/* Intervenants */}
            {e.intervenants && (
              <Reveal>
                <section aria-labelledby="intervenants-titre">
                  <h2 id="intervenants-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">Intervenant(s)</h2>
                  <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line">{e.intervenants}</p>
                </section>
              </Reveal>
            )}

            {/* Participation (fiche descriptive) */}
            {participationRows.length > 0 && (
              <Reveal>
                <section aria-labelledby="participation-titre">
                  <h2 id="participation-titre" className="text-sm font-semibold text-[#1D1E21] mb-3">Participation</h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {participationRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 border-b border-[#E9E9EA] py-1.5">
                        <dt className="text-xs text-[#6E7175]">{row.label}</dt>
                        <dd className="text-xs font-semibold text-[#1D1E21] text-right">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </Reveal>
            )}

            {/* Infos pratiques */}
            {(pratiques.length > 0 || e.infosPratiques) && (
              <Reveal>
                <section aria-labelledby="pratiques-titre">
                  <h2 id="pratiques-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">Informations pratiques</h2>
                  {pratiques.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pratiques.map((p) => (
                        <span key={p} className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {e.infosPratiques && (
                    <p className="text-sm text-[#4E5155] leading-relaxed whitespace-pre-line">{e.infosPratiques}</p>
                  )}
                </section>
              </Reveal>
            )}

            {/* Galerie photos */}
            {galerieUrls.length > 0 && (
              <Reveal>
                <section aria-labelledby="galerie-ev-titre">
                  <h2 id="galerie-ev-titre" className="text-sm font-semibold text-[#1D1E21] mb-3">En images</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {galerieUrls.map((url, i) => (
                      <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#DFE0E1]">
                        <Image src={url} alt={`Photo ${i + 1} de l'événement ${e.titre}`} fill className="object-cover" sizes="(max-width: 640px) 50vw, 240px" />
                      </div>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Contact organisateur */}
            {(e.contactNom || e.contactEmail || e.contactTelephone) && (
              <Reveal>
                <section aria-labelledby="contact-ev-titre">
                  <h2 id="contact-ev-titre" className="text-sm font-semibold text-[#1D1E21] mb-2">Contact</h2>
                  {e.contactNom && <p className="text-sm text-[#4E5155] mb-2">{e.contactNom}</p>}
                  <div className="flex flex-wrap gap-2">
                    {e.contactEmail && (
                      <a href={`mailto:${e.contactEmail}`} className="inline-flex items-center gap-1.5 p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] no-underline transition-colors">
                        {e.contactEmail}
                      </a>
                    )}
                    {e.contactTelephone && (
                      <a href={`tel:${e.contactTelephone}`} className="inline-flex items-center gap-1.5 p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] no-underline transition-colors">
                        {e.contactTelephone}
                      </a>
                    )}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Réseauteur organisateur (ADR-0013 — événement d'un réseauteur Plus) */}
            {organisateurRz && (
              <Reveal>
                <section aria-labelledby="organisateur-titre">
                  <h2 id="organisateur-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
                    <Users size={14} aria-hidden />
                    Organisé par
                  </h2>
                  {/* Accent orange = organisateur réseauteur Plus (vs bleu pour un réseau — ADR-0013) */}
                  <Link
                    href={`/reseauteur/${organisateurRz.slug}`}
                    className="rsn-lift flex items-center gap-3 p-2.5 rounded-xl border border-[#DFE0E1] hover:border-[#F5E050]/50 transition-colors no-underline group"
                  >
                    {organisateurPhotoUrl ? (
                      <Image
                        src={organisateurPhotoUrl}
                        alt={`Photo de ${organisateurRz.prenom} ${organisateurRz.nom}`}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover border border-[#DFE0E1] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#FEFBE6] flex items-center justify-center text-[#8A6D0B] font-bold text-sm shrink-0" aria-hidden>
                        {organisateurRz.prenom?.charAt(0)}{organisateurRz.nom?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1D1E21] group-hover:text-[#8A6D0B] transition-colors">
                        {organisateurRz.prenom} {organisateurRz.nom}
                      </p>
                      <p className="text-xs text-[#6E7175]">
                        Réseauteur{organisateurRz.ville ? ` · ${organisateurRz.ville}` : ''}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-[#999A9D] group-hover:text-[#8A6D0B] transition-colors shrink-0 rsn-arrow" aria-hidden />
                  </Link>
                </section>
              </Reveal>
            )}

            {/* Réseau organisateur */}
            {reseau && (
              <Reveal>
                <section aria-labelledby="reseau-titre">
                  <h2 id="reseau-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
                    <Network size={14} aria-hidden />
                    Réseau organisateur
                  </h2>
                  <Link
                    href={`/reseau/${reseau.slug}`}
                    className="rsn-lift flex items-center gap-3 p-2.5 rounded-xl border border-[#DFE0E1] hover:border-[#035AA6]/40 transition-colors no-underline group"
                  >
                    {reseauLogoUrl ? (
                      <Image
                        src={reseauLogoUrl}
                        alt={`Logo ${reseau.nom}`}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-contain border border-[#DFE0E1] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#A9C9E4]/30 flex items-center justify-center text-[#035AA6] font-bold text-sm shrink-0">
                        {reseau.nom.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1D1E21] group-hover:text-[#035AA6] transition-colors">{reseau.nom}</p>
                      {reseau.ville && <p className="text-xs text-[#6E7175]">{reseau.ville}</p>}
                    </div>
                    <ArrowRight size={14} className="text-[#999A9D] group-hover:text-[#035AA6] transition-colors shrink-0 rsn-arrow" aria-hidden />
                  </Link>
                </section>
              </Reveal>
            )}
            {/* Réseauteurs présents (participations signalées) */}
            {participants.length > 0 && (
              <Reveal>
                <section aria-labelledby="participants-titre">
                  <h2 id="participants-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
                    <Users size={14} aria-hidden />
                    Réseauteurs présents
                    <span className="text-[#999A9D] font-normal">({participants.length})</span>
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
                          className="rsn-linkrow inline-flex items-center gap-2 p-2.5 rounded-full bg-[#E9E9EA] border border-[#DFE0E1] hover:border-[#035AA6] no-underline transition-colors group"
                        >
                          {pPhotoUrl ? (
                            <Image src={pPhotoUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" aria-hidden />
                          ) : (
                            <span
                              className="w-6 h-6 rounded-full bg-[#035AA6]/10 text-[#035AA6] text-[10px] font-bold flex items-center justify-center"
                              aria-hidden
                            >
                              {p.prenom?.charAt(0)}{p.nom?.charAt(0)}
                            </span>
                          )}
                          <span className="text-xs font-medium text-[#4E5155] group-hover:text-[#035AA6] transition-colors">
                            {p.prenom} {p.nom}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                  <p className="text-xs text-[#999A9D] mt-2">
                    Réseauteurs de la plateforme ayant signalé leur présence.
                  </p>
                </section>
              </Reveal>
            )}

            {/* Lieu — mini-carte de l'événement */}
            {typeof e.lieuLatitude === 'number' && typeof e.lieuLongitude === 'number' && (
              <Reveal>
                <section aria-labelledby="lieu-titre">
                  <h2 id="lieu-titre" className="text-sm font-semibold text-[#1D1E21] mb-2 flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden />
                    Lieu
                  </h2>
                  <MiniMapLoader
                    latitude={e.lieuLatitude}
                    longitude={e.lieuLongitude}
                    zoom={14}
                    // Même accent que les marqueurs de la carte (ADR-0013) :
                    // orange = organisé par un réseauteur Plus, navy = réseau
                    color={isPlusEvent ? MAP_COLORS.evenementReseauteur : MAP_COLORS.evenement}
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
          <div className="px-6 py-5 border-t border-[#DFE0E1] bg-[#F2F2F2] flex flex-wrap gap-4 justify-between items-center">
            <Link
              href="/evenements"
              className="rsn-linkrow text-sm text-[#035AA6] font-medium hover:text-[#02467F] no-underline transition-colors flex items-center gap-1"
            >
              ← Tous les événements
            </Link>
            {/* CTA vers la carte des événements */}
            <Link
              href={`/evenements?vue=carte&ville=${encodeURIComponent(e.lieuVille ?? '')}`}
              className="rsn-linkrow inline-flex items-center gap-1.5 text-sm text-[#6E7175] hover:text-[#035AA6] no-underline transition-colors"
            >
              <MapPin size={13} aria-hidden />
              Voir sur la carte
            </Link>
          </div>
          {/* Ligne de validation (créé par + dernière mise à jour) */}
          {(e.updatedAt || e.creePar) && (
            <div className="px-6 py-2.5 border-t border-[#DFE0E1] bg-white text-[11px] text-[#999A9D] flex flex-wrap gap-x-3 gap-y-0.5">
              {e.creePar && <span>Créé par {e.creePar}</span>}
              {e.updatedAt && <span>{e.creePar ? '· ' : ''}Mis à jour le {new Date(e.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
