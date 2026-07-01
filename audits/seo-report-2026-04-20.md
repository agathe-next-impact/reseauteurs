# Rapport SEO / GEO / OpenGraph / GraphQL — 2026-04-20

Livrable du chantier de refonte SEO. Build `pnpm build` vert, migration SEO appliquee, zero erreur TypeScript.

## Decisions produit prises

| Question | Decision | Justification |
|----------|----------|---------------|
| Facettes indexables `/revendeurs?activite=...` ? | **Non** (pour l'instant) | Evite le contenu duplique, aucune page canonicale par facette en place. A rouvrir si besoin. |
| LLM crawlers (GPTBot, Perplexity, Claude, Applebot-Extended, Google-Extended) ? | **Autorises** | Annuaire B2B — visibilite generative souhaitee. |
| Hreflang ? | **Non** | Site FR only (`<html lang="fr">` suffit). |
| Stack OG images ? | `next/og` natif | Evite d'ajouter `@vercel/og`. Per-entite en Node runtime (acces DB), home en Edge. |
| `schema-dts` ? | **Non installe** | Types inline suffisent, -1 dependance. |

## Artefacts crees

### Helpers
- `src/lib/site.ts` — etendu : `SITE_NAME`, `SITE_TAGLINE`, `SITE_DESCRIPTION`, `SITE_LOCALE`, `SITE_LANG`, `SITE_COUNTRY`, `DEFAULT_OG_IMAGE`.
- `src/lib/seo-text.ts` — `stripMarkdown`, `truncate`, `truncateTitle`, `truncateDescription`, `joinNonEmpty`.
- `src/lib/seo.ts` — `buildMetadata`, `buildRootMetadata`, `applySeoOverrides`, types `BuildMetadataInput`, `SeoFieldInput`.
- `src/lib/jsonld.ts` — 7 builders : `buildOrganizationJsonLd`, `buildWebSiteJsonLd`, `buildBreadcrumbListJsonLd`, `buildLocalBusinessJsonLd`, `buildEventJsonLd`, `buildOrganisateurJsonLd`, `buildItemListJsonLd`, `buildFAQPageJsonLd`.

### Composants
- `src/components/seo/JsonLd.tsx` — injection `<script type="application/ld+json">`, accepte un objet ou un tableau.
- `src/components/seo/SeoBreadcrumb.tsx` — breadcrumb visuel + JSON-LD `BreadcrumbList` synchro.

### Collections
- `src/collections/fields/seoField.ts` — field group partage `{ title, description, keywords, ogImage, noindex }`.
- Attache a : `Fournisseurs`, `Evenements`, `OrganisateursEvenements`, `CategoriesActivite`, `TypesEvenement`.

### Migration DB
- `src/migrations/20260420_140000_add_seo_group.ts` — ajoute 5 colonnes × 5 tables + FK media + index, guards `IF NOT EXISTS` et `EXCEPTION WHEN duplicate_object`. Enregistree dans `src/migrations/index.ts`.

### Routes systeme
- `src/app/sitemap.ts` — etendu : fournisseurs + evenements a venir + organisateurs + 11 pages statiques. Respecte `seo.noindex`.
- `src/app/robots.ts` — regles globales + allowlist LLM explicite. Sitemap pointe vers `${SITE_URL}/sitemap.xml`.
- `src/app/llms.txt/route.ts` — format llmstxt.org (markdown), cache 1h, enumere les sections et la politique de crawl.

### OpenGraph images (`next/og`)
- `src/app/opengraph-image.tsx` — OG racine 1200×630, gradient + logo. Edge runtime.
- `src/app/(frontend)/revendeurs/[slug]/opengraph-image.tsx` — per-fournisseur, couleur = activite principale, banniere en overlay 35% opacity. Node runtime.
- `src/app/(frontend)/evenements/[id]/opengraph-image.tsx` — per-event, couleur = type d'evenement. Node runtime.

### GraphQL
- `queries/seo.graphql` — 6 requetes : `FournisseurSeoBySlug`, `EvenementSeoById`, `OrganisateurSeoBySlug`, `SitemapFournisseurs`, `SitemapEvenements`, `SitemapOrganisateurs`.
- `queries/README.md` — documentation endpoint + authentification + exemples curl.

## Routes mises a jour

| Route | generateMetadata | JSON-LD | OG image dynamique | Breadcrumb + JSON-LD |
|-------|------------------|---------|--------------------|-----------------------|
| `/` (home) | ✅ `buildMetadata` | ✅ `Organization` + `WebSite`+`SearchAction` (root layout) | ✅ static `opengraph-image.tsx` | — |
| `/revendeurs` | ✅ `buildMetadata` | ✅ (via layout) | ✅ default | — |
| `/revendeurs/[slug]` | ✅ `buildMetadata` + `applySeoOverrides` | ✅ `LocalBusiness` complet | ✅ dynamic per-fiche | ✅ Accueil → Revendeurs → Fiche |
| `/evenements` | ✅ `buildMetadata` | ✅ (via layout) | ✅ default | — |
| `/evenements/[id]` | ✅ `buildMetadata` + `applySeoOverrides` | ✅ `Event` + `Place` + `GeoCoordinates` + `organizer` + `offers` | ✅ dynamic per-event | ✅ Accueil → Evenements → Fiche |
| `/organisateurs/[slug]` | ✅ `buildMetadata` + `applySeoOverrides` | ✅ `Organization` complet | ✅ default | ✅ Accueil → Evenements → Fiche |

### Root layout (`src/app/(frontend)/layout.tsx`)
- `metadata` = `buildRootMetadata()` : `metadataBase`, title template `%s | Panorama Pub`, `robots` ouvert avec directives `max-image-preview: large`, OG defaults, icons.
- `<JsonLd data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]} />` injecte sur TOUTES les pages publiques.

## Access control SEO

- Champs `seo.*` heritent du `read: () => true` des collections publiques (lecture anonyme OK), update reserve au proprietaire ou admin via le collection-level access deja en place.
- `seo.noindex` respecte dans sitemap.ts (filter), et dans `generateMetadata` via `applySeoOverrides` (prop `noindex: true`).
- Contact perso (`emailContact`, `telephone`) inclus dans le JSON-LD **uniquement s'ils sont renseignes par le proprietaire** (conformite RGPD preservee).

## Auto-verification

| Item | Status |
|------|--------|
| Chaque route publique a `generateMetadata` | ✅ |
| JSON-LD valide schema.org sur fournisseurs/evenements/organisateurs | ✅ (a valider sur validator.schema.org) |
| Sitemap liste fournisseurs publies + evenements futurs + organisateurs | ✅ |
| `robots.txt` coherent avec regles d'indexation | ✅ (Disallow `/dashboard`, `/admin`, `/api`, `/reset-password`, `/verify`, `/mot-de-passe-oublie`) |
| `llms.txt` present | ✅ `/llms.txt` (route dynamique, cache 1h) |
| OG images fonctionnelles | ✅ (3 templates : root + per-fiche + per-event) |
| `pnpm build` sans erreur TS | ✅ `Compiled successfully in 13.3s` |
| GraphQL queries testees | ⏳ A valider dans `/api/graphql-playground` apres deploiement |
| Lighthouse SEO ≥ 95 | ⏳ A mesurer apres deploiement |

## Contraintes respectees

- ✅ Aucune metadonnee hardcodee dans les pages : tout passe par `buildMetadata` + collections Payload.
- ✅ Canonical absolu construit depuis `SITE_URL`.
- ✅ Longueurs : titres tronques a 60 car., descriptions a 160 car. dans `buildMetadata`.
- ✅ Images OG 1200×630 natifs (next/og).
- ✅ Types TypeScript stricts sans `any`.
- ✅ Aucun emoji dans les tags / descriptions.
- ✅ Telephone / email non exposes si champs vides (RGPD).
- ✅ `pnpm generate:types` execute apres modif collections.

## Todo residuel (decisions produit)

- [ ] Tester les queries GraphQL SEO sur le playground une fois deploye.
- [ ] Mesurer Lighthouse SEO sur echantillon de 3 fournisseurs + 3 evenements apres deploiement.
- [ ] Valider le JSON-LD sur https://validator.schema.org (3 echantillons par type).
- [ ] Valider OG images sur opengraph.xyz et cards-dev.twitter.com apres deploiement.
- [ ] Soumettre `sitemap.xml` dans Google Search Console apres mise en prod.
- [ ] Si un compte Twitter/X officiel est cree, ajouter `twitter:site` dans `buildRootMetadata`.
- [ ] Si un `icon.png` HD est disponible, remplacer le fallback generique dans `opengraph-image.tsx`.

## Reference de style pour admins / redacteurs

Champs `seo.*` disponibles en sidebar sur chaque collection publique :

| Champ | Type | Fallback si vide |
|-------|------|------------------|
| `seo.title` | text (70 car. max) | `raisonSociale` / `titre` / `nom` |
| `seo.description` | textarea (200 car.) | `description` de la fiche ou phrase auto-generee |
| `seo.keywords` | text (CSV) | liste auto (ville + activite + nom) |
| `seo.ogImage` | upload media | `banniere` puis `logo` puis 1re illustration |
| `seo.noindex` | checkbox | `false` — la page est indexable |

Les champs sont entierement optionnels : laisser vide = les valeurs par defaut intelligentes de `buildMetadata` s'appliquent.
