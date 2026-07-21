# CLAUDE.md — RÉSEAUTEURS

> Mémoire projet partagée par tous les agents. **Chaque agent lit ce fichier en premier.**
> Si un `CLAUDE.md` existe déjà dans le dépôt, fusionner ce contenu plutôt que l'écraser.
>
> **Ce fichier a été réaligné le 2026-06-28 sur le modèle à TROIS ENTITÉS** (ADR-0011).
> L'ancien produit « Info-Réseaux.fr / la carte des événements business » (modèle Réseau → Occurrences)
> **et** l'annuaire mono-entité de l'ADR-0010 (membre seul, réseaux = tags, sans événements, freemium 39 €)
> sont **caducs**. Sources de vérité du cap actuel :
> `docs/adr/0011-plateforme-trois-entites-monetisation-b2b.md` (décision structurante),
> `docs/evolution/Reseauteurs - Document de cadrage.md`, `docs/evolution/ROADMAP-V1.md`,
> `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` (+ son amendement 3-entités).
>
> **Évolution monétisation actée le 2026-07-12** (détail en §4) : le **réseauteur** a désormais
> **2 niveaux** — *Gratuit* (actuel) et ***Plus*** (abonnement) qui ouvre la **création d'événements**.
> Partout ci-dessous, les mentions « réseauteurs strictement gratuits » / « pas de palier payant côté
> réseauteur » sont **remplacées** par ce cap.
> ⚠️ **ADR-0015 (2026-07-17)** : les **packs de licences « Réseauteur Plus »** vendus aux partenaires
> (10/50/100 + code promo) sont **SUPPRIMÉS**. Le partenaire ne conserve que l'**abonnement de
> visibilité** avec son **offre réservée aux réseauteurs** ; le Plus s'obtient **uniquement par
> abonnement individuel**.

## 1. Produit

**RÉSEAUTEURS** — **« la plateforme nationale du networking »**. Le site ne devient **pas** un réseau
d'affaires de plus : il est le **point central qui rassemble tous les réseaux existants**. Aujourd'hui des
centaines de milliers de professionnels fréquentent des réseaux (BNI, DCF, CJD, Dynabuy, Cafés Business,
Rotary, Lions Club, Réseau Entreprendre, CPME, Medef…), répartis partout en France, mais **aucune
plateforme** ne permet de retrouver, au même endroit, **les personnes qui réseautent, les événements
business, et les réseaux**. RÉSEAUTEURS a vocation à devenir cette plateforme.

**Principe fondateur, structurant :** *« Le site ne remplace aucun réseau. Il les rassemble. »*
RÉSEAUTEURS est une **couche de visibilité et de mise en relation** neutre et indépendante, superposée à
l'écosystème. On ne concurrence aucun réseau ; on les transforme en partenaires.

## 2. Trois entités reliées (le cœur du modèle)

La plateforme repose sur **trois bases de données reliées entre elles** (ADR-0011, §1) :

1. **Le réseauteur** (`reseauteurs`) — une **personne**. Inscription **gratuite**. Fiche publique
   (`/reseauteur/<prenom-nom>`) et **marqueur sur la carte des réseauteurs**. Champs : photo, nom, prénom,
   entreprise, fonction, description, téléphone *(facultatif)*, email *(facultatif)*, site, LinkedIn, ville,
   département, région, secteur d'activité, compétences, **réseaux fréquentés** (cases à cocher multi →
   relation many-to-many), **badge** (§5), géolocalisation.
