# ADR-0012 — Hiérarchie réseaux national ↔ local, abonnement porté par le national, réseaux locaux délégables, pages à bascules

- **Statut :** Accepté (décisions de monétisation et de délégation **tranchées par l'humain** le 2026-06-30)
- **Date :** 2026-06-30
- **Décideurs :** Humain (product owner) + analyse Claude (`solution-architect`)
- **Portée :** modèle de domaine (`reseaux`), scope de l'affiliation réseauteur, monétisation B2B, comptes & rôles, gate de publication d'événements, cartes, recherche/filtres, pages d'exploration (UI), migration
- **Amende l'ADR-0011 sur quatre points :** (1) `reseaux` devient **hiérarchique** (national ↔ local) ; (2) l'affiliation réseauteur est **restreinte aux réseaux locaux** ; (3) la monétisation est **déplacée sur le réseau national** (abonnement) et l'**événement Premium ponctuel est supprimé** ; (4) deux **pages à bascules** remplacent les index/cartes séparés.
- **Réaffirme (ADR-0011, inchangé) :** réseauteurs **gratuits** ; trois entités reliées ; SSR/ISR des trois fiches ; SEO `Person`/`Event`/`Organization` ; géoloc **ville/centroïde** des réseauteurs ; RGPD proportionné + opt-out d'indexation ; **simplicité d'abord (< 30 s)** ; stack inchangée (Next.js + Payload + Postgres/PostGIS + MapLibre + Stripe + Resend + Vercel) ; **refactor in place** par migrations.
- **Réaffirme aussi :** ADR-0001 (accès Payload), ADR-0002 (PostGIS), ADR-0005 (URLs au singulier — fiches **inchangées**), ADR-0006 (MapLibre — étendu d'une vue carte « réseaux locaux »).
- **Confirme un choix de l'ADR-0003 :** **une seule collection `reseaux`** (l'alternative « deux collections national/local » reste écartée) — la hiérarchie est portée par une **self-relationship**, pas par une seconde table.
- **Remobilise l'angle « fédération » de l'ADR-0009 :** le couple national↔local **réalise** le scénario produit anticipé en ADR-0009 §Réversibilité (une tête de réseau qui pilote/finance ses sections locales) — mais via une **Subscription Stripe portée par le national**, **pas** la machinerie de coupons de groupe, qui **reste dormante**.

> **Cette ADR est structurante.** Elle ne rouvre pas l'ADR-0011 : elle l'**affine** pour coller à l'organisation réelle des réseaux d'affaires français, qui sont presque tous **fédérés** (une marque nationale — BNI, DCF, CJD… — et des **chapitres/sections locaux**). Le modèle plat de l'ADR-0011 ne sait pas représenter cette réalité, ni placer l'abonnement au bon endroit (la tête de réseau paie, les sections bénéficient). `ARCHITECTURE.md` et `PLAN.md` sont réalignés en conséquence.

---

## Contexte

Le brief produit du 2026-06-30 confirme la fondation à trois entités (ADR-0011) mais la fait évoluer sur quatre axes, en partant d'un constat de terrain : **les réseaux d'affaires sont fédérés**. BNI, DCF, CJD, Réseau Entreprendre… sont des **marques nationales** déclinées en **dizaines à centaines de chapitres locaux**. L'ADR-0011 modélise `reseaux` comme une entité **plate** : impossible d'exprimer « le chapitre BNI de Clermont-Ferrand appartient à BNI », ni de décider qui paie (la tête nationale) pour le compte de qui (ses sections).

Quatre conséquences en découlent :

1. **Hiérarchie.** Il faut deux niveaux : un **réseau national** (la marque, possédée par un compte « membre réseau national ») et des **réseaux locaux** (les chapitres) rattachés à un national.
2. **Affiliation au bon grain.** Un réseauteur fréquente un **chapitre local** précis (« BNI Clermont »), pas la marque abstraite. L'affiliation (`reseauxFrequentes`) doit donc cibler les **locaux** ; le national se **déduit** (parent du/des locaux).
3. **Monétisation au bon endroit.** C'est la **tête nationale** qui a le budget et l'intérêt à payer pour la visibilité de tout son maillage. L'abonnement se pose donc sur le **national** et débloque l'umbrella (créer des locaux + publier des événements pour le national et ses locaux). En contrepartie, l'**événement Premium ponctuel** de l'ADR-0011 (Checkout one-shot par événement) **disparaît** : il complexifiait la carte (marqueur distinct), le billing (un 3ᵉ produit transactionnel) et le modèle mental, pour une valeur marginale une fois l'abonnement national en place.
4. **Délégation.** Une tête nationale ne gère pas elle-même 200 chapitres : elle doit pouvoir **déléguer** la gestion d'un local à un **compte organisateur local distinct** (login propre, périmètre limité à son local et à ses événements), tout en gardant la main si besoin.

Enfin, l'expérience d'exploration est resserrée en **deux pages à bascules** (une pour réseauteurs/réseaux, une pour événements), plus simples qu'une dispersion entre `/reseauteurs`, `/reseaux`, `/carte/reseauteurs`, `/carte/evenements`.

Ces décisions sont prises **sous la contrainte invariante de simplicité (< 30 s)** : la hiérarchie reste à **deux niveaux** (pas d'arbre profond), l'abonnement reste **un seul produit** côté réseau (le national), et le modèle de comptes **n'ajoute pas de quatrième rôle**.

---

## Décision

### 1. Hiérarchie `reseaux` — une collection, deux niveaux

`reseaux` **reste une collection unique** (réaffirme ADR-0003 : pas de seconde table). On lui ajoute deux champs :

- **`niveau`** — enum `{ national, local }`.
- **`parent`** — **self-relationship N-1** vers `reseaux`. **Requis si `niveau = local`**, **null si `niveau = national`**.

**Invariants (validés côté serveur, hook de collection) :**

- Un `local` a **exactement un** `parent`, et **ce parent est `niveau = national`** → la hiérarchie est **strictement à deux niveaux** (un national n'a pas de parent ; un local ne peut pas être parent). Pas d'arbre profond (simplicité, extensibilité maîtrisée).
- Le garde-fou existant `beforeDelete` (interdit la suppression d'un réseau si des événements y sont rattachés) est **étendu** : un **national** ne peut pas être supprimé s'il possède des **locaux** (détacher/réaffecter d'abord).
- Le `slug`, le `geom`, le `seoField`, les compteurs et le pipeline de géocodage **sont réutilisés tels quels** (c'est l'argument décisif pour une seule collection : zéro duplication d'échafaudage).

**Géo (acté).** Un national n'a **pas de point unique** sur le territoire. Donc :
- sur la **carte des réseaux**, les **marqueurs = réseaux locaux** (géolocalisés au **centroïde ville**, même pipeline que les réseauteurs) ;
- les **nationaux** n'apparaissent **pas** comme marqueurs : ils figurent en **annuaire/logos** et servent de **filtre** (« afficher les chapitres de BNI »).

**Compteurs.** Un **local** porte ses propres `nbReseauteurs` / `nbEvenements` (déjà en place, recalculés par hooks). Un **national** affiche l'**agrégat de ses locaux** (somme), calculé **à l'affichage SSR** (pas de nouveau hook d'agrégation à maintenir — simplicité ; le coût est une requête `count`/`sum` bornée par fiche national).

### 2. Affiliation réseauteur — réseaux **locaux** uniquement

Le réseauteur conserve **uniquement** une fiche profil (ni événements ni réseau possédé). Son champ `reseauxFrequentes` (M2M) **continue de cibler la collection `reseaux`** (pas de nouvelle collection), mais une **validation serveur refuse tout réseau `niveau = national`** : on ne s'affilie qu'à des **chapitres locaux**.

- Le **réseau national d'un réseauteur est dérivé** : c'est l'ensemble des `parent` distincts de ses locaux fréquentés. Affiché sur la fiche et exploitable en filtre (« réseauteurs de la marque BNI » = réseauteurs affiliés à un local dont le parent est BNI), **sans champ stocké** (dérivation à la lecture).
- Les compteurs `reseaux.nbReseauteurs` restent posés sur les **locaux** (hook existant `updateReseauxCompteurs`, inchangé) ; le national agrège (cf. §1).

### 3. Monétisation B2B — recalibrée (décisions verrouillées)

| Produit | Type | Posé sur | Débloque |
|---|---|---|---|
| **Abonnement réseau national** | **Subscription** annuelle (Stripe), **par paliers** | le réseau **`niveau = national`** | **création de réseaux locaux** (capacité bornée par le palier) + **droit de publier des événements** (par le national **et** par ses locaux) + fiche enrichie + logo accueil + badge partenaire |
| **Partenaire (annonceur)** | **Subscription** | collection `partenaires` (**inchangée**) | logo page d'accueil + page Partenaires + lien |

- **Abonnement par paliers (ratifié 2026-06-30).** Le produit national est **décliné en paliers tarifaires selon la taille**, indexée sur le **nombre de réseaux locaux**. Le palier (source de vérité = **price/produit Stripe** posé par webhook, jamais déduit du client) **borne la capacité de création de locaux** : `peutCreerLocal(user)` vérifie `national.partenaire` **ET** `nbLocaux < maxLocaux(palier)` (refus serveur FR au dépassement, invitant à monter de palier). Les **seuils et prix concrets** sont une **config métier** (admin-configurable) — hors périmètre du schéma, à fournir avant `accounts-and-billing`. Le schéma stocke le palier effectif (ou le `stripePriceId`) sur le national.
- **Suppression de l'événement Premium ponctuel.** On **retire** `evenements.premium`, `evenements.stripeCheckoutSessionId`, le **Checkout one-shot** Premium et le **marqueur Premium distinct** sur la carte. **Plus aucun tier payant par événement.** (Supersède l'ADR-0011 §3, ligne « Événement Premium ».)
- **L'annonceur est conservé tel quel** (collection `partenaires`, Subscription, statut posé par webhook).
- **Le drapeau `partenaire`** (+ `stripeSubscriptionId`, `partenaireExpireAt`) n'est désormais **significatif que sur les réseaux `niveau = national`**. Sur un local, ces champs sont **inertes** (jamais écrits par les webhooks, jamais lus par le gate). Ils restent dans la collection unique (pas de drop) mais ne portent de sens qu'au niveau national.

**Invariant ADR-0011 réaffirmé :** le statut payant est **source de vérité serveur** (posé par les **webhooks Stripe idempotents signés**), **jamais déduit du client**. La plomberie Stripe (Subscription, Customer Portal, webhooks, factures PDF, crons d'expiration) est **conservée** ; on **retire** la branche Checkout one-shot Premium.

### 4. Gate de publication d'événement — abonnement **effectif** du national

La publication d'un événement par un organisateur est autorisée si l'**abonnement effectif** du réseau organisateur est actif. Calcul **centralisé** dans un helper serveur :

```
nationalDe(reseau)        = reseau.niveau === 'national' ? reseau : reseau.parent   // parent est national
abonnementActif(reseau)   = nationalDe(reseau)?.partenaire === true                  // statut serveur (webhook Stripe)

peutPublierEvenement(reseau) = abonnementActif(reseau)
peutCreerLocal(user)         = ∃ national possédé par user tel que
                                 national.partenaire === true ET nbLocaux(national) < maxLocaux(national.palier)
```

- Un **national abonné** publie des événements (sur lui-même ou sur ses locaux) et **crée des locaux**.
- Un **local** (qu'il soit géré par le national ou par un délégué) publie des événements **ssi son parent national est abonné**.
- Un **national non abonné** : fiche nationale gratuite visible, **mais** ni création de locaux ni publication d'événements (refus serveur, message FR).
- L'**admin** publie/crée sans gate (amorçage, import, support).

Ce helper **remplace** le test direct `if (!reseau.partenaire) throw` de l'ADR-0011 (qui ne regardait que le réseau lui-même).

### 5. Comptes & rôles — pas de quatrième rôle (Option A)

On **conserve les trois rôles** `reseauteur / organisateur / admin` (réaffirme ADR-0011 §2). On **ne crée pas** de rôle `reseau_national` dédié : le statut national vs délégué est **dérivé du `niveau` du réseau possédé**, ce qui évite une migration d'enum et une dimension de complexité supplémentaire.

- **Membre réseau national** = un `organisateur` qui **possède un réseau `niveau = national`** (`reseau.user`). Pouvoirs spéciaux : **créer/gérer ses locaux**, **déléguer** un local, **souscrire** l'abonnement.
- **Organisateur local délégué** = un `organisateur` qui **possède un ou des réseaux `niveau = local`** mais **aucun national**. Périmètre strict : **son/ses local(aux) + leurs événements**.
- **Réseauteur** = inchangé (profil gratuit).
- **Admin** = tout.

**Propriété (`reseaux.user`) et garde « 1 user = 1 réseau » révisés :**

- Le garde-fou « 1 user = 1 réseau » de l'ADR-0011/0003 devient **« 1 user = au plus 1 réseau national »** → **index partiel unique** `(user) WHERE niveau = 'national'`. (On **relâche** l'unicité actuelle `WHERE user IS NOT NULL`.)
- Un **national possède N locaux** : `local.user` peut pointer vers le compte national (local **auto-géré**) — donc un national apparaît comme `user` sur son national **et** sur ses locaux auto-gérés. **Pas d'unicité** sur `local.user`.
- Un **délégué possède exactement son/ses local(aux)** : `local.user` pointe vers le compte délégué.

**Ownership (helper serveur) :**

```
peutGererReseau(user, reseau) =
   user.role === 'admin'                                            // admin : tout
   || reseau.user === user.id                                       // propriétaire direct (national ou local)
   || (reseau.niveau === 'local' && reseau.parent.user === user.id) // umbrella : le national gère ses locaux
peutGererEvenement(user, evenement) = peutGererReseau(user, evenement.reseau)
```

> Le **délégué** est restreint à **son** local (première ligne du `||` qui le concerne : `reseau.user === user.id`). Le **national** n'est pas restreint à l'intérieur de son umbrella (3ᵉ ligne) : il reste le propriétaire de la marque, la délégation est une **commodité** (et une **réassignation** de `local.user`), pas une barrière contre la tête de réseau.

### 6. Réseaux locaux **délégables** (décision verrouillée)

- Le national **crée** la fiche du local (`niveau = local`, `parent = son national`, `user = son compte` par défaut → local **auto-géré**).
- Le national peut **déléguer** ce local à un **compte organisateur distinct** : la délégation **réassigne `local.user`** au compte délégué (login propre). Le délégué gère alors **uniquement** ce local et ses événements ; il **ne peut ni créer de locaux ni souscrire** (il ne possède pas de national).
- Le national peut **révoquer** la délégation (réassigner `local.user`) et **gérer ses locaux lui-même**.
- **Mécanisme de délégation (RATIFIÉ 2026-06-30) : assignation par l'admin.** La délégation se fait **uniquement** par un **admin** RÉSEAUTEURS qui réassigne `local.user` au compte organisateur cible (back-office Payload, ou action admin dédiée). **Pas de flow d'invitation self-serve par email en V1** (écarté au gate — plus simple à livrer). Le compte délégué doit exister comme `organisateur` **sans national** : on réutilise le **pattern claim-flow** (`req.context`) pour qu'un tel compte ne déclenche **pas** l'auto-création d'un national. L'invitation email self-serve reste une **évolution future** (le modèle de données ne s'y oppose pas).

### 7. Deux pages à bascules — exploration resserrée

Les fiches **singulières SSR/ISR `/reseauteur/[slug]`, `/reseau/[slug]`, `/evenement/[slug]` sont INCHANGÉES** (capital SEO, ADR-0005 ; sitemap et maillage inchangés). L'évolution porte **uniquement** sur les surfaces d'**exploration** :

- **Page « Réseauteurs et réseaux »** : une **bascule d'entité** (réseauteurs ↔ réseaux) **et** une **bascule de vue** (carte ↔ annuaire/liste). Les **filtres** s'appliquent aux deux entités et aux deux vues. États **deep-linkables**.
- **Page « Événements »** (`/evenements`) : une **bascule de vue** (carte des événements à venir ↔ grille agenda). Filtres dans les deux vues.

**Schéma d'URL (RATIFIÉ 2026-06-30 — deux landing pages) :**

- `/reseauteurs` → page combinée, **entité présélectionnée = réseauteurs**, bascule de vue `?vue=carte|annuaire` (défaut annuaire), filtres en query. **Self-canonical.**
- `/reseaux` → **même composant** de page combinée, **entité présélectionnée = réseaux**, mêmes bascules/filtres. **Self-canonical.**
  → La **bascule d'entité** est une **vraie navigation** entre `/reseauteurs` et `/reseaux` (deux landing pages riches en mots-clés, crawlables, chacune avec ses métadonnées) ; la **vue** et les **filtres** sont de l'**état en query** (canonical épuré des paramètres volatils).
- `/carte/reseauteurs` → **301** vers `/reseauteurs?vue=carte`.
- `/carte/evenements` → **301** vers `/evenements?vue=carte`.
- `/evenements` → page événements, bascule `?vue=carte|agenda` (défaut agenda/grille), filtres en query.

> Ce schéma **fusionne les `/carte/*` autonomes** dans les bascules (301) tout en **préservant deux landing pages SEO** (`/reseauteurs`, `/reseaux`) et **toutes les fiches**. L'alternative (une seule URL combinée + 301 collapse de `/reseaux`) a été **écartée au gate humain du 2026-06-30** (deux landing pages retenues pour le capital mots-clés).

---

## Ce que cette ADR change par rapport à l'ADR-0011

| Sujet | ADR-0011 | ADR-0012 (en vigueur) |
|---|---|---|
| Entité `reseaux` | **plate** | **hiérarchique** : `niveau` {national, local} + `parent` (self-N-1), 2 niveaux max |
| Affiliation réseauteur | M2M vers `reseaux` (tout réseau) | M2M **restreint aux locaux** ; national **dérivé** (parent) |
| Abonnement réseau | « réseau partenaire » (chaque réseau) | **réseau national uniquement** ; débloque locaux + publication (umbrella) |
| Événement Premium | **Checkout one-shot** + marqueur distinct | **supprimé** (champ `premium`, `stripeCheckoutSessionId`, marqueur) |
| Annonceur | conservé | **conservé (inchangé)** |
| Gate publication événement | `reseau.partenaire` (le réseau lui-même) | **`nationalDe(reseau).partenaire`** (helper centralisé) |
| Rôles | `reseauteur/organisateur/admin` | **inchangés** ; national vs délégué **dérivé du `niveau`** possédé |
| « 1 user = 1 réseau » | unique `WHERE user IS NOT NULL` | **« 1 user = au plus 1 national »** (unique partiel `WHERE niveau='national'`) ; national possède N locaux ; délégué possède son/ses local(aux) |
| Gestion des locaux | — | national crée ses locaux ; **délégables** à un organisateur local distinct (réassignation `local.user`) |
| Carte des réseaux | (réseaux non cartographiés en V1) | **marqueurs = locaux** ; nationaux en annuaire/logos + filtre |
| Exploration | `/reseauteurs`, `/reseaux`, `/carte/*` séparés | **2 pages à bascules** (entité+vue / vue) ; `/carte/*` → 301 |
| Fiches SSR + SEO + RGPD + géoloc ville + gratuité réseauteurs + stack | — | **inchangés (réaffirmés)** |

---

## Conséquences

**Positives**

- **Fidélité au terrain** : le modèle représente enfin la réalité fédérée des réseaux d'affaires (marque + chapitres), ce qui crédibilise la prospection B2B (on parle à la tête nationale).
- **Monétisation alignée sur le payeur** : un seul abonnement (le national) finance la visibilité de tout le maillage → message commercial simple, billing simplifié (suppression d'un 3ᵉ produit transactionnel Premium).
- **Simplicité préservée** : aucune nouvelle collection, aucun nouveau rôle, hiérarchie bornée à 2 niveaux, un seul helper d'autorisation/gate à maintenir. La **carte se simplifie** (un type de marqueur événement, plus de variante Premium).
- **Réutilisation maximale** : `reseaux` garde son échafaudage (slug, geom, seoField, compteurs, géocodage, claim-flow) ; le claim-flow existant se réemploie pour la **délégation**. L'angle « fédération » documenté en ADR-0009 se concrétise.

**Négatives / vigilances**

- **Migration `reseaux`** : ajout `niveau`/`parent`, relâchement de l'unicité `user` → **unique partiel `WHERE niveau='national'`**, et **choix du niveau par défaut des lignes existantes** (proposé : `national`) — avec impact sur les **affiliations existantes** (qui, devenant des nationaux, violeraient la règle « locaux uniquement »). Risque réel **seulement si** des affiliations de production existent (la collection `reseauteurs` est neuve → impact attendu faible). Gate humain + dry-run.
- **Drop destructif `evenements.premium` / `stripeCheckoutSessionId`** : la suppression de colonnes est irréversible ; à dry-runner. Risque faible (fonctionnalité non lancée), mais le `down()` doit être documenté.
- **Code Premium à retirer proprement** (route Checkout one-shot, marqueur carte, UI « mettre en avant », libellés) — démontage **mécanique** mais à ne pas laisser en zombie (checklist QA).
- **Auto-création au signup** : un nouvel `organisateur` auto-signé crée désormais un réseau **`niveau = national`** (et non un réseau plat) ; les **délégués** ne passent **pas** par l'auto-création (flow d'invitation). Comportement à ajuster côté `data-architect`/`accounts-and-billing`.
- **Surface SEO d'exploration** : la bascule entité = navigation entre `/reseauteurs` et `/reseaux` ; veiller aux **canonical** (état carte/filtres non canonicalisé) pour éviter le duplicate content. La carte « réseaux locaux » ajoute une 3ᵉ source géo (même infra MapLibre/PostGIS).

---

## Alternatives écartées

1. **Deux collections séparées `reseaux_nationaux` / `reseaux_locaux`.** Écartée : recrée la dualité que l'ADR-0003 avait éliminée (double échafaudage slug/geom/SEO/compteurs, double route géo, double sitemap). La self-relationship sur une collection unique couvre le besoin à coût quasi nul.
2. **Rôle dédié `reseau_national` (Option B).** Écartée au profit de l'Option A (dériver national vs délégué du `niveau` possédé) : un 4ᵉ rôle imposerait une migration d'enum, dédoublerait les chemins d'autorisation et alourdirait le modèle mental — contraire à « simplicité d'abord ». Le `niveau` du réseau possédé est une source de vérité suffisante.
3. **Conserver l'événement Premium ponctuel en plus de l'abonnement national.** Écartée (décision humaine) : redondant une fois l'umbrella national en place ; coûteux en complexité (marqueur carte distinct, 3ᵉ produit Stripe transactionnel, gate par événement) pour une valeur marginale.
4. **Hiérarchie à profondeur libre (national → régional → local…).** Écartée : aucun besoin V1, complexité d'agrégation et de validation non bornée. Deux niveaux suffisent ; le schéma `parent` reste extensible si un jour un niveau intermédiaire s'impose.
5. **Affiliation au national (marque) plutôt qu'au local.** Écartée : un réseauteur fréquente un **chapitre** précis ; affilier à la marque perdrait l'information de proximité (la valeur de la carte) et empêcherait de compter correctement les membres par section.
6. **Réactiver la machinerie de groupes/coupons (ADR-0009) pour financer les locaux.** Écartée : l'abonnement Stripe direct sur le national est plus simple et plus lisible commercialement ; les groupes **restent dormants** (ADR-0009 inchangé).

---

## Gate humain — TRANCHÉ le 2026-06-30

Les huit questions ouvertes ont été **tranchées par l'humain (product owner)**. Détail dans `PLAN.md §Partie C` (autorité). Synthèse des décisions :

| # | Question | **Décision** |
|---|---|---|
| Q1 | Rôle dédié vs niveau dérivé | **Niveau dérivé** (pas de 4ᵉ rôle) — *défaut confirmé* |
| Q2 | Mécanisme de délégation | **Assignation par l'admin** (pas d'invitation email self-serve en V1) — *change le défaut* |
| Q3 | Sort des routes index `/reseauteurs` `/reseaux` | **Deux landing self-canonical** — *défaut confirmé* |
| Q4 | Niveau par défaut des `reseaux` existants | **`national`** + remap/purge des affiliations — *défaut confirmé* |
| Q5 | Abonnement national : prix unique ou paliers | **Paliers selon la taille** (nombre de locaux) — *change le défaut* |
| Q6 | Champs `partenaire`/`stripeSubscriptionId` sur locaux importés | **Inertes sur les locaux** (significatifs au national uniquement) — *défaut confirmé* |
| Q7 | Agrégation des compteurs nationaux | **À l'affichage SSR** (pas de hook) — *défaut confirmé* |
| Q8 | Droit du national sur les événements d'un local délégué | **Umbrella** (le national garde la main) — *défaut confirmé* |

> Conséquences des deux changements de défaut : **Q2** simplifie E1.5/E2.A (pas de flow d'invitation — réassignation admin de `local.user`) ; **Q5** ajoute à E2.A une **logique de paliers** (produits/prix Stripe multiples, `maxLocaux(palier)`, gate de capacité sur `peutCreerLocal`) et au schéma E1 un **champ palier** (ou `stripePriceId`) sur le national. Aucun invariant verrouillé n'est altéré.
