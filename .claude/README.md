# `.claude/` — Mode d'emploi (RÉSEAUTEURS)

Ce dossier contient la **configuration Claude Code du projet** : la mémoire produit partagée, l'équipe de
**subagents** qui construit et fait évoluer RÉSEAUTEURS, et le système de design. Ce README explique **à quoi
sert chaque fichier et comment s'en servir**.

> **État au 2026-07-20.** La V1 à **trois entités** (réseauteurs · événements · réseaux) est **construite**
> (phases 0→4 livrées). Le pipeline sert désormais à **faire évoluer et vérifier** l'existant. Cap et
> décisions structurantes : **ADR-0011** (3 entités + monétisation) jusqu'à **ADR-0016** (gestion complète
> de l'abonnement en libre-service). `CLAUDE.md` (racine) reste la **source de vérité produit** — lu en
> premier par tous les agents.
>
> ⚠️ Résidus à corriger s'ils réapparaissent : « membre unique / annuaire mono-entité » (ADR-0010, caduc),
> « événement Premium » (ADR-0012, supprimé), « packs de licences / codes promo partenaires » (ADR-0015,
> supprimés), « 3 rôles » (il y en a **4**), « réseauteurs strictement gratuits » (le palier **Plus** existe),
> « quota d'événements / 3 paliers 90-130-190 € », « projection de confidentialité par champ », « recherche
> FTS à facettes », « Info-Réseaux » / « Panorama Pub ».

---

## 1. Le projet en une page

**RÉSEAUTEURS** = **« la plateforme nationale du networking »**. Principe : **« le site ne remplace aucun
réseau, il les rassemble »**. Trois entités reliées : **les réseauteurs** (personnes), **les événements**,
**les réseaux**.

| Avant (caduc) | Maintenant (cible livrée — ADR-0011 → 0016) |
|---|---|
| 1 entité (membre) ; réseaux = tags ; **pas d'événements** | **3 entités** : réseauteurs · événements · réseaux (reliées) |
| 1 carte (membres) | **2 cartes** : réseauteurs **+** événements |
| Réseaux = taxonomie seulement | Réseaux = **fiche-entité** **+** taxonomie M2M ; **hiérarchie tête ↔ local** |
| Réseauteurs 100 % gratuits (B2B pur) | **Gratuit** + palier **Plus** (39 € HT/an) ; monétisation **mixte** (Plus + réseau par paliers + annonceur) |
| Rôles `admin/membre` | **`reseauteur/organisateur/partenaire/admin`** (4 rôles) |
| Confidentialité par champ + double geom (lourd) | **Champs facultatifs** + RGPD de base + géoloc ville |
| Recherche FTS à facettes (pilier) | **Recherche simple** par filtres |
| — | **Badges** déclaratifs · **gestion d'abonnement unifiée** (`/dashboard/abonnement`) · **priorité absolue : simplicité (< 30 s)** |

**Verdict technique :** `REFACTOR_IN_PLACE` sur **Payload CMS + Next.js + PostgreSQL/PostGIS + MapLibre +
Stripe** (stack et infra conservées ; le domaine 3-entités est construit dedans).

---

## 2. Les documents — qui fait foi

**Sources de vérité du cap produit** (hors `.claude/`) :

