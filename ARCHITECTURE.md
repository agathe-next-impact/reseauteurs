# ARCHITECTURE.md — RÉSEAUTEURS

> Architecture cible. Réalignée le **2026-06-28** sur le **modèle à trois entités** (ADR-0011),
> puis **amendée le 2026-06-30** par l'**ADR-0012** (hiérarchie réseaux national↔local, abonnement national,
> locaux délégables, suppression de l'événement Premium, deux pages à bascules),
> puis **amendée le 2026-07-12** par l'**ADR-0013** (palier **Réseauteur Plus**, rôle **`partenaire`**,
> **packs de licences Plus** activés par code promo),
> puis **amendée le 2026-07-17 / 2026-07-20** par les **ADR-0014 → 0016** (abonnement réseau national en
> **4 paliers** + fiche de tête revendiquée suspendue, **suppression des packs de licences**, **hub
> d'abonnement unifié `/dashboard/abonnement`**). **Voir l'encart consolidé ADR-0014 → 0016 ci-dessous.**
> Entrées : `docs/adr/0011-...md`, `docs/adr/0012-hierarchie-reseaux-national-local-abonnement-national.md`,
> `docs/adr/0013-reseauteur-plus-licences-partenaires.md`,
> `docs/adr/0014-...md`, `docs/adr/0015-...md`, `docs/adr/0016-...md`,
> `AUDIT.md` (verdict **REFACTOR_IN_PLACE**) + `AUDIT-DELTA-RESEAUTEURS.md`, `CLAUDE.md`. Séquencement : `PLAN.md`.
> **Aucune implémentation ne commence avant validation humaine de ce document + du schéma** (règle d'or,
> CLAUDE.md §13).

---

## ⚠️ Encart d'amendement consolidé — ADR-0014 → 0016 (2026-07-17 / 2026-07-20) — EN VIGUEUR

> Ces trois ADR **supersèdent** les passages correspondants des encarts ADR-0012/0013 et du corps ci-dessous.
> En cas de contradiction, **cet encart fait foi**. Ils réaffirment tous les autres invariants (SSR/ISR,
> SEO 3 types, géoloc ville, RGPD proportionné, statut payant posé serveur, simplicité).

**a) ADR-0014 — Abonnement réseau national en 4 paliers · fiche de tête suspendue · locaux des réseauteurs Plus par propriété.**
L'« un seul produit d'abonnement réseau » de l'ADR-0012 est **levé** : l'abonnement porté par la **tête de
réseau** (`niveau` non-local — cf. `estTete()`) a **4 paliers** — **`fiche`** (publie la fiche seule, **0**
groupe local) / `starter` (**5**) / `growth` (**25**) / `enterprise` (**illimité, 999**). Capacités dans
`PALIERS_CONFIG` de `src/lib/reseau-hierarchie.ts` ; prix Stripe `STRIPE_PRICE_NATIONAL_FICHE/_STARTER/_GROWTH/_ENTERPRISE`
(placeholders, TODO PO). **La fiche d'une tête revendiquée (`source='revendique'`) naît `statut='suspendue'`**
et n'est **publiée que par un abonnement actif** (webhook pose `statut='publiee'` ; expiration → re-`suspendue`) ;
les fiches **importées** (`source='importe'`) ne sont pas suspendues. **Locaux des réseauteurs Plus (par
propriété)** : un réseauteur Plus **possède** (`reseaux.user`) jusqu'à **`MAX_LOCAUX_PLUS = 3`** réseaux
**locaux** (affiliés à une tête **ou** indépendants, `parent` optionnel) créés depuis « Mes réseaux »
(`/dashboard/mes-reseaux`) ; il publie les événements de **ses** locaux — **gate = `niveau='local'` + Plus
actif + `reseau.user === req.user.id`**, couvert par l'**abonnement Plus** (pas celui de la tête). Le **quota
palier** ne consomme que les locaux **possédés par la tête** (`peutCreerLocalAsync` filtre `user=owner`).
**L'« admin déclaré » (`reseauteurs.adminReseaux`) est déposé/dormant**, remplacé par la propriété `reseaux.user`.
Invitation de la tête absente : server action `inviterReseauNational` (rate-limit 3/jour, audit `national_invited`).

**b) ADR-0015 — Suppression des packs de licences « Réseauteur Plus ».** Le point 4 de l'encart ADR-0013
(**packs 10 / 50 / 100+ activés par code promo**) est **SUPPRIMÉ** : checkout, activation, UI et sections
publiques d'affiliation retirés. Route **`/api/licences/activer` → 410 Gone** ; `activerLicence` supprimée ;
produit `licences_pack` retiré du checkout/webhook. Les collections `licences-packs` / `licences-activations`
restent **dormantes** (`admin.hidden`, traçabilité legacy) ; le cron `expiration-plus` éteint les Plus
« licence » existants à échéance. **Le Réseauteur Plus s'obtient désormais uniquement par abonnement
individuel** : `users.plusSource ∈ {'abonnement' (nominal), 'licence' (legacy, extinction, lecture seule)}`,
`users.plusLicencePack` dormant. Le **partenaire annonceur** ne conserve que son **abonnement de visibilité**
+ son **offre réservée aux réseauteurs**.

