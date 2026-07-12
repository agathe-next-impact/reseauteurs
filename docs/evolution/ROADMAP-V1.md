# RÉSEAUTEURS — Périmètre V1 et feuille de route

> Document de travail. Traduit le cadrage (`Reseauteurs - Document de cadrage.md` v2.0) et l'ADR-0011 en un
> périmètre actionnable. Décision de fond : `docs/adr/0011-plateforme-trois-entites-monetisation-b2b.md`.
> **Date :** 2026-06-28 · **Statut :** à valider · **Stack :** reprise sur Payload (refactor in place).
>
> ⚠️ **Amendé le 2026-06-30 (ADR-0012)** — hiérarchie réseaux, abonnement national, suppression du Premium —
> **et le 2026-07-12 (ADR-0013)** : palier **Réseauteur Plus** (création d'événements), rôle **`partenaire`**
> self-service, **packs de licences Plus** (10/50/100+) activés par code promo. Les lignes D3/D4/D5
> ci-dessous sont annotées ; plan d'exécution : `PLAN.md` Parties B et D.

---

## 1. Décisions actées (ADR-0011)

| # | Décision | Détail |
|---|---|---|
| D1 | **Reprise de l'existant sur Payload** | Pas de nouvelle stack ; domaine (re)construit *dans* le repo. |
| D2 | **Trois entités reliées** | `reseauteurs` (personne) · `evenements` (événement) · `reseaux` (réseau-entité **+** taxonomie M2M). |
| D3 | **Réseauteurs gratuits** | *Amendé (ADR-0013)* : l'inscription et le socle restent gratuits (densité), mais un palier **Plus** (abonnement ou licence partenaire) débloque la **création d'événements**. |
| D4 | **Monétisation (Stripe)** | *Amendée (ADR-0012 + 0013)* : **Réseau national partenaire** (abonnement, paliers) · **Partenaire annonceur** (abonnement + **packs de licences Plus** 10/50/100+ par code promo) · **Réseauteur Plus** (abonnement individuel). ~~Événement Premium~~ supprimé (0012). |
| D5 | **Trois rôles** | *Amendé (ADR-0013)* : **quatre rôles** — `reseauteur` / `organisateur` (1 user ↔ 1 réseau) / `partenaire` (1 user ↔ 1 fiche) / `admin`. |
| D6 | **Deux cartes** | Carte des réseauteurs + carte des événements (MapLibre + PostGIS). |
| D7 | **Badges déclaratifs** | Bronze / Argent / Gold / Platinum (nb d'événements/mois). |
| D8 | **Recherche simple** | Filtres dans Postgres via Payload ; **pas** de moteur FTS à facettes, **pas** d'agent dédié. |
| D9 | **Confidentialité proportionnée** | Champs de contact facultatifs + RGPD de base + géoloc ville par défaut ; **pas** de double geom obligatoire ni de projection par champ. |
| D10 | **Simplicité d'abord** | Compris en < 30 s ; modèle de données extensible ; évolutions futures **conçues, non développées**. |
| D11 | **Marque = RÉSEAUTEURS** | Domaine, vocabulaire, copie, emails alignés. |

---

## 2. Périmètre V1

### Dans le périmètre

- **3 entités** + fiches publiques SSR : `/reseauteur/<prenom-nom>`, `/evenement/<slug>`, `/reseau/<slug>`.
- **2 cartes** nationales (réseauteurs + événements), clustering, recherche ville / autour de moi.
- **Recherche simple** par filtres (personne / événement / réseau).
- **Comptes + 3 rôles** + validation des inscriptions + modération.
- **Badges** déclaratifs réseauteur.
- **Monétisation B2B** : réseau partenaire (Subscription) + événement Premium (Checkout one-shot) +
  partenaire annonceur (Subscription) + **page Partenaires**.
- **SEO** `Person`/`Event`/`Organization` (sitemap, OG, llms.txt, ISR) + **RGPD** (opt-out indexation).
- **Responsive** desktop / tablette / mobile.

### Conçu dans le modèle de données, NON développé en V1 (évolutions futures)

App mobile · messagerie · agenda personnel · import auto d'événements (CSV/iCal/API) · check-in · badge
vérifié · statistiques · association · congrès · matching · IA.

### Retiré (caduc)

- Modèle **Réseau → Occurrences**, **quota d'occurrences**, **3 paliers 90/130/190 €**, **freemium membre
  39 €** (ADR-0010), objet publicitaire `fournisseurs`/`revendeurs`, route/champ
  `participer`/`participantsSignales`.
- **Projection de confidentialité par champ + double geom obligatoire** ; **moteur de recherche FTS à
  facettes** (ADR-0011 §6/§7). → agents `privacy-engineer` et `search-engineer` **retirés**.
- **Groupes/affiliation** : restent **dormants** (ADR-0009 inchangé).

---

## 3. Inventaire reprise — garder / réécrire / supprimer

> Détail `fichier:ligne` : `AUDIT-DELTA-RESEAUTEURS.md` **+ son amendement 3-entités**. Le retour des
> événements et des réseaux-entités **réutilise davantage** l'existant que sous l'ADR-0010.

| Bloc | Sort | Note |
|---|---|---|
| Stripe (checkout, portal, webhooks, factures, crons) | **Garder + recalibrer** | 3 produits B2B (Subscription réseau, Checkout one-shot événement, Subscription annonceur). |
| `evenements` (collection) | **Garder + simplifier** | Retirer `participer`/quota/`serieId`/archivage ; ajouter `lienInscription` + drapeau Premium. |
| `reseaux` (collection, créée en 0623) | **Garder comme entité** | Fiche + compteurs ; **et** valeur de taxonomie M2M ; possédée par un organisateur. |
| Carte MapLibre + PostGIS + `syncGeom` + géocodage data.gouv | **Garder** | Sert **les deux** cartes. |
| SEO multi-types (`Event`/`Organization`/`LocalBusiness`, sitemap, ISR, robots, llms.txt) | **Garder + ajouter `Person`** | Repointer sur les 3 entités. |
| RGPD (consentements, export, delete, purge, audit) | **Garder** | Repointer sur `reseauteurs`. |
| Auth Payload | **Garder** | Rôles `reseauteur/organisateur/admin`. |
| Emails Resend, onboarding, sécurité (rate-limit, CSP, sanitize) | **Garder + rebrander** | — |
| Admin Payload + field-level access | **Garder** | Modération + gestion des 3 entités + partenaires. |
| `Fournisseurs.ts`, `OrganisateursEvenements.ts`, `LabelsRSE.ts` | **Supprimer** | Legacy objet publicitaire PanoramaPub. |
| Enum `users.role` (`admin/fournisseur/organisateur`) | **Réécrire** | → `reseauteur/organisateur/admin`. |
| Enum `users.plan` 3-paliers + `getEffectiveFeatureLevel` | **Réécrire** | → statut B2B (réseau partenaire / annonceur) + drapeau Premium événement. |
| `CategoriesActivite` | **Repurpose** | Secteurs/métiers des réseauteurs (filtres). |
| `TypesEvenement` | **Repurpose** | Catégories d'événements (filtres carte événements). |
| Groupes/affiliation | **Dormant** | ADR-0009 inchangé. |

### Modules neufs (l'essentiel de l'effort)

1. **Collection `reseauteurs`** (personne) + carte des réseauteurs + fiche profil SSR.
2. **Collection `partenaires`** (annonceurs) + page Partenaires.
3. **Champ badge** + relation M2M réseauteur ↔ réseaux.
4. **Recalibrage Stripe B2B** (réseau partenaire + événement Premium + annonceur).
5. **Recherche simple** par filtres (UI + index).

---

## 4. Points à trancher avant implémentation

1. **URL des réseauteurs** : `/reseauteur/<prenom-nom>` (cohérence avec l'entité) — à confirmer avec
   `seo-engineer` (unicité de slug, collisions de noms).
2. **Modèle d'abonnement B2B** : un compte `organisateur` ↔ un `reseau` ; statut « partenaire » dérivé de la
   Subscription Stripe. Événement Premium = paiement ponctuel rattaché à l'événement. Annonceur = collection
   `partenaires` avec Subscription. → schéma `data-architect`.
3. **Badge** : champ dérivé du nombre déclaré d'événements/mois, avec référentiel admin. Simple `select` +
   logique de dérivation.
4. **Géolocalisation réseauteur** : centroïde ville par défaut (pas d'adresse exacte) — confirmer le niveau
   de précision avec `map-engineer`.
5. **Migrations `0623`** : `reseaux` **redevient pertinente** comme entité → réexamen plus simple que sous
   l'ADR-0010, mais `down()` de `120000` reste destructif (`TRUNCATE reseaux CASCADE`). Gate humain + dry-run.
   → `data-architect` / `MIGRATION.md`.
6. **Opt-out d'indexation** des personnes physiques (sitemap + robots + meta) → `seo-engineer`.

---

## 5. Séquencement (pipeline d'agents — 8 agents)

1. **`codebase-auditor`** — audit + delta (✅ produit ; amendement 3-entités ajouté).
2. **`solution-architect`** — `ARCHITECTURE.md` (modèle 3 entités), ADR, `PLAN.md` (réalignés dans la passe
   docs du 2026-06-28 ; à valider/affiner). **Gate humain.**
3. **`data-architect`** — collections `reseauteurs` / `evenements` (simplifié) / `reseaux` (entité+taxonomie)
   / `partenaires`, badge, M2M, RGPD repointé, `users.role` (3 rôles), index de recherche, `MIGRATION.md`.
   **Gate humain (re-migration, `down()` destructif).**
4. **`frontend-builder`** (home + 3 fiches + recherche + dashboards) · **`map-engineer`** (2 cartes,
   marqueurs Premium) · **`accounts-and-billing`** (3 rôles + monétisation B2B) · **`seo-engineer`**
   (`Person`/`Event`/`Organization` + opt-out) — **en parallèle** selon `PLAN.md`.
5. **`qa-reviewer`** — gate qualité avant merge (dont **critère simplicité**).

> **Règle d'or :** aucune implémentation (4) avant validation humaine de l'architecture et du schéma (2-3).
