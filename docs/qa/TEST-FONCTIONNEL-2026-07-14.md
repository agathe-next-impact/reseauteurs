# TEST FONCTIONNEL — 2026-07-14 — RÉSEAUTEURS (branche master)

> QA fonctionnel de bout en bout. Parcours métier **réellement exercés** via l'API locale Payload
> (scripts `_verify-*.mts` jetables, supprimés après exécution) et via le **serveur HTTP réel**
> (`pnpm dev` local, `.env.local`, base Neon **partagée avec la prod**) pour `/api/auth/register` et
> `/api/cron/expiration-plus`. `SEED_DEV=true` et `EMAILS_DRY_RUN=1` posés dans tous les scripts.
> Toutes les entités créées sont préfixées `qa-*@demo.reseauteurs.fr` / noms `QA*` et **supprimées en
> `try/finally`**. Aucune donnée réelle ni donnée de démo existante n'a été modifiée.
>
> Référentiel lu avant test : `CLAUDE.md` (§2, §3, §4, §11), `docs/adr/0013-reseauteur-plus-licences-partenaires.md`,
> `docs/qa/REVIEW-2026-07-12.md` (dernière revue — gate P4 « GO conditionnel », P1-P3 déjà couverts avant
> les commits `9fe78d8` niveau-4-valeurs, `8eda59e`/`82e610c` fiche événement + recherche, `5e48953` rate-limit).
> Cette campagne **ré-exerce indépendamment** tous les invariants ADR-0013 sur l'état actuel du code, plus
> les parcours ajoutés depuis (hiérarchie réseau 4 niveaux, recherche événements dept/type/gratuit).

---

## 1. Auth & inscription (`/api/auth/register` réel, HTTP local)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 1.1 | `POST /api/auth/register` (role `reseauteur`) crée le compte | `200`, `user.id` retourné, 5 comptes créés | ✅ PASS |
| 1.2 | Rate-limit register actif (5/h/IP) | 6ᵉ et 7ᵉ appel → `429 "Trop de tentatives d'inscription..."` | ✅ PASS |
| 1.3 | Squelette réseauteur auto-créé (`reseauteurs`) | `statut=en_attente`, `prenom=""`, `nom=nomSociete`, `slug=null` | ✅ PASS |
| 1.4 | `POST /api/auth/register` (role `organisateur`) crée compte + squelette réseau **national** | `200` ; réseau auto-créé `niveau=national`, `parent=null`, `statut=publiee`, `partenaire=false` | ✅ PASS |
| 1.5 | `POST /api/auth/register` (role `partenaire`) crée compte + squelette fiche partenaire | `200` ; fiche `statut=expire` (invisible tant que non abonné) | ✅ PASS |
| 1.6 | Email dupliqué refusé | `409 "Un compte avec cet email existe deja."` | ✅ PASS |
| 1.7 | Champ obligatoire manquant (`ville`) refusé | `400 "Champs obligatoires manquants"` | ✅ PASS |
| 1.8 | Mot de passe < 8 caractères refusé | `400 "Le mot de passe doit contenir au moins 8 caracteres."` | ✅ PASS |
| 1.9 | Slug généré depuis **prénom+nom structurés**, jamais `nomSociete`, à la **complétion** du profil | `nomSociete="QA Test 1"` mais slug=`alizee-dutestqa` après saisie prénom=Alizee/nom=Dutestqa | ✅ PASS |
| 1.10 | Auto-publication : `statut` passe à `valide` dès prénom+nom renseignés (pas de modération admin) | `statut=valide` observé après complétion | ✅ PASS |
| 1.11 | Collision de slug (même prénom+nom) → suffixe déterministe `-2` | 2ᵉ profil "Alizee Dutestqa" → slug=`alizee-dutestqa-2` | ✅ PASS |
| 1.12 | Slug **figé** après publication (renommer ne le régénère pas) | Après renommage `nom="NomChangeApresPublication"`, slug reste `alizee-dutestqa` | ✅ PASS |

