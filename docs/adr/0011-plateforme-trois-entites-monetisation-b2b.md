# ADR-0011 — Plateforme à trois entités (réseauteurs · événements · réseaux), monétisation B2B, comptes organisateurs — la simplicité d'abord

> **♻️ Amendée sur quatre points par [ADR-0012](0012-hierarchie-reseaux-national-local-abonnement-national.md) (2026-06-30).**
> La fondation à **trois entités reliées** reste **en vigueur**. L'ADR-0012 **affine** (ne rouvre pas) :
> (1) `reseaux` devient **hiérarchique** (`niveau` national/local + `parent` self-relationship, 2 niveaux) ;
> (2) l'affiliation réseauteur (`reseauxFrequentes`) est **restreinte aux réseaux locaux** (le national est
> dérivé) ; (3) la **monétisation est déplacée sur le réseau national** (abonnement umbrella : crée les
> locaux + débloque la publication d'événements), l'**annonceur est conservé**, et l'**événement Premium
> ponctuel est SUPPRIMÉ** ; (4) deux **pages à bascules** remplacent les index/cartes séparés. Tous les
> autres invariants ci-dessous (réseauteurs gratuits, SSR/ISR, SEO `Person`/`Event`/`Organization`, géoloc
> ville, RGPD proportionné, simplicité, stack, refactor in place) sont **réaffirmés**. **En cas de conflit,
> l'ADR-0012 prévaut** sur les §1 (modèle `reseaux`), §2 (garde « 1 user = 1 réseau »), §3 (produits Stripe :
> Premium retiré), §4 (cartes : marqueur Premium retiré). Détail : `ARCHITECTURE.md` (encart d'amendement).

- **Statut :** Accepté — **amendé sur 4 points par ADR-0012**
- **Date :** 2026-06-28
- **Décideurs :** Humain (product owner) + analyse Claude
- **Portée :** modèle de domaine, périmètre V1, comptes & rôles, monétisation, marque, principe directeur
- **Réaffirme :** ADR-0001 (accès Payload), ADR-0002 (PostGIS), ADR-0006 (MapLibre), ADR-0009 (groupes dormants)
- **Amende :** ADR-0005 (URLs — ajoute `/reseauteur`, `/evenement`, `/reseau`), ADR-0007 (marque — **RÉSEAUTEURS** confirmée)
- **Supersède / corrige :** **ADR-0010** sur trois points (voir §10) — réintroduit les **événements** et les **réseaux comme entités** en V1, **bascule la monétisation du membre vers le B2B**, et **abandonne** les deux piliers lourds (projection de confidentialité par champ + moteur de recherche FTS à facettes) au nom de la simplicité.
- **Remobilise l'esprit de :** ADR-0003 (réseau = entité possédée — mais seulement par un compte **organisateur**), ADR-0004 (événements — **sans quota**, mise en avant payante à la place), ADR-0008 (récurrence — hors V1).
- **Amendée par :** **ADR-0012** (hiérarchie réseaux national↔local, abonnement national, locaux délégables, suppression Premium événement, pages à bascules).

> **Cette ADR est structurante.** Elle redéfinit le produit une dernière fois avant implémentation : non plus un annuaire mono-entité (ADR-0010), mais **la plateforme nationale du networking** reposant sur **trois bases de données reliées** — les **réseauteurs**, les **événements**, les **réseaux**. `ARCHITECTURE.md` et `PLAN.md` sont réalignés en conséquence.

---

## Contexte

Le brief produit du 2026-06-28 redéfinit RÉSEAUTEURS comme **« la plateforme nationale du networking »** : non pas un réseau d'affaires de plus, mais **le point central qui rassemble tous les réseaux existants** (BNI, DCF, CJD, Dynabuy, Cafés Business, Rotary, Lions, Réseau Entreprendre, CPME, Medef…). Le principe fondateur de l'ADR-0010 est **conservé et renforcé** : *« Le site ne remplace aucun réseau. Il les rassemble. »*

L'ADR-0010 (bascule annuaire de professionnels, 2026-06-27) avait **réduit le produit à une seule entité** (le profil membre), **retiré les événements** et **fait des réseaux de simples tags**, avec une monétisation freemium côté membre (39 €/an) et deux piliers techniques lourds (projection de confidentialité par champ + recherche FTS à facettes).

Le nouveau brief **élargit** le périmètre tout en **simplifiant l'exécution** :

- Le produit repose sur **trois entités reliées**, pas une : **réseauteurs**, **événements**, **réseaux**.
- Les **événements business reviennent en V1** (chaque événement a une fiche et apparaît sur **une seconde carte**), rattachés à un **réseau organisateur**, avec un **lien d'inscription externe** (RÉSEAUTEURS n'organise pas, il référence).
- Les **réseaux redeviennent des entités** avec leur **fiche** (logo, description, présentation, lien, nombre de réseauteurs, nombre d'événements), et restent **aussi** une taxonomie que les réseauteurs cochent (relation many-to-many).
- **Les réseauteurs sont et restent gratuits.** La monétisation est **B2B et dès la V1** : **réseau partenaire** (abonnement annuel), **événement Premium** (mise en avant payante), **partenaire annonceur** (logo + page partenaires).
- Un **troisième type de compte** apparaît : l'**organisateur** (un réseau qui gère sa fiche et ses événements).
- Un **badge réseauteur** déclaratif (Bronze / Argent / Gold / Platinum) valorise l'activité.
- **La priorité absolue est la simplicité.** Le site doit être compris en **moins de 30 secondes**. Une V1 resserrée, parfaitement exécutée, rapide et évolutive, prime sur une V1 ambitieuse, complexe ou coûteuse à maintenir.
- L'**architecture de données doit être pensée dès le départ pour les évolutions** (app mobile, messagerie, agenda personnel, import CSV/iCal/API, check-in, badge vérifié, statistiques, association, congrès, matching, IA) — **conçues, pas développées maintenant**.

## Décision

### 1. Modèle de domaine — trois entités reliées

> **♻️ Amendé par ADR-0012 :** `reseaux` devient **hiérarchique** (`niveau` ∈ {national, local} + `parent`
> self-relationship, 2 niveaux max). L'affiliation `reseauxFrequentes` est **restreinte aux locaux** ; le
> national d'un réseauteur est **dérivé**. Voir ADR-0012 §1–§2.

Le produit repose sur **trois collections reliées** (détail du schéma laissé à `data-architect`) :

1. **Réseauteur** (`reseauteurs`) — une **personne** qui développe son réseau. Inscription **gratuite**. Champs : photo, nom, prénom, entreprise, fonction, description, téléphone (facultatif), email (facultatif), site, LinkedIn, ville, département, région, secteur d'activité, compétences, **réseaux fréquentés** (relation many-to-many vers `reseaux`, cases à cocher multi), **badge** (déclaratif, voir §5), géolocalisation. Apparaît comme **marqueur sur la carte des réseauteurs**. Fiche publique SSR (`/reseauteur/<prenom-nom>`).
2. **Événement** (`evenements`) — un **événement business daté**. Champs : titre, description, date, heure, adresse, ville, image, **réseau organisateur** (relation), **lien d'inscription externe**, géolocalisation, **drapeau Premium** (mise en avant payante). Apparaît comme **marqueur sur la carte des événements**. Fiche publique SSR (`/evenement/<slug>`). Le bouton « S'inscrire » **redirige vers le site du réseau** — RÉSEAUTEURS n'organise pas et ne gère pas d'inscription en V1. *(♻️ ADR-0012 : le **drapeau Premium est supprimé**.)*
3. **Réseau** (`reseaux`) — un **réseau d'affaires** (BNI, DCF…). Champs : nom, logo, description, présentation, lien internet, **nombre de réseauteurs** (dérivé), **nombre d'événements** (dérivé), drapeau **partenaire** (abonnement actif). Fiche publique SSR (`/reseau/<slug>`). Un réseau est **à la fois** une fiche-entité **et** la valeur de taxonomie cochée par les réseauteurs ; les événements lui sont rattachés. *(♻️ ADR-0012 : `niveau`/`parent` ; `partenaire` significatif au **national**.)*

**Relations :** un réseauteur appartient à plusieurs réseaux (M2M) ; un événement est rattaché à un réseau (N-1) ; un réseau possède des réseauteurs (via M2M) et des événements (1-N).

### 2. Comptes & rôles (trois rôles)

> **♻️ Amendé par ADR-0012 :** les **trois rôles sont conservés** ; « membre réseau national » vs
> « organisateur local délégué » sont **dérivés du `niveau` du réseau possédé** (pas de 4ᵉ rôle). Le garde
> « 1 user = 1 réseau » devient **« 1 user = au plus 1 réseau national »** (+ N locaux ; délégué = son/ses
> local(aux)). Voir ADR-0012 §5–§6.

L'enum `users.role` passe à **trois valeurs** :

- **`reseauteur`** (défaut, gratuit) — crée et gère **son** profil.
- **`organisateur`** — gère **uniquement** la fiche **de son réseau** et **ses événements** (1 compte organisateur ↔ 1 réseau, dans l'esprit « 1 user = 1 réseau » de l'ADR-0003, réversible). C'est le compte d'un **réseau partenaire**.
- **`admin`** — back-office complet : réseauteurs, événements, réseaux, partenaires, abonnements, tarifs, badges, catégories, utilisateurs (création / modification / suppression).

> L'ancienne dichotomie binaire `admin/membre` de l'ADR-0010 est remplacée par `admin/organisateur/reseauteur`.

### 3. Monétisation — B2B, dès la V1 (Stripe)

> **♻️ Amendé par ADR-0012 (verrouillé) :** l'abonnement est **porté par le réseau national** (umbrella :
> crée les locaux + débloque la publication d'événements pour le national et ses locaux) ; l'**annonceur est
> conservé** ; l'**événement Premium ponctuel est SUPPRIMÉ** (champ `premium`, `stripeCheckoutSessionId`,
> Checkout one-shot). Il ne reste **que deux produits** (Subscription nationale + Subscription annonceur).
> Voir ADR-0012 §3–§4.

