# AUDIT — Abonnement & droits PanoramaPub.fr

## Mission

Tu es auditeur senior mandaté pour un audit **rigoureux et non complaisant** du système d'abonnement de PanoramaPub.fr (annuaire B2B, Next.js 16 + Payload CMS 3 + Stripe). Objectif : produire un rapport actionnable couvrant **UX, qualité fonctionnelle, fonctionnement global/spécifique, bonnes pratiques, technique et sécurité**. Couverture maximale, zéro angle mort, ton factuel.

Tu dois :

1. Cartographier le périmètre (Phase 1 du workflow)
2. Exécuter l'audit statique + tests actifs locaux
3. Livrer un rapport markdown structuré dans [audits/abonnement-YYYY-MM-DD.md](audits/)

## Contexte projet

- **Stack** : Next.js 16.2 App Router (TS strict), Payload CMS 3.80, PostgreSQL (Neon), Stripe 20, Vercel Blob, Resend.
- **Modèle freemium 3 plans annuels** : Gratuit (0 €), Premium (99 €/an), Infinite (219 €/an).
- **1 user = 1 fiche** (contrainte stricte, `canCreateFiche`).
- **Groupes d'affiliation** : coupons Stripe mutualisés selon nombre de membres payants (3/5/10+ → 5/10/15 %).
- Détails complets : [CLAUDE.md](CLAUDE.md).

## Périmètre obligatoire (à couvrir exhaustivement)

### A. Paiement Stripe

- [src/lib/stripe.ts](src/lib/stripe.ts) — `PLANS`, `resolvePlanFromPriceId`
- [src/app/api/stripe/checkout/route.ts](src/app/api/stripe/checkout/route.ts) — création session, coupon groupe projeté
- [src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts) — idempotence (`stripe-events`), HMAC, 5 event types
- [src/app/api/stripe/cancel/route.ts](src/app/api/stripe/cancel/route.ts)
- [src/app/api/stripe/reactivate/route.ts](src/app/api/stripe/reactivate/route.ts)
- [src/components/dashboard/PlanCheckoutButton.tsx](src/components/dashboard/PlanCheckoutButton.tsx)
- [src/components/dashboard/CancelSubscriptionButton.tsx](src/components/dashboard/CancelSubscriptionButton.tsx)
- [src/components/dashboard/ReactivateButton.tsx](src/components/dashboard/ReactivateButton.tsx)
- [src/app/(frontend)/dashboard/abonnement/page.tsx](<src/app/(frontend)/dashboard/abonnement/page.tsx>)

### B. Droits / plans effectifs

- [src/collections/access.ts](src/collections/access.ts) — `getEffectiveFeatureLevel`, `isPremiumOrAbove`, `isInfinite`, `getFreshUser`, `canCreateFiche`
- [src/collections/Users.ts](src/collections/Users.ts) — `beforeChange` protection champs sensibles, `saveToJWT: true` sur `plan`
- [src/collections/Fournisseurs.ts](src/collections/Fournisseurs.ts) — `DESCRIPTION_WORD_LIMITS`, `ILLUSTRATIONS_LIMITS`, field-level access
- [src/collections/Evenements.ts](src/collections/Evenements.ts) — création réservée `infinite` effectif, quota 10 actifs

### C. Groupes & coupons

- [src/collections/Groupes.ts](src/collections/Groupes.ts) — génération code `GRP-XXXXXX`
- [src/lib/groupes.ts](src/lib/groupes.ts) — `calculerPalierGroupe`, `palierProjeteAvecUtilisateurPayant`, `recalculerEtAppliquerPalier`
- [src/app/api/groupes/create/route.ts](src/app/api/groupes/create/route.ts)
- [src/app/api/groupes/join/route.ts](src/app/api/groupes/join/route.ts)
- [src/app/api/groupes/leave/route.ts](src/app/api/groupes/leave/route.ts)
- [src/components/dashboard/GroupeCreateForm.tsx](src/components/dashboard/GroupeCreateForm.tsx)
- [src/components/dashboard/GroupeJoinForm.tsx](src/components/dashboard/GroupeJoinForm.tsx)
- [src/components/dashboard/GroupeMemberView.tsx](src/components/dashboard/GroupeMemberView.tsx)
- [src/app/(frontend)/dashboard/groupe/page.tsx](<src/app/(frontend)/dashboard/groupe/page.tsx>)

