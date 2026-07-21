# TEST-SANTE-2026-07-20 — Contrôle de santé RÉSEAUTEURS

> ### ⏫ Mise à jour post-correctif (2026-07-20, 2ᵉ passe)
> Le blocage racine `test:int` (28/28 suites mortes à l'import) a été **corrigé** en restaurant la
> résolution des alias `@/*` côté runner : ajout d'un `resolve.alias` explicite dans
> [`vitest.config.mts`](../../vitest.config.mts) (plutôt que de retirer `"tests"` de l'`exclude` de
> `tsconfig.json`, ce qui aurait fait entrer les specs dans le périmètre de `tsc --noEmit`/`next build`).
>
> **Re-run `pnpm test:int` :** les tests **s'exécutent à nouveau** — **433 tests, 312 ✅ / 120 ❌ / 1 skip**
> (avant : 0 exécuté). **Triage des 120 échecs → aucune régression du code produit**, trois causes, toutes
> antérieures et masquées par 18 jours de suite non lançable :
> 1. **Mocks/assertions de test périmés** (majorité) : `vi.mock('@/lib/stripe')` sans les exports récents
>    (`resolveProduitFromMetadata`, `PALIERS_NATIONAL`), `vi.mock('payload')` sans `create/delete/findByID`
>    ni `db.drizzle` ; `emails.int.spec.ts` (42) attend encore `/img/logo.png` alors que le template
>    RÉSEAUTEURS rend la marque en **wordmark texte** ([layout.ts:109](../../src/lib/emails/layout.ts#L109)).
> 2. **Specs caduques** : `plan-downgrade.int.spec.ts` → `@/lib/plan-downgrade` supprimé (ADR-0016) ;
>    `collections-config.int.spec.ts` → `@/collections/Fournisseurs` supprimé (PanoramaPub).
> 3. **Specs dépendantes d'env** : `geo-*`, `directions`, `api`, `access-control` → `missing secret key`
>    (`PAYLOAD_SECRET` absent de `.env.local`) + timeouts DB Neon partagée.
>
> Le verdict global reste **🔴 BLOCK** tant que lint (2 erreurs) et cette dette de tests ne sont pas traitées,
> **mais le code applicatif n'est pas cassé** : typecheck vert, et les 120 échecs sont de la maintenance de
> tests, pas des bugs produit. Détail original ci-dessous.

> ### ⏫ Mise à jour post-nettoyage (2026-07-20, 3ᵉ passe)
> Corrections appliquées : **lint 0 erreur** (suppression d'un cluster mort de 5 composants billing legacy —
> `PlanCheckoutButton`/`PlanChangeConfirmModal`/`CheckoutInfiniteConfirmModal`/`GroupePromoCodeInput`/
> `ReactivateButton`, remplacés par `components/billing/AbonnementManager.tsx`) ; **2 specs caduques
> supprimées** (`plan-downgrade`, `collections-config`) ; **mocks périmés rafraîchis** — assertion logo email
> → wordmark (42 tests), `@/lib/stripe` converti en spread-actual (`importActual`) dans 5 specs pour immuniser
> contre les nouveaux exports, méthodes `payload` manquantes (`create`/`delete`/`findByID`) ajoutées.
>
> **État `test:int` : 463 tests exécutés, 371 ✅ / 91 ❌ / 1 skip** (typecheck + lint verts). Le total exécuté
> monte de 433 à 463 car les specs qui échouaient à l'import tournent enfin ; les passants montent de 312 à 371.
> **Les 91 restants ne sont plus des mocks périmés** — trois familles de **dette plus profonde, hors périmètre
> « rafraîchir les mocks »** :
> 1. **Dérive d'assertion post-refonte de route/collection** (≈ la moitié) : la route webhook a été refondue
>    (messages FR `Signature manquante`, ordre signature→rate-limit, résolution produit `resolveProduitFromMetadata`),
>    `cron-downgrade` renvoie `{reseauxDowngraded, …}` au lieu de `{downgraded, checked}`, la création d'événement
>    exige désormais un champ **catégorie**, certains endpoints renvoient **410 Gone** (change-plan, ADR-0016) mais
>    les specs attendent 200. → **ré-écriture des assertions** contre le comportement actuel (domaine
>    `accounts-and-billing`), pas un patch de mock.
> 2. **Routes geo passées au SQL brut Drizzle** (`geo-evenements`/`geo-revendeurs`/`directions`) : elles lisent
>    `payload.db.drizzle` ; les specs ne mockent que `payload.find`. → mock d'un exécuteur Drizzle **ou** exécution
>    contre une vraie DB.
> 3. **Specs dépendantes d'env** (`access-control`, `api`, un test d'idempotence webhook) : `missing secret key`
>    (`PAYLOAD_SECRET`) + timeouts DB Neon — **catégorie explicitement hors périmètre** de cette passe.
>
> Verdict inchangé **🔴 BLOCK** (suite rouge), mais la nature du rouge est désormais **entièrement de la
> maintenance/ré-écriture de tests contre des routes refondues** — aucun bug produit détecté ; typecheck + lint verts.

---

**Agent :** QA santé du projet · **Date :** 2026-07-20 · **Branche :** `dev`
**Question posée :** « Est-ce que RÉSEAUTEURS fonctionne encore ? »
**Garde-fous respectés :** aucune modification de code/tests, aucun commit, aucun seed/purge/migrate sur
la base Neon partagée avec la prod. Un script de diagnostic **lecture seule** a été créé puis **supprimé**
en fin de vérification (détail §6).

---

## 1. Tableau de bord

| # | Étape | Commande exacte | Résultat | Temps |
|---|---|---|---|---|
| 1 | Typecheck | `pnpm exec tsc --noEmit` | ✅ **PASS** (0 erreur) | ~13,6 s |
| 2 | Lint | `pnpm lint` | ❌ **FAIL** (2 erreurs bloquantes, 95 warnings) | ~21,8 s |
| 3 | Tests d'intégration | `EMAILS_DRY_RUN=1 SEED_DEV=true pnpm test:int` | ❌ **FAIL** (28/28 suites en échec, **0 test exécuté**) | ~8,6 s |
| 4 | Tests e2e | `EMAILS_DRY_RUN=1 SEED_DEV=true pnpm test:e2e` | ⏭️ **SKIPPED** (environnement — voir §5) | ~40 s avant abandon |
| 5 | Build | `pnpm build` | ⏭️ **SKIPPED** (garde-fou : déclenche `migrate-safe` sur la base Neon partagée prod — non lancé, conforme aux instructions) | — |

**Verdict global : 🔴 BLOCK**

---

## 2. Typecheck — ✅ PASS

`pnpm exec tsc --noEmit` termine sans erreur (mode strict, ~13,6 s). Cohérent avec CLAUDE.md : Stripe
(`getStripe()` lazy, Proxy) et Resend (fallback `|| ''`) ne provoquent aucune erreur de compilation en
l'absence de `STRIPE_*`/`RESEND_*`. Aucune régression de typage détectée.

---

## 3. Lint — ❌ FAIL (2 erreurs bloquantes)

`pnpm lint` (eslint) : **2 erreurs**, **95 warnings**.

### Erreurs bloquantes

1. **`src/components/dashboard/GroupePromoCodeInput.tsx:73:7`** — règle `react-hooks/set-state-in-effect`
   (« Calling setState synchronously within an effect can trigger cascading renders »). `setStatus('idle')`
   appelé directement dans le corps d'un effet.
   → Composant encore importé par `PlanCheckoutButton.tsx` (donc pas mort), mais relève du flux **licences
   par code promo**, **supprimé côté produit par l'ADR-0015** (2026-07-17). À vérifier : ce composant est-il
   encore réellement monté dans un parcours utilisateur actif, ou orphelin après le retrait des packs de
   licences ?
   → **Agent recommandé : `accounts-and-billing`.**

2. **`src/components/dashboard/PlanChangeConfirmModal.tsx:145:5`** — même règle. `setPreviewLoading(true)`
   appelé directement dans un effet, juste avant un `fetch('/api/stripe/preview-change-plan', ...)`.
   → Cette route est documentée **410 Gone** dans CLAUDE.md §4 (ADR-0016 : remplacée par
   `POST /api/stripe/change-palier`). Le composant est encore importé par `CheckoutInfiniteConfirmModal.tsx`
   — probablement un résidu de l'ancien flux `change-plan` non nettoyé après la migration vers le hub
   `/dashboard/abonnement`.
   → **Agent recommandé : `accounts-and-billing`.**

### Warnings (non bloquants, 95 au total — échantillon représentatif)

- `@typescript-eslint/ban-ts-comment` (`@ts-nocheck` en tête de fichier) sur ~15 fichiers de production :
  `src/collections/Evenements.ts`, `src/collections/Reseauteurs.ts`, `src/collections/Reseaux.ts`,
  `src/app/api/geo/{evenements,reseauteurs,reseaux}/route.ts`, `src/components/map*/Map*.tsx`, etc. Ces
  `@ts-nocheck` masquent silencieusement d'éventuelles erreurs de type dans des fichiers-clés (collections,
  cartes) — à traiter en dette technique, **agent recommandé : `data-architect`** (collections) et
  **`map-engineer`** (composants carte).
- `@next/next/no-img-element` (3 occurrences), `@next/next/no-html-link-for-pages` (3 occurrences) —
  optimisation LCP/navigation, non bloquant.
- `@typescript-eslint/no-unused-vars` sur ~15 fichiers de migrations Payload (`src/migrations/2026*.ts`,
  paramètres `payload`/`req` non utilisés) — bruit habituel des migrations générées, non bloquant.
- 4 warnings dans des specs `tests/int/*.int.spec.ts` (`no-explicit-any`, variable inutilisée) — sans
  impact fonctionnel.

---

## 4. Tests d'intégration — ❌ FAIL (28/28 suites, 0 test exécuté)

### 4.1 Vérification de sécurité base (avant exécution)

Avant de lancer `pnpm test:int`, chaque fichier `tests/int/*.int.spec.ts` a été audité :

- **27/28 fichiers** mockent intégralement `payload`, `next/headers`, `@/lib/*` via `vi.mock(...)` — **aucun
  accès réseau à la base réelle**.
- **1 fichier** (`tests/int/api.int.spec.ts`) utilise un **vrai** `getPayload()` contre la base Neon
  partagée, mais l'unique test (`fetches users`) fait un `payload.find()` **en lecture seule**, sans
  `create`/`delete`/`update`. Vérifié sûr à exécuter.
- Aucune suite ne seed/purge/migre la base. → **Décision : exécution autorisée, sans risque pour la prod.**

### 4.2 Résultat réel

```
Test Files  28 failed (28)
     Tests  no tests
  Duration  8.63s
```

**Aucun test n'a été exécuté** : les 28 fichiers échouent tous **à l'import**, avant même que leur code ne
s'exécute (donc **zéro risque pour la base**, confirmé par les logs — aucune connexion Postgres n'a même eu
lieu pour 27 des 28 fichiers).

