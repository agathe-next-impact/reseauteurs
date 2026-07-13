import type { Media } from '@/payload-types'
import type { Reseauteur, EvenementRsn, Reseau, Categorie, TypesEvenement as TypesEvenementRsn } from '@/types/reseauteurs-domain'
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SITE_COUNTRY,
  CONTACT_EMAIL,
} from './site'

type JsonLd = Record<string, unknown>

function mediaUrl(m: unknown, size: 'full' | 'card' | 'thumbnail' = 'full'): string | null {
  if (!m || typeof m !== 'object') return null
  const media = m as Media
  const sized = media.sizes?.[size]?.url ?? media.url ?? null
  if (!sized) return null
  return /^https?:\/\//i.test(sized) ? sized : `${SITE_URL}${sized}`
}

function absUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// ─── Site-level builders ───────────────────────────────────────────────────────

/**
 * Organization — describes the RÉSEAUTEURS platform itself.
 * Used on the home page (layout.tsx). Distinct from buildReseauOrganizationJsonLd
 * which describes individual réseau d'affaires entities.
 */
export function buildOrganizationJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absUrl('/img/logo.png'),
    description: SITE_DESCRIPTION,
    email: CONTACT_EMAIL,
    slogan: SITE_TAGLINE,
    areaServed: { '@type': 'Country', name: 'France' },
  }
}

/**
 * WebSite with SearchAction — enables Google sitelinks search box.
 * Points to the réseauteurs search (main search target of the platform).
 */
export function buildWebSiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'fr-FR',
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/reseauteurs?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

// ─── Generic builders ──────────────────────────────────────────────────────────

export type BreadcrumbItem = { name: string; url: string }

export function buildBreadcrumbListJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.url),
    })),
  }
}

export type ItemListEntry = { name: string; url: string }

export function buildItemListJsonLd(items: ItemListEntry[], listName: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absUrl(item.url),
      name: item.name,
    })),
  }
}

export type FaqEntry = { question: string; answer: string }

export function buildFAQPageJsonLd(faq: FaqEntry[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }
}

// ─── RÉSEAUTEURS entity builders ──────────────────────────────────────────────

/**
 * Person — fiche réseauteur (/reseauteur/<slug>).
 *
 * RGPD :
 *  - Only includes fields explicitly provided by the réseauteur (non-null, non-empty).
 *  - Geo is at city/commune level only (centroïde ville — no personal address).
 *  - telephone and emailContact are NEVER included even if provided (structured
 *    data is machine-readable and increases contact-harvesting risk — RGPD ADR-0011 §7).
 *  - Call only when the profile is indexable (noindex !== true).
 */
export function buildPersonJsonLd(r: Reseauteur): JsonLd {
  const url = absUrl(`/reseauteur/${r.slug}`)
  // Prefer card size for Person image (portrait format); fall back to full
  const photoUrl = mediaUrl(r.photo, 'card') ?? mediaUrl(r.photo, 'full')

  const secteurDoc =
    typeof r.secteur === 'object' && r.secteur !== null ? (r.secteur as Categorie) : null

  const reseauxDocs = (r.reseauxFrequentes ?? []).filter(
    (res): res is Reseau => typeof res === 'object' && res !== null,
  )

  const jsonLd: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url,
    url,
    name: `${r.prenom} ${r.nom}`,
  }

  if (r.description) jsonLd.description = r.description
  if (photoUrl) jsonLd.image = photoUrl
  if (r.fonction) jsonLd.jobTitle = r.fonction

  // worksFor : entreprise (professional info, not personal contact)
  if (r.entreprise) {
    jsonLd.worksFor = { '@type': 'Organization', name: r.entreprise }
  }

  // address : city level only — RGPD (no street address for private individuals)
  if (r.ville) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressLocality: r.ville,
      ...(r.departement && { addressRegion: r.departement }),
      addressCountry: SITE_COUNTRY,
    }
    jsonLd.areaServed = r.ville
  }

  // sameAs : only explicitly provided public profile URLs
  const sameAs: string[] = []
  if (r.linkedin) sameAs.push(r.linkedin)
  if (r.site) sameAs.push(r.site)
  if (sameAs.length > 0) jsonLd.sameAs = sameAs

  // knowsAbout : secteur + compétences (professional, not personal)
  const knowsAbout: string[] = []
  if (secteurDoc?.label) knowsAbout.push(secteurDoc.label)
  for (const c of r.competences ?? []) {
    if (c.label) knowsAbout.push(c.label)
  }
  if (knowsAbout.length > 0) jsonLd.knowsAbout = knowsAbout

  // memberOf : réseaux fréquentés (public networking affiliation)
  if (reseauxDocs.length > 0) {
    jsonLd.memberOf = reseauxDocs.map((res) => ({
      '@type': 'Organization',
      name: res.nom,
      ...(res.slug && { url: absUrl(`/reseau/${res.slug}`) }),
    }))
  }

  return jsonLd
}

/**
 * Type léger pour les réseaux locaux listés dans subOrganization.
 * Exporté pour que reseau/[slug]/page.tsx puisse caster ses docs Payload.
 */
export type ReseauLocalLite = { id: number | string; slug?: string | null; nom: string }

/**
 * Organization — fiche réseau d'affaires (/reseau/<slug>).
 *
 * Distinct from buildOrganizationJsonLd() which describes the RÉSEAUTEURS platform.
 * Used on /reseau/[slug] pages.
 *
 * ADR-0012 §7 — hiérarchie JSON-LD :
 *  - Un réseau LOCAL expose `parentOrganization` pointant vers son national
 *    (champ `reseau.parent` populé à depth 1).
 *  - Un réseau NATIONAL expose `subOrganization` listant ses locaux publiés
 *    (passés via le paramètre `locaux`, limités à 50 pour les Rich Results).
 *  Aucun champ non renseigné n'est émis (fidélité aux données publiques réelles).
 */
