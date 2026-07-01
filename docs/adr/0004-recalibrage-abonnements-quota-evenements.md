# ADR-0004 — Recalibrage des abonnements et quota d'événements par an

> **⚠️ CADUC sur le fond — supersédé par [ADR-0011](0011-plateforme-trois-entites-monetisation-b2b.md) (2026-06-28)** (déjà supersédé par [ADR-0010](0010-bascule-annuaire-professionnels.md) le 2026-06-27).
> Le **quota d'événements/an** et les **trois paliers 90/130/190 €** décrits ci-dessous sont **abandonnés**.
> Sous l'ADR-0011 : **les réseauteurs sont gratuits** ; **aucun quota** ; la monétisation est **B2B** —
> **réseau partenaire** (Subscription annuelle) + **événement Premium** (Checkout one-shot, pas de quota) +
> **partenaire annonceur** (Subscription). Ne **pas** réintroduire de quota ni de palier 90/130/190 €.
> Reste valable : la **plomberie Stripe** (checkout/portal/webhooks idempotents/factures/crons) est conservée
> et **recalibrée** sur les trois produits B2B. **En cas de conflit, l'ADR-0011 prévaut.** Détail :
> `ARCHITECTURE.md §4.6`, `PLAN.md J2.A`.

- **Statut :** ~~Accepté~~ — **caduc (quota + 3 paliers) ; supersédé par ADR-0011**
- **Date :** 2026-06-23 (mise à jour 2026-06-23 après arbitrages)
- **Décideurs :** Humain (product owner) + `solution-architect` (sur recommandation §9.4 de l'audit)
- **Portée :** facturation Stripe, quotas, espace organisateur, schéma
- **Dépend de :** ADR-0001, ADR-0003

> **Arbitrages humains intégrés :**
> - **Aucun client payant à reprendre (résout Q1) :** la migration de données ne traite **que le contenu et les slugs SEO**, **pas** de mapping d'abonnements existants. Il n'y a pas de table de correspondance de plans à décider, pas de risque contractuel/comptable sur des clients en cours. `MIGRATION.md` (data-architect) **ne traite pas la reprise d'abonnements**.
> - **Fenêtre du quota = année glissante (résout Q2) :** rolling 12 mois.
> - **Quota basé sur la création annuelle** (et non le stock à venir) — confirmé par défaut.

## Contexte

Le modèle d'abonnement cible (CLAUDE.md §3) est :

| Formule | Prix (HT, annuel) | Quota événements/an |
|---|---|---|
| Accès | 90 € | jusqu'à 10 |
| Développement | 130 € | 11 à 20 |
| Premium | 190 € | illimité |

L'existant a un modèle **différent** sur deux axes :

1. **Paliers et prix** : `gratuit` / `premium` (99 €) / `infinite` (219 €) (`lib/stripe.ts:28-39`, `collections/Users.ts:459-475`). Les `priceId` Stripe sont en variables d'env (`STRIPE_PREMIUM_PRICE_ID`, `STRIPE_INFINITE_PRICE_ID`).
2. **Nature du quota** : le quota porte sur le **nombre de fiches** (`canCreateFiche` = 1 user = 1 fiche, `access.ts:79-91`), **pas** sur le nombre d'événements. La création d'événement n'est ouverte qu'au niveau `infinite` et est explicitement **illimitée** : `Evenements.ts:236-238` — « Pas de quota d'evenements actifs : nombre illimite ». Les niveaux gratuit/premium ne peuvent tout simplement pas créer d'événement (`Evenements.ts:124-133`).

Le modèle cible inverse la logique : **tout abonné a un (1) réseau**, et c'est le **nombre d'occurrences créées sur l'année** qui est plafonné (10 / 20 / ∞). Le niveau gratuit (visiteur) n'est pas un palier organisateur — un organisateur est par définition payant (CLAUDE.md §2).

**Pas de base d'abonnés à migrer :** il n'existe aucun client payant à reprendre. Le recalibrage est donc une refonte « à blanc » côté facturation (nouveaux produits/prix Stripe, nouvel enum de plan), sans contrainte de rétrocompatibilité sur des souscriptions existantes.

## Décision

**1. Renommer/recalibrer les trois paliers payants** (les valeurs techniques internes peuvent être conservées pour limiter la casse, mais les libellés, prix et quotas changent) :

| Valeur interne (proposée) | Libellé UI | Prix HT/an | Quota occurrences/an |
|---|---|---|---|
| `acces` | Accès | 90 € | 10 |
| `developpement` | Développement | 130 € | 20 |
| `premium` | Premium | 190 € | illimité |

- Mettre à jour `lib/stripe.ts` (`PLANS`, `planLabel`, `resolvePlanFromPriceId`) avec trois prix Stripe **annuels HT** et trois `priceId` en env (`STRIPE_ACCES_PRICE_ID`, `STRIPE_DEVELOPPEMENT_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`).
- Mettre à jour l'enum `Users.plan` (et `getEffectiveFeatureLevel`, `access.ts:12-30`) pour les trois valeurs + l'absence d'abonnement (compte créé non encore payé). Conserver la logique d'expiration `planExpiresAt` (downgrade) telle quelle.
- **Pas de mapping de comptes existants** : aucun client payant à reprendre (arbitrage Q1). Les comptes de test/démo éventuels sont réinitialisés à « sans abonnement » ou traités au cas par cas par l'admin, hors script de migration.

**2. Remplacer le quota « fiches » par un quota « occurrences/an ».** Nouvelle fonction métier (testée, `src/lib`) : `canCreateOccurrence(user)` qui :

- résout le niveau effectif (`getEffectiveFeatureLevel`) ;
- compte les occurrences du réseau du user **créées sur les 12 derniers mois glissants** (fenêtre **rolling 12 mois**, arbitrage Q2) ;
- compare au plafond (`acces`=10, `developpement`=20, `premium`=∞) ;
- est appelée en **hook `beforeChange` create** sur `evenements` (remplace le check `infinite`-only de `Evenements.ts:124-133` et le commentaire `:236-238`), avec message FR clair (« Vous avez atteint votre quota de N événements sur les 12 derniers mois. »).

**3. Le quota porte sur la création** (occurrences `create`) sur la fenêtre glissante, pas sur le stock vivant : une occurrence passée/archivée a consommé un crédit de sa fenêtre. Cela évite le gaming par suppression-recréation.

**4. Conserver intacte toute la plomberie Stripe** : checkout, customer portal, webhooks signés idempotents, change-plan + proration, factures PDF, alertes d'expiration, cron downgrade (`src/app/api/stripe/*`, `lib/plan-downgrade.ts`, crons). Seuls les `priceId` et libellés changent (pas de table de mapping, puisqu'il n'y a pas de base d'abonnés à convertir).