### 4.3 Cause racine identifiée (root cause, haute confiance)

Erreurs typiques :
```
Error: Failed to resolve import "@/collections/access" from "tests/int/access-control.int.spec.ts".
Error: Failed to resolve import "@/app/api/stripe/webhook/route" from "tests/int/stripe-webhook.int.spec.ts".
```
Or ces fichiers **existent bel et bien** sur le disque (vérifié : `src/collections/access.ts`,
`src/app/api/stripe/webhook/route.ts`, `src/app/api/geo/revendeurs/route.ts`, `src/lib/groupes.ts`,
`src/lib/badge.ts`, `src/lib/reseau-hierarchie.ts`, `src/app/api/cron/archiver-evenements/route.ts`, etc.
sont tous présents). Le problème n'est donc **pas un fichier manquant, mais une résolution d'alias `@/*`
cassée pour les fichiers du dossier `tests/`**.

**`tsconfig.json:44-45`** exclut `"tests"` de la config TS depuis le commit `625d550`
(« deploiement », 2026-07-02) :
```diff
   "exclude": [
-    "node_modules"
+    "node_modules",
+    "tests",
+    "src/scripts",
+    "src/seed.ts"
   ]
```
`vitest.config.mts` utilise le plugin **`vite-tsconfig-paths`** (basé sur `get-tsconfig`), qui détermine
quelle config `tsconfig` s'applique à un fichier **en respectant son `include`/`exclude`**. Comme `tests/`
est désormais exclu de `tsconfig.json`, le plugin ne reconnaît plus les fichiers `tests/int/*.spec.ts`
comme appartenant à ce projet TS et **n'applique plus l'alias `@/*` → `./src/*`** pour leurs imports — d'où
les échecs « Does the file exist? » sur des fichiers pourtant réels.

