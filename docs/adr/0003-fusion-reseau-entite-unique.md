# ADR-0003 — Fusion Fournisseurs + OrganisateursEvenements → entité `Reseaux` unique

> **♻️ Esprit remobilisé, modèle élargi — voir [ADR-0011](0011-plateforme-trois-entites-monetisation-b2b.md) (2026-06-28).**
> Le principe **« le réseau est une entité durable, possédée »** reste **valable** et structurant : `reseaux`
> demeure une **collection-entité** (fiche, logo, présentation, compteurs, drapeau partenaire). La fusion
> `Fournisseurs` + `OrganisateursEvenements` → `reseaux` (et le repointage `evenements.reseau`) reste le plan
> de données de référence (cf. `MIGRATION.md`). **Ce qui change sous l'ADR-0011 :**
> (a) le réseau est désormais possédé par un compte **`organisateur`** (rôle dédié), pas un « fournisseur/
> organisateur » fusionné ; (b) `reseaux` sert **aussi** de **taxonomie M2M** que les réseauteurs cochent ;
> (c) l'entité centrale du domaine n'est plus le réseau seul mais **trois entités reliées** (réseauteurs ·
> événements · réseaux). Le « 1 user = 1 réseau » devient « 1 **organisateur** = 1 réseau » (réversible).
> **En cas de conflit, l'ADR-0011 prévaut.** Détail : `ARCHITECTURE.md §2`.

- **Statut :** Accepté — **esprit remobilisé et élargi par ADR-0011 (réseau-entité + taxonomie M2M, possédé par `organisateur`)**
- **Date :** 2026-06-23 (mise à jour 2026-06-23 après arbitrages)
- **Décideurs :** Humain (product owner) + `solution-architect` (sur recommandation §9.3 de l'audit)
- **Portée :** schéma, access control, hooks, carte, SEO, espace organisateur, migration de données
- **Dépend de :** ADR-0001
- **Impacte :** ADR-0004 (quota), ADR-0005 (SEO/URLs)

> **Arbitrages humains intégrés :**
> - **1 user = 1 réseau, contrainte d'unicité DB conservée (résout Q4) :** on garde l'unicité `user` existante, **réversible plus tard** si un palier multi-réseaux est introduit. Pas de multi-réseaux au MVP.
> - **Migration = contenu + slugs SEO uniquement :** la reprise de données ne porte **pas** sur des abonnements (aucun client payant à reprendre, cf. ADR-0004 / Q1). `MIGRATION.md` traite la fusion d'entités, le repointage des occurrences et la préservation des slugs — **pas** de mapping d'abonnements.

## Contexte

Le modèle mental cible (CLAUDE.md §1) est strict : un **Réseau** (entité durable) possède des **Occurrences** (événements datés). Or l'existant porte **deux** entités « entité durable » concurrentes :

- **`Fournisseurs`** (`collections/Fournisseurs.ts`) : entité riche (slug, raisonSociale, adresse, lat/lon, logo, bannière, illustrations, réseaux sociaux, description, SEO, statut, `user` unique). C'est le « réseau payant » de fait. Champs spécifiques objet-pub à neutraliser : `boutiqueEnLigne`, `lienDevis`, `labelsRSE`, `descriptionRSE`, `offresEmploi`, `activitePrincipale`/`activitesSecondaires` (RSE/boutique/emploi).
- **`OrganisateursEvenements`** (`collections/OrganisateursEvenements.ts`) : entité plus pauvre (nom, ville, slug, logo, description, réseaux sociaux, SEO, `user`), pensée comme « organisateur externe non-fournisseur », réservée admin côté événement.

Une occurrence (`Evenements.ts`) se rattache à **l'une OU l'autre** via deux relations mutuellement exclusives : `fournisseur` (relationTo `fournisseurs`) **xor** `organisateurExterne` (relationTo `organisateurs-evenements`) — exclusion imposée en hook (`Evenements.ts:193-198`). Tous les hooks (notification archivage, ownership, quota, access read/update/delete) sont **dédoublés** pour résoudre l'un puis l'autre (`Evenements.ts:48-100, 110-155, 257-329`). L'auto-création de fiche au signup est elle aussi dédoublée selon `role` fournisseur/organisateur (`Users.ts:310-410`). L'audit qualifie cette dualité de **dette de modélisation** (Modèle 4/5, §5) et recommande la fusion (§9.3).

Cette dualité coûte : double code d'access, double résolution d'ownership, double chemin de quota (ADR-0004), double type d'entité dans la carte et le sitemap, ambiguïté SEO (deux espaces d'URLs pour le même concept).

## Décision

**Fusionner les deux entités en une collection unique `reseaux` (slug Payload `reseaux`), qui devient la seule « entité durable » du domaine. `Evenements` ne porte plus qu'une relation `reseau` (relationTo `reseaux`), remplaçant le couple `fournisseur` xor `organisateurExterne`.**

Modèle de `reseaux` (champs conservés/renommés, détail laissé à `data-architect`) :

