# INSTALLATION & DÉPLOIEMENT — RÉSEAUTEURS

> Guide d'installation **locale** et de **déploiement** (Vercel + Neon).
> Stack : Next.js 16 (App Router) · Payload CMS 3.80 · PostgreSQL **Neon + PostGIS** · Stripe · Resend ·
> Vercel Blob · MapLibre/OSM. Gestionnaire de paquets : **pnpm**.
>
> ⚠️ Voir aussi `docs/qa/PASSE-OUTILLEE.md` (vérifications avant 1ère mise en prod) et les issues GitHub
> #1 (passe outillée) / #2 (pages légales + tarifs).

---

## 1. Prérequis

| Outil | Version | Note |
|---|---|---|
| **Node.js** | `^18.20.2` ou `>=20.9.0` | `node:20` recommandé |
| **pnpm** | `^9` ou `^10` (projet épinglé `10.32.1`) | `corepack enable && corepack prepare pnpm@10.32.1 --activate` |
| **Git** | — | racine du dépôt = `C:\dev` (monorepo, voir §5) |

**Comptes/services (prod et idéalement dev) :**
- **Neon** (PostgreSQL serverless avec PostGIS) — via l'intégration Vercel ou direct.
- **Vercel** (hébergement + Blob + Crons).
- **Stripe** (3 produits B2B) — clés test pour le dev.
- **Resend** (emails transactionnels + webhook).
- *(optionnel dev)* **Stripe CLI** pour rejouer les webhooks en local.

---

## 2. Variables d'environnement

Copier `.env.example` → **`.env.local`** (dev) ; en prod, les définir dans **Vercel → Settings → Environment
Variables**. **Ne jamais committer** `.env*`.