**C'est une régression d'infrastructure de test, présente sans interruption depuis le 2026-07-02 (18
jours), qui invalide `pnpm test:int` dans son intégralité** — probablement jamais relancé avec succès
depuis, sinon elle aurait été détectée immédiatement (100% des suites échouent dès l'import).

→ Fichier fautif : **`tsconfig.json:44-45`** (ligne `"tests"` dans `exclude`).
→ **Agent recommandé : `frontend-builder`** (ou tout agent touchant à la config de tooling/build partagée) —
correctif probable : retirer `"tests"` de `exclude` (et gérer séparément le bruit de typecheck sur
`tests/` si c'était le but initial), ou fournir un `tsconfig.json` dédié sous `tests/` reconnu par
`vite-tsconfig-paths`.

### 4.4 Second problème, indépendant : specs réellement caduques

Même une fois l'alias corrigé, **au moins 2 fichiers referencent du code qui n'existe plus** (confirmé par
recherche directe, indépendamment du bug d'alias) :

- **`tests/int/collections-config.int.spec.ts`** importe `@/collections/Fournisseurs`,
  `@/collections/CategoriesActivite`, `@/collections/OrganisateursEvenements` — **collections PanoramaPub
  supprimées**, remplacées par `Reseauteurs.ts` / `Reseaux.ts` / `Partenaires.ts` / `Categories.ts` dans le
  modèle 3-entités actuel. → **Agent recommandé : `data-architect`.**
- **`tests/int/plan-downgrade.int.spec.ts`**, **`groupes-routes.int.spec.ts`**,
  **`stripe-webhook-groupes.int.spec.ts`**, **`stripe-webhook-idempotence.int.spec.ts`** mockent
  `@/lib/plan-downgrade` (fonction `downgradeUserAndClearFields`) — **module introuvable nulle part dans
  `src/`** (recherche exhaustive infructueuse). → **Agent recommandé : `accounts-and-billing`.**

Ceci confirme l'avertissement déjà présent dans CLAUDE.md §11 : *« Les specs existantes valident
PanoramaPub et sont en partie caduques — à re-spécifier sur le modèle 3 entités »* — mais l'ampleur réelle
(100 % d'échec, cause principale = config et non contenu des specs) n'avait apparemment pas été mesurée
depuis le 2026-07-02.

---

## 5. Tests e2e — ⏭️ SKIPPED (2 raisons cumulées, aucune n'est une régression applicative)

`pnpm test:e2e` a été lancé (avec `EMAILS_DRY_RUN=1 SEED_DEV=true`, serveur `pnpm dev` démarré par
Playwright car le port 3000 était libre). Résultat : **6 échecs explicites + 16 non exécutés**, mais
**aucun n'est imputable au code applicatif** :

1. **Exécutable Chromium introuvable pour la version Playwright pinée.** `package.json` fixe
   `@playwright/test@1.58.2`, qui attend `chromium-1208`. Le cache local
   (`%LOCALAPPDATA%\ms-playwright`) ne contient que `chromium-1223` / `chromium_headless_shell-1223`
   (installés pour une autre version/projet). Erreur : *« Executable doesn't exist at
   .../chromium-1208/chrome-win64/chrome.exe »* sur les 22 tests. → **Environnement local mal aligné avec
   la version pinée**, pas un bug produit. Correctif hors-scope de cet agent : `pnpm exec playwright
   install`.
2. **`PAYLOAD_SECRET` absent de `.env.local`** (confirmé : aucune ligne `PAYLOAD_SECRET=` dans le fichier).
   Contrairement à Stripe (`getStripe()` lazy) et Resend (fallback `|| ''`), **Payload valide lui-même que
   `secret` est non-vide au moment de `getPayload()`/`.init()`** et lève *« missing secret key »* — ceci a
   fait planter le rendu SSR de la page d'accueil dans les logs du `[WebServer]` (`payloadInitError: true`,
   `src/app/(frontend)/page.tsx:93`). **Ce n'est pas couvert par la clause CLAUDE.md sur Stripe/Resend** (qui
   ne s'applique pas à `PAYLOAD_SECRET`) : c'est un vrai trou de configuration locale, distinct des clés
   Stripe/Resend absentes normalement. → Pas un défaut de code, mais un `.env.local` incomplet pour un run
   e2e local complet. Aucune action corrective effectuée (garde-fou : pas de modification d'environnement).

**Conséquence :** impossible de statuer sur la santé fonctionnelle réelle des parcours e2e (accueil, login,
inscription, garde d'auth `/dashboard`, panneau admin) tant que ces deux prérequis d'environnement ne sont
pas réunis. Marqué **SKIPPED**, pas compté comme FAIL, conformément aux instructions.

### Confirmation absence de données de test résiduelles

`tests/e2e/admin.e2e.spec.ts` utilise `tests/helpers/seedUser.ts` (crée/supprime `dev@payloadcms.com`).
Le run a échoué avant/pendant ce cycle et **`cleanupTestUser()` a lui-même échoué** (même cause :
`PAYLOAD_SECRET` manquant) — risque théorique de résidu. **Vérifié explicitement en lecture seule** (voir
§6) : **`RESULT_COUNT=0`** — aucun utilisateur `dev@payloadcms.com` présent dans la base réelle. Aucune
donnée de test ne subsiste.

---

## 6. Build — ⏭️ SKIPPED (conforme aux instructions)

`pnpm build` **non lancé**, conformément à la consigne explicite : il déclenche `migrate-safe.ts` puis
`next build`, et `migrate-safe` exécute des migrations sur la base Neon partagée avec la prod. Le
typecheck (§2, PASS) couvre la validité de compilation TypeScript sans ce risque.

---

## 7. Intégrité de l'environnement (garde-fous)

- **Aucune modification de code applicatif ni de tests.** Seuls des fichiers de log/scratch ont été créés,
  hors du dépôt (`C:\Users\...\scratchpad\`), à l'exception d'un script diagnostic temporaire :
  **`qa-check-leftover-tmp.ts`** créé à la racine du dépôt pour vérifier en **lecture seule**
  (`payload.find`, aucune écriture) l'absence de résidu de test après l'échec de `cleanupTestUser()`
  (§5) — **supprimé immédiatement après vérification** ; `git status` confirme qu'aucune trace ne subsiste.
- **Aucun commit, aucun seed/purge/migrate** sur la base Neon.
- **Base partagée non modifiée** : la seule requête réelle exécutée contre la base (hors le diagnostic
  ci-dessus) était `payload.find({collection:'users'})` dans `api.int.spec.ts` — mais celui-ci n'a **jamais
  atteint la base** (l'exécution a échoué à l'import, avant tout appel réseau).
- **Processus orphelin nettoyé** : le serveur `pnpm dev` lancé par Playwright (`webServer`) est resté actif
  sur le port 3000 après l'échec du run e2e (PID `node.exe` détecté en écoute) ; il a été arrêté
  (`taskkill`) pour ne laisser aucun processus résiduel.
- Git status affiche par ailleurs des fichiers modifiés **sans rapport avec cette session**
  (`docs/INSTALLATION-DEPLOIEMENT.md`, `public/img/logo.png`, `public/llms.txt`,
  `src/app/opengraph-image.tsx`) — non touchés par les commandes exécutées ici (aucune commande de la
  chaîne de vérification n'écrit dans ces fichiers) ; probablement des modifications de travail en cours
  de l'utilisateur, préexistantes à cette session.

---

## 8. Synthèse par priorité

### 🔴 Critique (bloque le gate)
1. **`tsconfig.json:44-45`** — `"tests"` dans `exclude` casse la résolution d'alias `@/*` pour
   `vite-tsconfig-paths` → **100 % de `pnpm test:int` en échec depuis le 2026-07-02**, aucun test exécuté,
   couverture métier actuellement **nulle** en intégration (rôles/propriété, monétisation, géo-filtrage,
   badges — tout ce que CLAUDE.md §11 exige de tester). **Agent : `frontend-builder`.**
2. **2 erreurs ESLint bloquantes** (`GroupePromoCodeInput.tsx:73`, `PlanChangeConfirmModal.tsx:145`) dans
   des composants de billing, potentiellement branchés sur des flux déjà retirés/remplacés (licences
   ADR-0015, `change-plan` 410 Gone ADR-0016). **Agent : `accounts-and-billing`.**

### 🟡 Important
3. Specs int genuinement caduques (`collections-config.int.spec.ts`, `plan-downgrade.int.spec.ts` et
   dépendants) référençant des collections/modules PanoramaPub supprimés — à re-spécifier sur le modèle
   3-entités une fois le point 1 corrigé. **Agents : `data-architect`, `accounts-and-billing`.**
4. Environnement e2e local incomplet : `PAYLOAD_SECRET` absent de `.env.local` (fait planter le SSR même
   hors Stripe/Resend) + cache Playwright désaligné avec la version pinée (`chromium-1208` attendu,
   `1223` installé). Empêche toute vérification e2e réelle en local. **Pas d'agent produit — action
   d'environnement/tooling.**

### 🟢 Mineur
5. 95 warnings ESLint, dont ~15 `@ts-nocheck` sur des fichiers de production (collections, routes géo,
   composants carte) qui masquent silencieusement d'éventuelles erreurs de type. **Agents :
   `data-architect` (collections), `map-engineer` (cartes).**

---

## 9. Verdict

## 🔴 BLOCK

**Bloquants :**
- `pnpm test:int` : 0/28 suites exécutables (régression d'infrastructure `tsconfig.json`, 18 jours sans
  détection) — la couverture d'intégration métier est actuellement **invisible**, pas seulement dégradée.
- `pnpm lint` : 2 erreurs bloquantes dans des composants de billing.

**Non bloquant mais à traiter :** tests e2e non vérifiables en l'état (environnement local incomplet),
specs int à re-spécifier sur le modèle 3-entités une fois l'alias corrigé.

**Prochaine action recommandée :**
1. `frontend-builder` — retirer `"tests"` de `tsconfig.json` `exclude` (ou fournir une config dédiée pour
   `vite-tsconfig-paths`) puis **relancer `pnpm test:int`** pour obtenir un vrai signal (probable qu'une
   partie des 28 suites passe une fois l'alias réparé ; l'autre partie nécessitera une re-spécification —
   voir §4.4).
2. `accounts-and-billing` — corriger les 2 erreurs `react-hooks/set-state-in-effect` et clarifier si
   `GroupePromoCodeInput`/`PlanChangeConfirmModal` sont encore des parcours actifs post-ADR-0015/0016 ou
   du code mort à retirer.
3. Une fois (1) et (2) faits, relancer ce contrôle de santé complet, puis envisager `pnpm test:e2e` avec
   `PAYLOAD_SECRET` renseigné et `pnpm exec playwright install` exécuté.