### D. Cron & expiration

- [src/app/api/cron/downgrade-expires/route.ts](src/app/api/cron/downgrade-expires/route.ts)
- [src/app/api/cron/expiration-alertes/route.ts](src/app/api/cron/expiration-alertes/route.ts)

### E. Sécurité transverse

- [src/lib/rate-limit.ts](src/lib/rate-limit.ts) — sliding window in-memory, `MAX_STORE_SIZE` 10k
- [src/middleware.ts](src/middleware.ts) — auth guard `/dashboard`, `/admin`
- [src/lib/emails.ts](src/lib/emails.ts) — templates paiement/expiration/groupe

## Grille d'évaluation (6 axes)

### 1. UX & parcours

- États vides, états intermédiaires, feedback après action (toasts, redirections)
- Gestion des erreurs côté utilisateur (messages actionnables, pas de stack trace)
- Accessibilité (labels, focus, contrastes, navigation clavier)
- Cohérence des badges/statuts entre `PlanBadge`, dashboard, `/dashboard/abonnement`
- Clarté du flow : signup → checkout → retour → dashboard
- Affichage du palier groupe et du prix avec/sans coupon
- Confirmation avant actions destructives (cancel, leave, delete account)

### 2. Qualité fonctionnelle

- Spécification (`CLAUDE.md`) vs implémentation : écarts ?
- Cas limites couverts : plan expiré, sub Stripe active en parallèle d'un downgrade, priceId inconnu, code groupe invalide, user non-payant tentant de rejoindre un groupe
- Quota 10 événements actifs : enforced côté create ET update ?
- Unicité 1 user = 1 fiche : enforced côté DB ET hook ?
- Field-level access : tentative d'écrire un champ verrouillé par plan → rejet propre ?

### 3. Fonctionnement global (flows bout-en-bout)

Simule et valide chaque flow :

- **F1 subscribe** : signup → checkout premium → paiement → webhook → plan actif → badge + droits
- **F2 upgrade** : premium → checkout infinite → webhook → anciennes subs annulées → plan infinite
- **F3 downgrade cron** : `planExpiresAt` passé → cron 02h00 → user gratuit → palier groupe recalculé → email
- **F4 cancel/reactivate** : cancel_at_period_end → UI montre "annulation prévue" → reactivate avant échéance
- **F5 groupe** : create → invite code → join (payant) → palier recalculé → coupon Stripe appliqué → leave owner → transfert ownership au plus ancien → palier recalculé
- **F6 delete account** : suppression user → subs Stripe annulées ? Fiche / événements orphelins ? Groupe vidé ?

### 4. Bonnes pratiques

- Typage strict (pas de `any` injustifié)
- Validation input : Zod sur toutes les routes POST/PATCH ?
- Usage Local API Payload côté serveur (pas de fetch HTTP interne)
- Logs : pas d'info sensible (tokens, secrets) ; niveau cohérent
- Gestion d'erreur : try/catch aux bons endroits, pas de swallow silencieux
- Nommage, duplication, helpers factorisés

### 5. Technique

- **Performance** : N+1 sur recalc palier (fetch user pour chaque membre), pagination cron
- **Idempotence** : collection `stripe-events` avec UNIQUE sur `eventId` — vérifier que la dedup tient face aux retries Stripe concurrents
- **Cohérence transactionnelle** : Payload ne supporte pas les transactions distribuées → quels sont les états partiels possibles (plan updated mais groupe non recalculé, coupon Stripe appliqué mais `stripeCouponId` non persisté, etc.) ?
- **JWT vs DB** : `plan` est `saveToJWT: true` → JWT stale après webhook. Vérifier que chaque check critique relit depuis la DB via `getFreshUser`
- **Rate limit** : `MAX_STORE_SIZE` 10k avec éviction naïve — contournable ?
- Body size webhook, timeout routes, `maxDuration` Vercel

