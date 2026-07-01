# MIGRATION.md — RÉSEAUTEURS (modèle à trois entités)

> Stratégie de migration de données. Réaligné le **2026-06-28** sur le **modèle à trois entités** (ADR-0011).
> **Étendu le 2026-06-30** par les migrations **ADR-0012 (Jalon E1)** — hiérarchie réseaux national↔local,
> suppression du Premium événement. Voir le **§ JALON E1** en fin de document.
> Complète `ARCHITECTURE.md §6` et `PLAN.md`. **Owner : `data-architect`** (phases J1 + E1). **Gate humain
> obligatoire** avant toute exécution sur la base Neon de production (risque destructif — voir §9/§10/E1).
>
> ⚠️ **Mode « code-prep » :** Les **fichiers de migration sont écrits** (`src/migrations/20260628_*.ts` et
> `src/migrations/20260630_*.ts`) ; **leur exécution est différée au gate humain** correspondant (gate J1 pour
> les ADR-0011, **gate E1 pour les ADR-0012** — voir §E1.7). Ce document fixe la stratégie d'application et
> de reprise.

---

## 1. Périmètre et stratégie

**Principe : migrations additives, refactor in place.** On ne recrée pas de dépôt. On construit le domaine à
3 entités par-dessus l'existant (PanoramaPub + migrations `0623`), en réutilisant un maximum (PostGIS, Stripe,
SEO, carte, RGPD, auth).

| Catégorie | Détail |
|---|---|
| **Créé (neuf)** | Collection **`reseauteurs`** (personne) · collection **`partenaires`** (annonceurs) · référentiel **`badges`** · champ **badge** dérivé sur `reseauteurs` · relation **M2M `reseauteurs ↔ reseaux`** · index de recherche (filtres). |
| **Conservé + adapté** | **`reseaux`** (créée par `0623`) → garder comme **entité** (fiche, logo, présentation) **+** ajouter compteurs dérivés + drapeau `partenaire` + cible M2M. **`evenements`** → **simplifier** (retirer `participer`/quota/`serieId`/archivage ; ajouter `lienInscription` externe + `premium`). **`users`** → enum `role` à 3 valeurs ; retrait de l'enum `plan` 3-paliers. **`CategoriesActivite`** → `categories` (secteurs/métiers). **`TypesEvenement`** → catégories d'événements. |
| **Supprimé** | `Fournisseurs.ts`, `OrganisateursEvenements.ts`, `LabelsRSE.ts` (legacy objet publicitaire ; démonter de `payload.config.ts`). Champs/enum 3-paliers et freemium membre. |
| **Non migré / non repris** | **Aucune base d'abonnés payants** à reprendre (la monétisation est neuve, B2B). Pas de collection `membres` (elle n'a jamais existé). |
| **Intouché (dormant — ADR-0009)** | Collection `groupes`, `lib/groupes.ts`, routes `api/groupes/*`, cron `retry-groupe-sync`, champs `users.groupe`/`users.pendingGroupeCode`, **toutes les migrations `*groupe*`**. Aucune migration de retrait, aucun drop. |
| **Dormant (tranché 2026-06-29 — `ARCHITECTURE.md §8.5`)** | **`Testimonials.ts`** (avis, legacy PanoramaPub) : hors des 3 entités → **conservé DORMANT en V1** (table gardée en DB, collection non câblée en home, **pas de drop**). Réutilisable en V2. |

---

## 2. État de départ (constat)

Le dépôt mêle trois générations (cf. `AUDIT-DELTA-RESEAUTEURS.md`) :

- **PanoramaPub** (fond) : `Fournisseurs`, `OrganisateursEvenements`, `LabelsRSE`, plans `premium/infinite`.
- **Pivot Info-Réseaux** (migrations `0623`, **partiel**) :
  - `20260623_100000_postgis_extension.ts` — `CREATE EXTENSION postgis`.
  - `20260623_110000_create_reseaux.ts` — table `reseaux` (+ tables enfants), colonnes `geom` + `reseau_id` +
    `serie_id` sur `evenements`, index GiST.
  - `20260623_120000_data_migration_fusion.ts` — fusion `fournisseurs` + `organisateurs-evenements` →
    `reseaux`, repointage `evenements`, backfill `geom`, conversion `role`. **`down()` destructif :
    `TRUNCATE reseaux CASCADE`.**
  - `20260623_130000_plan_enum_et_categories.ts` — recalibrage enum `users.plan`
    (`gratuit/premium/infinite` → `acces/developpement/premium`), reseed `types_evenement` (7 catégories).
