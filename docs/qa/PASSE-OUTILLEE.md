# PASSE OUTILLÉE — RÉSEAUTEURS (à exécuter avec environnement complet)

> Checklist **ordonnée** des vérifications/nettoyages qui **nécessitent `node_modules` + compilateur + DB**
> (impossibles en mode code-prep). Découle de `docs/qa/REVIEW-2026-06-29.md` (section « non vérifiable »).
> Owner : humain + agents lors de la phase outillée. **À exécuter top → bottom.**

## 0. Prérequis
- `node_modules` installés (`pnpm install` / `yarn`).
- `DATABASE_URL` vers une **branche Neon de copie** (jamais la prod directement — cf. `MIGRATION.md §6/§8`).
- Clés **Stripe test** + secret webhook ; `RESEND_API_KEY` ; variables d'env complètes (`.env`).
- Snapshot/PITR Neon pris avant tout run prod.

## 1. Compilation & types
- [ ] `pnpm generate:types` (régénère `src/payload-types.ts` depuis les collections du modèle 3 entités).
- [ ] **Lever les `@ts-nocheck`** et corriger les erreurs réelles dans : `src/collections/Reseauteurs.ts`, `src/collections/Reseaux.ts`, et les composants carte qui en portent un.
- [ ] `pnpm tsc --noEmit` puis `pnpm lint` → **0 erreur**.
- [ ] `pnpm build` → build vert. (⚠️ Un bug de build — guillemets typographiques dans `inscription/page.tsx` — a été trouvé et corrigé à la main faute de build en code-prep ; ce build doit confirmer qu'il n'en reste pas d'autres.)

## 2. Nettoyage outillé (sûr seulement avec compilateur)
- [ ] **M-1** : re-spécifier `tests/int/collections-config.int.spec.ts` sur le modèle 3 entités, **puis** supprimer `src/collections/Fournisseurs.ts` et `src/collections/OrganisateursEvenements.ts` (aujourd'hui importés uniquement par ce test caduc).
- [ ] Supprimer les fonctions dépréciées de `src/collections/access.ts` (`getEffectiveFeatureLevel`, `isPremium*`, `isInfinite`, `canCreateFiche`…) une fois qu'aucun fichier vivant ne les importe (vérifier par grep + compilateur).
- [ ] Confirmer qu'aucun import résiduel vers les builders JSON-LD legacy retirés (I-10) ne subsiste (le build le détecterait).

## 3. Migrations (sur copie Neon — cf. MIGRATION.md §8)
- [ ] `yarn payload migrate` sur la copie → succès.
- [ ] Rejouer **2×** → idempotence (aucune divergence).
- [ ] `yarn payload migrate:down` puis re-`migrate` → rollback testé.
- [ ] ⚠️ **Ne jamais** jouer le `down()` de `20260623_120000` (`TRUNCATE reseaux CASCADE`) sur des données réelles.

## 4. Vérifications SQL post-migration
```sql
SELECT COUNT(*) FROM badges;        -- attendu : 4
SELECT COUNT(*) FROM categories;    -- attendu : 16
SELECT role, COUNT(*) FROM users GROUP BY role;            -- reseauteur/organisateur/admin
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';      -- présent
SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%';
-- Index GiST réellement utilisés :
EXPLAIN ANALYZE SELECT id FROM reseauteurs
  WHERE geom && ST_MakeEnvelope(2.2,48.8,2.4,48.9,4326)::geography;   -- doit viser reseauteurs_geom_gist_idx
EXPLAIN ANALYZE SELECT id FROM evenements
  WHERE geom && ST_MakeEnvelope(2.2,48.8,2.4,48.9,4326)::geography;   -- doit viser evenements_geom_gist_idx
```

## 5. Monétisation B2B (Stripe test)
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- [ ] `checkout.session.completed` (événement Premium one-shot) → `evenement.premium = true`.
- [ ] `customer.subscription.updated` (réseau partenaire actif) → `reseau.partenaire = true` + `partenaireExpireAt`.
- [ ] `customer.subscription.deleted` (ou cron `downgrade-expires`) → `reseau.partenaire = false`.
- [ ] **Double verrou** : un réseau non-partenaire **ne peut pas** publier d'événement (refus serveur, message FR) — hook `Evenements.beforeValidate` + server action.
- [ ] **B-1** régression : un compte `reseauteur` **ne peut pas** POST `/api/reseaux` (403/refus).
- [ ] Idempotence webhooks (`StripeEvents` UNIQUE) : rejouer un même `eventId` → ignoré.
- [ ] Customer Portal + factures PDF OK.

## 6. SEO & RGPD
- [ ] Rich Results test : fiche réseauteur (`Person`), événement (`Event`, `organizer`=réseau), réseau (`Organization`).
- [ ] Échappement XSS du JSON-LD préservé (`JSON.stringify`, pas d'interpolation).
- [ ] Profil `statut=en_attente` → `<meta name="robots" content="noindex">` présent + **absent du sitemap**.
- [ ] Opt-out réseauteur → exclu du sitemap + `noindex`.
- [ ] Collision de slug : 2 homonymes → `<prenom-nom>-<ville>` puis `-2/-3`, **jamais `Date.now()`**.
- [ ] URLs legacy → **301** (`/revendeurs*`, `/organisateurs/*`, `/evenements/:slug`, `/faq-revendeurs`).

## 7. Parcours bout-en-bout (staging)
- [ ] Visiteur : carte → fiche → « voir le profil » / « s'inscrire » (lien externe).
- [ ] Organisateur : abonnement partenaire → fiche réseau → publier un événement → le passer Premium.
- [ ] Réseauteur : inscription gratuite → profil → apparaît sur la carte (après modération).

## 8. Gate 3 (humain)
- [ ] Tests verts (suite re-spécifiée 3 entités). ▸ Merge autorisé / déploiement.
- [ ] Faire **valider les pages légales par un juriste** (réécriture B2B faite, validation pro requise).
- [ ] Trancher la grille tarifaire B2B chiffrée (CGV laissées en « grille en vigueur »).
