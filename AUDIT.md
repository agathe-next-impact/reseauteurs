# AUDIT.md — Audit du dépôt existant (état d'origine PanoramaPub)

> Produit par `codebase-auditor` (lecture seule). Phase 1 du pipeline d'agents.
>
> **Note 2026-06-28 :** cet audit décrit l'état d'origine **PanoramaPub** et reste un inventaire fiable de la
> stack et de la qualité du dépôt. La **cible** a évolué : ce n'est plus « Info-Réseaux / Réseau→Occurrences »
> ni l'annuaire mono-entité (ADR-0010), mais le **modèle à trois entités** — réseauteurs · événements ·
> réseaux (**ADR-0011**, voir `CLAUDE.md` et `ARCHITECTURE.md`). Le **verdict `REFACTOR_IN_PLACE` tient
> *a fortiori*** : le retour des événements et des réseaux-entités rapproche la cible de l'existant
> PanoramaPub, donc augmente la réutilisation. Lire les mappings de domaine ci-dessous à la lumière de
> l'ADR-0011 (`Fournisseur`/`Organisateur` → `reseaux`-entité ; `Evenement` → `evenements` simplifié ;
> nouveauté = collection `reseauteurs`).
>
> **Note 2026-07-20 (réconciliation) :** ce document est un **artefact historique** — son corps n'est **pas**
> réécrit. ⚠️ Plusieurs *recommandations cible* ci-dessous sont désormais **caduques** et ne doivent pas être
> prises pour le cap actuel : le **quota d'événements/an** et les **3 paliers 90/130/190 €** (colonnes
> « cible » des tableaux, ADR-4 historique) ont été **abandonnés** ; la monétisation actuelle est **mixte** —
> réseauteur **Plus** (abonnement 39 € HT/an, ADR-0013), **réseau partenaire par 4 paliers**
> `fiche`/`starter`/`growth`/`enterprise` (ADR-0012/0014), **partenaire annonceur** — sans **événement
> Premium** (ADR-0012, supprimé) ni **packs de licences** (ADR-0015, supprimés), gérée en libre-service via le
> hub `/dashboard/abonnement` (ADR-0016). Pour l'état réel, se référer à `CLAUDE.md` §4, `ARCHITECTURE.md` et
> `MIGRATION.md` (tous réconciliés le 2026-07-20).

## 1. Résumé exécutif

Le dépôt `C:\dev\infos-reseaux` **n'est pas un simple annuaire** : c'est **PanoramaPub.fr** (`name: "panorama-pub"` dans `package.json:2`), une application **Next.js 16.2.1 + React 19 (App Router, TypeScript strict)** construite sur **Payload CMS 3.80** avec **PostgreSQL (Neon)**, déjà en production (logs Vercel commités, ~39 000 lignes TS sur 293 fichiers). C'est un annuaire de **revendeurs/fournisseurs d'objets publicitaires** avec **événements associés, carte interactive, abonnements Stripe à 3 paliers, géocodage, SEO complet (SSR/ISR + JSON-LD + sitemap dynamique), 25+ tests d'intégration et conformité RGPD**. La distance avec le modèle cible Réseau→Occurrences est faible : `Fournisseur`/`OrganisateursEvenements` ↔ Réseau, `Evenement` ↔ Occurrence. Les manques sont ciblés et traitables (pas de PostGIS, quotas par nombre de fiches au lieu d'événements/an, MapLibre à substituer à Mapbox, rebranding).

### VERDICT : **REFACTOR_IN_PLACE**

Score moyen **3.9/5**. Base saine, sécurisée, testée, déjà sur la stack cible, avec SEO/SSR et facturation Stripe de qualité production. On étend et on réaligne in place ; **aucun argument ne justifie un REBUILD** (qui détruirait un actif considérable). Le refactor est un réalignement de domaine, pas un assainissement.

---

## 2. Localisation de l'existant

- **L'existant EST le répertoire de travail** `C:\dev\infos-reseaux\` (le git status initial trompe : le dossier est en réalité densément peuplé). Aucun dossier voisin sous `C:\dev\` n'est l'annuaire cible.
- Identité réelle : **PanoramaPub.fr** — `package.json:2`, `.env.example` (domaine `panorama-pub.com`), `next.config.ts:10`.
- Le `CLAUDE.md` Info-Réseaux a été déposé par-dessus ce dépôt : c'est ce projet qu'il faut transformer en Info-Réseaux.fr.