**Les réseauteurs restent gratuits.** Le revenu vient de trois produits B2B, branchés sur le **compte Stripe existant** (paiement, renouvellement, expiration, gestion des abonnements, factures) :

| Produit | Type | Avantages |
|---|---|---|
| **Réseau partenaire** | Abonnement **annuel** (Stripe Subscription) | Logo sur la page d'accueil · badge partenaire · **fiche réseau enrichie** · **droit de publier des événements** · lien vers le site. |
| **Événement Premium** ⛔ *(supprimé — ADR-0012)* | Paiement **ponctuel** par événement (Stripe Checkout one-shot) | **Marqueur spécifique** (couleur différente) sur la carte · **mise en avant** dans les résultats · **badge Premium**. |
| **Partenaire (annonceur)** | Abonnement (entreprises souhaitant communiquer auprès des réseauteurs) | Logo sur la **page d'accueil** + **page Partenaires** + lien vers leur site. |

La plomberie Stripe (checkout, Customer Portal, webhooks idempotents signés, factures PDF, crons d'expiration/relance) est **conservée** et **recalibrée** sur ces produits. Le modèle « freemium membre 39 €/an » de l'ADR-0010 est **abandonné** : il n'y a **pas de palier payant côté réseauteur**.

### 4. Deux cartes

> **♻️ Amendé par ADR-0012 :** sur la **carte des réseaux**, les marqueurs = **réseaux locaux** (les
> nationaux apparaissent en annuaire/logos + filtre). Le **marqueur Premium distinct** est **retiré** de la
> carte des événements (un seul type de marqueur). Cartes intégrées dans les **deux pages à bascules**.

- **Carte des réseauteurs** — marqueur = une personne.
- **Carte des événements** — marqueur = un événement (les événements Premium ont un marqueur distinct). *(♻️ ADR-0012 : marqueur Premium retiré.)*

Toutes deux en **MapLibre + tuiles OSM** (ADR-0006) au-dessus de **PostGIS** (ADR-0002), avec clustering, recherche ville/département/région et « autour de moi ».

### 5. Badge réseauteur (déclaratif, simple)

Question obligatoire à l'inscription : **« Combien d'événements de networking fréquentez-vous chaque mois ? »**

| Réponse | Badge |
|---|---|
| 0 à 1 | **Bronze** |
| 2 à 5 | **Argent** |
| 6 à 10 | **Gold** |
| Plus de 10 | **Platinum** |

Le badge est **affiché sur le profil** et le marqueur. Le niveau est **purement déclaratif** en V1 (le « badge vérifié » est une évolution future). L'admin gère le référentiel des badges.

### 6. Recherche — simple (abandon du moteur FTS à facettes)

La recherche est **simple**, par **filtres combinables** : pour les réseauteurs (nom, entreprise, ville, département, région, métier, secteur, réseau, badge) ; pour les événements (réseau, ville, date). Implémentation **dans Postgres via Payload** (`find` + colonnes indexées, `pg_trgm` optionnel pour la tolérance de frappe sur les noms). **Pas de moteur FTS à facettes dédié, pas d'agent dédié, pas de moteur externe.** Le pilier « recherche multicritères à facettes » de l'ADR-0010 est **abandonné** au profit de la simplicité. *(♻️ ADR-0012 ajoute les filtres `niveau` et `national`.)*

### 7. Confidentialité & RGPD — proportionnée (abandon de la projection lourde + double geom obligatoire)

Le modèle de l'ADR-0010 (projection de visibilité **par champ** au rendu + **double `geom` exact/approché obligatoire**) était justifié par le gate « Premium déverrouille les coordonnées ». **Ce gate disparaît** : les coordonnées (téléphone, email) sont des **champs facultatifs** que le réseauteur **choisit de renseigner ou non** — c'est *cela*, le contrôle de confidentialité, et c'est suffisant et simple.

Il **reste** des obligations, traitées **proportionnellement** et **sans pilier dédié** :

- **RGPD de base** (personnes physiques) : consentement, export, suppression, purge, audit, opt-out — **plomberie existante conservée**, repointée sur `reseauteurs`. Porté par `data-architect`.
- **Indexation des personnes physiques** : opt-out d'indexation respecté (sitemap + robots + `<meta noindex>`), droit au déréférencement. Porté par `seo-engineer` (le flag `seoField.noindex` existe).
- **Géolocalisation** : par défaut **au niveau ville/commune** (centroïde) pour les réseauteurs — on n'a pas besoin de l'adresse personnelle exacte (l'entité utile est ville/département/région). Cela écarte le risque de reverse-geocoding **sans** machinerie de double `geom`. Précision plus fine possible plus tard si besoin.

Conséquence : les agents `privacy-engineer` et `search-engineer` de l'ADR-0010 sont **retirés** (voir `.claude/README.md`), leurs préoccupations résiduelles repliées dans `data-architect`, `seo-engineer` et `frontend-builder`.

### 8. SEO — riche et multi-types (comme PanoramaPub)

JSON-LD **`Person`** (réseauteurs) + **`Event`** (événements) + **`Organization`** (réseaux). URLs propres au singulier (`/reseauteur/<prenom-nom>`, `/evenement/<slug>`, `/reseau/<slug>`), métadonnées dynamiques, Open Graph, **optimisation IA** (`llms.txt`), `sitemap.xml` dynamique, canonical, maillage interne. Chaque fiche (réseauteur, événement, réseau) est un **actif SEO longue traîne**. *(♻️ ADR-0012 : fiches **inchangées** ; un réseau local référence son national via `parentOrganization` ; deux pages à bascules pour l'exploration.)*

### 9. Stack — inchangée (refactor in place)

Aucun changement de stack : **Next.js (App Router, TS strict) + Payload CMS + PostgreSQL/PostGIS + MapLibre + Stripe + Resend + Vercel + géocodage data.gouv**. Évolution **in place** par migrations. Le verdict **`REFACTOR_IN_PLACE`** tient (et est même **plus favorable** qu'à l'ADR-0010 : événements et réseaux-entités **reviennent**, donc une plus grande part de l'existant PanoramaPub/0623 se **réutilise** au lieu d'être démontée).

### 10. Principe directeur — la simplicité d'abord

> **La priorité absolue est la simplicité. Le site doit être compris en moins de 30 secondes par un nouvel utilisateur.** Une V1 avec peu de fonctionnalités mais parfaitement exécutées, rapide et évolutive, prime sur une V1 trop ambitieuse, complexe ou coûteuse à maintenir.

Corollaire d'architecture : **investir dès le départ sur un modèle de données propre et extensible** pour ajouter facilement les évolutions futures **sans remettre en cause les fondations** — mais **ne pas développer** ces évolutions maintenant.

## Ce que cette ADR change par rapport à l'ADR-0010 (synthèse)

| Sujet | ADR-0010 (caduc sur ces points) | ADR-0011 (en vigueur) |
|---|---|---|
| Entités | **1** (membre) ; réseaux = tags ; **pas d'événements** | **3** (réseauteurs · événements · réseaux-entités reliées) |
| Événements | Hors V1 | **En V1**, seconde carte, rattachés au réseau, inscription externe |
| Réseaux | Taxonomie (tags) | **Entité avec fiche** **+** taxonomie M2M |
| Monétisation | Freemium **membre** 39 €/an | **Réseauteurs gratuits** ; **B2B** : réseau partenaire + événement Premium + annonceur |
| Rôles | `admin` / `membre` | `admin` / **`organisateur`** / `reseauteur` |
| Badges | — | **Bronze / Argent / Gold / Platinum** (déclaratif) |
| Recherche | Pilier FTS à facettes (agent dédié) | **Recherche simple** par filtres (sans agent dédié) |
| Confidentialité | Projection par champ + **double geom obligatoire** (agent dédié) | **Champs facultatifs** + RGPD de base + géoloc ville par défaut (sans agent dédié) |
| Cartes | 1 (membres) | **2** (réseauteurs + événements) |
| Principe | Densité & SEO | **Simplicité d'abord (< 30 s)** |

## Conséquences

**Positives**

- Réutilisation **accrue** de l'existant : `evenements` et `reseaux` (entité), démontés par l'ADR-0010, **reviennent** ; le pattern `syncGeom`, la machinerie SEO multi-types (`Event`/`Organization`) et la carte PanoramaPub se réutilisent largement.
- Monétisation **dès la V1** sans friction d'adoption côté réseauteurs (la gratuité densifie ; le B2B monétise les acteurs qui ont un budget : réseaux et annonceurs).
- Périmètre technique **simplifié** : suppression des deux chantiers les plus lourds (projection de confidentialité, moteur FTS) → 8 agents au lieu de 10, V1 plus rapide à livrer.

**Négatives / vigilances**

- `ARCHITECTURE.md`, `PLAN.md`, l'`AUDIT-DELTA` et `MIGRATION.md` doivent être **réalignés** (chantier réalisé dans cette passe pour les docs ; le schéma/les migrations restent à produire par `data-architect`).
- **Trois entités + trois produits Stripe** = plus de surface fonctionnelle que l'annuaire mono-entité de l'ADR-0010 ; la discipline « simplicité d'abord » doit cadrer chaque écran (carte, fiche, recherche) pour ne pas dériver. *(♻️ ADR-0012 réduit à **deux** produits Stripe.)*
- **RGPD des personnes physiques** : maintenir l'opt-out d'indexation et la géoloc ville par défaut malgré l'allègement du dispositif.
- **Migrations `0623`** (création `reseaux`, fusion, enum) : sous le nouveau modèle, `reseaux` **redevient pertinente** comme entité — leur réexamen est **plus simple** que sous l'ADR-0010, mais le `down()` destructif de `120000` reste un point de vigilance (gate humain, dry-run). Détail : `data-architect` / `MIGRATION.md`.

## Alternatives écartées

1. **Conserver l'annuaire mono-entité de l'ADR-0010.** Écartée : le brief réintroduit explicitement les événements et les réseaux-entités, et déplace la valeur économique vers le B2B.
2. **Monétiser les réseauteurs (freemium 39 €).** Écartée : le brief acte la **gratuité** des réseauteurs (la densité fait la valeur) ; le payant est B2B.
3. **Conserver les piliers confidentialité-par-champ + recherche FTS à facettes.** Écartés : surdimensionnés une fois le gate Premium-coordonnées supprimé et la « recherche simple » demandée — contraires au principe « simplicité d'abord ».
4. **Développer dès la V1 une partie des évolutions futures** (messagerie, agenda personnel, matching, IA…). Écartée : conçues dans le modèle de données, **non développées** en V1 (priorité simplicité).
