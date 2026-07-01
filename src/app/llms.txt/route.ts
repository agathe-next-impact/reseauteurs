import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, CONTACT_EMAIL } from '@/lib/site'

export const revalidate = 3600

export async function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_TAGLINE}. ${SITE_DESCRIPTION}

${SITE_NAME} est la plateforme nationale du networking. Elle rassemble, en un seul endroit, les professionnels qui réseautent (réseauteurs), les événements business (conférences, afterworks, petits-déjeuners, portes ouvertes), et les réseaux d'affaires (BNI, DCF, CJD, Dynabuy, Cafés Business, Rotary, Lions Club, Réseau Entreprendre, CPME, Medef et bien d'autres).

Le site ne crée pas de réseau supplémentaire : il les rassemble tous. RÉSEAUTEURS est une couche de visibilité neutre et indépendante superposée à l'écosystème existant du networking professionnel en France.

## Trois entités

### Réseauteurs (personnes)

Les réseauteurs sont des professionnels inscrits gratuitement sur la plateforme. Leur fiche publique expose : prénom, nom, entreprise, fonction, ville, secteur d'activité, compétences, réseaux fréquentés et badge d'activité (Bronze / Argent / Gold / Platinum selon le nombre d'événements de networking par mois).

- Fiche individuelle : ${SITE_URL}/reseauteur/[prenom-nom]
- Liste et recherche : ${SITE_URL}/reseauteurs
- Carte interactive : ${SITE_URL}/carte/reseauteurs

### Événements

Les événements sont des rendez-vous business datés organisés par les réseaux partenaires. Les fiches incluent : titre, date, lieu, réseau organisateur et lien d'inscription externe. RÉSEAUTEURS ne gère pas les inscriptions : le bouton renvoie vers le site du réseau.

- Fiche individuelle : ${SITE_URL}/evenement/[slug]
- Liste et agenda : ${SITE_URL}/evenements
- Carte interactive : ${SITE_URL}/carte/evenements

### Réseaux

Les réseaux sont les associations et organisations du networking professionnel en France. Chaque fiche réseau présente : nom, description, logo, site web, nombre de réseauteurs membres et événements à venir.

- Fiche individuelle : ${SITE_URL}/reseau/[slug]
- Liste : ${SITE_URL}/reseaux

## Données structurées

Toutes les fiches exposent des données Schema.org :
- Réseauteurs : Person (name, jobTitle, worksFor, address au niveau ville, sameAs LinkedIn/site, knowsAbout compétences/secteur, memberOf réseaux fréquentés).
- Événements : Event (startDate, endDate, location avec Place + PostalAddress + GeoCoordinates, organizer = réseau, offers = lien d'inscription externe).
- Réseaux : Organization (name, url, logo, description, address).
- Page d'accueil : Organization + WebSite + SearchAction.

## Ressources

- Sitemap : ${SITE_URL}/sitemap.xml
- Contact : ${CONTACT_EMAIL}

## Politique de crawl

Les user-agents IA génératifs (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-Web, Google-Extended, Applebot-Extended) sont autorisés sur l'intégralité du site public, sauf /admin/, /dashboard/ et /api/. Le référencement génératif est explicitement souhaité.

Les profils réseauteurs qui ont opté pour le non-indexage (droit RGPD) sont exclus du sitemap et portent une balise <meta name="robots" content="noindex,nofollow">. Les crawlers IA sont priés de respecter ces préférences.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