| Fichier | Rôle |
|---|---|
| `docs/adr/0011-*.md` → `0016-*.md` | Les **décisions structurantes**. 0011 (3 entités + monétisation), 0012 (Premium supprimé), 0013 (Réseauteur Plus + inscriptions), 0014 (fiche nationale payante + locaux Plus), 0015 (**packs de licences supprimés**), 0016 (**gestion d'abonnement complète, libre-service, 3 types**). |
| `docs/evolution/Reseauteurs - Document de cadrage.md` | **Le pourquoi/quoi** : vision, personas, 3 entités, modèle éco. |
| `docs/evolution/ROADMAP-V1.md` | **Périmètre V1** + points tranchés. |
| `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` (+ amendement 3-entités) | **État de reprise du code** : garder/réécrire/supprimer. |
| `ARCHITECTURE.md` (modèle 3 entités) | **Architecture cible**. |
| `PLAN.md` | **Séquencement** des jalons + agents responsables. |
| `MIGRATION.md` | Stratégie et fichiers de re-migration. |

**Fichiers de configuration Claude :**

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` (racine) | **Mémoire produit partagée** — lue en premier par **tous** les agents. |
| `.claude/AGENTS_PIPELINE.md` | La **chaîne de valeur**, l'ordre des phases, les gates, la parallélisation. |
| `.claude/agents/*.md` | Les **12 subagents** (rôle, périmètre, méthode, garde-fous, Definition of Done). |
| `.claude/design/DESIGN.md` | **Tokens visuels = source de vérité** ; structure home/cartes = modèle 3 entités. |
| `.claude/settings*.json` | Permissions outils locales. |

---

## 3. Les 12 agents

**8 agents de construction** (le pipeline principal) :

| Agent | Modèle | Rôle | Livrable |
|---|---|---|---|
| `codebase-auditor` | opus | Audit lecture seule, verdict de reprise, inventaire garder/réécrire/supprimer. | `AUDIT.md` / delta |
| `solution-architect` | opus | Archi 3 entités, ADR, plan reséquencé. Doc seule. | `ARCHITECTURE.md`, `docs/adr/*`, `PLAN.md` |
| `data-architect` | sonnet | Collections `reseauteurs`/`evenements`/`reseaux`/`partenaires`, badge, M2M, **4 rôles**, RGPD, index recherche, re-migration. | collections + migrations, `MIGRATION.md` |
| `frontend-builder` | sonnet | Design system, **home 3 piliers**, **3 fiches SSR**, **recherche par filtres**, page Partenaires, dashboards. | composants + pages |
| `map-engineer` | sonnet | **Deux cartes** (réseauteurs + événements), clustering, géo, mobile. | composants cartes + API géo |
| `accounts-and-billing` | sonnet | Auth + **4 rôles**, dashboards, **monétisation mixte** (Plus + réseau par paliers + annonceur) + **hub `/dashboard/abonnement`**. | auth + dashboards + facturation |
| `seo-engineer` | sonnet | JSON-LD **`Person`/`Event`/`Organization`**, sitemap, ISR, maillage, **opt-out indexation**. | couche SEO |
| `qa-reviewer` | sonnet | Gate qualité avant merge (sécurité, RGPD, invariants, **simplicité**, perf, a11y). | `docs/qa/REVIEW-<date>.md` |

**4 agents d'audit ciblé** (lecture seule — pour vérifier une évolution) :

| Agent | Modèle | Rôle | Livrable |
|---|---|---|---|
| `test-fonctionnel` | sonnet | Exerce **réellement** les parcours métier (scripts tsx éphémères sur l'API Payload) : 4 rôles + gates, XOR organisateur, gate Plus, inscriptions en ligne, hiérarchie réseau, recherche, badges, crons. | rapport pass/fail |
| `test-securite` | sonnet | Autorisation par rôle & propriété, statut payant/rôle **posés serveur** (webhooks signés+idempotents), routes mutantes (auth+ownership+rate-limit), crons protégés, secrets, RGPD. | rapport priorisé |
| `test-performance` | sonnet | N+1, requêtes non bornées, `await` séquentiels, ISR cassée par `headers()`/`auth()`, index DB manquants, payloads carte trop lourds. | rapport priorisé |
| `test-ux` | sonnet | a11y (contrastes/labels/focus/clavier/aria), états (chargement/vide/erreur/succès), mobile-first des cartes, fidélité aux tokens, copie FR, **compris en < 30 s**. | rapport priorisé |

> **Retirés vs ADR-0010 :** `privacy-engineer` (projection par champ + double geom → abandonnés ; RGPD de base
> repliée dans `data-architect`, opt-out indexation dans `seo-engineer`) et `search-engineer` (FTS à facettes
> → abandonné ; recherche simple repliée dans `frontend-builder` + index dans `data-architect`).

---

## 4. Le workflow — ordre et gates

```
Phase 0  codebase-auditor   →  AUDIT + delta (amendement 3-entités)              ✅ FAIT
   │  gate humain : verdict REFACTOR_IN_PLACE ✅
Phase 1  solution-architect →  ARCHITECTURE.md (3 entités) + ADR-0011→0016 + PLAN.md   ✅ FAIT
   │  gate humain : archi & plan ✅
Phase 2  data-architect     →  4 collections + badge + M2M + 4 rôles + migrations  ✅ FAIT
   │  gate humain : schéma & re-migration ✅
Phase 3  frontend-builder · map-engineer · accounts-and-billing · seo-engineer     ✅ V1 CONSTRUITE
Phase 4  qa-reviewer + audits ciblés (test-fonctionnel/securite/performance/ux)    ⏳ EN CONTINU
```

**La V1 est construite.** Le pipeline tourne désormais **par évolution** : une nouvelle décision (ADR) →
`data-architect`/`accounts-and-billing`/etc. l'implémentent in place → les agents `test-*` + `qa-reviewer`
la vérifient avant merge.

**Règle d'or (toujours valable) :** toute évolution de **schéma** ou d'**invariant de monétisation** passe
par un ADR + une validation humaine avant implémentation.

### 👉 Faire évoluer / vérifier

```
Use the accounts-and-billing subagent to <décrire l'évolution de facturation/rôle>.
Use the test-fonctionnel subagent to exercise the <parcours> end-to-end and report pass/fail.
Use the test-securite subagent to audit authorization & server-side paid-status on the current branch.
Use the qa-reviewer subagent to review the current branch before merge (including the simplicity criterion).
```

---

## 5. Comment invoquer les agents

- **Automatique** : décris la tâche ; le `description` de l'agent route.
- **Explicite** : *« Use the `<agent>` subagent to … »*.
- **Non-interactif** : `claude -p "Use the test-fonctionnel subagent to exercise the Plus gate"`.
- **Vérifier** : commande `/agents`.

### ⚠️ Recharger après édition
Si tu **édites un fichier de `.claude/agents/` ou `CLAUDE.md`**, **redémarre Claude Code** (ou rouvre
`/agents`) pour que les changements soient pris en compte.

---

## 6. Invariants à ne jamais violer (rappel transverse)

1. **Trois entités reliées** : réseauteurs (personnes) · événements · réseaux (fiche-entité **+** taxonomie ;
   hiérarchie tête ↔ local, 2 étages).
2. **Deux cartes** : réseauteurs (marqueur = personne, position **ville**) et événements (marqueur = événement).
3. **Monétisation mixte, statut posé côté serveur.** Réseauteur **Gratuit** ou **Plus** (39 € HT/an, crée des
   événements) ; réseau partenaire par **paliers** (`fiche`/`starter`/`growth`/`enterprise`) ; partenaire
   annonceur. Tout avantage payant n'est accordé que sur **statut serveur** (webhook Stripe), **jamais client**.
   Gestion en **libre-service** via le hub **`/dashboard/abonnement`** (ADR-0016).
4. **Quatre rôles & propriété stricte** : réseauteur→son profil (+ ses événements/réseaux locaux s'il est Plus) ;
   organisateur→son réseau + ses événements ; partenaire→sa fiche + son offre ; admin→tout.
5. **Visiteur sans friction** : pas de compte pour parcourir/consulter.
6. **Recherche simple** par filtres (pas de moteur FTS à facettes, pas de moteur externe).
7. **Confidentialité proportionnée** : contact = **champs facultatifs** ; **géoloc ville par défaut** ; RGPD
   de base + **opt-out d'indexation** des personnes physiques.
8. **SEO = pilier** : `Person` / `Event` / `Organization`, sitemap, ISR, llms.txt.
9. **Stack figée** : Payload + Next.js + Postgres/PostGIS + MapLibre + Stripe. **Pas de Prisma**, pas de moteur
   de recherche externe, pas de nouveau dépôt.
10. **La simplicité d'abord** : site compris en < 30 s ; pas de complexité non nécessaire ; modèle de données
    extensible pour les évolutions futures (non développées en V1).
11. **Copie en français**, tokens de `DESIGN.md`, **0 occurrence** de « Info-Réseaux » / « Panorama Pub ».