### 6. Sécurité

- Auth : middleware `/dashboard`, `/admin` — contournable via header forgé ?
- HMAC webhook Stripe : `request.text()` puis `stripe.webhooks.constructEvent` — bien ordonné
- Rate limit : couverture des routes sensibles (Stripe, groupes, account/delete)
- CSRF : routes POST protégées ? (cookies SameSite vs bearer token)
- IDOR : un user peut-il manipuler un `stripeSubscriptionId` qui n'est pas le sien ? Un `groupe.id` ?
- Escalade de privilège : non-admin peut-il changer son `role`, `plan`, `planExpiresAt`, `stripeCustomerId` ?
- PII / RGPD : `billingAddress`, `vatNumber` — accès restreint admin ? Suppression lors du delete account ?
- Enumération : codes groupes, slugs fournisseurs, IDs événements
- Token unsubscribe email : expiration ? rotation ?

## Points à investiguer en priorité

Pour chacun, **trancher** : bug confirmé / risque théorique / non-problème, avec preuve.

1. **JWT stale sur `plan`** — le frontend affiche-t-il le plan du JWT ou le plan frais ? Impact après upgrade/downgrade immédiat.
2. **Race conditions subscription** — 2 clics checkout successifs, upgrade en vol pendant un webhook. Vérifier les guards lignes ~135-153 et ~201-206 du webhook.
3. **Rate limit absent** sur `/api/stripe/cancel` et `/api/stripe/reactivate` — DoS possible ?
4. **Rate limit in-memory** — non partagé entre instances Vercel serverless. Éviction à 10k clés : contournement ?
5. **Recalcul palier non atomique** — leave + join concurrents, ou Stripe API down pendant `recalculerEtAppliquerPalier` → palier en BD désynchronisé des coupons réels ?
6. **Transfert ownership sans consent** — `leave/route.ts` choisit le plus ancien membre sans lui demander. Problématique UX/légal ?
7. **Suppression groupe vide** — aucun audit trail, pas de soft-delete.
8. **Illustrations orphelines au downgrade** — user infinite → gratuit garde 6 illustrations en BD ? Nettoyage côté `media-cleanup.ts` ?
9. **Cron downgrade non paginé** — `limit: 0` dans `downgrade-expires`. Risque OOM si 10k+ expirés le même jour.
10. **Alertes expiration double-envoi** — pas de flag `expirationWarningSentJ30/J7` sur Users. Cron rejoué = double email ?
11. **priceId inconnu** (webhook) — log warning mais subscription saved avec plan `null`. Comportement attendu ?
12. **Body size webhook** — pas de cap explicite. Vercel cap par défaut ? OOM possible ?
13. **Token unsubscribe sans expiration** — HMAC signé avec `PAYLOAD_SECRET`, valide à vie. Problématique si leak ?
14. **Access check événements** — confirmer que `getEffectiveFeatureLevel(fresh)` utilise bien le user frais DB et non JWT.

## Méthodologie (obligatoire)

### Phase 1 — Cartographie et audit statique

1. Lire intégralement chaque fichier du périmètre.
2. Tracer les flows bout-en-bout avec chemins d'appel.
3. Cross-check JWT vs DB vs Stripe sur chaque point de droit.
4. Identifier chaque edge case en simulant mentalement (erreur Stripe, double requête, crash mid-webhook, clock skew).
5. Pour chaque finding : citer fichier + n° de ligne.

### Phase 2 — Tests actifs locaux

Prérequis : env local configuré (`.env.local` avec clés Stripe test, DB Neon dev).

1. Lancer en parallèle :
   ```bash
   pnpm devsafe
   pnpm stripe:listen
   ```