**c) ADR-0016 — Hub d'abonnement unifié en libre-service, pour tous les rôles souscripteurs.** Un **hub unique
`/dashboard/abonnement`** est ouvert au **réseauteur Plus, à l'organisateur et au partenaire**. Résolveur
commun **`src/lib/abonnement.ts`** : `resolveAbonnement(freshUser, payload)` → descripteur `AbonnementContext`
unifiant les **3 porteurs** Stripe (`users` pour Plus, `reseaux` de tête pour le national, `partenaires`) ;
`fetchLiveStripeState` enrichit avec l'état live Stripe (status, `current_period_end`, `cancel_at_period_end`,
palier) — **tolérant aux pannes** (retombe sur la DB). Brique UI partagée **`src/components/billing/AbonnementManager.tsx`**
(souscrire / changer de palier / annuler / réactiver / moyen de paiement / factures). **`cancel` / `reactivate`
généralisées aux 3 produits** (ownership **garanti par construction** : `resolveAbonnement` ne résout que le
porteur du caller). Nouvelle route **`POST /api/stripe/change-palier`** (organisateur : swap de price +
proration + **garde anti-downgrade** si `maxLocaux(nouveauPalier) < locaux possédés`). **`change-plan` /
`preview-change-plan` restent 410 Gone.** Factures (`/dashboard/factures`) accessibles à tout rôle souscripteur
ayant un `stripeCustomerId` (réseauteur Plus inclus). Invariant §11 conservé : le statut/accès est posé
**serveur** (webhooks) ; les actions in-app **pilotent Stripe** (`cancel_at_period_end`, swap de price), la DB
n'est jamais mutée par le client.

## ⚠️ Encart d'amendement — ADR-0013 (2026-07-12) — À METTRE EN ŒUVRE (PLAN.md Partie D)

L'ADR-0013 fait passer le revenu en **mix B2C + B2B** et **lève deux invariants** antérieurs :

1. **Réseauteur : 2 niveaux.** « Réseauteurs strictement gratuits » est levé — **Gratuit** (inchangé) et
   **Plus** (abonnement individuel **ou** licence activée par code promo partenaire), dont le seul avantage
   V1 est le **droit de créer des événements**. Statut porté par `users` (`plusActif`/`plusExpireAt`/
   `plusSource`), **posé serveur uniquement**. → §3, §4.6.
2. **Gate d'événements étendu** : `peutCreerEvenement(user)` = organisateur d'un national abonné (ADR-0012,
   inchangé) **OU réseauteur Plus actif**. Modèle **acté (gate P0, 2026-07-12)** : le réseauteur **est**
   l'organisateur — `evenements.organisateurReseauteur` (optionnel) + `reseau` relâché, invariant
   « exactement un organisateur » (réseau XOR réseauteur). → §2, §4.4.
3. **Rôle `partenaire` acté** (« pas de 4ᵉ rôle » levé) : 1 compte ↔ 1 fiche `partenaires` self-service,
   fiche publique `/partenaire/<slug>`, **offre réservée aux réseauteurs** — **déjà livrés** (2026-07-10).
4. ~~**Packs de licences Plus** vendus aux partenaires (**10 / 50 / 100+**), activés par **code promo**…~~
   **⚠️ CADUC — SUPPRIMÉ par l'ADR-0015 (2026-07-17).** Voir l'encart consolidé ci-dessus (b) : le Plus
   s'obtient **uniquement par abonnement individuel** ; collections `licences-packs`/`licences-activations`
   **dormantes**, route `/api/licences/activer` → **410**.

**Les réseaux sont inchangés** (hiérarchie, abonnement national, délégation — ADR-0012 intégralement
réaffirmé). Sections ci-dessous : les mentions « réseauteurs gratuits / pas de palier payant » se lisent
désormais **au sens ADR-0013**.

## ⚠️ Encart d'amendement — ADR-0012 (2026-06-30)

L'ADR-0012 **affine** l'ADR-0011 (elle n'en rouvre aucun invariant : réseauteurs gratuits, SSR/ISR des
fiches, SEO `Person`/`Event`/`Organization`, géoloc ville, RGPD proportionné, simplicité, stack, refactor in
place — **tous réaffirmés**). Les sections ci-dessous portent les **deltas** :

1. **`reseaux` devient hiérarchique** : `niveau` ∈ {national, local} + `parent` (self-relationship N-1,
   requis si local, null si national, **2 niveaux max**). → §1, §2, §6.
2. **Affiliation réseauteur restreinte aux locaux** : `reseauxFrequentes` cible des réseaux `niveau = local`
   (validation serveur) ; le national d'un réseauteur est **dérivé** (parent). → §2, §4.8.
3. **Monétisation recalibrée** : l'**abonnement Stripe est porté par le réseau national** (débloque création
   de locaux + publication d'événements pour l'umbrella) ; **l'annonceur est conservé** ; **l'événement
   Premium ponctuel est SUPPRIMÉ** (champ `premium`, `stripeCheckoutSessionId`, Checkout one-shot, marqueur
   carte). → §3, §4.4, §4.6.
4. **Comptes** : pas de 4ᵉ rôle ; « membre réseau national » vs « organisateur local délégué » **dérivés du
   `niveau` du réseau possédé** ; garde « 1 user = 1 réseau » → **« 1 user = au plus 1 national »**. Locaux
   **délégables** (réassignation `local.user`). → §1, §2, §3.
5. **Deux pages à bascules** (« Réseauteurs et réseaux » : entité + vue ; « Événements » : vue) ; **fiches
   singulières SSR inchangées** (capital SEO). → §4.4, §4.7, §5.

---

## 0. Principe directeur

