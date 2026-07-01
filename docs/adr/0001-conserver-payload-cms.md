# ADR-0001 — Conserver Payload CMS comme couche d'accès Postgres (écart assumé vs Prisma)

- **Statut :** Accepté (décision humaine validée en amont de la phase 2)
- **Date :** 2026-06-23
- **Décideurs :** Humain (product/tech owner) + `solution-architect`
- **Portée :** transverse (toute la couche d'accès données)

## Contexte

Le `CLAUDE.md` (§4) liste **Prisma** comme couche d'accès Postgres cible. L'audit (phase 1) établit que l'existant **PanoramaPub.fr** n'utilise pas Prisma mais **Payload CMS 3.80** sur l'adaptateur officiel `@payloadcms/db-postgres` (Drizzle sous le capot), avec :

- 12 collections déjà modélisées (`src/payload.config.ts:71`) ;
- ~35 migrations SQL versionnées avec `up`/`down`, `push:false` (`payload.config.ts:82-85`, `src/migrations/`) ;
- l'admin `/admin` auto-généré (back-office gratuit) ;
- l'auth native (JWT, verify email, lockout, reset — `collections/Users.ts:30-50`) ;
- les hooks métier (géocodage, slugs, ownership, emails, cleanup média) attachés aux collections ;
- access control par collection ET par champ (`collections/access.ts`, `Fournisseurs.ts:96-116`).

Le verdict d'audit est **REFACTOR_IN_PLACE** (3.94/5). La question n'est pas « refactorer ou reconstruire » mais « réutiliser ou réaligner in place ».

Migrer vers Prisma signifierait : réécrire le schéma, perdre l'admin auto-généré, réimplémenter l'auth (vers Auth.js/Lucia), réécrire tous les hooks métier comme du code applicatif, recréer toute la chaîne de migrations, et re-tester ~39k LOC. C'est un **quasi-rebuild** déguisé, pour un gain fonctionnel nul (Postgres reste Postgres dans les deux cas).

## Décision

**On conserve Payload CMS + `@payloadcms/db-postgres` comme couche d'accès Postgres standardisée et unique du projet.** Payload **est** l'ORM/back-office/auth du projet. Le `CLAUDE.md` est amendé sur ce point : « Prisma » est interprété comme « accès Postgres standardisé et typé » — exigence satisfaite par Payload + l'adaptateur Drizzle.

Conséquences pratiques :

- Tout accès données passe par l'API Payload (`getPayload({ config })` + `find/findByID/create/update/count`) ou les routes REST/GraphQL auto-générées. **Aucun SQL applicatif concaténé** (l'audit confirme : 0 requête concaténée hors migrations).
- Les évolutions de schéma se font par **migrations Payload versionnées** (`src/migrations/`), jamais par `push`.
- Le seul SQL brut autorisé est dans les migrations (DDL statique), et — nouveauté apportée par ADR-0002 — dans la **route géo PostGIS dédiée** via `payload.db.drizzle` / `sql` paramétré.

## Conséquences

**Positives :**

- On préserve ~39k LOC testées, l'admin, l'auth, les hooks, les migrations, la chaîne Stripe et le SEO sans réécriture.
- Une seule source de vérité pour le schéma (collections → types générés `src/payload-types.ts`).
- Validation Zod côté serveur conservée dans les routes API (cf. `geo/evenements/route.ts:11`), en complément des hooks Payload.

**Négatives / dette assumée :**

- **Framework lock-in Payload** : la logique métier est couplée aux hooks de collections. Mitigation déjà en place : la logique pure (quotas, dates, géocodage, SEO) vit dans `src/lib/*` et est testée à part — les hooks ne font qu'orchestrer.
- Payload pilote le DDL ; les colonnes spatiales PostGIS (ADR-0002) sortent du modèle de champs Payload et doivent être gérées par migration manuelle + déclenchées par un hook applicatif. Couplage à documenter pour `data-architect`.

## Alternatives écartées

1. **Migrer vers Prisma (littéralité du CLAUDE.md).** Écartée : quasi-rebuild, perte de l'admin/auth/hooks, zéro gain fonctionnel, risque élevé. Contraire au verdict REFACTOR_IN_PLACE.
2. **Coexistence Payload + Prisma sur la même base.** Écartée : deux sources de vérité du schéma, deux chaînes de migration concurrentes, risque de divergence — complexité sans bénéfice.
3. **Drizzle « à nu » (exposer l'adaptateur sous-jacent).** Écartée pour l'accès général : on perdrait l'admin et l'access control. Drizzle est néanmoins utilisé ponctuellement et de façon contrôlée pour la requête spatiale (ADR-0002).
