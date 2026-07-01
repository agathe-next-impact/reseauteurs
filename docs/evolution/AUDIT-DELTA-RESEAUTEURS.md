# AUDIT-DELTA-RÉSEAUTEURS — Audit de bascule vers le modèle centré membre

> Audit en lecture seule (mode code-prep : pas de `node_modules`/DB, donc analyse statique pure, pas de build/typecheck). Ancré dans le code réel, références `fichier:ligne`. Source de vérité : `docs/adr/0010-bascule-annuaire-professionnels.md`. Ne remplace pas `AUDIT.md` (état d'origine PanoramaPub→Réseau→Occurrences).
>
> Produit le 2026-06-27 par `codebase-auditor`.

---

## ⚠️ AMENDEMENT 2026-06-28 — bascule vers le modèle à TROIS ENTITÉS (ADR-0011)

> **Ce delta a été écrit pour l'annuaire mono-entité de l'ADR-0010 (membre seul, réseaux = tags, sans
> événements). L'ADR-0011 (2026-06-28) le supersède sur plusieurs points.** Le **diagnostic factuel
> `fichier:ligne` ci-dessous reste valable** comme inventaire du code ; **seuls certains VERDICTS changent.**

**Ce qui change (lire avant d'appliquer les verdicts des §1 à §6) :**

| Asset | Verdict ADR-0010 (ci-dessous) | Verdict ADR-0011 (en vigueur) |
|---|---|---|
| `Evenements.ts` | **SUPPRIMER (hors V1)** | **GARDER + SIMPLIFIER** — les événements **reviennent** en V1 (2ᵉ carte). Retirer `participer`/quota/`serieId`/archivage ; **ajouter** `lienInscription` externe + drapeau `premium`. |
| `Reseaux.ts` (entité) | RÉÉCRIRE/DÉMONTER → taxonomie | **GARDER COMME ENTITÉ** (fiche, logo, présentation, compteurs, drapeau partenaire) **+** taxonomie M2M. Possédée par un compte **organisateur**. |
| `api/geo/evenements` + `MapEvenements*` | SUPPRIMER | **GARDER** — alimente la **carte des événements**. |
| Collection centrale | `membres` | **`reseauteurs`** (personne) + **`evenements`** + **`reseaux`** (3 entités reliées). |
| `partenaires` (annonceurs) | — | **NOUVELLE collection** (logo accueil + page Partenaires). |
| `users.role` | `admin/membre` | **`reseauteur/organisateur/admin`**. |
| `users.plan` / Stripe | binaire freemium 39 €/an (membre) | **B2B** : réseau partenaire (Subscription) + événement Premium (Checkout one-shot) + annonceur (Subscription). **Réseauteurs gratuits.** |
| Confidentialité par champ + **double geom** (point dur §5.1/§5.3) | brique lourde dédiée (`privacy-engineer`) | **ABANDONNÉ** — coordonnées = **champs facultatifs** ; géoloc **ville par défaut** ; RGPD de base + opt-out indexation. Plus de double geom obligatoire. |
| Recherche FTS à facettes (point dur §5.4) | moteur dédié (`search-engineer`) | **ABANDONNÉ** — **recherche simple** par filtres (Payload `find` + index ; `pg_trgm` optionnel). |
| Agents `privacy-engineer` / `search-engineer` | créés | **RETIRÉS** (préoccupations repliées dans `data-architect`/`seo-engineer`/`frontend-builder`). |

**Conséquence favorable :** le retour des événements et des réseaux-entités **réduit le démontage** et
**augmente la réutilisation** de l'existant PanoramaPub/0623 (la collection `reseaux` créée en `0623`
redevient pertinente ; la machinerie SEO `Event`/`Organization` et la carte d'événements se réutilisent).
Le verdict **`REFACTOR_IN_PLACE`** est confirmé, *a fortiori*.

> **Comment lire la suite :** les §1 à §6 restent un inventaire `fichier:ligne` fiable. Là où ils disent
> « SUPPRIMER » pour l'événementiel ou « DÉMONTER » pour `reseaux`, appliquer le tableau ci-dessus (GARDER +
> simplifier). Là où ils décrivent la confidentialité par champ / le double geom / la recherche FTS comme
> des **points durs ÉLEVÉS**, ces chantiers sont **hors périmètre V1** (ADR-0011 §6/§7).

---

## 0. Constat préalable décisif — l'état réel du dépôt n'est PAS « Réseau→Occurrences terminé »

Le dépôt est dans un état **à moitié migré du premier pivot** (PanoramaPub → Info-Réseaux Réseau→Occurrences). Le refactor `data-architect`/`solution-architect` daté du 23 juin n'a touché qu'une **fine couche** :

- **Touché par le 1er pivot** (5 fichiers contiennent « Info-Réseaux ») : `payload.config.ts`, `collections/Users.ts`, `collections/access.ts`, `collections/Evenements.ts`, `collections/Reseaux.ts`, + 4 migrations `20260623_*`.
- **Resté PanoramaPub** : « Panorama Pub » apparaît encore dans **78 fichiers / 258 occurrences** (`src/lib/site.ts:1-3`, tout `(frontend)/*`, `components/*`, `lib/stripe.ts`, `lib/plan-downgrade.ts`, `lib/jsonld.ts`, `app/sitemap.ts`, les routes geo, les emails, etc.). « RÉSEAUTEURS » : **0 occurrence**.

**Trois générations de modèle coexistent dans le code**, ce qui crée des incohérences déjà présentes (voir §5, findings durs) :

| Génération | Où | Vocabulaire plan |
|---|---|---|
| 1. PanoramaPub (origine) | `lib/stripe.ts`, `lib/plan-downgrade.ts`, `nav-items.ts`, `jsonld.ts`, geo routes, frontend, tests | `gratuit` / `premium` / `infinite` |
| 2. Info-Réseaux 3-paliers (½ fait) | `access.ts`, `Users.ts` (enum), migrations `0623` | `acces` / `developpement` / `premium` |
| 3. RÉSEAUTEURS cible (à faire) | rien encore | `gratuit` / `premium` (binaire) |

**Conséquence pour la bascule :** le « travail récent à démonter » que redoute l'ADR-0010 §Conséquences est **plus petit que supposé** (≈ `Reseaux.ts` + 4 migrations + réécriture `access.ts` + relation `evenements.reseau`). En contrepartie, la dette PanoramaPub résiduelle (objet publicitaire, plans 99/219 €, événementiel) est **plus grande que supposé** : la majorité de la base n'a jamais quitté PanoramaPub. Le coût de bascule se déplace donc du « démontage du Réseau→Occurrences » vers le **démontage du fond PanoramaPub + construction du membre**.

---

## 1. Inventaire : garder / réécrire / supprimer / dormant (modèle centré membre)

### 1.1 Collections (`src/collections/`)

| Asset | Verdict | Justification + `fichier:ligne` |
|---|---|---|
| `Users.ts` | **GARDER + remodeler** | Socle compte/auth/RGPD/billing intact. À remodeler : enum `plan` 3-paliers → binaire (`Users.ts:435-453`), enum `role` `admin/fournisseur/organisateur` → `admin/membre` (`Users.ts:420-433`), hook **auto-création réseau** (`Users.ts:314-383`) → auto-création **membre** (statut « en attente »). Champs RGPD/consentement/Stripe/onboarding/blacklist (`Users.ts:521-723`) **conservés tels quels**. Champs `groupe`/`pendingGroupeCode` (`Users.ts:455-476`) **dormants**. |
| `Reseaux.ts` | **RÉÉCRIRE / DÉMONTER** | C'est l'entité centrale **possédée** (1 user = 1 réseau, `Reseaux.ts:170-178`, `:283-294`), avec slug SEO figé, geom, galerie, statut modération. Sous le modèle membre, le réseau n'est plus possédé : il devient un **référentiel plat many-to-many** (BNI/DCF). Soit on **vide** `Reseaux.ts` de son ownership/geom/SEO pour le réduire à un référentiel, soit on le met **dormant** et on crée un référentiel dédié (sort `data-architect`). **MAIS** son échafaudage (hook `syncGeom` PostGIS `:67-87`, slug `:122-153`, géocodage `:214-228`, `seoField`, statut `publiee/suspendue` `:500-515`, field-access admin) est le **plan directeur de la future collection `membres`** : à copier, pas à jeter intellectuellement. |
| `Evenements.ts` | **SUPPRIMER (hors V1)** | Cœur de l'événementiel, hors périmètre V1 (ROADMAP §Retiré). Relation `reseau` (`Evenements.ts:366-374`), quota placeholder (`:254-263`), `serieId` (`:381-388`), archivage. **Pattern `syncGeom` (`:89-107`) réutilisable** pour `membres.geom`. Agenda membre déclaratif (cadrage §6.5) ≠ cette collection : champ/array léger sur `membres`, pas cette machinerie. |
| `Fournisseurs.ts` | **SUPPRIMER** | Legacy PanoramaPub, déjà censé être supersédé par la fusion `reseaux` mais **toujours actif** dans `payload.config.ts:82`. 42 références à l'objet pub (RSE, boutique, offres-emploi). |
| `OrganisateursEvenements.ts` | **SUPPRIMER** | Idem legacy, toujours dans `payload.config.ts:83`. |
| `TypesEvenement.ts` | **REPURPOSE** | Reseedé en 7 catégories d'événements (`20260623_130000:73-86`). Le modèle membre a besoin d'un **référentiel réseaux** (BNI/DCF/CJD…) et de **secteurs/métiers**, pas de catégories d'événements. À reconvertir ou remplacer. |
| `CategoriesActivite.ts` | **REPURPOSE** | `label/value/couleur` → base directe pour **secteurs d'activité / métiers** des membres (recherche à facettes). Structure réutilisable. |
| `LabelsRSE.ts` | **SUPPRIMER** | Spécifique objet publicitaire. |
| `Testimonials.ts` | **GARDER** | Marketing agnostique. |
| `Media.ts` | **GARDER** | Upload/Sharp/Vercel Blob + cleanup orphelins, agnostique. |
| `Groupes.ts` | **DORMANT** | ADR-0009 inchangé (ADR-0010 §7/Décisions). Conservé, masqué. |
| `AuditLogs.ts` | **GARDER** | Registre RGPD, plus critique encore (personnes physiques). |
| `StripeEvents.ts` | **GARDER** | Idempotence webhooks, agnostique. |

### 1.2 `access.ts` — niveaux & gates

| Élément | Verdict | `fichier:ligne` |
|---|---|---|
| `getEffectiveFeatureLevel` (3 niveaux `acces/developpement/premium`) | **RÉÉCRIRE binaire** `gratuit/premium` | `access.ts:21-39` |
| `canCreateReseau` (1 user = 1 réseau) | **RÉÉCRIRE → `canCreateMembre`** (1 user = 1 membre, ADR-0010 §2) | `access.ts:89-101` |
| `isDeveloppementOrAbove` / `isInfinite` / `isPremiumOrAbove` | **SUPPRIMER / collapse** → un seul `isPremium` binaire | `access.ts:70-82`, `:123-135` |
| `getFreshUser` (cache `_freshUser` anti-JWT-périmé) | **GARDER tel quel** — excellent pattern, réutilisé par tous les field-access (anti-N+1) | `access.ts:48-63` |
| `canCreateFiche` / `canCreateOrganisateurFiche` (dépréciées) | **SUPPRIMER** | `access.ts:108-115` |

### 1.3 Stripe & facturation

| Asset | Verdict | `fichier:ligne` |
|---|---|---|
| `lib/stripe.ts` `PLANS` | **RÉÉCRIRE → 1 palier 39 €** ; aujourd'hui encore `premium 9900 / infinite 21900` (PanoramaPub), **incohérent** avec l'enum DB | `lib/stripe.ts:28-39` |
| `resolvePlanFromPriceId`, `planLabel` | **RÉÉCRIRE binaire** ; env `STRIPE_PREMIUM_PRICE_ID` + `STRIPE_INFINITE_PRICE_ID` → un seul prix | `lib/stripe.ts:6-11,47-60` |
| `getSubscriptionPeriodEnd`, client `stripe`, pin API | **GARDER** (plomberie agnostique) | `lib/stripe.ts:20-22,72-83` |
| `api/stripe/webhook` | **GARDER** — idempotence UNIQUE (`route.ts:36-52`), extraction billing/TVA (`:86-118`), signature. Recâbler les libellés de plan | `api/stripe/webhook/route.ts` |
| `api/stripe/checkout`, `portal`, `cancel`, `reactivate` | **GARDER** (recalibrer prix unique) | `api/stripe/*` |
| `api/stripe/change-plan`, `preview-change-plan` | **SUPPRIMER probable** — pas de changement de palier avec un seul tier payant | `api/stripe/change-plan/`, `preview-change-plan/` |
| `lib/plan-downgrade.ts` | **GARDER pattern, RÉÉCRIRE contenu** — la liste des champs Premium à purger est **100 % fournisseur** (`boutiqueEnLigne`, `descriptionRSE`, `offresEmploi`…) ; à remplacer par les champs Premium **membre** (coordonnées/galerie/agenda). Encore en `gratuit/premium/infinite` | `lib/plan-downgrade.ts:13-30,49-86` |

### 1.4 Crons (`src/app/api/cron/`)

| Cron | Verdict | Note |
|---|---|---|
| `downgrade-expires` | **GARDER** (binaire) | downgrade plan expiré |
| `expiration-alertes` | **GARDER** | alertes J-30/J-7 |
| `onboarding-emails` | **GARDER** (rebrand) | séquence J3/J7/J14 |
| `purge-anciens` | **GARDER (RGPD)** | purge données ; vérifier qu'il ne purge pas que des événements |
| `archiver-evenements` | **SUPPRIMER** | cycle de vie des occurrences passées — sans objet sans événements |
| `retry-groupe-sync` | **DORMANT** (ADR-0009) | conservé |

### 1.5 SEO

| Asset | Verdict | `fichier:ligne` |
|---|---|---|
| `lib/jsonld.ts` `buildEventJsonLd`, `buildLocalBusinessJsonLd(Fournisseur)`, `buildOrganisateurJsonLd` | **RÉÉCRIRE** — modèle obsolète (`event.fournisseur`/`organisateurExterne` `:146-147,187-200`) ; créer `buildPersonJsonLd` / `ProfilePage` (`Person`) | `lib/jsonld.ts:85,143,219` |
| `buildOrganizationJsonLd`, `buildWebSiteJsonLd`, `buildBreadcrumbListJsonLd`, `buildItemListJsonLd`, `buildFAQPageJsonLd` | **GARDER** (génériques) | `lib/jsonld.ts:28,45,67,262,279` |
| `lib/seo.ts` (`buildMetadata`, `applySeoOverrides`, ogType `profile` déjà supporté) | **GARDER** | `lib/seo.ts:39,68,169` |
| `seoField` (+ flag `noindex`) | **GARDER** — `noindex` sert directement l'**opt-out d'indexation** des profils de personnes | `collections/fields/seoField.ts:54-61` |
| `app/sitemap.ts` | **RÉÉCRIRE** — pointe `fournisseurs`/`evenements`/`organisateurs-evenements` | `app/sitemap.ts:24-61` |
| `app/robots.ts`, `app/llms.txt/route.ts` | **GARDER + repointer** (URLs profils) | — |
| Composant `JsonLd` (échappement XSS) | **GARDER** (ne pas régresser) | `components/seo/JsonLd.tsx` |

### 1.6 Carte / géo

| Asset | Verdict | `fichier:ligne` |
|---|---|---|
| `api/geo/revendeurs/route.ts` | **REPURPOSE → `api/geo/membres`** (marqueur = membre) ; même squelette GeoJSON | `api/geo/revendeurs/route.ts:76-117` |
| `api/geo/evenements/route.ts` | **SUPPRIMER** (carte d'occurrences) | `api/geo/evenements/route.ts` |
| `/api/geo/reseaux` | **N'EXISTE PAS** — `Reseaux.ts:237` et `Evenements.ts:319` `revalidatePath('/api/geo/reseaux')` une route fantôme | — |
| `syncGeom` (Reseaux/Evenements) | **GARDER pattern** → `membres.geom` | `Reseaux.ts:67-87`, `Evenements.ts:89-107` |
| `lib/geocode.ts` (data.gouv) | **GARDER intact** | `lib/geocode.ts:6-32` |
| `lib/geojson.ts` (`toFeature`/`toFeatureCollection`) | **GARDER** (contrat agnostique) | `lib/geojson.ts` |
| `components/maps/MapRevendeurs.tsx` | **REPURPOSE** (marqueurs membres) ; Mapbox→MapLibre (ADR-0006) | — |
| `components/maps/MapEvenements*.tsx` | **SUPPRIMER** | — |
| `components/map/*` (POI/Route/directions, Mapbox) + `lib/mapbox/*` + `api/directions` | **DORMANT ou SUPPRIMER** — itinéraire vers un événement ; sans objet V1 sauf « itinéraire vers un membre » | `components/map/`, `lib/mapbox/`, `api/directions/` |
| Migration `postgis_extension` | **GARDER** | `20260623_100000_postgis_extension.ts` |

### 1.7 RGPD / auth / emails

| Asset | Verdict | `fichier:ligne` |
|---|---|---|
| Auth Payload (JWT, lockout, verify, reset, change-email) | **GARDER** ; ouvrir l'inscription à tous les membres | `Users.ts:30-50` |
| `api/account/export`, `delete`, `change-email`, `confirm-email-change`, `preferences` | **GARDER, REPOINTER** — `delete` détache `fournisseur`/`evenements`/`fournisseursAssocies` (`route.ts:26-28`), à repointer sur `membres` | `api/account/*` |
| Resend + `email-sender` + blacklist webhook | **GARDER** | `lib/email-sender.ts`, `api/resend/webhook` |
| Templates `security.ts`, `onboarding.ts` | **GARDER + rebrand** | `lib/emails/templates/` |
| Templates `subscription.ts`, `moderation.ts` | **GARDER, RECALIBRER** (libellés plans, « fiche réseau » → « profil ») | `lib/emails/templates/subscription.ts`, `moderation.ts` |
| Templates `groupes.ts`, `admin.ts` (groupes) | **DORMANT** | — |
| `api/ical/[id]` + `lib/ical.ts` | **SUPPRIMER V1** (export agenda événements → V2) | — |

---

## 2. Surface de démontage du modèle événementiel & des 3 paliers (coût de retrait)

Périmètre : fichiers **hors migrations** (les snapshots `migrations/*.json` gonflent les comptes mais ne se « démontent » pas — ils restent figés ; seules les migrations `0623` sont à reconsidérer).

### 2.1 Référence `participantsSignales` / `organisateurExterne` (participation PanoramaPub) — **17 fichiers fonctionnels**
- **Collections (2)** : `Evenements.ts`, `OrganisateursEvenements.ts`
- **Routes (3)** : `api/evenements/[id]/participer/route.ts`, `api/evenements/public/[slug]/route.ts`, `api/organisateurs/public/[slug]/route.ts`
- **Lib (2)** : `lib/jsonld.ts`, `lib/plan-downgrade.ts`
- **Composants (3)** : `components/slideover/SlideOverEvenement.tsx`, `components/dashboard/EvenementsManager.tsx`, `EvenementsManagerLoader.tsx`
- **Pages (3)** : `(frontend)/evenements/[slug]/page.tsx`, `(frontend)/organisateurs/[slug]/page.tsx`, `(frontend)/dashboard/evenements*/page.tsx`
- **Compte (1)** : `api/account/delete/route.ts`
- **Scripts/types (3)** : `seed.ts`, `scripts/seed-demo.ts`, `scripts/cleanup-legacy-demo.ts`, `payload-types.ts`

### 2.2 Consommateurs de la collection `evenements` — **~36 fichiers** (geo/evenements, /api/evenements, slideover, manager, sitemap, ical, crons archivage/purge, pages /evenements, /dashboard/evenements). Le retrait de la collection casse en cascade : routes geo, sitemap, dashboard, agenda.

### 2.3 Référence aux paliers `infinite`/`premium`/`priceId` — **~42 fichiers fonctionnels** (55 avec migrations json)
- **Lib (3)** : `lib/stripe.ts`, `lib/groupes.ts`, `lib/plan-downgrade.ts`
- **Stripe routes (6)** : `checkout`, `change-plan`, `preview-change-plan`, `reactivate`, `webhook`, (+ `cancel`)
- **Composants UI (10+)** : `nav-items.ts` (`infiniteOnly`/`paidOnly`/roles `:16-35`), `PlanBadge.tsx`, `UnlockBanner.tsx`, `Card.tsx`, `PlanCheckoutButton.tsx`, `CheckoutInfiniteConfirmModal.tsx`, `PlanChangeConfirmModal.tsx`, `DashboardSidebar.tsx`, `MobileNav.tsx`, `SlideOverRevendeur.tsx`, `PhotosManager.tsx`
- **Pages (5)** : `dashboard/abonnement`, `dashboard/evenements-nationaux`, `dashboard/page`, `dashboard/layout`, `(frontend)/layout`
- **Crons (2)** : `expiration-alertes`, `onboarding-emails`

### 2.4 Référence à l'objet publicitaire `fournisseur` — **~30 fichiers** (toute la lignée `revendeurs`/`fournisseurs`, `lib/fournisseur-dedup.ts`, `lib/ensure-fiche.ts`, geo/revendeurs, slideover, maps, pages `/revendeurs/*`, `/devenir-revendeur`, `/faq-revendeurs`, composants `about/*`).

### 2.5 Migrations `0623` (premier pivot) — **à reconsidérer, PAS à appliquer telles quelles**
`20260623_110000_create_reseaux`, `120000_data_migration_fusion` (fusion Fournisseurs+Organisateurs→reseaux, `:40-419`), `130000_plan_enum_et_categories` (enum 3-paliers + reseed 7 catégories). Sous le modèle membre, ces migrations construisent la **mauvaise cible**. **Risque** : si elles ont déjà été appliquées en prod/staging, la DB est en état 3-paliers/reseaux-possédés — il faut un **chemin de migration depuis cet état**, pas seulement « ne pas l'appliquer ». À trancher avec `data-architect`.

**Ordre de grandeur du retrait :** ~70-80 fichiers source touchés (hors migrations json figées). C'est important mais **mécanique et localisé** — pas une réécriture d'architecture. La couche d'accès (Payload), l'infra (Stripe/RGPD/auth/géocodage/sécurité) et le rendu (SSR/ISR) ne sont pas concernés.

---

## 3. Ce qui manque pour le modèle membre (briques à créer)

| Brique à créer | Détail (cadrage §6.2/6.3/6.6) | Base réutilisable existante |
|---|---|---|
| **Collection `membres`** | identité (prénom/nom), photo, fonction, entreprise, taille entreprise, secteurs, compétences, présentation, zone d'intervention, `geom`, galerie | **Échafaudage `Reseaux.ts`** (slug `:122-153`, `syncGeom` `:67-87`, géocodage `:214-228`, `seoField`, statut, field-access) à cloner |
| **Relation M2M membre ↔ réseaux-référentiel** | « réseaux fréquentés » (BNI/DCF multi) | Payload `relationship hasMany` ; référentiel issu de `Reseaux`/`TypesEvenement` aplati |
| **Champ « ce que je recherche »** | client/partenaire/fournisseur/investisseur/recrutement/sous-traitance | `select hasMany` simple (neuf) |
| **Confidentialité par champ** | visibilité public/masqué par champ (coordonnées, adresse → localisation approchée) | field-access Payload existant (`access:{read}`) **comme base**, mais voir §5 (insuffisant pour le rendu public SSR) |
| **Statut de modération** | `en attente / validé / suspendu` (Parcours A étape 2) | `Reseaux.statut` (`publiee/suspendue` `:500-515`) à étendre à 3 valeurs + filtre admin natif Payload |
| **Auto-création profil au signup** | 1 user = 1 membre, statut « en attente » | hook `Users.ts:314-383` (auto-create-reseau) à transformer en auto-create-membre |
| **Recherche multicritères à facettes** | métier, ville/dept/région, distance, réseau, compétences, type de recherche, taille | Filtres `find()`+`like` (`geo/revendeurs:61-72`) **insuffisants** → Postgres FTS/trigram à brancher (voir §5) |
| **Agenda membre déclaratif** | événements où je serai (préfigure V2) | array léger sur `membres` (PAS la collection `Evenements`) |
| **Quota** | **À NE PAS recréer** | `lib/quota.ts` n'existe pas (jamais implémenté) ; le quota d'occurrences est supprimé → rien à porter |
| **Déverrouillage contact Premium** | gratuit = visible, Premium = joignable (ADR-0010 §5) | gates `isPremium` (à rendre binaire) + champ `préférence de contact` (couture V2) |
| **JSON-LD `Person`/`ProfilePage`** | SEO profils | `lib/jsonld.ts` patterns + `seo.ts` ogType `profile` déjà là |

**Note :** `Membres.ts` et `lib/quota.ts` **n'existent pas** (confirmé). Aucune amorce du modèle membre.

---

## 4. Réutilisable tel quel (infra agnostique)

| Brique | Statut | `fichier:ligne` clé | Recalibrage |
|---|---|---|---|
| Plomberie Stripe (checkout/portal/webhook/factures/idempotence) | **GARDER** | `api/stripe/webhook/route.ts:36-52,86-118`, `lib/stripe.ts:72-83` | → 1 palier 39 € |
| RGPD (export/delete/consentements/audit/blacklist/purge) | **GARDER** (plus critique) | `Users.ts:553-677`, `api/account/*`, `AuditLogs.ts` | repointer collections |
| Auth Payload | **GARDER** | `Users.ts:30-50` | ouvrir à tous |
| Géocodage data.gouv | **GARDER intact** | `lib/geocode.ts:6-32` | aucun |
| Carte (GeoJSON, clusters, bbox, bottom-sheet) | **GARDER** | `lib/geojson.ts`, `components/maps/MapRevendeurs.tsx` | Mapbox→MapLibre ; marqueur=membre |
| PostGIS (extension + pattern syncGeom) | **GARDER** | `20260623_100000`, `Reseaux.ts:67-87` | brancher sur `membres` |
| Sécurité HTTP (CSP/HSTS/rate-limit/sanitize/safe-url) | **GARDER** | `next.config.ts`, `lib/rate-limit.ts`, `lib/sanitize.ts`, `lib/safe-url.ts` | retirer Mapbox de la CSP |
| Emails Resend + onboarding + sécurité | **GARDER** | `lib/email-sender.ts`, `lib/emails/templates/security.ts` | rebrand |
| `getFreshUser` (anti-JWT-périmé, cache requête) | **GARDER** | `access.ts:48-63` | aucun |
| `seoField` + `lib/seo.ts` + composant JsonLd (XSS) | **GARDER** | `seoField.ts`, `seo.ts:39,169`, `components/seo/JsonLd.tsx` | aucun |
| Media (Sharp/Vercel Blob/cleanup orphelins) | **GARDER** | `Media.ts`, `lib/media-cleanup.ts` | aucun |
| Suite de tests d'intégration (26 specs) | **GARDER l'outillage** | `tests/int/*` | **ATTENTION** : tous écrits sur le modèle PanoramaPub (geo-evenements, plan-downgrade, archivage, stripe 3-tier). Aucun test sur `reseaux`/`membres`. La majorité des assertions devient caduque → re-spécifier |

**À recalibrer (pas à réécrire) :** Stripe → 1 palier ; `getEffectiveFeatureLevel` → binaire ; JSON-LD `Event/LocalBusiness` → `Person/ProfilePage` ; `lib/plan-downgrade` → champs membre.

---

## 5. Risques & points durs

1. **[ÉLEVÉ] Confidentialité par champ vs field-access Payload — l'ADR-0010 §7 sous-estime.** Le field-access Payload (`access:{read}`) filtre l'API Payload, **mais le rendu public des fiches se fait en SSR avec `overrideAccess: true`** (cf. `geo/revendeurs:81`, `sitemap.ts:30`, toutes les routes publiques). `overrideAccess` **bypasse** le field-access. Donc la confidentialité par champ pour l'affichage public **ne peut PAS reposer uniquement sur le field-access** : il faut une logique de projection explicite (drapeaux de visibilité par champ lus et appliqués dans le composant de rendu et dans la route geo). Risque de **fuite de coordonnées/adresse exacte** si on suppose que field-access suffit. À cadrer en ADR dédié.

2. **[ÉLEVÉ] SEO de personnes physiques (RGPD/e-réputation).** Indexer prénom+nom+entreprise+géoloc engage le droit au déréférencement, l'opt-out d'indexation, l'exactitude. Le flag `seoField.noindex` (`:54-61`) donne le levier technique, mais il faut une **politique** : noindex par défaut tant que non validé ? opt-out membre respecté dans `sitemap.ts` ET `robots` ET `<meta>` ? purge du cache ISR au déréférencement ? Non traité dans le code.

3. **[ÉLEVÉ] Localisation approchée sur la carte.** Le `geom` actuel est l'adresse **exacte géocodée** (`Reseaux.ts:214-228`). Pour les membres en confidentialité « adresse masquée », il faut **flouter** : stocker un `geom` approché (jitter déterministe / centroïde commune) **distinct** du `geom` exact, et ne servir que l'approché dans `api/geo/membres`. Sinon, reverse-geocoding trivial depuis le marqueur. Brique neuve.

4. **[MOYEN] Recherche à facettes au-dessus de Payload.** Le filtrage actuel est `find()` + `like` prefix + filtre JS sur ≤5000 docs (`geo/revendeurs:61-93`, `geo/evenements:148-172`). Insuffisant pour une recherche multicritères nationale (métier + distance + réseau + compétences combinés). Il faut **brancher Postgres FTS (`tsvector`) et/ou `pg_trgm`** à côté de Payload (route SQL paramétrée, même pattern que le `syncGeom` Drizzle `Reseaux.ts:72`). Effort réel, pilier produit (cadrage §6.3).

5. **[MOYEN] Démontage `reseaux` + migrations `0623` déjà potentiellement appliquées.** Si la fusion `20260623_120000` et l'enum 3-paliers `20260623_130000` ont tourné en staging/prod, la DB est en état « reseaux possédés + plan acces/dev/premium ». Le chemin n'est alors pas « ne pas migrer » mais « **re-migrer depuis cet état** » vers le modèle membre + plan binaire. `down()` de `120000` est **destructif** (`TRUNCATE reseaux CASCADE`, `:401`). Gate humain + dry-run obligatoires.

6. **[MOYEN — bug latent déjà présent] Incohérence plan 3 générations.** `Users.ts:85` force `data.plan = 'gratuit'` à la création, mais l'enum `plan` (`Users.ts:437-441`) et la migration `20260623_130000:45` ne contiennent **que** `acces/developpement/premium` (plus de `gratuit`). **Si la migration `130000` est appliquée, toute inscription non-admin casse** (valeur enum invalide). Par ailleurs `lib/stripe.ts:28-39` écrit encore `premium/infinite`. Le passage au binaire `gratuit/premium` **résout** cette incohérence (le `gratuit` redevient valide) — mais il faut le faire de bout en bout, pas à moitié comme le pivot précédent.

7. **[FAIBLE] Tests obsolètes donnant une fausse assurance.** 26 specs vertes valident PanoramaPub (participer, archivage, quota fiches, 3-tier). Elles ne couvrent ni `reseaux` ni `membres`. Risque de croire la base « testée » alors que le domaine cible n'a aucune couverture.

8. **[FAIBLE] Code mort en cascade.** `revalidatePath('/api/geo/reseaux')` pointe une route inexistante (`Reseaux.ts:237`) ; `Fournisseurs`/`OrganisateursEvenements` encore montées (`payload.config.ts:82-83`) alors que `reseaux` les remplace. Préférer suppression franche (ADR-0010 §Conséquences) pour éviter le modèle zombie.

---

## 6. Verdict de synthèse

**Confirmation de l'orientation de l'ADR-0010 : reprise sur Payload + retrait franc du modèle événementiel.** Le code réel la conforte, avec **deux nuances importantes** que l'ADR n'avait pas vues :

- **Nuance 1 — l'état de départ n'est pas celui supposé.** L'ADR-0010 raisonne comme si le dépôt était « Réseau→Occurrences abouti, à démonter ». En réalité le 1er pivot est **à moitié fait** : la base est encore massivement PanoramaPub (78 fichiers « Panorama Pub », plans 99/219 €, objet publicitaire, `jsonld`/`sitemap`/geo/downgrade jamais migrés). **Bonne nouvelle** : moins de travail Info-Réseaux à jeter. **Mauvaise nouvelle** : le « retrait franc » porte sur le **fond PanoramaPub** (≈70-80 fichiers), pas seulement sur l'événementiel. Le chiffrage de bascule doit intégrer ce démontage PanoramaPub résiduel.

- **Nuance 2 — un point dur non identifié par l'ADR : la confidentialité par champ ne tient pas sur le seul field-access Payload** (rendu public en `overrideAccess`). C'est un pilier produit (cadrage §6.6) et un enjeu RGPD : à traiter en brique explicite (projection de visibilité + double `geom` exact/approché), pas en « usage natif et économique de Payload » comme l'affirmait l'ADR-0010 §7. **Aucun blocage rédhibitoire**, mais à acter avant implémentation.

**Aucun argument ne fait basculer vers un rebuild de stack.** L'infra agnostique (Stripe, RGPD, auth, géocodage, PostGIS, sécurité, SSR/ISR, SEO machinery) est réutilisable et de qualité production. L'essentiel de l'effort est dans les **modules neufs** (profil membre, recherche à facettes, JSON-LD `Person`) — indépendants de la stack. Le verdict **reprise sur Payload / refactor in place** tient, à condition d'assumer que la bascule est un **double démontage** (PanoramaPub résiduel + Réseau→Occurrences à demi construit) suivi d'une **construction membre**, et de traiter explicitement les 3 points durs ÉLEVÉS (confidentialité-rendu, SEO-personnes, localisation approchée).