| Variable | Obligatoire | Rôle |
|---|:---:|---|
| `DATABASE_URI` | ✅ | Chaîne Neon PostgreSQL (⚠️ nom = `DATABASE_URI`, pas `DATABASE_URL`). `?sslmode=require` en prod. |
| `PAYLOAD_SECRET` | ✅ | Secret JWT/sessions, **min. 32 caractères** (`openssl rand -base64 32`). |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `http://localhost:3000` en dev ; `https://reseauteurs.fr` en prod. |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | ✅ | `sk_test_`/`pk_test_` en dev, `..._live_` en prod. |
| `STRIPE_RESEAU_PARTENAIRE_PRICE_ID` | ✅ | Produit 1 — abonnement annuel réseau partenaire. |
| `STRIPE_EVENEMENT_PREMIUM_PRICE_ID` | ✅ | Produit 2 — paiement ponctuel événement Premium. |
| `STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID` | ✅ | Produit 3 — abonnement partenaire annonceur. |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_…` (Stripe Dashboard › Webhooks, ou `stripe listen` en dev). |
| `BLOB_READ_WRITE_TOKEN` | ✅ (prod) | Vercel Blob (stockage médias). |
| `RESEND_API_KEY` | ✅ | Envoi d'emails. |
| `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO_EMAIL` | ✅ | Expéditeur / Reply-To. |
| `RESEND_WEBHOOK_SECRET` | ⬜ | Signature webhook Resend (suivi délivrabilité). |
| `CRON_SECRET` | ✅ (prod) | Protège les endpoints `/api/cron/*` (header envoyé par Vercel Cron). |
| `SITE_PROTECTION_ENABLED` | ⬜ | `true` pour verrouiller le site en Basic Auth (staging). **`false` en prod.** |
| `SITE_PROTECTION_USER` / `SITE_PROTECTION_PASSWORD` | ⬜ | Identifiants Basic Auth si activé. |
| `NEXT_PUBLIC_MAPLIBRE_STYLE` | ⬜ | Style de tuiles custom (sinon OSM par défaut). Géocodage = data.gouv (sans clé). |

> Les 3 `..._PRICE_ID` Stripe sont à créer dans Stripe (cf. issue #2 pour la grille tarifaire chiffrée).

---

## 3. Installation locale

```bash
# 1. Récupérer le code (voir §5 pour la structure monorepo)
#    Le projet vit dans le sous-dossier infos-reseaux/ du dépôt.
cd infos-reseaux

# 2. Activer pnpm et installer
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install

# 3. Configurer l'environnement
cp .env.example .env.local
#   → renseigner au minimum DATABASE_URI, PAYLOAD_SECRET, NEXT_PUBLIC_SITE_URL,
#     et les clés Stripe test si tu testes la monétisation.

# 4. Générer les types Payload (après toute modif de collection)
pnpm generate:types

# 5. Appliquer les migrations (crée PostGIS + le schéma 3 entités)
pnpm payload migrate

# 6. (optionnel) Seed de données de dév : 8 réseauteurs, 6 événements (2 Premium),
#    5 réseaux, 2 partenaires → les 2 cartes ne sont pas vides
pnpm exec tsx src/scripts/seed-dev.ts

# 7. Lancer le serveur de dev (http://localhost:3000)
pnpm dev
#   Admin Payload : http://localhost:3000/admin
```

> `pnpm devsafe` relance en purgeant le cache `.next` si l'admin ou le HMR se comporte mal.

---

## 4. Base de données (Neon + PostGIS)

L'app **exige PostGIS** (colonnes `geom geography(Point,4326)`, index GiST, `ST_DWithin`). Deux options pour le dev :

**Option A — branche Neon (recommandée, identique à la prod)**
1. Dashboard Neon → **Branches → Create branch from `main`**.
2. Copier la connection string dans `DATABASE_URI` de `.env.local`.
3. PostGIS est activé par la 1ère migration (`CREATE EXTENSION postgis`) — l'utilisateur Neon a les droits.

**Option B — PostgreSQL local avec PostGIS (Docker)**
```bash
docker run --name reseauteurs-db -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=reseauteurs \
  -p 5432:5432 -d postgis/postgis:16-3.4
# puis : DATABASE_URI=postgresql://postgres:dev@localhost:5432/reseauteurs
```
> Le `docker-compose.yml` du repo lance **l'app Node** (pas Postgres) — la DB reste sur Neon par défaut.

### Migrations
- Appliquer : `pnpm payload migrate`
- Annuler la dernière : `pnpm payload migrate:down`
- **Le build exécute automatiquement les migrations en attente** (`src/scripts/migrate-safe.ts`) avant `next build` → en prod Vercel, le déploiement migre tout seul.
- Après modif de schéma : `pnpm generate:types` (régénère `src/payload-types.ts`).
- ⚠️ **Jamais** jouer le `down()` de `20260623_120000` sur des données réelles (`TRUNCATE reseaux CASCADE`). Pour un rollback prod : **restauration d'un snapshot Neon**. Procédure dry-run/rollback détaillée : `MIGRATION.md §8`.

---

## 5. ⚠️ Structure du dépôt (monorepo)

La racine git est **`C:\dev`** et contient plusieurs projets ; RÉSEAUTEURS vit dans **`infos-reseaux/`**.
Conséquences :
- **En local** : travailler depuis `infos-reseaux/` (toutes les commandes pnpm).
- **Sur Vercel** : régler **Settings → Build & Development → Root Directory = `infos-reseaux`** (sinon Vercel ne trouve ni `package.json` ni le code).
- Le remote `origin` = `github.com/agathe-next-impact/reseauteurs` suit ce dépôt ; ne committer/pousser que le sous-arbre `infos-reseaux/` pour cette app.

---

## 6. Stripe en local

```bash
# Terminal séparé : relaie les webhooks Stripe vers l'app locale
pnpm stripe:listen          # = stripe listen --forward-to localhost:3000/api/stripe/webhook
#   → copier le whsec_… affiché dans STRIPE_WEBHOOK_SECRET (.env.local)
```
Tester : checkout événement Premium (`checkout.session.completed` → `evenement.premium=true`),
abonnement réseau partenaire (`customer.subscription.updated` → `reseau.partenaire=true`),
expiration (`customer.subscription.deleted` → `reseau.partenaire=false`). Cartes test : `4242 4242 4242 4242`.

---

## 7. Tests, lint, build

```bash
pnpm lint          # ESLint
pnpm generate:types
pnpm test:int      # Vitest (tests d'intégration : rôles B2B, gate partenaire, webhooks, crons)
pnpm test:e2e      # Playwright (parcours)
pnpm build         # migrations + next build (= ce que fait Vercel)
pnpm start         # sert le build de prod en local
```

---

## 8. Déploiement (Vercel)

1. **Importer le repo** GitHub dans Vercel.
2. **Root Directory = `infos-reseaux`** (cf. §5). Framework : Next.js (auto). Install : `pnpm install`. Build : `pnpm build`.
3. **Base de données** : lier l'**intégration Neon** (renseigne `DATABASE_URI`) ou la coller manuellement.
4. **Variables d'environnement** (§2) pour les 3 environnements (Production / Preview / Development). En prod : clés Stripe **live**, `NEXT_PUBLIC_SITE_URL=https://reseauteurs.fr`, `SITE_PROTECTION_ENABLED=false`, `CRON_SECRET` défini.
5. **Vercel Blob** : créer un store Blob → `BLOB_READ_WRITE_TOKEN`.
6. **Webhook Stripe (prod)** : Dashboard Stripe → Webhooks → endpoint `https://reseauteurs.fr/api/stripe/webhook` → reporter `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
7. **Webhook Resend (optionnel)** : endpoint `/api/...` + `RESEND_WEBHOOK_SECRET`.
8. **Domaine** : ajouter `reseauteurs.fr` (et `www` → redirige vers l'apex).
9. **Déployer** : le build applique les migrations en attente automatiquement (`migrate-safe.ts`). ⚠️ Avant le **1er** déploiement prod, prendre un **snapshot Neon** et faire un dry-run des migrations sur une branche (cf. `MIGRATION.md §8` + issue #1).

### Crons (Vercel — définis dans `vercel.json`)
| Endpoint | Planification | Rôle |
|---|---|---|
| `/api/cron/archiver-evenements` | `0 1 * * *` | Archive les événements passés |
| `/api/cron/downgrade-expires` | `0 2 * * *` | Expire les statuts partenaire/abonnements (maxDuration 300s) |
| `/api/cron/purge-anciens` | `0 3 * * *` | Purge RGPD |
| `/api/cron/retry-groupe-sync` | `0 4 * * 1` | **Dormant** (ADR-0009) |
| `/api/cron/expiration-alertes` | `0 8 * * *` | Alertes d'expiration |
| `/api/cron/onboarding-emails` | `0 9 * * *` | Emails d'onboarding |

> Tous les crons exigent le header `CRON_SECRET` (Vercel Cron l'injecte). Sans `CRON_SECRET`, ils renvoient 401.

---

## 9. Checklist go-live

- [ ] Build Vercel **vert** (1er vrai build — confirme l'absence d'erreurs de compilation ; cf. issue #1).
- [ ] Migrations jouées (dry-run + rollback testés sur branche Neon, snapshot prod pris).
- [ ] Webhooks **Stripe live** signés et reçus (`evenement.premium`, `reseau.partenaire`).
- [ ] `NEXT_PUBLIC_SITE_URL=https://reseauteurs.fr` · `SITE_PROTECTION_ENABLED=false` · `CRON_SECRET` défini.
- [ ] Domaine `reseauteurs.fr` actif + SSL.
- [ ] **Pages légales** validées par un juriste + grille tarifaire chiffrée (issue #2).
- [ ] Compte **admin** créé (1ère inscription via `/admin`, puis rôle `admin` en base).
- [ ] Référentiels seedés (badges=4, categories=16, types_evenement) et réseaux de référence (BNI, DCF, CJD…).

### Dette résiduelle à nettoyer (non bloquant)
- `vercel.json` `redirects` contient encore une règle `www.panorama-pub.com` → mettre à jour vers `reseauteurs.fr` (les 301 legacy actives sont dans `next.config.ts`).
- `package.json` : `name` = `panorama-pub`, `description` = template Payload → rebrander.
- `mapbox-gl` encore dans les dépendances (les nouvelles cartes utilisent `maplibre-gl`) → retirer après vérif (`pnpm remove mapbox-gl`).
- Lever les `@ts-nocheck` (`Reseauteurs.ts`, `Reseaux.ts`, composants carte) après `generate:types` (issue #1).

---

## 10. Dépannage

| Symptôme | Cause / solution |
|---|---|
| `type "geography" does not exist` / erreurs géo | PostGIS non activé → rejouer `pnpm payload migrate` (la 1ère migration crée l'extension) ; vérifier les droits Neon. |
| Connexion DB échoue | Vérifier le **nom** `DATABASE_URI` (≠ `DATABASE_URL`) et `?sslmode=require`. |
| Vercel : « No Next.js detected » | **Root Directory** non réglé sur `infos-reseaux` (§5). |
| Webhooks Stripe en 400 | `STRIPE_WEBHOOK_SECRET` incorrect (régénéré par `stripe listen` à chaque session). |
| Crons en 401 | `CRON_SECRET` manquant côté Vercel. |
| Admin Payload cassé après modif schéma | `pnpm generate:types` puis `pnpm devsafe`. |

---

### Renvois
`MIGRATION.md` (stratégie migration/rollback) · `docs/qa/PASSE-OUTILLEE.md` (vérifs pré-prod) ·
`docs/qa/REVIEW-2026-06-29.md` (gate QA) · `ARCHITECTURE.md` · `CLAUDE.md` (modèle produit, ADR-0011).