export function buildReseauOrganizationJsonLd(
  reseau: Reseau,
  locaux?: ReseauLocalLite[],
): JsonLd {
  const url = absUrl(`/reseau/${reseau.slug}`)
  const logoUrl = mediaUrl(reseau.logo, 'card') ?? mediaUrl(reseau.logo, 'thumbnail')

  const jsonLd: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': url,
    url,
    name: reseau.nom,
  }

  if (reseau.description) jsonLd.description = reseau.description
  if (logoUrl) {
    jsonLd.logo = logoUrl
    jsonLd.image = logoUrl
  }

  if (reseau.ville) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressLocality: reseau.ville,
      addressCountry: SITE_COUNTRY,
    }
  }

  const sameAs: string[] = []
  if (reseau.siteWeb) sameAs.push(reseau.siteWeb)
  if (sameAs.length > 0) jsonLd.sameAs = sameAs

  // ── parentOrganization (ADR-0012) : réseau LOCAL → son national ──────────────
  // Inclus uniquement si parent est populé (depth ≥ 1) et contient nom + slug.
  if (reseau.niveau === 'local') {
    const parentDoc =
      typeof reseau.parent === 'object' && reseau.parent !== null
        ? (reseau.parent as Reseau)
        : null
    if (parentDoc?.nom) {
      jsonLd.parentOrganization = {
        '@type': 'Organization',
        name: parentDoc.nom,
        ...(parentDoc.slug && { url: absUrl(`/reseau/${parentDoc.slug}`) }),
      }
    }
  }

  // ── subOrganization (ADR-0012) : tête de réseau (non-local) → ses locaux publiés ─
  // Passés en paramètre depuis la page (évite un second fetch dans le builder).
  if (reseau.niveau !== 'local' && locaux && locaux.length > 0) {
    jsonLd.subOrganization = locaux.map((l) => ({
      '@type': 'Organization',
      name: l.nom,
      ...(l.slug && { url: absUrl(`/reseau/${l.slug}`) }),
    }))
  }

  return jsonLd
}

/**
 * Event — fiche événement RÉSEAUTEURS (/evenement/<slug>, modèle ADR-0011).
 *
 * Key differences from legacy buildEventJsonLd():
 *  - organizer = le réseau d'affaires organisateur (not a fournisseur)
 *  - lienInscription = external registration URL (RÉSEAUTEURS ne gère pas l'inscription)
 *  - image field (not banniere/logo)
 *  - Uses EvenementRsn domain type (not legacy Payload Evenement)
 */
export function buildEvenementRsnJsonLd(event: EvenementRsn): JsonLd {
  const url = absUrl(`/evenement/${event.slug ?? event.id}`)
  const imageUrl = mediaUrl(event.image, 'full')
  const reseau =
    typeof event.reseau === 'object' && event.reseau !== null ? (event.reseau as Reseau) : null
  const typeDoc =
    typeof event.type === 'object' && event.type !== null
      ? (event.type as TypesEvenementRsn)
      : null

  const jsonLd: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.titre,
    startDate: event.dateDebut,
    ...(event.dateFin && { endDate: event.dateFin }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.lieuNom || event.lieuVille || 'France',
      address: {
        '@type': 'PostalAddress',
        ...(event.lieuAdresse && { streetAddress: event.lieuAdresse }),
        ...(event.lieuCodePostal && { postalCode: event.lieuCodePostal }),
        addressLocality: event.lieuVille ?? '',
        addressCountry: SITE_COUNTRY,
      },
      ...(event.lieuLatitude != null &&
        event.lieuLongitude != null && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: event.lieuLatitude,
            longitude: event.lieuLongitude,
          },
        }),
    },
    url,
  }

  if (event.description) jsonLd.description = event.description
  if (imageUrl) jsonLd.image = imageUrl
  if (typeDoc?.label) jsonLd.about = typeDoc.label

  // organizer = le réseau d'affaires OU le réseauteur Plus (ADR-0013 — XOR ;
  // RÉSEAUTEURS lui-même ne l'est jamais)
  if (reseau) {
    jsonLd.organizer = {
      '@type': 'Organization',
      name: reseau.nom,
      ...(reseau.slug && { url: absUrl(`/reseau/${reseau.slug}`) }),
    }
  } else {
    const organisateurRz =
      typeof event.organisateurReseauteur === 'object' && event.organisateurReseauteur !== null
        ? (event.organisateurReseauteur as { prenom?: string; nom?: string; slug?: string | null })
        : null
    if (organisateurRz) {
      jsonLd.organizer = {
        '@type': 'Person',
        name: `${organisateurRz.prenom ?? ''} ${organisateurRz.nom ?? ''}`.trim(),
        ...(organisateurRz.slug && { url: absUrl(`/reseauteur/${organisateurRz.slug}`) }),
      }
    }
  }

  // offers = lien d'inscription externe (prix inconnu → free par défaut)
  if (event.lienInscription) {
    jsonLd.offers = {
      '@type': 'Offer',
      url: event.lienInscription,
      availability: 'https://schema.org/InStock',
      price: '0',
      priceCurrency: 'EUR',
    }
  }

  return jsonLd
}

// ─── Builders JSON-LD legacy PanoramaPub retirés (ADR-0011 / finding QA I-10) ───
// buildLocalBusinessJsonLd / buildEventJsonLd / buildOrganisateurJsonLd supprimés :
// modèle obsolète (fournisseurs / organisateurs-evenements démontés), aucun appelant
// actif. Le JSON-LD courant passe par buildPersonJsonLd / buildEvenementRsnJsonLd /
// buildReseauOrganizationJsonLd.
