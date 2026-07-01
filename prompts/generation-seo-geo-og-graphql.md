# GÉNÉRATION — SEO / GEO / OpenGraph / GraphQL PanoramaPub.fr

## Mission

Concevoir et implémenter un **système unifié et automatisé** de génération de métadonnées pour toutes les pages publiques et tous les contenus de PanoramaPub.fr, couvrant :

1. **SEO classique** — `<title>`, meta description, canonical, robots, hreflang, sitemap, robots.txt
2. **GEO — Geographic** — schema.org `LocalBusiness` / `Place` / `Event`, coordonnées lat/lng, adresse structurée
3. **GEO — Generative Engine Optimization** — structured data pour moteurs IA (ChatGPT, Perplexity, Google AI Overviews), `llms.txt`
4. **OpenGraph + Twitter Cards** — tags `og:*`, `twitter:*`, images OG dynamiques
5. **GraphQL** — exposition cohérente des champs SEO via l'API Payload GraphQL auto-générée, vérification de la complétude

Objectif : **zéro hardcoding par page**. Toutes les métadonnées doivent être tirées des collections Payload (ou dérivées d'un helper central), versionnables, et actualisées automatiquement à chaque modification de contenu.

## Contexte projet

- Next.js 16 (App Router), Payload CMS 3, PostgreSQL. Détails : [CLAUDE.md](CLAUDE.md).
- Site multi-pages : accueil, annuaire (Map Revendeurs + fiches), événements (Map + Agenda + détails), pages auth/dashboard.
- Public cible : B2B, recherche de fournisseurs d'objets publicitaires par ville/activité → **fort potentiel SEO local**.
- Domaine : `panorama-pub.com` (variable `NEXT_PUBLIC_SITE_URL` + `lib/site.ts`).
- Sitemap existant : [src/app/sitemap.ts](src/app/sitemap.ts).
- GraphQL Payload : `/api/graphql`, playground `/api/graphql-playground`.

## Périmètre

### Routes publiques à couvrir

| Route                                    | Type        | Indexable | Priorité SEO |
|------------------------------------------|-------------|-----------|--------------|
| `/`                                      | Statique    | Oui       | Haute        |
| `/revendeurs`                            | Dynamique   | Oui       | Haute        |
| `/revendeurs/[slug]`                     | Dynamique   | Oui       | **Critique** |
| `/evenements`                            | Dynamique   | Oui       | Haute        |
| `/evenements/[id]`                       | Dynamique   | Oui       | **Critique** |
| `/login`, `/inscription`                 | Statique    | Oui       | Basse        |
| `/mot-de-passe-oublie`, `/reset-password`| Statique    | `noindex` | —            |
| `/verify`                                | Statique    | `noindex` | —            |
| `/dashboard/*`                           | Auth        | `noindex` | —            |
| `/admin/*`                               | Auth        | `noindex` | —            |

### Collections Payload alimentant le SEO

- [src/collections/Fournisseurs.ts](src/collections/Fournisseurs.ts) — fiches fournisseurs (schema `LocalBusiness`)
- [src/collections/Evenements.ts](src/collections/Evenements.ts) — événements (schema `Event`)
- [src/collections/CategoriesActivite.ts](src/collections/CategoriesActivite.ts) — pages / facettes par activité
- [src/collections/TypesEvenement.ts](src/collections/TypesEvenement.ts) — facettes événements
- [src/collections/OrganisateursEvenements.ts](src/collections/OrganisateursEvenements.ts) — schema `Organization`
- [src/collections/Media.ts](src/collections/Media.ts) — source des OG images (banniere, logo, illustrations)

### Champs SEO à ajouter (par collection)

Si absents, ajouter un group `seo` (facultatif, fallback sur les champs existants) :

- `seo.title` (text, 60 car. max)
- `seo.description` (textarea, 160 car. max)
- `seo.keywords` (text, optionnel)
- `seo.ogImage` (upload media, fallback sur `banniere` ou `logo`)
- `seo.noindex` (checkbox, défaut `false`)

Ces champs doivent être éditables depuis l'admin Payload et exposés en GraphQL sans action supplémentaire (Payload auto-génère).

## Livrables attendus

### 1. Helper central `lib/seo.ts`

Exporter une fonction `buildMetadata(input)` qui prend un objet normalisé et retourne un `Metadata` Next.js complet (title, description, canonical, openGraph, twitter, robots, alternates).

- Source de vérité unique, tous les `generateMetadata` du site l'appellent.
- Fallback en cascade : `seo.title` → nom de l'entité → titre global du site.
- Troncature automatique des descriptions à 160 caractères, titres à 60.
- Gestion du canonical absolu avec `SITE_URL`.

### 2. Helper `lib/jsonld.ts`

Exporter des builders typés par schéma :

- `buildLocalBusinessJsonLd(fournisseur)` → `LocalBusiness` avec `address`, `geo`, `telephone`, `url`, `image`, `priceRange`, `openingHours` si disponible, `aggregateRating` si prévu plus tard
- `buildEventJsonLd(evenement)` → `Event` avec `location` (`Place` + `PostalAddress` + `geo`), `startDate`, `endDate`, `organizer`, `eventStatus`, `eventAttendanceMode`
- `buildOrganizationJsonLd()` → `Organization` pour l'accueil (nom, logo, sameAs réseaux sociaux)
- `buildWebSiteJsonLd()` → `WebSite` + `SearchAction` pour la barre de recherche interne
- `buildBreadcrumbListJsonLd(path)` → fil d'Ariane
- `buildItemListJsonLd(items)` → listing fournisseurs / événements (`/revendeurs`, `/evenements`)
- `buildFAQPageJsonLd(faq)` si une page FAQ existe

Chaque builder retourne un objet sérialisable injecté via un composant `<JsonLd data={...} />` (script `type="application/ld+json"`).

### 3. `generateMetadata` sur chaque route dynamique

- [src/app/(frontend)/revendeurs/[slug]/page.tsx](<src/app/(frontend)/revendeurs/[slug]/page.tsx>) — SEO local par fournisseur
- [src/app/(frontend)/evenements/[id]/page.tsx](<src/app/(frontend)/evenements/[id]/page.tsx>) — SEO par événement
- [src/app/(frontend)/revendeurs/page.tsx](<src/app/(frontend)/revendeurs/page.tsx>) — SEO agrégé + gestion des facettes URL (activité, dept) si indexables
- [src/app/(frontend)/evenements/page.tsx](<src/app/(frontend)/evenements/page.tsx>) — idem

Chaque `generateMetadata` :
1. Charge la donnée via Local API Payload
2. Appelle `buildMetadata(...)`
3. Gère le 404 / entité supprimée avec `notFound()` + `robots: noindex`

### 4. Images OpenGraph dynamiques

Créer [src/app/opengraph-image.tsx](src/app/opengraph-image.tsx) pour l'accueil et un template `opengraph-image.tsx` par route dynamique si pertinent :

- Fournisseurs : bannière du fournisseur + nom + ville + logo sur fond coloré (couleur de l'activité principale)
- Événements : bannière + titre + date + ville + type
- Fallback statique si pas de bannière

Formats : 1200×630 (OG) + `twitter-image.tsx` en 1200×600.

### 5. Sitemap étendu

Mettre à jour [src/app/sitemap.ts](src/app/sitemap.ts) :

- Toutes les fiches `publiee`
- Tous les événements `publie` et futurs
- Pages de facettes par catégorie d'activité (ex : `/revendeurs?activite=textile`) si décidé d'indexer
- `lastModified` = `updatedAt` de la collection
- `changeFrequency` + `priority` cohérents par type
- Scission en sitemaps multiples (`sitemap-index.xml`) si > 50 000 URL

### 6. `robots.txt`

Créer [src/app/robots.ts](src/app/robots.ts) :

- Disallow `/dashboard/`, `/admin/`, `/api/`
- Allow le reste
- Sitemap vers `${SITE_URL}/sitemap.xml`
- Éventuellement directives spécifiques `GPTBot`, `PerplexityBot`, `ClaudeBot` (autoriser / bloquer selon décision produit)

### 7. `llms.txt` pour GEO générative

Créer [src/app/llms.txt/route.ts](src/app/llms.txt/route.ts) (ou fichier statique `public/llms.txt`) décrivant :

- Nom, mission, domaine du site
- Sections principales (annuaire fournisseurs, événements)
- URL de base des sitemaps
- Politique de crawl pour les LLM
- Format recommandé : https://llmstxt.org

### 8. Composants et utilitaires

- `<JsonLd data={...} />` (client/server) : injection propre du script
- `<SeoBreadcrumb path={...} />` : rend le breadcrumb visuel **et** injecte le JSON-LD associé
- Utilitaires `lib/seo-text.ts` : troncature, strip markdown, nettoyage HTML pour descriptions

### 9. Couverture GraphQL

Vérifier via `/api/graphql-playground` que :

- Les champs `seo.*` sont exposés sur chaque collection ayant le group
- Les champs `latitude`, `longitude`, `ville`, adresse sont queryables sur `Fournisseurs` et `Evenements`
- Les relations (`activitePrincipale.couleur`, `type.couleur`) sont accessibles en un seul appel
- Les filtres `where` couvrent : `statut`, `ville`, `activitePrincipale`, `dateDebut`

Livrable : fichier `queries/seo.graphql` contenant des queries types réutilisables :

- `FournisseurSeoBySlug($slug: String!)`
- `EvenementSeoById($id: Int!)`
- `SitemapFournisseurs` (paginé)
- `SitemapEvenements` (paginé, futurs uniquement)

## Standards à respecter

### SEO
- Longueurs : title 50-60 car., description 140-160 car.
- 1 `<h1>` par page (déjà présent dans les pages détail)
- Canonical absolu, sans paramètres non-indexables
- hreflang uniquement si plusieurs langues (pour l'instant `fr-FR` unique → `<html lang="fr">` suffit)

### OpenGraph
- `og:type` : `website` pour l'accueil/listes, `profile` pour fiches fournisseurs, `event` pour événements (via `og:type` custom ou JSON-LD strict)
- `og:image` : 1200×630, PNG/JPG, < 5 MB
- `og:locale` : `fr_FR`
- Twitter Card : `summary_large_image` partout, `twitter:site` si compte officiel

### Schema.org (JSON-LD)
- Format strict : `@context: 'https://schema.org'`, `@type` valide
- Valider chaque builder contre https://validator.schema.org avant commit
- `LocalBusiness` : `address` structuré (PostalAddress), `geo` (GeoCoordinates lat/lng), `url` canonical, `image` absolue
- `Event` : `eventStatus: EventScheduled`, `eventAttendanceMode: OfflineEventAttendanceMode` par défaut, `location` obligatoire
- Ne pas inventer de `aggregateRating` ou `review` sans vraies données

### GEO générative (LLM)
- Structured data robuste (JSON-LD complet) > simples tags meta
- `description` lisible et auto-suffisante (les LLM la pompent)
- Contenu principal dans du HTML sémantique (`<article>`, `<section>`, `<address>`)
- `llms.txt` à la racine

## Méthodologie

### Phase 1 — Inventaire et décisions
1. Lire les pages actuelles et lister les `export const metadata` / `generateMetadata` existants.
2. Identifier ce qui est déjà géré vs manquant.
3. Décider avec l'utilisateur :
   - Les pages de facettes (`/revendeurs?activite=...`) sont-elles indexables ?
   - Les LLM crawlers sont-ils autorisés ?
   - Besoin de hreflang pour une future version multilingue ?
4. Proposer un plan de migration si des métadonnées hardcodées doivent être déplacées vers Payload.

### Phase 2 — Extension des collections
1. Ajouter le group `seo` sur Fournisseurs, Evenements, CategoriesActivite, TypesEvenement, OrganisateursEvenements.
2. `pnpm generate:types` après modif.
3. Migration Payload si nécessaire pour colonnes SQL.

### Phase 3 — Helpers centraux
1. Implémenter `lib/seo.ts` (`buildMetadata`) avec tests unitaires.
2. Implémenter `lib/jsonld.ts` (builders schema.org) avec validation schema.
3. Implémenter `<JsonLd />` et `<SeoBreadcrumb />`.

### Phase 4 — Intégration dans les routes
1. Ajouter / mettre à jour `generateMetadata` sur chaque route publique.
2. Injecter le JSON-LD correspondant dans chaque page détail.
3. Créer les `opengraph-image.tsx` dynamiques.

### Phase 5 — Sitemap + robots + llms
1. Mettre à jour `src/app/sitemap.ts` pour couvrir toutes les entités publiables.
2. Créer `src/app/robots.ts`.
3. Créer `llms.txt`.

### Phase 6 — GraphQL
1. Vérifier l'exposition des nouveaux champs `seo.*`.
2. Écrire `queries/seo.graphql`.
3. Documenter l'usage dans un court README.

### Phase 7 — Validation
1. Page par page : View Source → vérifier `<title>`, `<meta>`, `<link rel="canonical">`, JSON-LD.
2. Tests automatisés :
   - https://validator.schema.org pour JSON-LD
   - https://opengraph.xyz pour OpenGraph
   - https://cards-dev.twitter.com/validator pour Twitter
   - Google Rich Results Test
3. Lighthouse SEO score ≥ 95 sur chaque route publique.
4. Google Search Console : soumettre le sitemap en fin de déploiement.

## Format du livrable final

Fichier `audits/seo-report-YYYY-MM-DD.md` listant :

- Routes mises à jour (tableau : route / metadata OK / JSON-LD OK / OG image OK / score Lighthouse)
- Collections étendues (champs ajoutés)
- Helpers créés (chemin + tests)
- Queries GraphQL ajoutées
- Validations externes (captures ou liens)
- Todo restant (si décisions produit en attente)

## Contraintes strictes

- **Aucune métadonnée hardcodée** dans les composants de page. Tout passe par `buildMetadata` + collections Payload.
- **Pas de duplication de descriptions** entre pages (Google pénalise).
- **Images OG ≤ 5 MB**, format PNG/JPG, dimensions exactes 1200×630.
- **Types TypeScript stricts** : pas de `any` dans les builders JSON-LD, utiliser `schema-dts` ou types custom.
- **Pas de `pnpm build` cassé** : vérifier à chaque étape que `pnpm build` passe.
- **Pas d'emoji** dans les tags ou descriptions, ton professionnel B2B.
- **Conformité RGPD** : ne pas exposer de données personnelles non publiques (téléphone, email de contact) dans le JSON-LD si le fournisseur ne les a pas rendus publics.
- Après modification des collections : `pnpm generate:types`.
- Après ajout d'un composant admin : `pnpm generate:importmap`.

## Auto-vérification avant rendu

- [ ] Chaque route publique listée a un `generateMetadata` fonctionnel
- [ ] Chaque page détail (fournisseur, événement) émet un JSON-LD valide schema.org
- [ ] Sitemap liste tous les fournisseurs `publiee` et événements `publie` futurs
- [ ] `robots.txt` généré, cohérent avec les règles d'indexation
- [ ] `llms.txt` présent à la racine (via route ou public/)
- [ ] OG images rendues correctement sur Facebook / LinkedIn / Twitter (test visuel)
- [ ] Validateur schema.org passe sans erreur sur 3 fiches et 3 événements échantillons
- [ ] `pnpm build` passe sans erreur TypeScript
- [ ] GraphQL : requêtes `FournisseurSeoBySlug`, `EvenementSeoById`, `SitemapFournisseurs`, `SitemapEvenements` fonctionnelles dans le playground
- [ ] Lighthouse SEO ≥ 95 sur `/`, `/revendeurs/[slug]` échantillon, `/evenements/[id]` échantillon
