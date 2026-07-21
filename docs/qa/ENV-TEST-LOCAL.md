# Environnement de test local (base docker) — débloque `api` + e2e

> Provisionné le 2026-07-21. Permet d'exécuter les tests qui exigent une **vraie** base
> Payload (`api.int.spec.ts`, tous les `tests/e2e/**`) contre une **base PostgreSQL/PostGIS
> locale jetable**, **jamais** contre la base Neon partagée avec la prod.

## Principe

- La prod utilise Neon. La suite d'intégration « pure » (`pnpm test:int`) mocke `payload` et
  ne touche aucune base — elle tourne sans rien provisionner.
- Deux catégories exigent une vraie base + un `PAYLOAD_SECRET` : `api.int.spec.ts` (bootstrap
  Payload réel) et **tous les e2e** (le serveur `next dev` fait du SSR via Payload).
- On les fait tourner contre le service `postgres` de [`docker-compose.yml`](../../docker-compose.yml)
  (image `postgis/postgis:16-3.4-alpine`), **isolé de Neon**. Le fichier **`.env.test`**
  (gitignoré) porte l'URI locale + un secret de test. Il ne doit **jamais** contenir l'URL Neon.

## Mise en route (une fois)

```bash
# 1. Démarre la base locale (Docker Desktop doit tourner)
pnpm run test:local:db

# 2. Applique les migrations sur la base locale (DATABASE_URI forcée en localhost)
pnpm run test:local:migrate
#    (ou en un coup : pnpm run test:local:setup)

# 3. Navigateur Playwright épinglé (une fois par machine)
pnpm exec playwright install chromium
```

`.env.test` (déjà créé, gitignoré) :

```
DATABASE_URI=postgresql://postgres:dev@localhost:5432/reseauteurs
PAYLOAD_SECRET=test-secret-reseauteurs-local-e2e
SEED_DEV=true
EMAILS_DRY_RUN=1
```

## Lancer les tests

```bash
pnpm run test:int:local   # suite d'intégration + api.int.spec.ts (contre la base locale)
pnpm run test:e2e:local   # e2e Playwright (démarre son propre next dev sur la base locale)
```

Les scripts `:local` chargent `.env.test` via `DOTENV_CONFIG_PATH` (repris par le
`import 'dotenv/config'` de `vitest.setup.ts` et `playwright.config.ts`). Comme `next dev`
hérite de `process.env`, `DATABASE_URI` (localhost) prime sur le `DATABASE_URL` (Neon) de
`.env.local`, et `PAYLOAD_SECRET` est fourni — le SSR ne plante plus sur « missing secret key ».

## Garde-fous

- **Ne jamais** pointer `.env.test` / `DATABASE_URI` vers Neon. `withExplicitSslMode` ne force
  le SSL que sur les URLs `neon` ; localhost tourne sans SSL.
- `api.int.spec.ts` ne s'exécute que si `PAYLOAD_SECRET` est présent **et** `DATABASE_URI`
  pointe sur `localhost`/`127.0.0.1` (gate `describe.skipIf`) ; sinon il skippe. Donc
  `pnpm test:int` (sans base locale) reste sûr et ne touche jamais Neon.
- Base jetable : `docker compose down -v` supprime le volume si on veut repartir propre.

## Détail des scripts (`package.json`)

| Script | Rôle |
|---|---|
| `test:local:db` | `docker compose up -d postgres` |
| `test:local:migrate` | applique les migrations sur la base locale (URI/secret forcés) |
| `test:local:setup` | db + migrate enchaînés |
| `test:int:local` | vitest avec `.env.test` |
| `test:e2e:local` | playwright avec `.env.test` |