2. **L'événement** (`evenements`) — un **événement business daté**. Fiche publique (`/evenement/<slug>`) et
   **marqueur sur la carte des événements**. Champs (fiche complète — spec 2026-07-13) : titre, **type**
   (10 valeurs : petit-déj, déjeuner, afterwork, conférence, atelier, formation, visite d'entreprise, speed
   business, salon, autre), **description courte + détaillée + intervenants**, date/heure début+fin, **lieu**
   (nom/adresse/CP/ville/**département**), **participation** (gratuit/tarif, nb de places, date limite,
   ouvert à tous ?, réservé aux membres ?, invité possible ?, niveau, public concerné, secteur), **contact**
   (nom/email/tél), **médias** (visuel + galerie), **infos pratiques** (parking, PMR, compléments),
   **réseau organisateur** *(ou réseauteur Plus organisateur — XOR)*, **lien d'inscription externe**,
   validation (statut + créé par + date de MàJ), géolocalisation. **Recherche/filtres :** ville, **département**,
   réseau, **type**, **gratuit/payant**, date. **Inscription — deux régimes (ADR-0013, tranché 2026-07-13) :**
   • **événement de réseau** → le bouton « S'inscrire » **redirige vers le site du réseau** (RÉSEAUTEURS
   **n'organise pas** ; le réseau a son propre système) ;
   • **événement organisé par un réseauteur Plus** → **inscription sur la plateforme** : un réseauteur
   connecté clique « Je m'inscris », et l'**organisateur Plus gère la liste des inscrits** depuis son espace.
   *(Le réseauteur Plus n'a pas de site d'inscription externe — la plateforme le lui fournit.)*
   **Création (§4) :** ouverte aux **organisateurs** (réseau partenaire) **et aux réseauteurs Plus** (abonnés) ;
   relation organisateur = **réseau XOR réseauteur** (`organisateurReseauteur`, invariant serveur).
3. **Le réseau** (`reseaux`) — un **réseau d'affaires** (BNI, DCF…). Fiche publique (`/reseau/<slug>`).
   Champs (fiche complète — spec 2026-07-13) : nom, logo, **description courte + présentation détaillée +
   objectif + différenciateur**, site + **réseaux sociaux**, **localisation** (ville/dépt/région/adresse),
   **type de structure** (association/privé/franchise/institution/autre) + **échelle** = champ **`niveau`** à
   **4 valeurs** (local/régional/national/international), **responsable local** (nom/fonction/
   photo) + email/téléphone, **fonctionnement** (public concerné, ouvert à tous ?, invités ?, adhésion
   obligatoire ?, une profession par groupe ?, cotisation), **nombre de membres déclaré**, **médias** (galerie,
   vidéo, plaquette PDF), **nombre de réseauteurs** (dérivé), **nombre d'événements** (dérivé), drapeau
   **partenaire** (abonnement actif, §4), validation (statut + date de MàJ + rempli par). Un réseau est **à la
   fois** une fiche-entité **et** la valeur de taxonomie que les réseauteurs cochent.
   > La fiche **présente le réseau** ; les **événements** sont une entité distincte (saisie unique des infos
   > permanentes, événements gérés séparément). **`niveau` = un seul champ à 4 valeurs** (réconciliation
   > 2026-07-13 : « portée » et « niveau » = la même caractéristique). La **hiérarchie umbrella reste à
   > 2 étages** : une **tête de réseau** = *régional / national / international* (parent null, porte
   > l'abonnement, peut avoir des groupes) ; un **groupe** = *local*, **rattaché à une tête OU indépendant**
   > (parent optionnel — ADR-0014 ; terme UI tranché 2026-07-16 — l'ancien mot « chapitre » est banni de
   > toute copie visible). Les gates (facturation, publication d'événements, unicité « 1 tête par compte »)
   > raisonnent **« tête (non-local) vs local »** — cf. `estTete()` dans `lib/reseau-hierarchie.ts`.
   > **ADR-0014 (2026-07-17)** : la **fiche d'une tête revendiquée naît suspendue** et n'est publiée que
   > par l'abonnement (webhook) ; un **réseauteur Plus possède jusqu'à 3 réseaux locaux** (affiliés ou
   > indépendants) créés depuis son espace « Mes réseaux », et crée les événements de SES locaux (gate =
   > propriété + Plus, l'« admin déclaré » adminReseaux est déposé/dormant).

**Relations :** réseauteur **↔** réseaux = many-to-many (réseaux fréquentés) · événement **→** réseau = N-1
(réseau organisateur) · réseau **→** réseauteurs/événements = dérivés (compteurs).

## 3. Audiences & comptes (quatre rôles — ne jamais les confondre)

- **Visiteur** (gratuit, sans compte) : explore les **deux cartes**, consulte les fiches réseauteur /
  événement / réseau, recherche. **Zéro friction.** Compte/email uniquement pour devenir réseauteur ou
  recevoir des alertes.
- **Réseauteur** (`role: reseauteur`) — **2 niveaux (évolution §4)** : **Gratuit** (actuel : profil, carte,
  participation aux événements, offres partenaires) et **Plus** (**abonnement individuel** — ADR-0015 :
  la licence par code promo partenaire est supprimée) qui ouvre le **droit de créer des événements**.
  L'inscription reste **gratuite et sans friction** — la gratuité fait la densité ; le Plus est optionnel.
- **Organisateur** (`role: organisateur`) : gère **uniquement** la fiche **de son réseau** et **ses
  événements** (1 compte ↔ 1 réseau). C'est le compte d'un **réseau partenaire** (§4).
- **Partenaire** (`role: partenaire`) : entreprise **annonceuse** (1 compte ↔ 1 fiche partenaire). Gère sa
  fiche perso + son **offre réservée aux réseauteurs** et souscrit l'**abonnement annonceur** (§4.3).
  *(Les packs de licences sont supprimés — ADR-0015.)*
- **Administrateur** (`role: admin`) : back-office complet — créer / modifier / supprimer **réseauteurs,
  événements, réseaux, partenaires, abonnements, tarifs, badges, catégories, utilisateurs**.

## 4. Monétisation (Stripe)

> **Évolution 2026-07-12.** Le modèle passe d'un revenu **100 % B2B** à un **mix B2C (réseauteur Plus)
> + B2B (réseaux, partenaires)**. Cela **lève** l'invariant historique « les réseauteurs sont et restent
> gratuits / pas de palier payant côté réseauteur ». La plomberie Stripe existante (checkout, Customer
> Portal, webhooks idempotents signés, factures PDF, crons d'expiration) est **réutilisée**. Le statut
> payant est **toujours** posé côté serveur (webhook), jamais par le client (§11).
> **ADR-0015 (2026-07-17)** : les packs de licences partenaires sont **supprimés** du mix.
> **ADR-0016 (2026-07-20)** : la **gestion de l'abonnement est unifiée et complète, en libre-service, pour
> les 3 types de souscripteurs** (réseauteur Plus, organisateur, partenaire). Hub unique **`/dashboard/abonnement`**
> ouvert à tous les rôles souscripteurs ; résolveur commun **`src/lib/abonnement.ts`** (`resolveAbonnement`
> → `AbonnementContext` unifiant les 3 porteurs `users`/`reseaux`/`partenaires` + `fetchLiveStripeState`
> tolérant aux pannes) ; brique partagée **`src/components/billing/AbonnementManager.tsx`** (souscrire /
> changer de palier / **annuler** / **réactiver** / moyen de paiement / factures). `cancel`+`reactivate`
> **généralisés aux 3 produits** (ownership garanti par construction) ; nouvelle route
> **`POST /api/stripe/change-palier`** (organisateur, proration + garde anti-downgrade) ; `change-plan` /
> `preview-change-plan` restent **410 Gone**. Invariant §11 conservé : accès posé côté serveur (webhooks),
> les actions in-app **pilotent Stripe** (cancel_at_period_end, swap de price) sans muter la DB depuis le client.

### 4.1 Réseauteur — 2 niveaux d'accès (Plus **= 39 € HT/an** — décision 2026-07-16)
| Niveau | Type | Accès |
|---|---|---|
| **Gratuit** *(actuel)* | — | Profil, fiche publique, carte, réseaux fréquentés, participation aux événements, offres partenaires, **inscription en ligne aux événements Plus**. |
| **Plus** | Abonnement **39 € HT/an** (Subscription) | Tout le gratuit **+ créer des événements** (illimités, publication auto sur la carte) **+ gérer les inscriptions** de ses événements (liste des inscrits) **+ modifier/supprimer** ses événements. |

> **Prix : 39 € HT/an** (décision 2026-07-16 — remplace le 59 €/an du gate P0 D2). ⚠️ Le prix Stripe réel est porté par `STRIPE_PLUS_PRICE_ID` : créer/pointer un Price à 39 € HT dans Stripe, sinon le checkout facture encore l'ancien montant.
> **Pas de « profil vérifié » en V1** (reste une évolution future — §12).

Le niveau est porté par le **compte réseauteur** (statut d'abonnement posé par le webhook Stripe). Un
réseauteur passe **Plus** d'une **seule façon** : l'**abonnement individuel** (ADR-0015 — l'activation
par licence/code promo partenaire est supprimée ; les licences déjà activées s'éteignent à échéance).

### 4.2 Réseau — abonnement par paliers (ADR-0014, 2026-07-17)
**Réseau partenaire** : abonnement **annuel** porté par la **tête de réseau**, en **4 paliers** —
**`fiche`** (publication de la fiche, 0 groupe local) / `starter` / `growth` / `enterprise` (prix Stripe :
`STRIPE_PRICE_NATIONAL_*`, TODO PO). **La fiche d'une tête revendiquée naît `suspendue` et n'est publiée
que par un abonnement actif** (posé par webhook ; expiration → re-suspendue, fiches importées épargnées).
Tout palier inclut logo page d'accueil, badge partenaire, fiche enrichie, lien site ; les paliers ≥ starter
débloquent les groupes locaux (quota = locaux **possédés** par le national) et la publication d'événements.
**Réseauteur Plus ↔ réseaux locaux** : un Plus crée jusqu'à **3 réseaux locaux** (affiliés à une tête ou
**indépendants**) et publie leurs événements (couverts par l'abonnement Plus, pas par celui du national) ;
s'il ne trouve pas le national, il peut l'**inviter par email** à créer son compte organisateur.

### 4.3 Partenaire (annonceur) — abonnement de visibilité uniquement (ADR-0015)
| Produit | Type | Inclus |
|---|---|---|
| **Partenaire annonceur** | Abonnement | **Espace publicitaire** : logo page d'accueil + page Partenaires + **fiche perso** (`/partenaire/<slug>`) + **offre réservée aux réseauteurs** (visible dans leur espace « Offres partenaires »). *(= fonctionnalité déjà livrée.)* |

> **Packs de licences « Réseauteur Plus » : SUPPRIMÉS (ADR-0015, 2026-07-17).** Checkout, activation par
> code promo, UI et sections publiques d'affiliation retirés. Les collections `licences-packs` /
> `licences-activations` restent **dormantes** en DB (traçabilité legacy, extinction par le cron
> `expiration-plus` — les Plus « licence » existants gardent leur accès jusqu'à échéance).

> **Toujours caduc :** l'« Événement Premium » ponctuel (ADR-0012) reste **supprimé** ; le « freemium membre
> 39 €/an » et les 3 paliers 90/130/190 € historiques restent **supprimés**. Le **Réseauteur Plus** est un
> **nouveau** palier distinct, dont le seul avantage V1 est la **création d'événements**.

## 5. Badge réseauteur (déclaratif, simple)

Question obligatoire à l'inscription : **« Combien d'événements de networking fréquentez-vous chaque mois ? »**
→ **0–1 : Bronze · 2–5 : Argent · 6–10 : Gold · plus de 10 : Platinum.** Affiché sur le profil et le
marqueur. **Purement déclaratif** en V1 (le « badge vérifié » est une évolution future, §12). L'admin gère
le référentiel des badges.

## 6. Stack (CONFIRMÉE — refactor in place — ADR-0001/0011)

- **Framework :** Next.js (App Router, TypeScript strict). SSR/ISR indispensable pour le SEO des fiches.
- **Couche d'accès / back-office :** **Payload CMS** (admin auto-généré, auth, **field-level access**,
  pipeline média, hooks) — réaffirmé ADR-0001. Accès SQL via **Drizzle** + SQL paramétré pour la géo et la
  recherche. *(Ne pas introduire Prisma.)*
- **Base de données :** **PostgreSQL** + **PostGIS** (ADR-0002) pour la géo (`geom`,
  `geography(Point,4326)`, index GiST, `ST_DWithin`).
- **Cartes :** **MapLibre GL JS** + tuiles OpenStreetMap (ADR-0006). **Deux cartes** (réseauteurs +
  événements). Géocodage via **data.gouv** (existant, conservé).
- **Recherche :** **simple, par filtres** dans Postgres via Payload (`find` + colonnes indexées, `pg_trgm`
  optionnel pour la tolérance de frappe). **Pas de moteur FTS à facettes, pas de moteur externe** (§10, §8).
- **Auth :** **Payload** (JWT, lockout, verify, reset). Rôles `admin/organisateur/reseauteur/partenaire`.
- **Paiement :** Stripe (**Subscriptions** + Customer Portal + webhooks idempotents signés + factures PDF),
  recalibré sur les **3 produits** (réseauteur Plus B2C + réseau partenaire par paliers + annonceur, tous en
  abonnement) ; gestion unifiée en libre-service (`resolveAbonnement` / hub `/dashboard/abonnement`, ADR-0016).
- **Emails :** Resend (onboarding, sécurité, modération, expiration d'abonnement) — conservé, à rebrander.
- **Hébergement :** Vercel ; SSL obligatoire.

## 7. État réel de l'existant (lire avant de toucher au code)

Le dépôt est historiquement **PanoramaPub.fr** (annuaire de revendeurs + événements + carte + Stripe 3
paliers + SEO complet), partiellement pivoté vers « Info-Réseaux » (modèle Réseau→Occurrences, migrations
`20260623_*`). **Bonne nouvelle pour le modèle à 3 entités :** événements et réseaux-entités, que l'ADR-0010
avait prévu de **démonter**, **reviennent** — donc une **plus grande part de l'existant se réutilise** :

- **`evenements`** : **conservée et simplifiée** (retrait de `participer`/quota/`serieId`/archivage de
  l'ancien modèle ; ajout de `lienInscription` externe). Le **drapeau `premium` a été supprimé** (ADR-0012,
  colonnes droppées) ; l'organisateur est **réseau XOR réseauteur Plus** (`organisateurReseauteur`), et la
  collection **`inscriptions`** existe pour les inscriptions en ligne aux événements organisés par un
  réseauteur Plus (ADR-0013).
- **`reseaux`** (créée par les migrations `0623`) : à **conserver comme entité** (fiche, logo, présentation,
  compteurs) **et** comme valeur de taxonomie M2M. Possédée par un compte **organisateur**.
- **Machinerie SEO multi-types** (`Event`, `Organization`, `LocalBusiness`, sitemap, ISR), **carte
  MapLibre/PostGIS**, **Stripe**, **RGPD**, **auth**, **géocodage**, **emails**, **sécurité HTTP** : **infra
  agnostique de qualité production → réutilisée**.
- À **créer** : collection **`reseauteurs`** (personne), collection **`partenaires`** (annonceurs), champ
  **badge**, relation M2M réseauteur↔réseaux, **carte des réseauteurs**, recalibrage Stripe (Plus B2C + réseau/annonceur B2B).
- **Dormant (ADR-0009 inchangé) :** groupes/affiliation — conservés, masqués.

> Détail garder/réécrire/supprimer : `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` **+ son amendement
> 3-entités** (les verdicts « SUPPRIMER » de l'événementiel/réseaux y sont **revus** : ils reviennent).

## 8. Design — tokens conservés, structure simple

Le **système visuel est conservé** comme identité de marque ; la **structure** est (ré)écrite vers le modèle
à 3 entités, **sous contrainte de simplicité** (§10). Références :

- **`.claude/design/DESIGN.md`** — **tokens (typo, couleurs, rayons, composants) = source de vérité
  conservée** ; **structure home + deux cartes = décrites pour le modèle 3 entités**.
- **`.claude/design/info-reseaux-plasma.html`** — maquette : **référence de TOKENS uniquement** (palette,
  typo, rayons, style des clusters/cartes). Sa **structure** est indicative.

Tokens clés (détail dans `DESIGN.md`) :
- **Police : Hanken Grotesk** (Google Fonts, 400→800), via `next/font`.
- **Mode clair dominant** sur canvas **`#faf9f5`** ; surfaces blanches ; **bandes sombres** (`#0d0d10`).
- **Bleu primaire `#2563EB`**, navy `#16284f`, **accent orange `#f5851f`** (conversion / abonnement / CTA),
  violet secondaire `#a855f7`, neutres zinc, bordure `#e4e4e7`.
- **Rayons généreux** (~12px ; conteneurs 16px ; pills 999px) ; sentence case ; deux graisses ; ombres
  discrètes. Copie UI **en français**.

Structure de la home (modèle 3 entités, **comprise en < 30 s** — voir `DESIGN.md §5`) : En-tête → Hero +
accès aux **deux cartes** → Bandeau logos réseaux (« tous les réseaux réunis ») → **Trois piliers**
(Réseauteurs · Événements · Réseaux) → Comment ça fonctionne → Chiffres clés (réseauteurs / événements /
réseaux / villes) → **Bandeau Partenaires** (logos annonceurs) → Newsletter → Pied de page.

## 9. SEO + RGPD (transverse, exigence forte — « comme PanoramaPub »)

Chaque fiche (réseauteur, événement, réseau) est un **actif de référencement longue traîne**. Obligatoire :
URLs propres au singulier (`/reseauteur/<prenom-nom>`, `/evenement/<slug>`, `/reseau/<slug>`),
`<title>`/meta dynamiques, **JSON-LD `Person` / `Event` / `Organization`**, `sitemap.xml` dynamique,
canonical/OG, **optimisation IA** (`llms.txt`), rendu SSR/ISR, maillage interne (à proximité / même métier /
même réseau / mêmes événements).

**RGPD — proportionné (ADR-0011 §7).** On indexe des **personnes physiques** (réseauteurs) : respecter
consentement, export, suppression, purge, audit, **opt-out d'indexation** (sitemap + robots + `<meta>`),
droit au déréférencement. **Le contrôle de confidentialité du réseauteur = les champs de contact
facultatifs** (téléphone/email) qu'il choisit de renseigner. **Géolocalisation par défaut au niveau
ville/commune** (centroïde) — on n'a pas besoin de l'adresse personnelle exacte → pas de double `geom`
obligatoire ni de projection par champ (allègement assumé vs ADR-0010).

## 10. Principe directeur — la simplicité d'abord (NON négociable)

> **La priorité absolue est la simplicité. Le site doit être compris en moins de 30 secondes par un nouvel
> utilisateur.** Préférer une V1 avec **peu de fonctionnalités mais parfaitement exécutées**, rapide et
> évolutive, à une V1 trop ambitieuse, complexe ou coûteuse à maintenir.

**Corollaire d'architecture :** investir dès le départ sur un **modèle de données propre et extensible**,
pour ajouter facilement les évolutions futures (§12) **sans remettre en cause les fondations** — mais **ne
pas développer** ces évolutions maintenant. Chaque écran (carte, fiche, recherche, dashboard) est cadré par
cette contrainte : un parcours évident, pas de fonctionnalité « parce qu'on peut ».

## 11. Conventions de code (toutes les implémentations)

- TypeScript strict ; Server Components par défaut, Client Components seulement si nécessaire.
- **Aucun secret en clair** (Stripe, DB, Resend…) → variables d'environnement uniquement.
- Validation des entrées (Zod) côté serveur ; jamais confiance au client (statut payant, rôle, propriété).
- **Autorisation stricte** : un réseauteur n'agit que sur **son** profil ; un organisateur uniquement sur
  **son** réseau et **ses** événements ; l'admin sur tout.
- **RGPD** : consentement, export, suppression, purge, audit, opt-out d'indexation respectés de bout en bout.
- Accessibilité (a11y) : contrastes, labels, navigation clavier, focus visibles.
- Tests sur la logique métier (rôles & propriété, monétisation mixte, géo-filtrage des deux cartes, badges,
  recherche par filtres, slugs/SEO). ⚠️ Les **specs existantes valident PanoramaPub** et sont en partie
  caduques — à re-spécifier sur le modèle 3 entités.
- Mobile-first sur les cartes (plein écran + bottom-sheet, pas une carte rétrécie au-dessus d'une liste).
- Commits atomiques, messages clairs ; ne jamais committer `.env`.

## 12. Périmètre V1 / V2+ (ne pas déborder — simplicité)

- **Dans la V1 :** les **3 entités** (réseauteurs, événements, réseaux) + leurs fiches publiques SSR ; les
  **2 cartes** (réseauteurs + événements) ; **recherche simple par filtres** ; comptes + **4 rôles**
  (réseauteur / organisateur / partenaire / admin) ; **badges** déclaratifs ; **monétisation mixte Stripe**
  (réseauteur **Plus** 39 € HT/an + réseau partenaire par paliers `fiche`/`starter`/`growth`/`enterprise`
  + partenaire annonceur), **gérée en libre-service via le hub `/dashboard/abonnement`** (ADR-0016) ;
  **page Partenaires** ; validation des inscriptions + modération ; SEO `Person`/`Event`/`Organization`
  + RGPD proportionné ; responsive (desktop / tablette / mobile).
- **Évolution monétisation (2026-07-12, livrée — voir §4) :** palier **Réseauteur Plus** (abonnement
  débloquant la **création d'événements**). Cela **remplace** l'invariant « pas de palier payant
  réseauteur » ; la création d'événements est ouverte aux **réseauteurs Plus** (en plus des
  organisateurs). *(Le rôle `partenaire`, l'espace partenaire, la fiche perso et les offres réservées
  aux réseauteurs sont **déjà livrés**. Les packs de licences + codes promo de la décision 2026-07-12
  ont été livrés puis **SUPPRIMÉS le 2026-07-17 — ADR-0015**.)*
- **Conçu dès le départ dans le modèle de données, mais NON développé en V1 (évolutions futures) :**
  application mobile · messagerie entre réseauteurs · agenda personnel · import automatique d'événements
  (CSV / iCal / API) · check-in aux événements · badge vérifié · statistiques · association RÉSEAUTEURS ·
  congrès annuel · matching entre membres · IA.
- **Retiré (caduc) :** modèle Réseau→Occurrences, quota d'occurrences, 3 paliers 90/130/190 €, freemium
  membre 39 €, objet publicitaire `fournisseurs`/`revendeurs`, route/champ
  `participer`/`participantsSignales`, **projection de confidentialité par champ + double geom obligatoire**,
  **moteur de recherche FTS à facettes**.
- **Dormant (ADR-0009 inchangé) :** groupes/affiliation — conservés, masqués.

## 13. Pipeline d'agents et artefacts

Voir `.claude/AGENTS_PIPELINE.md` et `.claude/README.md`. **13 agents** (8 de construction + **4 d'audit
ciblé** : `test-fonctionnel`, `test-securite`, `test-performance`, `test-ux` + **1 de contrôle de santé**
`test-sante`, gate green/red qui exécute la chaîne de vérif du dépôt). **Phases 0→4 livrées** — la
V1 3-entités est construite ; le pipeline sert désormais à **faire évoluer et vérifier** l'existant.
Ordre et livrables :

1. `codebase-auditor` → **`AUDIT.md`** + **`AUDIT-DELTA-RESEAUTEURS.md`** *(lecture seule ; delta + amendement
   3-entités déjà produits ; verdict `REFACTOR_IN_PLACE`)*.
2. `solution-architect` → **`ARCHITECTURE.md`** (modèle 3 entités), **ADR** (0011 acté ; statuts amendés),
   **`PLAN.md`** reséquencé. *(Réalignés dans la passe docs du 2026-06-28 ; à valider/affiner.)*
3. `data-architect` → collections **`reseauteurs`**, **`evenements`** (simplifié), **`reseaux`** (entité +
   taxonomie), **`partenaires`**, champ **badge**, relation M2M ; **RGPD** repointé ; recalibrage `users.role`
   (**4 rôles** : réseauteur/organisateur/partenaire/admin) ; index de recherche simple ; **`MIGRATION.md`**.
4. Implémentation parallélisable (cf. `PLAN.md`) : `frontend-builder` (home + 3 fiches + recherche par
   filtres + dashboards) · `map-engineer` (**2 cartes** réseauteurs/événements) ·
   `accounts-and-billing` (**4 rôles** + monétisation mixte Stripe : Plus + réseau par paliers + annonceur,
   hub `/dashboard/abonnement`) · `seo-engineer` (`Person`/`Event`/`Organization` + opt-out indexation).
5. `qa-reviewer` → **`docs/qa/REVIEW-<date>.md`** (gate qualité avant merge) ; **audits ciblés** :
   `test-fonctionnel` (parcours de bout en bout), `test-securite` (autorisation/RGPD/Stripe serveur),
   `test-performance` (N+1, ISR, index), `test-ux` (a11y + < 30 s) → `docs/qa/TEST-*.md`.

**Règle d'or :** aucune implémentation (phase 3) ne démarre avant que **`ARCHITECTURE.md` + le schéma soient
validés** (humain dans la boucle entre les phases). La **simplicité** est un critère de revue à chaque gate.