**Preuve rate-limit (extrait brut)** :
```
attempt 5 → HTTP_STATUS:200 {"message":"Compte cree avec succes."...}
attempt 6 → HTTP_STATUS:429 {"error":"Trop de tentatives d'inscription. Réessayez plus tard."}
attempt 7 → HTTP_STATUS:429 {"error":"Trop de tentatives d'inscription. Réessayez plus tard."}
```

**12/12 PASS.**

---

## 2. Rôles & propriété (refus inter-comptes, admin OK)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 2.1 | Un réseauteur ne peut PAS modifier le profil d'un AUTRE réseauteur | `Forbidden: You are not allowed to perform this action.` | ✅ PASS |
| 2.2 | L'admin PEUT modifier n'importe quel profil réseauteur | Update accepté | ✅ PASS |
| 2.3 | Un organisateur ne peut PAS modifier le réseau d'un AUTRE organisateur | `Forbidden` | ✅ PASS |
| 2.4 | L'admin PEUT modifier n'importe quel réseau | Update accepté | ✅ PASS |
| 2.5 | Un organisateur ne peut PAS modifier/supprimer l'événement d'un AUTRE organisateur | `Forbidden` (update) et `Forbidden` (delete) | ✅ PASS |
| 2.6 | L'admin PEUT modifier l'événement d'un tiers | Update accepté | ✅ PASS |

**6/6 PASS** (fichiers testés : `src/collections/Reseauteurs.ts` access.update L130-134 ; `src/collections/Reseaux.ts` access.update L98-102 ; `src/collections/Evenements.ts` access.update/delete L125-144).

---

## 3. Gate Réseauteur Plus (création d'événement)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 3.1 | Réseauteur SANS Plus refusé à la création d'événement en son nom | `"La création d'événements est réservée aux réseauteurs Plus..."` | ✅ PASS |
| 3.2 | Réseauteur ne peut pas organiser au nom d'un AUTRE réseauteur (usurpation) | `"Vous ne pouvez organiser un événement qu'en votre propre nom."` | ✅ PASS |
| 3.3 | Réseauteur Plus **par abonnement** crée un événement | Création acceptée | ✅ PASS |
| 3.4 | Réseauteur Plus **par licence** crée un événement | Création acceptée (voir §5) | ✅ PASS |
| 3.5 | **Lecture fraîche serveur, jamais le JWT** : DB dit `plusActif=true`, objet `user` transmis (JWT simulé) dit `plusActif=false` | Création **ACCEPTÉE** (le hook ignore le claim périmé, relit `findByID` frais) | ✅ PASS |
| 3.6 | **Lecture fraîche serveur, jamais le JWT (sens inverse)** : DB dit `plusActif=false`, objet `user` transmis (JWT falsifié) dit `plusActif=true` | Création **REFUSÉE** (le serveur ne fait jamais confiance au claim du client) | ✅ PASS |

**6/6 PASS.** Preuve directe de l'invariant CLAUDE.md §4.1 / ADR-0013 §1 : `src/collections/Evenements.ts` L241-253 (`req.payload.findByID('users', req.user.id)` — jamais `req.user.plusActif`).

---

## 4. Invariant XOR organisateur (réseau XOR réseauteur)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 4.1 | Create — DEUX organisateurs (réseau + réseauteur) refusé | `"Un événement a un seul organisateur..."` | ✅ PASS |
| 4.2 | Create — AUCUN organisateur refusé | `"Un événement doit avoir un organisateur..."` | ✅ PASS |
| 4.3 | Create — réseau seul accepté | Création OK | ✅ PASS |
| 4.4 | Create — réseauteur seul (Plus) accepté | Création OK | ✅ PASS |
| 4.5 | Update — ajouter un réseau à un événement déjà organisé par un réseauteur → refusé | `"Un événement a un seul organisateur..."` | ✅ PASS |
| 4.6 | Update — retirer le réseau organisateur sans le remplacer → refusé | `"Un événement doit avoir un organisateur..."` | ✅ PASS |