L'existant (**PanoramaPub.fr** → pivots successifs : Next.js App Router + Payload CMS + Postgres/Neon, Stripe
complet, SEO multi-types, carte, géocodage, RGPD, ~39k LOC) **est déjà sur la stack cible**. Le travail
n'est **pas** un changement de stack : c'est la **construction du domaine à 3 entités in place**, par
migrations. Le retour des **événements** et des **réseaux-entités** (que l'ADR-0010 avait retirés) rend la
reprise **plus favorable** : on réutilise davantage l'existant. L'ADR-0012 **prolonge** cette logique :
la hiérarchie national↔local **réutilise l'échafaudage `reseaux`** (slug/geom/SEO/compteurs/claim-flow) au
lieu d'introduire une seconde collection.

Deux contraintes gouvernent toutes les décisions :
1. **La simplicité d'abord** (CLAUDE.md §10) — site compris en < 30 s ; pas de complexité non nécessaire.
   L'ADR-0012 borne la hiérarchie à **2 niveaux** et garde **un seul produit d'abonnement réseau** (la tête).
   *(ADR-0014 : ce produit unique a désormais **4 paliers** `fiche`/`starter`/`growth`/`enterprise` — même
   produit, capacités graduées ; et les **locaux d'un réseauteur Plus** sont couverts par l'abonnement Plus,
   pas par un nouveau produit réseau. ADR-0013 ajoute le rôle `partenaire`.)*
2. **Un modèle de données extensible** — conçu dès le départ pour les évolutions futures (CLAUDE.md §12),
   sans les développer.

---

## 1. Vue d'ensemble

```
   VISITEUR        RÉSEAUTEUR (gratuit)   MEMBRE RÉSEAU NATIONAL (abonné)   ORGANISATEUR LOCAL (délégué)   ADMIN
   (sans compte)         │                         │                              │                          │
        │                ▼                         ▼                              ▼                          ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Next.js · App Router · React · TypeScript strict · Server Components par défaut                                 │
│                                                                                                                  │
│  RENDU (SSR/ISR)            EXPLORATION (2 pages à bascules)        ESPACES                  ADMIN                │
│  fiche réseauteur           « Réseauteurs et réseaux »             /dashboard réseauteur     /admin (Payload     │
│  fiche événement             ├ bascule ENTITÉ (réseauteurs↔réseaux) /dashboard national       auto-généré)        │
│  fiche réseau (national/     └ bascule VUE (carte ↔ annuaire)        (réseau national +                          │
│   local)                    « Événements »                          locaux + abonnement +                       │
│  home (3 piliers)            └ bascule VUE (carte ↔ agenda)          événements)                                 │
│  filtres (recherche simple) MapLibre GL : réseauteurs · réseaux-   /dashboard local délégué                     │
│                              locaux · événements (1 type marqueur)  (1 local + ses événements)                  │
│                                                                                                                  │
│  ── couche d'accès (ADR-0001) ───────────────────────────────────────────────────────────────────────────────  │
│  Payload CMS  →  collections + hooks (slug, géocodage, compteurs, badge, hiérarchie, emails, cleanup)            │
│       │  find/create/update/count             │  routes géo dédiées (ADR-0002)                                   │
│       ▼                                        ▼                                                                  │
│  @payloadcms/db-postgres (Drizzle)      Drizzle/`sql` paramétré (ST_DWithin / bbox / GiST / pg_trgm)             │
└───────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┘
                                         ▼
        ┌──────────────────────── PostgreSQL (Neon) + PostGIS ───────────────────────────────────┐
        │  reseauteurs (geom)   evenements (geom)   reseaux (geom · niveau · parent)   partenaires │
        │  users   categories (secteurs/métiers)   types_evenement   badges   media   stripe_events│
        │  audit_logs   groupes (DORMANT, ADR-0009)   migrations                                    │
        └──────────────────────────────────────────────────────────────────────────────────────────┘

   Intégrations : Stripe (3 Subscriptions : réseau tête 4 paliers + annonceur + Réseauteur Plus ; portal + webhooks)
                  · Resend (emails) · Vercel Blob (média) · API Adresse data.gouv (géocodage) · tuiles OSM
   Crons Vercel : downgrade/expiration abonnements · alertes · onboarding · purge RGPD
                  · retry-groupe-sync (dormant — ADR-0009)
```

> **Note ADR-0012 :** « membre réseau national » et « organisateur local délégué » sont **tous deux** des
> comptes `role: organisateur` ; on les distingue par le **`niveau` du réseau possédé** (national possède un
> réseau `niveau=national` ; délégué possède un/des `niveau=local` sans national). Plus de produit/marqueur
> « événement Premium ».

---

## 2. Modèle de domaine cible — trois entités reliées (réseaux hiérarchiques)

### 2.1 Concepts

- **Réseauteur** (`reseauteurs`) — une **personne**. Champs : prénom/nom, **slug** (`/reseauteur/<prenom-nom>`),
  photo, fonction, entreprise, description, **téléphone/email facultatifs**, site, LinkedIn,
  ville/département/région, **secteur d'activité** (relation), **compétences**, **réseaux fréquentés**
  (M2M → `reseaux`, **restreint aux `niveau = local`** — ADR-0012), **badge** (dérivé du nb d'événements/mois
  déclaré), `geom` (centroïde ville par défaut), statut de modération (`en_attente / valide / suspendu`),
  `seoField` (+ `noindex`). Inscription **gratuite**. Le **réseau national** d'un réseauteur est **dérivé**
  (ensemble des `parent` distincts de ses locaux fréquentés) — non stocké.
- **Événement** (`evenements`) — un **événement daté**. Champs : titre, **slug**, description, **date/heure**,
  adresse, ville, image, **réseau organisateur** (relation N-1 vers `reseaux`, national **ou** local),
  **lien d'inscription externe**, `geom`, catégorie (`types_evenement`), statut. **Plus de champ `premium`**
  (ADR-0012). Une fiche = un actif SEO longue traîne.
- **Réseau** (`reseaux`) — un **réseau d'affaires**, désormais **hiérarchique** (ADR-0012) :
  - **`niveau`** ∈ {`national`, `local`} ; **`parent`** = self-relationship N-1 (**requis si local**, **null
    si national** ; le parent d'un local est **toujours un national** → **2 niveaux max**).
  - Champs communs (réutilisés) : nom, **slug**, logo, description, présentation, lien internet, `geom`,
    **compteurs dérivés** (nb réseauteurs / nb événements), `seoField`, statut.
  - **Abonnement** : `partenaire` (+ `stripeSubscriptionId`, `partenaireExpireAt`) **significatif uniquement
    au niveau national** (posé par webhook Stripe). Sur un local, ces champs sont **inertes**.
  - **Propriété** : `user` (0..1). Un **national** est possédé par un compte « membre réseau national »
    (`role: organisateur`). Un **local** est possédé soit par le **compte national** (auto-géré) soit par un
    **compte délégué** distinct (réassignation `local.user`).
  - Sert **à la fois** de fiche-entité (national **et** local ont une fiche `/reseau/<slug>`) et de valeur de
    **taxonomie M2M** côté réseauteur (mais seuls les **locaux** sont sélectionnables).
- **Partenaire** (`partenaires`) — un **annonceur** (entreprise). **Inchangé** (ADR-0012) : nom, logo, lien,
  statut d'abonnement (Subscription). Affiché en page d'accueil + page Partenaires.
- **Compte** (`users`) — `role` ∈ {`reseauteur`, `organisateur`, `admin`} (**inchangé**). Porte l'auth, les
  IDs Stripe, la facturation, les consentements RGPD. National vs délégué **dérivé du `niveau`** possédé.
  Champs `groupe`/`pendingGroupeCode` **dormants** (ADR-0009).
- **Référentiels** — `categories` (secteurs/métiers), `types_evenement` (catégories d'événements),
  `badges` (Bronze/Argent/Gold/Platinum).

### 2.2 Relations (conceptuel)

```
users (reseauteur)  ──owns──▶ (0..1) reseauteurs ──M2M (locaux only)──▶ (0..n) reseaux[local]
                                                                                  │ parent (N-1)
                                                                                  ▼
users (organisateur national) ──owns──▶ (1) reseaux[national] ◀──parent── reseaux[local] (1..n)
users (organisateur national) ──owns──▶ (0..n) reseaux[local] (auto-gérés)
users (organisateur délégué)  ──owns──▶ (1..n) reseaux[local] (délégués)
reseaux[national|local] ──1..n──▶ evenements (lienInscription externe)   // gate = national.partenaire
reseauteur.national (dérivé) = distinct(parent de ses locaux fréquentés)
reseauteurs ──(secteur)──▶ categories      evenements ──(catégorie)──▶ types_evenement
reseaux[national].partenaire / partenaires(annonceur) ──▶ Stripe (Subscriptions, statut serveur)
reseauteurs.geom / evenements.geom / reseaux[local].geom  ── PostGIS (3 sources géo)
users ┄┄groupe┄┄▶ (0..1) groupes  [DORMANT — ADR-0009 ; angle « fédération » réalisé par la hiérarchie]
```

> **Garde-fous métier (serveur) — révisés par ADR-0012 :**
> - **« 1 user = au plus 1 réseau national »** → index partiel unique `(user) WHERE niveau='national'`
>   (remplace l'unicité `WHERE user IS NOT NULL`). Pas d'unicité sur `local.user` (un national possède N
>   locaux ; un délégué possède son/ses local(aux)).
> - **Hiérarchie 2 niveaux** : un local a exactement un parent `national` ; un national n'a pas de parent.
> - **Affiliation locaux-only** : `reseauxFrequentes` refuse les réseaux `niveau=national`.
> - **Suppression** : un national ne peut être supprimé s'il a des locaux ; un réseau ne peut être supprimé
>   s'il a des événements (garde existant étendu).

### 2.3 Autorisation & gate (helpers serveur centralisés — ADR-0012)

```
nationalDe(reseau)          = reseau.niveau==='national' ? reseau : reseau.parent
abonnementActif(reseau)     = nationalDe(reseau)?.partenaire === true          // statut serveur (webhook)
peutPublierEvenement(reseau)= abonnementActif(reseau)                          // remplace `!reseau.partenaire`
peutCreerLocal(user)        = ∃ national possédé par user, national.partenaire === true
peutGererReseau(user, r)    = admin || r.user===user.id
                              || (r.niveau==='local' && r.parent.user===user.id)  // umbrella national
peutGererEvenement(user, e) = peutGererReseau(user, e.reseau)
```

> **⚠️ Révision ADR-0014 (voir encart consolidé).** La propriété des **locaux** n'est plus seulement
> « tête auto-gérée / organisateur délégué » : un **réseauteur Plus possède** (`reseaux.user`) jusqu'à
> **`MAX_LOCAUX_PLUS = 3`** locaux (affiliés **ou** indépendants). Les gates deviennent :
> `peutCreerLocalReseauteurPlus(user) = user.plusActif && (# locaux possédés) < 3` ;
> `peutPublierEvenement(local) = local.user===user.id && user.plusActif` (**par propriété + Plus**, couvert
> par l'abonnement Plus) **OU** `abonnementActif(nationalDe(local))` (couverture par la tête). Le **quota de
> palier** de la tête ne compte que les locaux **possédés par la tête** (`peutCreerLocalAsync` filtre
> `user=owner`). Le champ `reseauteurs.adminReseaux` est **déposé/dormant** (remplacé par `reseaux.user`).
> `estTete()` (`niveau` non-local) remplace le binaire national/local dans les gates de facturation/quota.

Source de vérité du statut payant = **webhooks Stripe** (jamais le client) — invariant ADR-0011 réaffirmé.

---

## 3. Modules et frontières

| Module | Responsabilité | Emplacement | Frontière (contrat) |
|---|---|---|---|
| **Réseauteurs** | profil personne, slug, géocodage ville, badge, statut, affiliation **locaux only** | collection `reseauteurs` + hooks | slug figé (contrat SEO) ; M2M validée locaux |
| **Événements** | événement daté, slug, géocodage, lien externe ; gate publication = abonnement **national effectif** | collection `evenements` + hooks | rattaché à un réseau (national/local) ; pas d'inscription interne ; **plus de Premium** |
| **Réseaux** | fiche-entité **hiérarchique** (national/local), `niveau`/`parent`, logo, compteurs, drapeau partenaire (national), **délégation** | collection `reseaux` + hooks | M2M réseauteurs (locaux) ; possédé par 0..1 organisateur ; 2 niveaux max |
| **Cartes / Géo** | requêtes spatiales, GeoJSON, **3 sources** : réseauteurs · réseaux-**locaux** · événements | `/api/geo/reseauteurs`, `/api/geo/reseaux`, `/api/geo/evenements` (PostGIS) + clients MapLibre | **sortie** : GeoJSON FeatureCollection (format figé) ; **1 seul type de marqueur événement** |
| **Recherche / Filtres** | filtres combinables (simple) ; filtre **national** (umbrella), **niveau**, badge, ville… | route(s) `find` + colonnes indexées (+ `pg_trgm` noms) | **simple** ; pas de moteur FTS/externe |
| **Comptes & Espaces** | auth, dashboards réseauteur / national / local délégué ; **délégation** de locaux | Payload Auth + `/dashboard/*` + `/api/account/*` | un acteur n'agit que sur ses entités (helper `peutGererReseau`) |
| **Monétisation (mix B2C+B2B)** | **3 Subscriptions** : réseau tête **4 paliers** (ADR-0014) · annonceur · **Réseauteur Plus** ; hub unifié + `change-palier` (ADR-0016) ; factures | `/api/stripe/*`, `lib/stripe`, `lib/abonnement`, `/dashboard/abonnement`, crons | **source de vérité** des statuts payants ; webhooks idempotents ; **plus de Premium ni de packs de licences (ADR-0015)** |
| **SEO / Contenu** | metadata, JSON-LD `Person`/`Event`/`Organization`, sitemap, llms.txt, maillage, opt-out ; canonical des 2 pages à bascules | `lib/seo`, `lib/jsonld`, `app/sitemap.ts`, `robots.ts` | fiches **inchangées** ; états vue/filtres non canonicalisés |
| **Admin / Modération** | CRUD 3 entités (+ hiérarchie réseaux) + partenaires + abonnements + badges + catégories ; validation ; délégation fallback | Payload `/admin` | `admin` only ; `groupes` visible (ADR-0009) |
| **Plateforme / Transverse** | sécurité HTTP, rate-limit, emails, média, audit, RGPD, i18n FR | `next.config.ts`, `lib/*`, Media | identité centralisée `lib/site` |

**Contrats inter-modules clés :**
1. **Statut payant = source de vérité côté Monétisation.** Aucun module n'accorde un avantage (création de
   locaux, publication d'événement, fiche enrichie) sur un état client — toujours via le statut serveur du
   **national** dérivé des webhooks Stripe (`abonnementActif`).
2. **Slug figé = contrat Données ↔ SEO.** Aucun module ne re-slugifie une entité existante (ADR-0005).
   Les **fiches** `/reseauteur|reseau|evenement/[slug]` sont **inchangées** par l'ADR-0012.
3. **GeoJSON FeatureCollection = contrat Géo ↔ Cartes.** MapLibre interchangeable ; 3 sources, **1 type de
   marqueur** par source (plus de variante Premium).
4. **Propriété = contrat Comptes ↔ Admin.** réseauteur→son profil ; national→son réseau + ses locaux + leurs
   événements ; délégué→son local + ses événements ; admin→tout. Vérifié serveur (`peutGererReseau`).
5. **Hiérarchie = contrat Données.** `niveau`/`parent` valides (2 niveaux), affiliation locaux-only,
   unicité `WHERE niveau='national'` — garantis par hooks + index.

---

## 4. Couches transverses (décisions)

### 4.1 Rendu — SSR/ISR
- **Server Components par défaut** ; Client Components pour l'interactif (cartes, bascules, formulaires, filtres).
- **Fiches réseauteur / événement / réseau : SSR + ISR** (`generateStaticParams`, `generateMetadata`
  dynamiques). Revalidation ciblée via `revalidatePath` dans les hooks `afterChange`. **Pages à bascules** :
  SSR de l'état initial (entité + vue par défaut), hydratation client pour les bascules/filtres.

### 4.2 Accès données — Payload (ADR-0001)
- Payload + `@payloadcms/db-postgres` (Drizzle). Migrations versionnées (`push:false`). SQL paramétré
  uniquement pour la géo et la recherche. Types générés (`src/payload-types.ts`). **Pas de Prisma.**

### 4.3 Géo — PostGIS (ADR-0002)
- Colonnes `geom geography(Point,4326)` sur `reseauteurs`, `evenements` **et `reseaux`** (pour les **locaux**),
  alimentées par hook de géocodage (data.gouv). Index GiST. **Réseauteurs : centroïde ville par défaut.**
  **Événements : adresse du lieu** (lieu public). **Réseaux locaux : centroïde ville** (un national n'est pas
  cartographié — pas de point unique). Routes géo dédiées bbox/rayon → GeoJSON.

### 4.4 Cartes — MapLibre (ADR-0006, étendu)
- **Trois sources géo**, exposées dans les **deux pages à bascules** :
  - Page « Réseauteurs et réseaux », vue **carte** : marqueurs = **personnes** (entité réseauteurs) **ou**
    **réseaux locaux** (entité réseaux). Les **nationaux** ne sont pas des marqueurs (annuaire/logos + filtre).
  - Page « Événements », vue **carte** : marqueurs = **événements à venir**. **Un seul type de marqueur**
    (suppression du marqueur/couleur Premium — ADR-0012).
- Clusters comptés, contrôles, recherche ville / autour de moi. **Mobile-first** (plein écran + bottom-sheet).
  CSP nettoyée de Mapbox. **Impact `map-engineer` :** ajouter `/api/geo/reseaux` (locaux) ; **retirer** la
  branche marqueur Premium.

### 4.5 Auth — Payload Auth
- Conservée (JWT, verify, lockout, reset, change-email). Rôles `reseauteur` (défaut, gratuit) /
  `organisateur` / `admin`. Inscription **ouverte** ; hook signup → auto-création du `reseauteur`
  (statut « en attente ») **ou**, pour un `organisateur` auto-signé, d'un réseau **`niveau = national`**
  (ADR-0012). Les **délégués** sont créés via le **flow d'invitation** (pas d'auto-création de national —
  réutilisation du pattern claim-flow `req.context`).

### 4.6 Monétisation — Stripe (recalibrée ADR-0012/0013, **révisée ADR-0014 → 0016**)
- Plomberie conservée (**Subscription**, **Customer Portal**, **webhooks signés idempotents**, factures PDF,
  crons expiration). **Trois produits Stripe, tous en `mode: subscription`** (`src/lib/stripe.ts` → `PRODUITS`) :
  - (a) **Abonnement réseau national (tête)** = Subscription annuelle **en 4 paliers** (ADR-0014) —
    **`fiche`** (fiche publiée seule, **0** local) / `starter` (**5**) / `growth` (**25**) / `enterprise`
    (**illimité**), prix `STRIPE_PRICE_NATIONAL_FICHE/_STARTER/_GROWTH/_ENTERPRISE` (TODO PO). Posée sur la
    **tête** (`niveau` non-local) → `reseaux.partenaire=true`, `palier`, `partenaireExpireAt`,
    `statut='publiee'` (tête revendiquée). **Débloque** : publication de la fiche (naît `suspendue` sinon),
    création de locaux **jusqu'au quota du palier**, publication d'événements, fiche enrichie, logo accueil,
    badge partenaire.
  - (b) **Partenaire annonceur** = Subscription → logo page d'accueil + page Partenaires + **fiche perso
    `/partenaire/<slug>`** + **offre réservée aux réseauteurs** (espace « Offres partenaires » — livré).
    Pose `partenaires.statut='actif'`. *(ADR-0015 : ne conserve QUE cet abonnement de visibilité.)*
  - (c) **Réseauteur Plus** = Subscription individuelle **39 € HT/an** (`STRIPE_PLUS_PRICE_ID`) →
    `users.plusActif` (+ `plusExpireAt`, `plusSource='abonnement'`, `stripeSubscriptionId`). **Débloque** :
    création d'événements par le réseauteur **et** possession/publication de jusqu'à **3 réseaux locaux**
    (ADR-0014). **Seule voie vers le Plus** (ADR-0015 — les packs de licences sont supprimés).
- **Gestion unifiée (ADR-0016)** : hub **`/dashboard/abonnement`** + résolveur `resolveAbonnement`
  (`src/lib/abonnement.ts`) + brique UI `AbonnementManager`. `cancel` / `reactivate` **généralisées aux 3
  produits** (ownership par construction) ; route **`POST /api/stripe/change-palier`** (swap de price +
  proration + garde anti-downgrade côté organisateur). **`change-plan` / `preview-change-plan` → 410 Gone.**
- **Supprimé** : **événement Premium ponctuel** (ADR-0012, champs `premium`+`stripeCheckoutSessionId` droppés) ;
  **packs de licences Plus + codes promo** (ADR-0015 — route `/api/licences/activer` → 410, collections
  dormantes).
- **Pas** de quota d'événements, **pas** de 3 paliers historiques (90/130/190 €). Le « freemium réseauteur »
  historique (39 €/an) reste caduc — le **Plus** est un palier **nouveau et distinct**. Les statuts payants
  (`abonnementActif` de la tête, statut **annonceur**, **Plus**) sont posés par webhooks/serveur et **évalués
  séparément** (jamais comme un niveau cumulatif). La fonction `getEffectiveFeatureLevel` reste **supprimée**.

### 4.7 SEO (ADR-0005, « comme PanoramaPub »)
- JSON-LD **`Person`** (réseauteurs), **`Event`** (événements, `organizer` = réseau organisateur),
  **`Organization`** (réseaux ; un **local** peut référencer son **national** via `parentOrganization`),
  + `Breadcrumb`/`FAQ`/`ItemList`. **Fiches au singulier inchangées** (`/reseauteur`, `/evenement`, `/reseau`).
  **Pages à bascules** : `/reseauteurs` et `/reseaux` = deux landing **self-canonical** (la bascule d'entité
  est une navigation entre les deux) ; **état vue/filtres non canonicalisé** (canonical épuré). `/carte/*` →
  **301** vers les bascules. Sitemap dynamique des **fiches indexables** (opt-out respecté). `robots.ts`,
  `llms.txt`. Maillage interne (proximité / même métier / même réseau / **même national**). JSON-LD échappé
  XSS (ne pas régresser).

### 4.8 Recherche / filtres — simple (ADR-0011 §6 ; étendu ADR-0012)
- Filtres combinables, appliqués dans les **deux entités et les deux vues** de la page combinée, et dans la
  page événements :
  - réseauteurs : nom, entreprise, ville/dept/région, métier, secteur, **réseau (local)**, **national
    (umbrella, dérivé)**, badge ;
  - réseaux : nom, ville/dept/région, **niveau** (national/local), **national parent**, catégorie, partenaire ;
  - événements : réseau (national/local), ville, date (à venir), catégorie.
- Implémentation **Payload `find` + colonnes indexées**, `pg_trgm` optionnel (tolérance de frappe sur les
  noms). Filtre « national » = filtrer les locaux dont `parent = X` (jointure parent). Partagée avec les
  cartes (bbox + filtres). **Pas** de moteur FTS à facettes ni externe.

### 4.9 Confidentialité & RGPD — proportionné (ADR-0011 §7, inchangé)
- Contrôle de confidentialité du réseauteur = **champs de contact facultatifs**. **Géoloc ville** par défaut.
  RGPD existant (consentement/export/delete/purge/audit) **repointé** sur `reseauteurs`. **Opt-out
  d'indexation** propagé (sitemap + robots + `<meta noindex>` ; `noindex` par défaut tant que non validé).
  **Pas** de projection par champ ni de double `geom` obligatoire.

### 4.10 i18n / a11y / secrets / observabilité / validation
- **i18n FR** (sentence case). **a11y** (contrastes, focus, clavier ; bascules accessibles au clavier).
  **Secrets** en env only. Logs structurés + `AuditLogs` + `/api/health`. **Zod côté serveur** sur toutes les
  routes (statut payant, rôle, propriété, **niveau/parent** jamais déduits du client).

---

## 5. Arborescence cible (déltas sur l'existant)

```
src/
  app/
    (frontend)/
      page.tsx                         # home (3 piliers — frontend-builder)
      reseauteurs/                     # page combinée « Réseauteurs et réseaux » — entité préselect = réseauteurs
      reseaux/                         # MÊME composant combiné — entité préselect = réseaux (national=annuaire, local=carte)
      evenements/                      # page « Événements » — bascule carte ↔ agenda
      carte/reseauteurs/  carte/evenements/   # → 301 vers /reseauteurs?vue=carte / /evenements?vue=carte
      reseauteur/[slug]/               # fiche réseauteur SSR/ISR (INCHANGÉE)
      evenement/[slug]/                # fiche événement SSR/ISR (INCHANGÉE)
      reseau/[slug]/                   # fiche réseau SSR/ISR (national ou local — parentOrganization JSON-LD)
      partenaires/                     # page Partenaires (annonceurs — inchangée)
      dashboard/
        (reseauteur)/profil            # édition profil, badge, contacts facultatifs, affiliation locaux
        (organisateur)/reseau          # fiche réseau ; NATIONAL : + gestion des locaux + délégation + abonnement
        evenements/                    # CRUD événements (gate = national.partenaire)
        abonnement/                    # ADR-0016 : HUB unifié tous rôles souscripteurs (souscrire/annuler/réactiver/changer de palier)
        factures/                      # factures — tout rôle souscripteur avec stripeCustomerId (Plus inclus)
        mes-reseaux/                   # ADR-0014 : locaux possédés par un réseauteur Plus (≤ 3) + invitation tête absente
        groupe/                        # CONSERVÉ non lié (dormant — ADR-0009)
        evenements-nationaux/          # legacy → déjà redirect /dashboard (neutralisé)
      ...(pages légales, auth — conservées, rebrandées)
    (payload)/admin/                   # back-office Payload (hiérarchie réseaux, délégation fallback)
    api/
      geo/reseauteurs/route.ts         # route spatiale PostGIS (carte réseauteurs)
      geo/reseaux/route.ts             # NOUVEAU : route spatiale PostGIS (marqueurs = réseaux LOCAUX)
      geo/evenements/route.ts          # route spatiale PostGIS (carte événements — sans Premium)
      stripe/*                         # 3 Subscriptions (national 4 paliers + annonceur + Plus) ; change-palier ; change-plan/preview → 410
      licences/activer                 # ADR-0015 : SUPPRIMÉ → 410 Gone (packs de licences retirés)
      account/* cron/* ...             # conservés, repointés
    sitemap.ts  robots.ts  llms.txt    # 3 entités fiches, opt-out indexation (seo-engineer)
  collections/
    Reseauteurs.ts                     # M2M reseauxFrequentes validée « locaux only »
    Evenements.ts                      # RETIRER premium + stripeCheckoutSessionId ; gate = national effectif
    Reseaux.ts                         # + niveau + parent (self) ; unicité user → WHERE niveau='national' ; délégation
    Partenaires.ts                     # INCHANGÉE (annonceurs)
    Users.ts                           # role inchangé ; auto-create organisateur → réseau niveau=national ; flow délégué
    Categories.ts / TypesEvenement.ts / Badges.ts   # référentiels
    Groupes.ts                         # CONSERVÉ dormant (ADR-0009)
    Testimonials.ts                    # CONSERVÉ DORMANT (tranché ADR-0011 §8.5)
  lib/
    site.ts                            # identité RÉSEAUTEURS
    stripe.ts                          # 3 produits, mode:subscription (national 4 paliers + annonceur + Réseauteur Plus)
    abonnement.ts                      # ADR-0016 : resolveAbonnement / AbonnementContext / fetchLiveStripeState (3 porteurs)
    reseau-hierarchie.ts               # estTete / PALIERS_CONFIG / nationalDe / abonnementActif / peutCreerLocalAsync / MAX_LOCAUX_PLUS
    geocode.ts geojson.ts              # conservés
    seo.ts jsonld.ts                   # Person ; Event organizer=réseau ; Organization (+ parentOrganization)
    badge.ts                           # dérivation du badge
  migrations/                          # additives : niveau/parent, unicité partielle, drop premium ; + réexamen 0623
  payload.config.ts                    # collections mises à jour
  next.config.ts                       # CSP sans Mapbox + 301 (/carte/* → bascules ; legacy)
```

> Principe : **migrations additives, refactor in place**. On fait évoluer ce dépôt.

---

## 6. Points de migration (résumé — détail `data-architect` / `MIGRATION.md`)

1. **PostGIS** : extension + `geom` sur `reseauteurs`, `evenements` et `reseaux` + index GiST + backfill.
2. **`reseaux` — hiérarchie (ADR-0012)** :
   - Ajouter **`niveau`** (enum, **défaut proposé `national`** pour les lignes existantes) + **`parent`**
     (self-FK nullable). Valider : local⇒parent national ; national⇒parent null ; 2 niveaux.
   - **Relâcher l'unicité `user`** : remplacer l'index partiel `WHERE user_id IS NOT NULL` par
     **`WHERE niveau='national'`** (1 user = au plus 1 national).
   - **Affiliations existantes** : si des `reseauxFrequentes` pointent vers des lignes devenues `national`,
     elles violent « locaux only » → remap ou purge (impact attendu faible : `reseauteurs` est neuf).
     **Question ouverte** (cf. `PLAN.md`).
   - Garde `beforeDelete` étendu (national avec locaux).
3. **`evenements`** : **supprimer** `premium` + `stripeCheckoutSessionId` (drop colonnes — `down()` documenté) ;
   le gate de publication passe de `reseau.partenaire` à `nationalDe(reseau).partenaire`.
4. **`reseauteurs`** : validation M2M « locaux only » (serveur). Pas de changement de colonnes structurant.
5. **`users`** : enum `role` **inchangé** ; ajuster l'auto-création signup (`organisateur` → réseau
   `niveau=national`) et brancher le **flow délégué** (claim-flow → `local.user`).
6. **Stripe** : retrait du Checkout one-shot Premium (route + webhook one-shot) ; les Subscriptions
   (nationale + annonceur) restent. Les champs `partenaire`/`stripeSubscriptionId`/`partenaireExpireAt`
   ne sont écrits que pour `niveau=national`. **Question ouverte** : sort de ces champs sur d'éventuels locaux
   importés déjà flaggés.
7. **Référentiels** : `categories`, `types_evenement`, `badges` — inchangés.
8. **Routes/URLs** : **301** `/carte/reseauteurs` → `/reseauteurs?vue=carte`, `/carte/evenements` →
   `/evenements?vue=carte`. **Fiches inchangées** (pas de re-slug). Sort de `/reseaux` (landing vs 301
   collapse) = **question ouverte**.
9. **Re-migration `0623`** : inchangée vs ADR-0011 (`reseaux` reste pertinente) ; ⚠️ `down()` de `120000`
   destructif (`TRUNCATE reseaux CASCADE`) — gate humain + dry-run.
10. **Groupes** : aucune migration (dormant — ADR-0009).

---

## 7. Carte des décisions (index ADR)

| ADR | Titre | Statut |
|---|---|---|
| 0001 | Conserver Payload CMS comme couche d'accès Postgres | Accepté (réaffirmé par 0011/0012) |
| 0002 | Activer PostGIS + requêtes spatiales | Accepté (réaffirmé par 0011/0012) |
| 0003 | Fusion → entité `reseaux` (collection unique) | Esprit remobilisé (0011) ; **collection unique confirmée par 0012** (hiérarchie par self-relationship, pas 2 tables) |
| 0004 | Recalibrage abonnements + **quota d'événements/an** | **Caduc** (quota + 3 paliers) — supersédé par 0011 (B2B sans quota) ; 0012 recalibre encore le B2B |
| 0005 | Schéma d'URLs au singulier + préservation SEO | Accepté — étendu à 3 entités (0011) ; **fiches inchangées par 0012** ; bascules + 301 `/carte/*` |
| 0006 | Substitution MapLibre ← Mapbox | Accepté (réaffirmé) — **étendu par 0012** d'une source « réseaux locaux » ; marqueur Premium retiré |
| 0007 | Rebranding Panorama → Info-Réseaux | Mécanisme accepté ; cible de marque caduque → RÉSEAUTEURS (0011) |
| 0008 | Occurrences récurrentes | Hors V1 ; `serieId` retiré (0011) |
| 0009 | Paiements de groupe / affiliation dormants | Accepté (inchangé) — **angle « fédération » réalisé par la hiérarchie 0012**, mais groupes restent dormants |
| 0010 | Annuaire mono-entité (membre seul) | Supersédé sur 3 points par 0011 |
| 0011 | Plateforme à 3 entités, monétisation B2B, simplicité d'abord | **Accepté — amendé sur 4 points par 0012, sur l'invariant « réseauteurs gratuits » par 0013** |
| 0012 | Hiérarchie réseaux national↔local, abonnement national, locaux délégables, pages à bascules | **Accepté** — abonnement national passé en **4 paliers** par 0014 ; « délégation » complétée par la **propriété** (0014) ; réseaux hiérarchiques réaffirmés |
| 0013 | Réseauteur Plus (création d'événements), rôle partenaire self-service, packs de licences Plus par code promo | **Accepté (2026-07-12)** — Plus + rôle partenaire **en vigueur** ; **packs de licences supersédés (supprimés) par 0015** |
| **0014** | **Fiche nationale payante (4 paliers), locaux des réseauteurs Plus par propriété, événements par propriété** | **Accepté (2026-07-17, en vigueur)** — 4 paliers `fiche`/`starter`/`growth`/`enterprise` ; fiche de tête revendiquée naît `suspendue` ; `MAX_LOCAUX_PLUS=3` ; `adminReseaux` dormant |
| **0015** | **Suppression des packs de licences « Réseauteur Plus »** | **Accepté (2026-07-17, en vigueur)** — `/api/licences/activer` → 410 ; collections dormantes ; Plus par abonnement individuel uniquement |
| **0016** | **Hub d'abonnement unifié en libre-service (tous rôles souscripteurs)** | **Accepté (2026-07-20, en vigueur)** — `/dashboard/abonnement`, `resolveAbonnement`, cancel/reactivate/`change-palier` ; `change-plan`/`preview-change-plan` → 410 |

---

## 8. Décisions tranchées & questions ouvertes

### 8.1 Tranchées au gate humain (2026-06-29 — ADR-0011, toujours valides)
1. **URL & slug des réseauteurs** : `/reseauteur/<prenom-nom>` ; collision déterministe (`-<ville>` puis
   `-2`,`-3`…) ; slug **figé**. (Fiches **inchangées** par ADR-0012.)
2. **Précision géo des réseauteurs** : **centroïde ville/commune** par défaut.
3. **Opt-out d'indexation** : respecté (sitemap + robots + `<meta noindex>`) ; **`noindex` par défaut tant que
   non validé**.
4. **`Testimonials`** : conservé **dormant**.

### 8.2 Tranchées au brief du 2026-06-30 (ADR-0012 — verrouillées)
- Abonnement = **réseaux nationaux uniquement** ; **annonceur conservé** ; **événement Premium supprimé**.
- Réseaux locaux = fiches créées par le national, **gestion délégable** à un compte organisateur local distinct.

### 8.3 Questions ouvertes (gate humain ADR-0012)
Autorité dans **`PLAN.md` §Questions ouvertes**. Synthèse : rôle dédié vs `niveau` dérivé (proposé : dérivé) ;
mécanisme de délégation (invitation email vs assignation admin — proposé : invitation) ; sort des routes index
(`/reseaux` landing self-canonical vs 301 collapse — proposé : landing) ; niveau par défaut des `reseaux`
existants + remap des affiliations (proposé : `national`) ; un seul prix d'abonnement national vs paliers ;
sort des champs `partenaire`/`stripeSubscriptionId` sur d'éventuels locaux importés flaggés ; agrégation des
compteurs nationaux (proposé : à l'affichage SSR).

> Le gate 1 (archi + plan) et le gate 2 (schéma) de l'ADR-0011 sont **levés**. L'**amendement ADR-0012**
> rouvre un **gate humain ciblé** sur le schéma de la hiérarchie + les questions §8.3, **avant** la phase
> d'implémentation correspondante (cf. `PLAN.md`).