- **RÉSEAUTEURS** (cible) : `reseauteurs`/`partenaires` = **0 occurrence**.

> **Deux scénarios** selon que les migrations `0623` ont été appliquées en staging/prod (à confirmer côté
> humain — §6). **Bonne nouvelle vs ADR-0010 :** sous le modèle à 3 entités, la collection `reseaux` créée
> par `0623` **redevient pertinente** (on l'adapte au lieu de la démonter) → la re-migration est **moins
> destructive** que ce que craignait l'annuaire mono-entité.

---

## 3. Modèle cible (rappel — détail `ARCHITECTURE.md §2`)

- **`reseauteurs`** *(neuve)* — prénom/nom, slug unique, photo, fonction, entreprise, description, tél/email
  **facultatifs**, site, LinkedIn, ville/dept/région, secteur (→ `categories`), compétences, **réseaux
  fréquentés** (M2M → `reseaux`), **badge** (dérivé du nb d'événements/mois), `geom` (**centroïde ville**),
  statut modération, `seoField` (+ `noindex`). 1 user `reseauteur` ↔ 1 réseauteur.
- **`evenements`** *(adapté)* — titre, slug, description, date/heure, adresse, ville, image, `reseau`
  (organisateur, N-1), **`lienInscription`** (URL externe), catégorie (→ `types_evenement`), `geom`,
  **`premium`** (bool), statut.
- **`reseaux`** *(adapté)* — nom, slug, logo, description, présentation, lien, **compteurs dérivés**
  (`nbReseauteurs`/`nbEvenements`), **`partenaire`** (bool/statut), `seoField`. Possédé par 0..1 `organisateur`.
- **`partenaires`** *(neuve)* — nom, logo, lien, statut d'abonnement (annonceurs).
- **`users`** — `role ∈ {reseauteur, organisateur, admin}` ; champs Stripe/RGPD conservés ; champs `groupe`
  dormants.
- **Référentiels** — `categories` (secteurs/métiers), `types_evenement` (catégories d'événements), `badges`.

---

## 4. Migrations produites (data-architect — 2026-06-28)

> Fichiers dans `src/migrations/`. L'ordre d'application dans `migrations/index.ts` est celui ci-dessous.
> `20260628_130000_categories` precede `20260628_100000_reseauteurs` (dependance FK secteur_id → categories).

| Rang | Fichier | Contenu | Reversible |
|---|---|---|---|
| 1 | `20260628_130000_categories.ts` | Cree table `categories` (secteurs/metiers) + seed 16 secteurs. | Oui (DROP TABLE) |
| 2 | `20260628_100000_reseauteurs.ts` | Cree `reseauteurs` + `reseauteurs_competences` + `_rels` (M2M → reseaux) ; `geom geography(Point,4326)` ; index GiST + unicite slug + filtres (ville/dept/region/secteur/badge/statut). | Oui (DROP TABLE) |
| 3 | `20260628_110000_partenaires.ts` | Cree `partenaires` (annonceurs) + enum `statut` actif/expire. | Oui |
| 4 | `20260628_120000_badges.ts` | Cree `badges` (Bronze/Argent/Gold/Platinum) + seed 4 niveaux (couleurs, seuils). | Oui |
| 5 | `20260628_140000_reseaux_adapter.ts` | Ajoute a `reseaux` : `presentation`, `partenaire` (bool), `stripe_subscription_id`, `partenaire_expire_at`, `nb_reseauteurs` (int), `nb_evenements` (int). Index `partenaire`. | Oui (DROP COLUMN) |
| 6 | `20260628_150000_evenements_adapter.ts` | Ajoute `premium` (bool) + `stripe_checkout_session_id` a `evenements` ; etend enum statut (`suspendu`) ; index GiST partiel Premium+publie. **`serie_id` (ADR-0008) et `visible` rendus DORMANTS** : retires de la collection `Evenements.ts`, **colonnes conservees en DB (pas de DROP)** — nettoyage differe a une migration ulterieure. | Partiel (enum non reversible) |
| 7 | `20260628_160000_users_roles.ts` | Enum `role` : `fournisseur/organisateur/admin` → `reseauteur/organisateur/admin`. **Regle unique de conversion** : `fournisseur` → `reseauteur` (tout non-organisateur = reseauteur), `organisateur` → `organisateur` (inchange), `admin` → `admin` (inchange). `plan` → text dormant (NULL pour role reseauteur). | Approximatif |
| 8 | `20260628_170000_indexes.ts` | Extension `pg_trgm` + index GIN trigram (nom/prenom/entreprise sur reseauteurs, nom sur reseaux) + index composites filtres (statut+ville, statut+badge, statut+secteur, reseau+date, ville+date). | Oui (DROP INDEX) |

> PostGIS (`20260623_100000`) est **conserve et actif** — pas de migration a rejouer.
> Tables legacy `fournisseurs`, `organisateurs_evenements`, `labels_rse`, `categories_activite`
> **conservees en DB** (collections demontees de `payload.config.ts`) — drop dans une migration de nettoyage ulterieure.
> Idem pour les **colonnes dormantes** `evenements.serie_id` et `evenements.visible` (retirees de la
> collection, conservees en DB) : aucun `DROP COLUMN` destructif en V1 — nettoyage groupe avec les tables legacy.

**Bug latent resolu :** `Users.ts` forcait `plan='gratuit'` alors que l'enum `130000` ne contenait que `acces/developpement/premium`.
La migration `160000` sort `plan` du systeme d'enum (→ text dormant) et resout ce crash a l'inscription.

---

## 5. Reprise de données

- **`reseauteurs`** : **greenfield** — aucune donnée existante (pas de collection `membres`). Pas de reprise ;
  seed de dév uniquement (§8 de `ARCHITECTURE`). En production, les profils sont créés par les inscriptions.
- **`reseaux`** : si `0623` appliqué, la fusion `fournisseurs`+`organisateurs` → `reseaux` **a déjà eu lieu** →
  ces lignes deviennent des **fiches réseau** (nom, logo, description, présentation, lien réutilisés). Sinon,
  recréer `reseaux` (migration 110000 conservée) puis seed les réseaux de référence (BNI, DCF, CJD…).
- **`evenements`** : conservés ; backfill `lienInscription` (depuis l'éventuel lien existant) ; `premium`
  initialisé à `false`.
- **Abonnés payants** : **aucun à reprendre** (monétisation B2B neuve) → pas de mapping Stripe d'historique.
- **`users`** : conversion de l'enum `role` (migration `160000`, **règle unique** alignée sur le code) —
  `fournisseur` → `reseauteur` (dans le modèle 3-entités, tout compte non-organisateur est un réseauteur) ;
  `organisateur` → `organisateur` (inchangé) ; `admin` → `admin` (inchangé). Le champ `plan` passe en text
  dormant (NULL pour les `reseauteur`). Les nouveaux inscrits arrivent en `reseauteur` (défaut).

Tout enregistrement non migrable est **loggé** (jamais perdu silencieusement).

---

## 6. Re-migration depuis l'état `0623` (gate humain)

**Question préalable à trancher avec l'humain : les migrations `0623` ont-elles tourné en staging/prod ?**

- **Scénario A — `0623` NON appliqué.** Appliquer `110000`/`130000` adaptés (créer `reseaux`-entité + reseed
  référentiels), puis les migrations §4. Pas de chemin de rattrapage.
- **Scénario B — `0623` appliqué** (DB en état « reseaux possédés + enum 3-paliers »). **NE PAS** se contenter
  de « ne pas appliquer » : écrire un **chemin de re-migration depuis cet état** :
  1. **Conserver `reseaux`** (l'adapter, migration §4.5) — *ne pas* jouer le `down()` de `120000`.
  2. Migrer l'enum `users.plan` `acces/developpement/premium` → **suppression** (B2B sur `reseau.partenaire`
     / `partenaires`, plus de plan utilisateur). Résout le bug latent (§10).
  3. Convertir l'enum `role`.
  4. Ajouter `reseauteurs`/`partenaires`/`badges`/M2M (migrations §4.1-4.4).

⚠️ **Ne jamais déclencher `down()` de `20260623_120000`** (`TRUNCATE reseaux CASCADE`) sur une base contenant
des réseaux/événements réels : c'est destructif. Si un rollback de `0623` est nécessaire, passer par une
**restauration de sauvegarde**, pas par le `down()`.

---

## 7. Slugs & redirections (ADR-0005 amendé)

- Slugs **figés** au singulier : `/reseauteur/<prenom-nom>`, `/evenement/<slug>`, `/reseau/<slug>`.
- **Dédoublonnage déterministe** des collisions de slugs (notamment homonymes de réseauteurs : suffixe
  ville/identifiant court — règle confirmée par `data-architect`/`seo-engineer`).
- **Redirections 301** depuis les anciennes URLs PanoramaPub/Info-Réseaux (`/revendeurs/*`,
  `/organisateurs/*`, anciennes `/evenements/<slug>`) vers les URLs cibles. Conserver le fallback
  legacy-id → slug. (Implémentation : `next.config.ts` / `seo-engineer`.)

---

## 8. Dry-run & rollback

```bash
# ── GATE HUMAIN : lire §6 avant de lancer ──

# 1) Créer une branche Neon (ou restaurer un dump sur DB locale)
#    Dashboard Neon → Branches → Create branch from main

# 2) DRY-RUN sur la COPIE :
DATABASE_URL="postgresql://user:pass@host/db_copy" yarn payload migrate

# 3) Vérifications rapides post dry-run :
psql $DATABASE_URL_COPY -c "\dt reseauteurs partenaires badges categories"
psql $DATABASE_URL_COPY -c "SELECT COUNT(*) FROM badges;"          # doit renvoyer 4
psql $DATABASE_URL_COPY -c "SELECT COUNT(*) FROM categories;"      # doit renvoyer 16
psql $DATABASE_URL_COPY -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
psql $DATABASE_URL_COPY -c "SELECT * FROM pg_extension WHERE extname = 'pg_trgm';"
psql $DATABASE_URL_COPY -c "SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%';"

# 4) Test de rollback sur la copie :
DATABASE_URL="postgresql://user:pass@host/db_copy" yarn payload migrate:down
# Rejouer pour vérifier l'idempotence :
DATABASE_URL="postgresql://user:pass@host/db_copy" yarn payload migrate

# 5) PRODUCTION (uniquement après GATE HUMAIN + snapshot Neon) :
DATABASE_URL="$DATABASE_URL_PRODUCTION" yarn payload migrate

# 6) Seed dev (local uniquement) :
yarn ts-node src/scripts/seed-dev.ts
```

- **Sauvegarde Neon (snapshot/PITR) avant tout run prod.**
- **Rejouer le dry-run 2×** sur la copie : résultat identique (idempotence).
- Pour les migrations destructives (§6 : `down()` de `120000`), **rollback = restauration de snapshot**, pas `migrate:down`.

---

## 9. Points de vigilance

1. **`down()` de `120000` destructif** (`TRUNCATE reseaux CASCADE`) — ne jamais l'exécuter sur des données
   réelles (§6). Rollback de `0623` = restauration snapshot uniquement.
2. **Bug latent enum/plan résolu** : `Users.ts` forcait `plan='gratuit'` alors que l'enum post-`130000` ne
   contenait que `acces/developpement/premium`. La migration `160000` sort `plan` de l'enum (→ text dormant)
   et résout ce crash à l'inscription.
3. **Géocodage** : `geom` des `reseauteurs` au **niveau ville/commune** (pas d'adresse perso, RGPD §9) ;
   `geom` des `evenements` à l'adresse de l'événement. Lignes non géocodables → loggées, exclues de la carte,
   jamais bloquantes. Backfill via `src/scripts/geocode-retry.ts --collection reseauteurs`.
4. **Doublons** : homonymes de réseauteurs (slug collision → suffixe déterministe `-2`/`-3`/`-<ville>`,
   jamais `Date.now()`). Réseaux en double issus de la fusion `0623` → dédoublonnage manuel en prod.
5. **Compteurs `reseaux`** (`nb_reseauteurs`/`nb_evenements`) : initialisés à 0 par la migration ; recalculés
   par hooks Payload (`afterChange`/`afterDelete` dans `Reseauteurs.ts` et `Evenements.ts`).
6. **Legacy non retiré** : tables `fournisseurs`/`organisateurs_evenements`/`labels_rse`/`categories_activite`
   restent en DB ; vérifier qu'aucune route/API les référence avant le drop (gate humain, migration future).
7. **Enum `evenements.statut` + valeur `suspendu`** : ne peut pas être retirée sans recréer l'enum entier.
   Les lignes avec `statut='archive'` (existantes pré-0628) restent valides en DB ; la collection ne les expose
   plus mais elles ne bloquent pas.
8. **Ordre migrations** : `20260628_130000_categories` AVANT `20260628_100000_reseauteurs` dans `index.ts`
   (FK `reseauteurs.secteur_id → categories.id`). L'ordre est déjà correct dans le fichier livré.

---

## 10. Checklist post-migration

- [ ] `reseauteurs`, `partenaires`, `badges`, M2M `reseauteurs_rels` (→ reseaux) créés ; index GiST + filtres en place.
- [ ] `reseaux` = entité (fiche + compteurs + `partenaire`) **et** cible M2M ; `down()` `120000` non joué.
- [ ] `evenements.premium` présent (default false) ; `statut` enum étendu (`suspendu`).
- [ ] `users.role` ∈ {reseauteur, organisateur, admin} ; `plan` = text dormant ; inscription non-admin ne casse plus.
- [ ] `Fournisseurs`/`OrganisateursEvenements`/`LabelsRSE`/`CategoriesActivite` démontées du config Payload (tables conservées en DB).
- [ ] Référentiels : `categories` (16 secteurs), `types_evenement` (7 catégories seedées par `0623`), `badges` (4 niveaux).
- [ ] `pg_trgm` actif ; index GIN trigram sur noms/entreprises ; index composites filtres en place.
- [ ] Slugs uniques (3 entités) ; collision → suffixe `-2`/`-3`/`-<ville>` déterministe.
- [ ] **`groupes` et ses migrations intactes** (ADR-0009 — ne pas toucher).
- [ ] Dry-run rejoué 2× sans divergence ; snapshot de sauvegarde prod pris ; rollback (restauration snapshot) testé.
- [ ] Seed dev exécuté : deux cartes non vides (réseauteurs, réseaux locaux, événements — sans Premium).
- [ ] `noindex: true` par défaut sur `reseauteurs` avec statut `en_attente`/`suspendu` (RGPD).
- [ ] ADR-0012 E1 : `evenements.premium` et `evenements.stripe_checkout_session_id` absents (droppes par 20260630_110000).
- [ ] ADR-0012 E1 : `reseaux.niveau` = 'national' sur tous les existants ; `reseaux.parent_id` et `reseaux.palier` présents.
- [ ] ADR-0012 E1 : index unique `(user_id) WHERE niveau='national'` opérationnel (remplace l'ancien).

---

## 11. Résidus pour les autres agents

| Élément | Agent | Priorité |
|---|---|---|
| Recalibrage Stripe (3 produits B2B, webhooks partenaire/premium) | `accounts-and-billing` | J2.A |
| Suppression propre colonne `plan` (après transition Stripe) | `accounts-and-billing` | J2.A |
| Routes `/api/geo/reseauteurs` et `/api/geo/evenements` (GeoJSON PostGIS) | `map-engineer` | J2.B |
| Vérification que `evenements.lien_inscription` existe en DB | `frontend-builder` | J2.C |
| JSON-LD `Person`/`Event`/`Organization` ; `noindex` dans sitemap | `seo-engineer` | J2.D |
| Rebranding emails Resend → RÉSEAUTEURS | `frontend-builder` | J2.C |

---

## 12. Renvois

`docs/adr/0011-plateforme-trois-entites-monetisation-b2b.md` · `ARCHITECTURE.md §2/§5/§6` · `PLAN.md J1` ·
`docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` (+ amendement 3-entités) · ADR-0002 (PostGIS), ADR-0005 (URLs),
ADR-0009 (groupes dormants).

---

---

# JALON E1 — ADR-0012 : Hiérarchie réseaux national↔local (2026-06-30)

> Ajouté par `data-architect` le **2026-06-30**. Décisions tranchées au gate humain ADR-0012 (PLAN.md §Partie C).
> Gate humain **obligatoire en sortie de E1** avant exécution des migrations E1 sur staging/prod.

## E1.0 — Dry-run du 2026-06-30 (RÉSULTAT : ✅ VALIDÉ)

Dry-run exécuté sur une **base PostGIS jetable** (conteneur Docker `postgis/postgis:16-3.4-alpine`,
DB vierge, **aucune base réelle touchée**). Chaîne **complète** rejouée (50+ migrations, 0324 → 0623 →
0628 → 0629 → **0630 E1**) via `src/scripts/migrate-safe.ts`.

**Forward (up) — `PIPELINE_EXIT=0`, aucune erreur.** Assertions de schéma post-migration vérifiées en SQL :
- `reseaux.niveau` (enum `enum_reseaux_niveau` = {national, local}, **défaut `national`**), `reseaux.parent_id`
  (FK auto-référentielle `reseaux_parent_id_fk → reseaux`), `reseaux.palier` (varchar) : **présents**.
- Index unique partiel `reseaux_user_national_unique_idx ... WHERE niveau='national' AND user_id IS NOT NULL` :
  **créé** (invariant « 1 user = au plus 1 national »).
- `evenements.premium` et `evenements.stripe_checkout_session_id` + leurs 3 index : **absents** (drop OK).
- **Nom réel de l'ancien index confirmé** : `reseaux_user_id_unique` (créé par `20260623_110000`) — c'est le
  **1ᵉʳ nom candidat** droppé par `20260630_100000` ⇒ le remplacement fonctionnera sur la vraie base
  (incertitude levée).

**Rollback (down → re-up) — testé en isolé sur les 3 migrations E1, idempotent :**
- Après `down` (120000→110000→100000) : `niveau` retiré, `premium` recréé, `reseaux_user_id_unique` restauré.
- Après `re-up` : retour **exact** à l'état E1 final. Cycle symétrique (données des colonnes droppées non
  restaurables — attendu et documenté §E1.2).

**Types Payload régénérés** (`payload generate:types`) : `src/payload-types.ts` reflète désormais E1
(`Reseau.niveau`/`parent`/`palier` ajoutés ; `Evenement.premium`/`stripeCheckoutSessionId` retirés).
> ⚠️ `data-architect` n'avait **pas** régénéré les types ; corrigé pendant le dry-run.

**Limite du dry-run :** exécuté sur DB **vierge** (le backfill `niveau='national'` et le pré-contrôle
`premium=true` portaient donc sur 0 ligne). Sur la **vraie** base (déjà à l'état 0628), les 3 migrations E1
s'appliquent en **incrémental** — la checklist de gate prod (§E1.7 : snapshot, `COUNT(*) WHERE premium=true`,
remap affiliations) **reste à exécuter par l'humain** avant tout run staging/prod.

## E1.1 Migrations ADR-0012 (ordre d'application)

Enchaîner DANS CET ORDRE après les migrations ADR-0011 (20260629_102000 étant la dernière) :

| Ordre | Fichier | Nature | Risque |
|---|---|---|---|
| 1 | `20260630_100000_reseaux_hierarchie.ts` | Additif — add niveau/parent/palier + index unique partiel | Moyen (relâchement unicité) |
| 2 | `20260630_110000_evenements_drop_premium.ts` | **DESTRUCTIF** — drop premium + stripeCheckoutSessionId | **Élevé** |
| 3 | `20260630_120000_reseaux_niveau_national_default.ts` | Backfill + vérification affiliations | Faible |

**Commande (NE PAS EXÉCUTER avant dry-run + gate humain) :**
```bash
# Depuis la racine du projet, APRÈS npm install
npx payload migrate
```

## E1.2 Opérations DESTRUCTIVES signalées

### Migration 20260630_110000 — DROP colonnes evenements

| Colonne | Type | Défaut | Données à risque |
|---|---|---|---|
| `evenements.premium` | boolean | false | Événements avec premium=true (attendu: 0 — vérifier) |
| `evenements.stripe_checkout_session_id` | varchar | null | Sessions Checkout one-shot (attendu: 0 — vérifier) |

Vérification OBLIGATOIRE avant exécution :
```sql
SELECT COUNT(*) FROM evenements WHERE premium = true;
SELECT COUNT(*) FROM evenements WHERE stripe_checkout_session_id IS NOT NULL;
-- Si > 0 : alerter le product owner avant DROP
```

Les index `evenements_premium_idx`, `evenements_premium_publie_gist_idx`, `evenements_stripe_checkout_idx` sont supprimés.

### Migration 20260630_100000 — Relâchement index unique user

L'ancien index partiel unique `(user_id) WHERE user_id IS NOT NULL` (règle "1 user = 1 réseau") est remplacé par `(user_id) WHERE niveau='national'` (règle "1 user = au plus 1 national").

**Noms candidats droppés par la migration** (les trois sont tentés avec IF EXISTS) :
- `reseaux_user_id_unique`
- `reseaux_user_unique`
- `reseaux_user_idx_unique`

Si aucun ne correspond au nom réel en base (vérifiable via `\d reseaux` en psql ou via `pg_indexes`), le drop sera silencieux et le nouvel index unique partiel sera quand même créé. **Vérification recommandée avant E1** :
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'reseaux' AND indexdef LIKE '%user_id%';
```

## E1.3 Procédure de dry-run

```bash
# 1. Sauvegarde snapshot Neon (obligatoire)
#    Dashboard Neon → Branches → Create a branch from main (point-in-time)

# 2. Dry-run sur la branche Neon de dev (pas la prod)
DATABASE_URL="postgresql://<neon-dev-branch-url>" npx payload migrate --dry-run
# (ou équivalent selon la config du projet — flag dry-run selon version Payload)

# Si payload migrate ne supporte pas --dry-run :
# Jouer les SQL manuellement dans psql/Neon console avec BEGIN; ... ROLLBACK;
# pour inspecter les NOTICE/WARNING sans committer.

# 3. Vérifications post-dry-run
# a. Confirmer 0 événement avec premium=true (WARNING sinon)
# b. Confirmer que l'index unique partiel national est créé correctement
# c. Confirmer que le backfill niveau='national' couvre tous les reseaux existants
# d. Confirmer 0 affiliation reseauxFrequentes vers un national (WARNING sinon)
```

## E1.4 Rollback (down)

**Ordre inverse obligatoire :**
```bash
# 1. Annuler le backfill (no-op effectif)
npx payload migrate:down --migration 20260630_120000_reseaux_niveau_national_default
# 2. Recréer les colonnes premium (sans données — données perdues par up())
npx payload migrate:down --migration 20260630_110000_evenements_drop_premium
# 3. Supprimer hiérarchie (DESTRUCTIF si des locaux ont été créés)
npx payload migrate:down --migration 20260630_100000_reseaux_hierarchie
```

**Points de vigilance du rollback :**
- `20260630_110000 down()` recrée les colonnes premium/stripeCheckoutSessionId **sans données** (données perdues en up()).
- `20260630_100000 down()` est **DESTRUCTIF si des réseaux locaux ont été créés** (parent_id = données perdues).
- Ne jamais jouer `down()` sur les migrations ADR-0011 (20260623_120000) — `TRUNCATE reseaux CASCADE` (inchangé vs ADR-0011 §9).

## E1.5 Redirections 301 (à implémenter par seo-engineer en E2.D)

Exigence documentée par `data-architect`, implémentation déléguée à `seo-engineer` + `frontend-builder` en E2 :

| Ancienne URL | Nouvelle URL | Type |
|---|---|---|
| `/carte/reseauteurs` | `/reseauteurs?vue=carte` | 301 permanent |
| `/carte/evenements` | `/evenements?vue=carte` | 301 permanent |

Implémentation recommandée : `next.config.ts` (redirects statiques) ou middleware Next.js.
Ces redirects doivent être en place avant la mise en production d'E2 (pages à bascules).

## E1.6 Config paliers (à fournir avant E2.A)

Le champ `reseaux.palier` stocke la valeur du palier (ex: 'starter', 'growth', 'enterprise').
Les seuils et les prix Stripe sont **des valeurs placeholder dans `src/lib/reseau-hierarchie.ts`**.

**Ce qui reste à fournir par le product owner avant E2.A (accounts-and-billing) :**
- Prix annuels réels par palier
- Nombre de locaux autorisés par palier
- IDs de produits/prix Stripe correspondants
- Noms définitifs des paliers

Emplacement à mettre à jour : `src/lib/reseau-hierarchie.ts` — constante `PALIERS_CONFIG`.

## E1.7 Checklist gate humain E1

Avant d'autoriser E2 (chantiers parallèles E2.A/B/C/D) :

- [ ] Dry-run E1 joué sur branche Neon dev, 0 WARNING non résolu
- [ ] `SELECT COUNT(*) FROM evenements WHERE premium = true` = 0 confirmé
- [ ] Snapshot Neon prod pris avant toute exécution prod
- [ ] `20260630_100000` appliqué : colonne `niveau` = 'national' sur tous les reseaux existants
- [ ] `20260630_100000` appliqué : index unique partiel `WHERE niveau='national'` en place (vérifier via `pg_indexes`)
- [ ] `20260630_110000` appliqué : colonnes `premium` et `stripe_checkout_session_id` absentes de `evenements`
- [ ] `20260630_120000` appliqué : 0 affiliation `reseauxFrequentes` vers un national (vérifier le NOTICE)
- [ ] Rollback testé sur branche dev (down() 3 migrations + up() de nouveau → résultat identique)
- [ ] Config paliers E1.6 : product owner informé de la TODO — blocage de E2.A si non fournie
- [ ] Collections : `Reseaux.ts` (`niveau`/`parent`/`palier`), `Evenements.ts` (sans `premium`), `Reseauteurs.ts` (locaux-only), `Users.ts` (`niveau='national'`), `access.ts` (`canCreateNational`) compilent sans erreur TypeScript
- [ ] `src/lib/reseau-hierarchie.ts` présent et importable
- [ ] `payload generate:types` lancé et `src/payload-types.ts` régénéré
- [ ] **Tag git** de l'état pré-E1 (avant toute migration destructive sur prod)

## E1.8 Résidus pour les autres agents (delta ADR-0012)

| Élément | Agent | Jalon |
|---|---|---|
| Drop Premium UI/route Checkout one-shot/webhook one-shot/marqueur carte | `accounts-and-billing` + `map-engineer` | E2.A/B |
| Abonnement national par paliers (Stripe produits multiples + `maxLocaux`) | `accounts-and-billing` | E2.A |
| Action admin délégation `local.user` (back-office Payload) | `accounts-and-billing` | E2.A |
| Route `/api/geo/reseaux` (marqueurs = locaux) | `map-engineer` | E2.B |
| Pages à bascules `/reseauteurs` + `/reseaux` (entité+vue) | `frontend-builder` | E2.C |
| Dashboard national (gestion locaux + délégation + abonnement) | `frontend-builder` | E2.C |
| JSON-LD `parentOrganization` sur locaux | `seo-engineer` | E2.D |
| Canonical bascules + 301 `/carte/*` | `seo-engineer` | E2.D |
| Config paliers réels (`PALIERS_CONFIG` dans `reseau-hierarchie.ts`) | Product owner → `accounts-and-billing` | Avant E2.A |