**6/6 PASS.** Fichier : `src/collections/Evenements.ts` hook `beforeValidate` L185-257 (fonction `effective()` — résout la valeur XOR depuis `data` ou `originalDoc`, teste bien le cas update).

---

## 5. Packs de licences Réseauteur Plus

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 5.1 | Code de pack généré serveur, format `RSN-XXXXXXXX` non devinable | `RSN-D5VPL79C` | ✅ PASS |
| 5.2 | Code inconnu refusé | `"Code inconnu. Vérifiez auprès de votre partenaire."` | ✅ PASS |
| 5.3 | Activation nominale → `plusActif=true`, `plusSource=licence`, `plusLicencePack=pack.id` | Confirmé en DB | ✅ PASS |
| 5.4 | Quota décrémenté après activation (1/2, statut=actif) | `quotaUtilise=1` | ✅ PASS |
| 5.5 | Double activation du MÊME compte refusée (garde applicative) | `"Votre compte est déjà Réseauteur Plus."` | ✅ PASS |
| 5.6 | **Index UNIQUE DB** sur `licences_activations.user_id` (contournement direct de la garde applicative) | Voir note ci-dessous — confirmé par repro isolée | ✅ PASS (voir note) |
| 5.7 | 2ᵉ activation → pack **épuisé** (quotaUtilise=2/2, statut=`epuise`) | Confirmé | ✅ PASS |
| 5.8 | 3ᵉ activation sur pack épuisé refusée | `"Toutes les licences de ce pack ont déjà été activées."` | ✅ PASS |
| 5.9 | Code expiré (`expireAt` passé) refusé | `"Ce code a expiré. Rapprochez-vous de votre partenaire."` | ✅ PASS |
| 5.10 | **Concurrence** : 2 activations simultanées sur quota=1 → EXACTEMENT une réussit | `{concG: ok, concH: refusé}`, `quotaUtilise=1` (jamais 2) | ✅ PASS |
| 5.11 | Cascade d'expiration (cron réel, Bearer `CRON_SECRET`) : pack expiré → `statut=expire` + désactivation des Plus issus du pack | `packsExpires=2`, `plusDesactives=3`, D et E désactivés | ✅ PASS |
| 5.12 | Filet de sécurité webhook : user Plus par abonnement expiré → `plusActif=false` | Confirmé (`F.plusActif=false`) | ✅ PASS |
| 5.13 | Cron sans Bearer → `401` | Confirmé | ✅ PASS |
| 5.14 | Non-régression : Plus non expiré (pack à échéance future) **non affecté** par la cascade d'un autre pack | `A.plusActif=true` après cron | ✅ PASS |