**5. `canCreateFiche` (1 user = 1 réseau)** : conservée comme garde-fou métier (un organisateur = un réseau), cf. ADR-0003 — **contrainte d'unicité DB conservée** (arbitrage Q4, réversible plus tard). La sémantique « palier = nombre de fiches » disparaît au profit de « palier = quota d'occurrences ».

## Conséquences

**Positives :**

- Modèle d'abonnement aligné au CLAUDE.md §3, source de revenu cohérente avec « réseaux-first ».
- Toute l'infra Stripe (la partie la plus risquée à réécrire) est préservée.
- **Pas de risque contractuel/comptable** : aucune base d'abonnés à convertir → recalibrage « à blanc », simple à dérouler.
- Le quota devient testable unitairement (logique pure dans `src/lib`), conforme à l'exigence de tests métier (CLAUDE.md §9).

**Négatives / risques :**

- Nouveaux `priceId` à créer côté Stripe (produits annuels HT) avant tout déploiement — dépendance externe (tâche de mise en production).
- La fenêtre glissante de 12 mois doit être implémentée et testée avec soin (bordures de mois, fuseau Europe/Paris cohérent avec `lib/dates`).

## Alternatives écartées

1. **Garder gratuit/premium/infinite et n'ajuster que les prix.** Écartée : ne livre pas les trois paliers nommés ni le quota par événements du CLAUDE.md.
2. **Quota sur le stock d'occurrences à venir (et non sur la création sur 12 mois glissants).** Écartée (gaming par suppression/recréation, compteur instable).
3. **Quota en année civile** (remise à zéro au 1er janvier). Écartée au profit de l'année glissante (arbitrage Q2), pour ne pas créer d'effet de bord en fin/début d'année.
4. **Conserver un palier « gratuit » organisateur.** Écartée : contredit CLAUDE.md §2 (organisateur = client payant). Le « gratuit » reste l'audience visiteur, sans compte.