- Identité : `slug` (unique, figé), `nom` (ex-`raisonSociale`/`nom`), `ville`, `adresse`, `codePostal`, `latitude`/`longitude`, `geom` (ADR-0002).
- Présentation : `logo`, `banniere`, `illustrations`, `description`, `reseauxSociaux`, `siteWeb`, `emailContact`, `telephone`, `videoYoutube`.
- Classement : `categorie` (relationTo `types-evenement` ou nouvelle taxo réseau — cf. §8 CLAUDE.md), filtres secondaires optionnels.
- Propriété/état : `user` (relationTo `users`, **unique** — voir ci-dessous), `statut` (`publiee`/`suspendue`), bloc `seo`.
- **Drapeau de provenance** : un champ `source`/`revendique` (enum `revendique` | `importe`/`national`) qui remplace la sémantique « fournisseur payant » vs « organisateur saisi par admin / fiche orpheline ». Une fiche `importe` sans `user` = précédent du concept « national » qui règle le cold-start (l'existant a déjà des occurrences sans fournisseur — `evenements-nationaux`, `route.ts:170` `isNational: !doc.fournisseur`).

Champs objet-publicitaire **retirés ou neutralisés** : `boutiqueEnLigne`, `lienDevis`, `labelsRSE`, `descriptionRSE`, `offresEmploi`, et le couplage `activitePrincipale`/`activitesSecondaires` (collections `LabelsRSE`, `CategoriesActivite` à conserver inactives ou réaffectées — décision data-architect, sans suppression destructive).

**Migration de données — périmètre : contenu + slugs SEO uniquement** (plan détaillé par `data-architect`, MIGRATION.md ; **pas de reprise d'abonnements**, cf. ADR-0004) :

- Les lignes `fournisseurs` deviennent des `reseaux` `revendique` (slugs **préservés**).
- Les lignes `organisateurs-evenements` deviennent des `reseaux` (slugs préservés). En cas de **collision de slug** entre les deux espaces, règle déterministe (suffixe stable, jamais `Date.now()` en migration) documentée dans MIGRATION.md.
- `evenements.fournisseur` et `evenements.organisateurExterne` → `evenements.reseau` (repointage par mapping d'IDs).
- `Users.role` : les valeurs `fournisseur`/`organisateur` convergent vers un rôle unique **`organisateur`** (= client payant) ; `admin` inchangé. Migration de l'enum + des comptes.
  > **♻️ Amendé par ADR-0011 (2026-06-28) — règle de conversion qui fait foi :** avec l'introduction du rôle `reseauteur` (personne, gratuit), la convergence d'origine ne s'applique plus. La migration `20260628_160000_users_roles` applique : **`fournisseur` → `reseauteur`** (tout compte non-organisateur est un réseauteur), **`organisateur` → `organisateur`** (inchangé), **`admin` → `admin`** (inchangé). Source de vérité : `MIGRATION.md §4 (rang 7) / §5`.
- Aucune perte : les fiches orphelines (`user` vide) sont conservées comme `reseaux` `importe` revendiquables (le claim-flow existant `Users.ts:318-351` est conservé et repointé).

**Unicité `user` (arbitrage Q4 — conservée) :** l'existant impose `fournisseurs.user` **unique** (`Fournisseurs.ts:281-284`, migration `20260418_100000`). On **conserve cette contrainte d'unicité en base** sur `reseaux.user` (règle « 1 organisateur = 1 réseau », cf. `canCreateFiche`, ADR-0004). Décision **réversible plus tard** : si un palier futur autorise plusieurs réseaux par compte, on lèvera l'unicité par une migration additive. Pas de multi-réseaux au MVP.

## Conséquences

**Positives :**

- Un seul modèle « Réseau → Occurrences », fidèle au CLAUDE.md §1.
- Suppression de tout le code dédoublé (access, ownership, quota, notifications, auto-création, carte, sitemap) → moins de surface de bug.
- Un seul espace d'URLs SEO pour les réseaux (ADR-0005), un seul type de feature géo.
- Le concept « national » (cold-start) devient un drapeau explicite plutôt qu'une absence de relation.
- Périmètre de migration réduit (contenu + slugs, sans abonnements) → moins de risque que prévu initialement.

**Négatives / risques :**

- **Migration de données structurante et à sens unique** : repointage de toutes les occurrences, fusion de deux enums de rôle, dédoublonnage de slugs. C'est le point de plus haut risque du projet → gate humain obligatoire sur MIGRATION.md, dry-run sur copie de la base Neon, plan de rollback.
- Refonte des hooks `Evenements` (suppression de la branche `organisateurExterne`), de l'auto-création au signup (`Users.ts`), de la route géo et du sitemap.
- Les fonctions `canCreateOrganisateurFiche` / champs RSE/boutique deviennent du code mort à retirer proprement.

## Alternatives écartées

1. **Garder deux collections, harmoniser leurs champs.** Écartée : conserve le dédoublement de code et l'ambiguïté SEO/carte ; ne résout pas la dette identifiée par l'audit.
2. **Fusionner mais garder `evenements.fournisseur` ET `evenements.organisateurExterne`.** Écartée : la relation duale est précisément ce qui dédouble les hooks ; une seule relation `reseau` est l'objectif.
3. **Distinguer Réseau « national/marque » et Réseau « local » en deux collections.** Écartée : un seul champ `source`/`categorie` suffit ; deux collections recréeraient la dualité sous un autre nom.
4. **Lever l'unicité `user` dès le MVP (multi-réseaux).** Écartée (arbitrage Q4) : pas de besoin au MVP ; on garde l'unicité, réversible par migration additive ultérieure.