**Note sur 5.6 :** le premier run a rapporté un **FAIL de mon propre script** (regex d'assertion trop stricte : `/unique|duplicate/i` ne matchait pas le message réel Payload `"The following field is invalid: user"`). Reproduction isolée immédiate :
```
act1 created: 24
act2 threw as expected: The following field is invalid: user
Raw DB rows for this user: [ { id: 24, user_id: 61, pack_id: 9 } ]   // 1 seule ligne, pas 2
```
→ **L'invariant est bien appliqué** (index `licences_activations_user_idx` = `UNIQUE btree(user_id)`, confirmé par `pg_indexes`). Faux négatif de harnais corrigé, pas un bug produit.

**14/14 PASS** (13 directs + 1 confirmé par repro isolée). Fichier : `src/lib/licences.ts` (transaction `SELECT ... FOR UPDATE`), `src/app/api/cron/expiration-plus/route.ts`.

---

## 6. Inscriptions aux événements Plus

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 6.1 | Inscription nominale (événement Plus, publié, à venir) | `total=1` | ✅ PASS |
| 6.2 | Ré-inscription idempotente | `deja=true`, `total` inchangé | ✅ PASS |
| 6.3 | 2ᵉ réseauteur s'inscrit | `total=2` | ✅ PASS |
| 6.4 | Refus sur événement de **réseau** (pas de `organisateurReseauteur`) | `"Les inscriptions en ligne ne sont ouvertes que pour les événements organisés par un réseauteur."` | ✅ PASS |
| 6.5 | Refus pour un compte **sans profil réseauteur** | `"Seuls les réseauteurs peuvent s'inscrire..."` | ✅ PASS |
| 6.6 | Refus sur événement **suspendu** (non publié) | `"Cet événement n'est pas ouvert aux inscriptions."` | ✅ PASS |
| 6.7 | Refus sur événement **passé** | `"Cet événement est terminé."` | ✅ PASS |
| 6.8 | Liste des inscrits — **organisateur** voit TOUTES les inscriptions (2) | `totalDocs=2` | ✅ PASS |
| 6.9 | Liste des inscrits — **tiers** (ni organisateur ni inscrit) voit 0 | `totalDocs=0` | ✅ PASS |
| 6.10 | Liste des inscrits — un **inscrit** voit UNIQUEMENT sa propre ligne | `totalDocs=1` | ✅ PASS |
| 6.11 | Désinscription réussie | `total=1` restant | ✅ PASS |
| 6.12 | Désinscription idempotente | Pas d'erreur, total inchangé | ✅ PASS |

**12/12 PASS.** Fichiers : `src/lib/inscriptions.ts`, `src/collections/Inscriptions.ts` access.read L34-43 (`or: [reseauteur.user===moi, evenement.organisateurReseauteur.user===moi]`).

---

## 7. Hiérarchie réseau (niveau à 4 valeurs, tête/local)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 7.1 | Squelette tête auto-créé au signup organisateur : `niveau=national`, `parent=null` | Confirmé | ✅ PASS |
| 7.2 | Création de LOCAL refusée si la tête n'a pas d'abonnement actif | `"Votre réseau national doit disposer d'un abonnement actif..."` | ✅ PASS |
| 7.3 | Création de LOCAL acceptée une fois la tête abonnée | Création OK | ✅ PASS |
| 7.4 | Un LOCAL ne peut PAS être parent d'un autre local | `"...hiérarchie à 2 étages. Un réseau local ne peut pas être parent d'un autre local."` | ✅ PASS |
| 7.5 | Un LOCAL sans parent refusé | `"Un réseau local doit être rattaché à une tête de réseau parent."` | ✅ PASS |
| 7.6 | **« 1 tête par compte »** — refus d'une 2ᵉ tête (`regional`, alors que le compte a déjà une tête `national`) | `"Vous possédez déjà une tête de réseau..."` | ✅ PASS |
| 7.7 | Une TÊTE ne peut PAS se voir assigner un parent | `"Une tête de réseau...ne peut pas avoir de réseau parent."` | ✅ PASS |
| 7.8 | Niveau `international` (4ᵉ valeur de l'enum) — tête standalone acceptée, `parent=null` | Création OK | ✅ PASS |
| 7.9 | **`peutPublierEvenement` hérite dynamiquement** de l'abonnement de la TÊTE : événement créé via un LOCAL alors que la tête est abonnée | Création OK | ✅ PASS |
| 7.10 | Abonnement de la TÊTE désactivé (le local lui-même n'a pas de champ `partenaire` significatif) → création via le LOCAL refusée | `"La publication d'événements est réservée aux réseaux dont le réseau national dispose d'un abonnement actif."` | ✅ PASS |
| 7.11 | Garde-fou de suppression : suppression de la TÊTE refusée tant qu'un LOCAL y est rattaché | `"...1 réseau(x) local/locaux y sont rattaché(s)."` | ✅ PASS |

**11/11 PASS.** Fichiers : `src/lib/reseau-hierarchie.ts` (`estTete`, `nationalDe`, `peutPublierEvenement`, `peutCreerLocalAsync`), `src/collections/Reseaux.ts` hooks `beforeChange` L168-236, `beforeDelete` L294-338, `src/collections/access.ts` `canCreateNational` L52-70.

---

## 8. Affiliation partenaire ⇄ réseauteur

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 8.1 | Le partenaire voit ses réseauteurs affiliés (licences activées sur ses packs) | `["Boris Activateur","Aline Activatrice", ...]` | ✅ PASS |
| 8.2 | Le réseauteur voit son partenaire, **si actif** | `{nom:"QA Partenaire Licences", slug:"qa-partenaire-licences"}` | ✅ PASS |
| 8.3 | Partenaire devenu **inactif** (`statut=expire`) → le lien d'affiliation disparaît | `getPartenaireDeReseauteur → null` | ✅ PASS |

**3/3 PASS.** Fichier : `src/lib/affiliation.ts`.

---

## 9. Recherche / filtres

### 9.1 Événements (ville, département, réseau, type, gratuit/payant, date)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 9.1.1 | Filtre `ville` inclut/exclut correctement | Lyon → Ev1+Ev3 ; Paris exclu | ✅ PASS |
| 9.1.2 | Filtre `departement` inclut/exclut correctement | Rhône → Ev1+Ev3 ; Paris exclu | ✅ PASS |
| 9.1.3 | Filtre `type` (par slug `types-evenement`) inclut/exclut correctement | afterwork → Ev2+Ev3 ; conference exclu | ✅ PASS |
| 9.1.4 | Filtre `gratuit`/`payant` inclut/exclut correctement | gratuit → Ev1+Ev3 ; payant → Ev2 | ✅ PASS |
| 9.1.5 | Sans date explicite : événement passé exclu par défaut | Confirmé | ✅ PASS |
| 9.1.6 | Avec `dateDebut` explicite antérieure : événement passé réintégré | Confirmé | ✅ PASS |
| 9.1.7 | Filtre `réseau` (post-filtre JS côté page, pas un `where` DB) réduit correctement au réseau sélectionné | 1 seul résultat (le bon réseau) | ✅ PASS |

**7/7 PASS.**

### 9.2 Réseauteurs (ville, département, secteur, réseau)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 9.2.1 | Filtre `ville` inclut/exclut correctement | Lyon → P1+P3 ; Marseille exclu | ✅ PASS |
| 9.2.2 | Filtre `badge` inclut/exclut correctement | gold → P2 seul | ✅ PASS |
| 9.2.3 | Filtre `secteur` inclut/exclut correctement | CAT_A → P1+P3 ; CAT_B exclu | ✅ PASS |
| 9.2.4 | 🟢 Filtre `departement` (`contains` = sous-chaîne) : **faux positif documenté** — "Rhône" matche aussi "Bouches-du-Rhône" | P2 (Bouches-du-Rhône) inclus à tort dans un filtre "Rhône" | ⚠️ Comportement observé (non bloquant — design assumé §10) |
| 9.2.5 | 🟡 **Filtre `réseau` SANS AUCUN EFFET** sur l'annuaire réseauteurs | Résultats identiques avec/sans le paramètre `?reseau=` | ❌ **FAIL fonctionnel** (gap vs parcours attendu) |

**4/5 PASS, 1 gap fonctionnel documenté (voir §10 findings).**

---

## 10. Badges (Bronze/Argent/Gold/Platinum)

| # | Assertion | Résultat observé | Statut |
|---|---|---|---|
| 10.1 | `evenementsParMois=3` → badge `argent` | Confirmé | ✅ PASS |
| 10.2 | `evenementsParMois=0` → badge `bronze` | Confirmé | ✅ PASS |
| 10.3 | `evenementsParMois=1` → badge `bronze` | Confirmé | ✅ PASS |
| 10.4 | `evenementsParMois=8` → badge `gold` | Confirmé | ✅ PASS |
| 10.5 | `evenementsParMois=15` → badge `platinum` | Confirmé | ✅ PASS |

**5/5 PASS.** Fichier : `src/lib/badge.ts` (`deriverBadge`), hook `Reseauteurs.ts` `beforeChange` L322-329.

---

## 11. Synthèse chiffrée

| Parcours | PASS | FAIL |
|---|---|---|
| 1. Auth & inscription | 12 | 0 |
| 2. Rôles & propriété | 6 | 0 |
| 3. Gate Réseauteur Plus (+ preuve lecture fraîche) | 6 | 0 |
| 4. Invariant XOR | 6 | 0 |
| 5. Packs de licences | 14 | 0 |
| 6. Inscriptions événements Plus | 12 | 0 |
| 7. Hiérarchie réseau | 11 | 0 |
| 8. Affiliation | 3 | 0 |
| 9.1 Recherche événements | 7 | 0 |
| 9.2 Recherche réseauteurs | 4 | 1 |
| 10. Badges | 5 | 0 |
| **TOTAL** | **86** | **1** |

---

## 12. Findings priorisés

### 🟡 Priorité moyenne (bug de parcours — non bloquant, à corriger)

**F1 — Le filtre « réseau » de l'annuaire réseauteurs (`/reseauteurs?vue=annuaire&reseau=<slug>`) n'a AUCUN effet.**
- **Fichier/ligne fautif :** `src/app/(frontend)/reseauteurs/page.tsx` L44-78 (`SearchParams.reseau` déclaré L51 mais **jamais lu** dans `buildWhere()` L58-78) ; `src/components/search/ReseauteursFilters.tsx` (aucun contrôle UI pour sélectionner un réseau — seuls `q`/`ville`/`departement`/`region`/`badge`/`secteur` sont exposés).
- **Entrée → sortie attendue vs obtenue :** `?reseau=<slug-d-un-reseau-local>` avec des réseauteurs affiliés à ce réseau et d'autres non-affiliés → **attendu** : seuls les réseauteurs de ce réseau ; **obtenu** : tous les réseauteurs, filtre ignoré (prouvé dynamiquement : mêmes IDs retournés avec et sans le paramètre).
- **Impact :** fonctionnalité de recherche annoncée par CLAUDE.md §2 (filtres réseauteurs "réseau") mais non livrée sur la vue annuaire (elle existe côté **carte**, filtrage client-side dans `FiltresReseauteurs.tsx`, mais pas côté liste/SSR). Pas un problème de sécurité ni de perte de données — un correctif consiste à ajouter la condition manquante dans `buildWhere()` (`reseauxFrequentes: { contains: <id du réseau résolu depuis le slug> }`) et un contrôle `<select>` dans `ReseauteursFilters.tsx`.

**F2 — Duplication de la logique du gate Réseauteur Plus (dette de maintenance).**
- **Fichier/ligne :** `src/lib/acces-plus.ts` L75-100 (`peutCreerEvenementAsync`, présenté comme « helper serveur unique » par ADR-0013 §2) n'est **jamais importé/appelé** ailleurs dans le code (`grep` confirmé) ; la logique réellement exécutée est **dupliquée inline** dans `src/collections/Evenements.ts` L190-256 (hook `beforeValidate`).
- **Impact :** aucun bug fonctionnel aujourd'hui (le hook inline a été testé exhaustivement §3-4, tout PASS) — mais deux implémentations du même invariant peuvent diverger silencieusement lors d'une future évolution (ex. un correctif appliqué à l'un et pas à l'autre). Risque de dérive, pas un défaut actif.

### 🟢 Priorité basse (informationnel)

**F3 — Filtre `departement` (réseauteurs ET événements) par sous-chaîne (`contains`) produit des faux positifs sur des noms de départements français qui se recouvrent** (ex. `Rhône` matche aussi `Bouches-du-Rhône` ; même risque probable pour `Savoie`/`Haute-Savoie`, `Loire`/`Haute-Loire`, `Garonne`/`Haute-Garonne`, etc.).
- **Fichiers :** `src/app/(frontend)/reseauteurs/page.tsx` L72, `src/app/(frontend)/evenements/page.tsx` L64.
- C'est un compromis assumé par CLAUDE.md §10 (« recherche simple par filtres, pas de moteur FTS à facettes ») — signalé pour arbitrage produit, pas un bug au sens strict.

**F4 — `types-evenement` contient des entrées dupliquées/legacy** (`afterwork`/`afterworks`, `salon`/`salons`, `conference`/`conferences`, `reunion`, `congres`, `demonstration`, `presence-salon`…) constatées en base lors de l'inspection. Hygiène de données du référentiel admin, hors périmètre du présent test (pas testé dynamiquement), à trier côté back-office.

### Invariants serveur critiques — TOUS VÉRIFIÉS SANS FAILLE

- ✅ Statut Plus **jamais lu depuis le JWT/objet client** — preuve directe par spoofing (§3.5-3.6).
- ✅ Autorisation stricte propriété (réseauteur/organisateur/événement) — refus inter-comptes prouvés, admin OK (§2).
- ✅ Invariant XOR organisateur — create ET update (§4).
- ✅ Quota de licences **atomique sous concurrence** (2 activations simultanées sur quota=1 → exactement 1 réussit) (§5.10).
- ✅ Une seule activation de licence par compte — garde applicative **et** index unique DB (§5.5-5.6).
- ✅ Cascade d'expiration de pack + filet de sécurité webhook, cron protégé par `CRON_SECRET` (§5.11-5.13).
- ✅ Liste des inscrits strictement scopée à l'organisateur (tiers → 0, inscrit → la sienne) (§6.8-6.10).
- ✅ Hiérarchie réseau à 2 étages (tête/local), « 1 tête par compte », héritage dynamique de l'abonnement, garde-fou de suppression (§7).

---

## 13. Verdict

# **PASS_WITH_FIXES**

**Aucun bloquant 🔴.** Tous les invariants serveur critiques (autorisation, XOR, gate Plus « lecture fraîche »,
atomicité des licences, scoping des inscriptions, hiérarchie réseau) sont **vérifiés et corrects** sur l'état
actuel de `master`. Un seul écart fonctionnel réel (F1, 🟡, filtre réseau mort sur l'annuaire réseauteurs) et
une dette de maintenance mineure (F2, 🟡) sont à corriger avant la prochaine itération produit, sans urgence
bloquante. F3/F4 sont informationnels.

**Recommandations non bloquantes (à planifier) :**
1. Brancher le paramètre `reseau` dans `buildWhere()` de `src/app/(frontend)/reseauteurs/page.tsx` (annuaire) + ajouter le contrôle correspondant dans `ReseauteursFilters.tsx`.
2. Faire appeler `peutCreerEvenementAsync` (ou supprimer ce helper mort) plutôt que dupliquer sa logique dans `Evenements.ts`.

**Nettoyage :** les 6 scripts `_verify-*.mts` utilisés pour cette campagne (`_verify-01-auth-squelette.mts`,
`_verify-02-roles-xor-plus.mts`, `_verify-03-licences-affiliation.mts`, `_verify-04-inscriptions.mts`,
`_verify-05-hierarchie-reseaux.mts`, `_verify-06-recherche-badges.mts`, plus scripts de diagnostic/nettoyage
ponctuels) ont tous été **supprimés après exécution** (`rm`). Une vérification finale multi-collections
(`users`, `reseauteurs`, `reseaux`, `evenements`, `partenaires`, `licences-packs`, `licences-activations`,
`inscriptions`) confirme **aucune donnée de test résiduelle** — y compris 4 fiches `reseauteurs` orphelines
détectées suite à un bug de nettoyage dans mon propre premier script (parent `user` déjà supprimé), identifiées
et supprimées séparément après vérification stricte (`user == null` + nom correspondant exactement aux
préfixes de test). Aucune donnée de démonstration préexistante (`seed-demo*`, comptes `@demo.reseauteurs.fr`
antérieurs à cette campagne) n'a été touchée. Le serveur `pnpm dev` local démarré pour les tests HTTP a été
arrêté en fin de campagne. Aucun fichier applicatif n'a été modifié (`git status` propre).