2. **Scénarios webhook** à rejouer via `stripe trigger` ou dashboard Stripe test :
   - `checkout.session.completed` (premium, puis infinite)
   - `customer.subscription.updated` : active → canceled, canceled → active (reactivation)
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - **Event dupliqué** (même ID rejoué) → vérifier idempotence via table `stripe-events`
3. **Scénarios dashboard** (navigateur, 2 comptes de test minimum) :
   - Signup → fiche auto-créée en statut `en-attente`
   - Checkout premium → retour `/dashboard/abonnement` → badge + expiration visibles
   - Cancel → UI montre "annulation au…" → Reactivate
   - Compte A crée groupe → récupère le code
   - Compte B (payant) rejoint via code → vérifier palier recalculé en DB + coupon Stripe présent
   - Compte A (owner) leave → transfert ownership vers Compte B
   - Tentative création fiche n°2 sur un compte ayant déjà une fiche → doit échouer
   - Compte gratuit tente d'écrire `siteWeb`, `telephone` → doit échouer field-level
   - Compte premium tente de créer un événement → doit échouer (infinite only)
   - Compte infinite crée 10 événements → le 11e doit échouer
4. **Vérifier logs serveur** pendant chaque scénario : toute erreur silencieuse, warning inattendu, stack trace doit être documenté comme finding.
5. Capturer pour chaque finding reproduisible : commandes exactes, payloads, observations.

## Format du rapport

Fichier : `audits/abonnement-YYYY-MM-DD.md` (remplacer par date du jour).

### Structure

```markdown
# Audit abonnement & droits — YYYY-MM-DD

## Résumé exécutif

- Nombre total de findings par sévérité
- Top 5 critiques (à corriger avant prod / release)
- Top 5 quick wins (effort S, impact élevé)
- Verdict global (prêt prod / bloquant / améliorations recommandées)

## Findings par sévérité

### Critique

### Élevée

### Moyenne

### Faible

### Info
```

### Template d'un finding

```markdown
#### AUD-001 — [Titre concis, une ligne]

- **Sévérité** : Critique | Élevée | Moyenne | Faible | Info
- **Axe** : UX | Fonctionnel | Global | Bonnes pratiques | Technique | Sécurité
- **Fichier** : [src/app/api/stripe/webhook/route.ts:92](src/app/api/stripe/webhook/route.ts#L92)
- **Catégorie** : Bug confirmé | Risque | Amélioration
- **Description** : Ce qui est observé + pourquoi c'est problématique (2-5 lignes, factuel)
- **Reproduction** :
  1. Étape 1
  2. Étape 2
  3. Observation attendue vs réelle
- **Impact** : Données / sécurité / UX / performance (concret)
- **Recommandation** : Fix proposé + pointeur vers code adjacent. Pas de code complet, juste la direction.
- **Effort** : S (<1h) | M (1-4h) | L (>4h)
```

## Contraintes strictes

- **Ne pas inventer** de problèmes hypothétiques non démontrables par le code ou un test.
- **Citer systématiquement** chemin + n° de ligne pour chaque finding (format markdown link cliquable).
- **Distinguer rigoureusement** : bug confirmé (reproduit) / risque (théorique mais plausible) / amélioration (non bloquant).
- **Pas de code fixé** dans le rapport : l'audit recommande, l'implémentation est un travail séparé.
- **Ton factuel**, zéro emoji, phrases complètes.
- **Français** dans tout le rapport.
- **Pas de surestimation** : une typo de label ne mérite pas Critique, une escalade de privilège ne mérite pas Faible.

## Auto-vérification avant rendu

Avant de déclarer l'audit terminé, vérifier :

- [ ] Les 6 axes sont couverts (chaque finding a un axe)
- [ ] Les 14 points prioritaires ont chacun une conclusion explicite (bug / risque / non-problème)
- [ ] Tous les fichiers du périmètre ont été lus et analysés
- [ ] Les 6 flows bout-en-bout (F1-F6) ont été simulés ou testés
- [ ] Au moins une partie des scénarios webhook a été rejouée localement
- [ ] Chaque finding cite fichier + ligne
- [ ] Top 5 critiques et top 5 quick wins distincts dans le résumé
- [ ] Aucun finding avec sévérité "Critique" sans scénario de reproduction concret