---

## 3. Inventaire de la stack et de la structure

| Dimension | Constat | Preuve |
|---|---|---|
| Framework | Next.js **16.2.1**, **App Router** pur (pas de Pages Router), React 19.2 | `package.json:40-42`, `src/app/(frontend)`, `src/app/(payload)` |
| Langage | TypeScript **strict** | `tsconfig.json:11` (`"strict": true`) |
| Rendu | **SSR + ISR** (`revalidate=300/3600`), `generateStaticParams`, `generateMetadata` dynamiques, Server Components par défaut | `evenements/[slug]/page.tsx:25,27,74`, `sitemap.ts:6` |
| CMS / back-office | **Payload CMS 3.80** (admin `/admin`, GraphQL+REST auto) | `src/payload.config.ts`, `src/app/(payload)` |
| ORM / accès données | **Payload + `@payloadcms/db-postgres` (drizzle sous le capot)** — pas de Prisma, pas de SQL brut applicatif | `payload.config.ts:1,82`; grep : 0 requête concaténée hors migrations |
| Migrations | **Migrations versionnées** (`push:false`, ~35 fichiers SQL datés, `up`/`down`) | `payload.config.ts:85`, `src/migrations/` |
| Index | B-tree composites présents, dont un index géo composite `(statut, visible, lieu_latitude, lieu_longitude)` | `20260426_200000_add_geo_indexes.ts`, `unique`/`index` sur slugs, dateDebut, statut, user |
| **PostGIS** | **ABSENT.** Géo stockée en colonnes `number` lat/lon ; requêtes via `find()` + filtrage JS (jusqu'à 5000 docs), pas de `ST_DWithin`/bbox/GiST | `geo/evenements/route.ts:128-146`, `lib/geocode.ts` |
| Carte | **Mapbox GL** (`mapbox-gl`, `react-map-gl`) — cible = MapLibre | `package.json:39,45` |
| Géocodage | **API Adresse data.gouv.fr** (gratuit, FR) en hook `beforeChange` | `lib/geocode.ts:15` |
| Auth | **Payload Auth** (JWT, verify email, lockout 5 essais/10 min, forgot-password) — cible mentionne Auth.js/Lucia mais Payload Auth est natif et suffisant | `collections/Users.ts:30-50` |
| Paiement | **Stripe** complet : Checkout, Customer Portal, webhooks signés, change-plan, proration, coupons de groupe, factures | `src/app/api/stripe/*`, `lib/stripe.ts` |
| Emails | **Resend** + webhook bounce/complaint + séquence onboarding (J3/J7/J14) + alertes expiration | `payload.config.ts:72`, `api/resend/webhook` |
| Médias | **Vercel Blob** + Sharp (resize) | `payload.config.ts:116-124` |
| Tests | **Vitest (25 specs int.) + Playwright (2 e2e)** | `tests/int/*`, `tests/e2e/*`, `vitest.config.mts` |
| Sécurité HTTP | CSP stricte, HSTS, X-Frame-Options, basic-auth optionnelle, rate-limit | `next.config.ts:12-37`, `src/proxy.ts` (middleware), `lib/rate-limit.ts` |
| Lint/format | ESLint (next config) + Prettier | `eslint.config.mjs`, `.prettierrc.json` |
| Crons | archivage événements passés, downgrade plans expirés, alertes, onboarding, purge RGPD | `src/app/api/cron/*` |
| Hébergement | Vercel (config commitée) + Docker optionnel | `vercel.json`, `Dockerfile`, `docker-compose.yml` |

**Structure** : `src/app/(frontend)` (pages publiques + dashboard organisateur), `src/app/(payload)` (admin), `src/app/api` (geo, stripe, cron, ical, account, groupes), `src/collections` (12 collections), `src/lib` (logique métier), `src/migrations`, `tests`.

---

## 4. Modèle de données existant → mapping Réseau→Occurrences

| Entité existante | Champs clés | Cible Info-Réseaux | Écart |
|---|---|---|---|
| **Fournisseurs** (`collections/Fournisseurs.ts`) | slug, raisonSociale, ville, adresse, lat/lon, logo, bannière, illustrations, réseaux sociaux, description, SEO, statut, user | **Réseau** (organisateur durable, payant) | Renommer concept « fournisseur/revendeur » → « réseau ». Champs RSE/boutique/offres-emploi à retirer ou neutraliser. **Mappe à ~90%.** |
| **OrganisateursEvenements** (`collections/OrganisateursEvenements.ts`) | nom, ville, slug, logo, description, réseaux sociaux, SEO, user | **Réseau** (variante « organisateur externe ») | Doublon conceptuel avec Fournisseurs : à fusionner en une entité Réseau unique (décision `solution-architect`). |
| **Evenements** (`collections/Evenements.ts`) | titre, slug, type, **dateDebut/dateFin**, lieu (nom/adresse/CP/ville/**lat/lon**), descriptionCourte, lienInscription, bannière, statut, visible, SEO, rattachement organisateur | **Occurrence** (événement daté d'un réseau) | **Mappe directement.** Modèle déjà « entité durable → événements datés » via la relation `fournisseur`/`organisateurExterne`. Manque : récurrence native (RRULE) — aujourd'hui chaque occurrence est saisie une à une. |
| **TypesEvenement** (`collections/TypesEvenement.ts`) | label, value, couleur, ordre | **Catégories** (Réseaux d'affaires, Afterworks, Salons…) | Données à réseeder avec les 7 catégories cibles (§8 CLAUDE.md). Structure prête. |
| **CategoriesActivite** | label, value, couleur | Filtres secondaires | Réutilisable ou simplifiable. |
| **Users** | role (admin/fournisseur/organisateur), **plan (gratuit/premium/infinite)**, planExpiresAt, stripeCustomerId, billing, RGPD consents | **Organisateur (client payant)** | Mappe. Plans à recalibrer : Accès 90€/≤10, Développement 130€/11-20, Premium 190€/illimité. |
| **Groupes** | code affiliation, coupons Stripe, paliers | Affiliation multi-comptes | Hors scope cible immédiat — à conserver inactif, pas à supprimer. |
| **Quotas** | `getEffectiveFeatureLevel`, `canCreateFiche` (1 user=1 fiche), pas de quota événements (illimité) | **Quota événements/an (10/20/∞)** | **Manque principal côté métier** : la logique quota existe mais porte sur les *fiches*, pas sur le *nombre d'événements/an*. À réimplémenter (`Evenements.ts:236-238` indique explicitement « pas de quota d'événements »). |

**Concept « national »** (`evenements-nationaux`, événement sans fournisseur) = précédent direct du modèle « un réseau = des dizaines de points » qui règle le cold-start.

---

## 5. Scorecard qualité

| Dimension | Note /5 | Preuve | Commentaire |
|---|---|---|---|
| Architecture & séparation | **4** | collections/hooks/lib/api bien séparés ; logique métier dans `src/lib` testée à part | Couplage fort à Payload (avantage : moins de code ; inconvénient : framework lock-in). |
| Modèle de données & intégrité | **4** | FK relationnelles, `beforeDelete` bloquant les suppressions référencées (`Fournisseurs.ts:257`, `TypesEvenement.ts:18`), slugs `unique`+`index`, enums statut | Dualité Fournisseur/Organisateur = dette de modélisation à fusionner. |
| Sécurité | **4.5** | Stripe `constructEvent` signé + idempotence UNIQUE (`webhook/route.ts:208,36`), access control par champ + defense-in-depth ownership (`Evenements.ts:257-329`), XSS JSON-LD échappé (`JsonLd.tsx:9`), constant-time auth (`proxy.ts`), CSP stricte, aucun secret commité, aucun SQL concaténé | Très solide. Voir §6. |
| Tests | **4** | 25 specs int. (stripe-webhook-idempotence, access-control, geo, crons, account-delete) + 2 e2e Playwright | Couverture métier réelle ; pas de mesure de % mais les chemins critiques sont couverts. |
| Dépendances & maintenance | **4.5** | Next 16, React 19, Payload 3.80, Stripe SDK 20, Zod 4 — tout récent (juin 2026) | Versions fraîches, peu de dette de version. |
| Lisibilité & cohérence | **4.5** | Commentaires explicatifs riches (rationale des choix, refs bugs), nommage FR/EN cohérent, ESLint+Prettier | Code documenté au-dessus de la moyenne. |
| Performance | **3** | Index composites, ISR, select projeté, cache fresh-user anti-N+1 (`access.ts:39`) | **Limite géo** : fetch ≤5000 docs + filtre JS sans index spatial — OK à l'échelle actuelle, ne tiendra pas à l'échelle nationale visée. |
| **Aptitude SEO & SSR** | **5** | SSR+ISR par fiche, `generateMetadata` dynamique, **JSON-LD Event/LocalBusiness/Breadcrumb/FAQ** (`lib/jsonld.ts`), sitemap dynamique filtré noindex+date (`sitemap.ts`), URLs propres `/evenements/<slug>`, 308 legacy-id→slug | **Exactement l'exigence forte du §7 CLAUDE.md, déjà livrée.** Actif majeur. |
| **Aptitude carte/géo** | **3** | lat/lon géocodés + stockés + index B-tree + GeoJSON FeatureCollection (`lib/geojson`), carte fonctionnelle | Données géo exploitables **mais** Mapbox (≠ MapLibre cible) et **pas de PostGIS** (requêtes spatiales à implémenter). |

**Moyenne : 3.94 / 5.**

---

## 6. Sécurité (findings priorisés)

Aucun finding rédhibitoire. Posture nettement au-dessus de la moyenne.

1. **[INFO / à vérifier au déploiement]** Variables sensibles correctement externalisées : `.env` n'est **pas** tracké (`git ls-files` vide sur `.env`), `.env.example` ne contient que des placeholders. `test.env` est tracké — **vérifier qu'il ne contient pas de secret réel** (à confirmer avant tout commit public ; nature : fichier d'env de test, 62 octets).
2. **[POSITIF] Webhooks Stripe** : signature vérifiée (`constructEvent`, `webhook/route.ts:208`), idempotence persistante via contrainte UNIQUE + gestion fine des erreurs non-dupliquées (re-throw → 500 → retry Stripe).
3. **[POSITIF] AuthZ** : access control collection + champ, re-vérification d'ownership en `beforeChange` (anti-escalade sur transfert de propriété — `Evenements.ts:257`), strip des champs sensibles sur update non-admin (`Users.ts:87-111`).
4. **[POSITIF] Validation entrées** : Zod côté serveur (`geo/.../route.ts:11`), validation URL/YouTube/email, strip emojis serveur en filet (REST/admin), limites mots/caractères.
5. **[POSITIF] XSS** : unique `dangerouslySetInnerHTML` est le JSON-LD, échappé `<`/U+2028/U+2029 (`JsonLd.tsx`).
6. **[POSITIF] Injection SQL** : nulle surface — tout passe par Payload/drizzle paramétré ; les seuls `sql`` `` sont dans les migrations (DDL statique).
7. **[POSITIF] Headers** : CSP, HSTS preload, anti-clickjacking ; basic-auth optionnelle à comparaison constant-time.

---

## 7. Actifs récupérables

**Données / contenu :**
- `src/data/revendeurs-seed.json` (~34 Ko) : annuaire de fournisseurs réels (slugs, villes, CP, départements) — base de contenu réutilisable.
- Base Neon de production (membres, fiches, événements, slugs SEO déjà indexés) — récupérable via migration de données (`data-architect`).
- Les **slugs et URLs** existants (capital SEO) — à préserver via redirections.

**Logique métier saine (réutilisable quasi telle quelle) :**
- Tout le pipeline **Stripe** (checkout, portal, change-plan+proration, webhooks idempotents, factures, coupons).
- **SEO** : `lib/jsonld.ts`, `lib/seo.ts`, `sitemap.ts`, `robots.ts`, composants `JsonLd`/`SeoBreadcrumb`.
- **Géocodage** `lib/geocode.ts`, GeoJSON `lib/geojson`, génération de slugs, dates Paris-TZ.
- **Auth** complète (verify, lockout, reset, change-email sécurisé), **RGPD** (export/delete compte, registre traitements, blacklist email).
- **Crons** (archivage, downgrade, alertes, purge), **iCal export**, **emails transactionnels**.
- Infra : CSP/headers, rate-limit, middleware, tests, migrations.

**Jetable / à neutraliser :**
- Vocabulaire et champs « pub/RSE/boutique/offres-emploi/revendeur » spécifiques à l'objet publicitaire.
- Mapbox (remplacer par MapLibre).
- Dualité Fournisseur/Organisateur (à fusionner).

---

## 8. Justification du verdict (rubric)

- **REUSE_AS_IS** écarté : App Router et SSR sont exploitables, l'accès données est propre, le score ≥ moyen — **mais** le modèle n'est pas *littéralement* Réseau→Occurrences (dualité d'entités, quotas portant sur les fiches, vocabulaire pub), et PostGIS/MapLibre manquent. On ne peut pas « étendre sans rien réaligner ».
- **REFACTOR_IN_PLACE** retenu : tous les critères du rubric sont réunis — base saine, dette traitable (PostGIS à activer, ORM déjà standard via Payload, SEO/index déjà excellents, fusion d'entités + recalibrage quotas + rebranding + MapLibre), score moyen 3.94 dans la fourchette 2.5–4. On nettoie et on étend **in place, sans changer de stack ni de dépôt**.
- **REBUILD** explicitement rejeté : aucune des trois conditions (architecture fondamentalement malsaine / sécurité rédhibitoire / dette > coût de réécriture) n'est remplie. Réécrire détruirait ~39k LOC testées, un pipeline Stripe production-grade et un SEO complet — coût largement supérieur au refactor.

**Compromis tranché** : le seul argument pro-rebuild serait « le domaine pub est éloigné du domaine réseaux ». Il ne tient pas : le **squelette technique** (entité durable + événements datés + carte + abonnements + SEO) est précisément celui d'Info-Réseaux. Le travail est un **réalignement de domaine sur une fondation technique réutilisable**, pas un assainissement de code malsain.

---

## 9. Risques et recommandations pour `solution-architect`

**Risques :**
1. **Couplage Payload CMS** : le CLAUDE.md cible « Prisma ». Imposer Prisma signifierait abandonner Payload (admin, auth, hooks, migrations) — un quasi-rebuild. **Recommandation : conserver Payload+postgres-adapter** et documenter un ADR justifiant l'écart au CLAUDE.md (Payload *est* déjà l'accès Postgres standardisé du projet).
2. **Géo non spatiale** : le filtrage JS sur ≤5000 docs ne tiendra pas à l'échelle nationale. **Recommandation ADR : activer PostGIS** (colonne `geography(Point)` alimentée par le hook de géocodage existant + index GiST + `ST_DWithin`/bbox) dans une route géo dédiée, sans casser le `find()` Payload pour le reste.
3. **Dualité Fournisseur/Organisateur** : décider la fusion en une entité **Réseau** unique (migration de données) vs garder deux types — impacte schéma, access, SEO, carte.
4. **Quotas événements/an** : réimplémenter la logique de quota (aujourd'hui « illimité » côté événements) selon les paliers 10/20/∞ ; recalibrer prix Stripe (90/130/190 € HT).
5. **MapLibre vs Mapbox** : substitution UI (la couche données GeoJSON est agnostique, faible risque).
6. **Rebranding** : domaine, nom, CSP `siteSources`, emails, copies — mécanique mais transverse.
7. **`test.env`** : auditer son contenu avant publication (point §6.1).

**Recommandation d'ordonnancement pour la phase suivante :**
1. ADR-1 « Conserver Payload CMS comme couche d'accès Postgres » (écart assumé vs Prisma).
2. ADR-2 « Activer PostGIS + requêtes spatiales pour la carte nationale ».
3. ADR-3 « Fusion Fournisseur+Organisateur → entité Réseau ».
4. ADR-4 « Recalibrage abonnements + quota événements/an ».
5. `data-architect` : plan de reprise des données existantes (slugs SEO préservés, redirections).
6. Conserver tel quel : Stripe, SEO/JSON-LD/sitemap, auth, crons, tests, RGPD, géocodage.
