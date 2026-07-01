# `.claude/` — Mode d'emploi (RÉSEAUTEURS)

Ce dossier contient la **configuration Claude Code du projet** : la mémoire produit partagée, l'équipe de
**8 subagents** qui construisent RÉSEAUTEURS, et le système de design. Ce README explique **à quoi sert chaque
fichier et comment s'en servir**.

> **Réaligné le 2026-06-28** sur le **modèle à trois entités** (ADR-0011). L'annuaire mono-entité de
> l'ADR-0010 (membre seul, sans événements, freemium 39 €) est **caduc** (ADR-0010 **supersédé sur 3
> points** par 0011 — cf. `ARCHITECTURE.md §7`). Si un texte parle encore de
> « membre unique », « 3 paliers », « quota d'événements », « projection de confidentialité par champ »,
> « recherche FTS à facettes » ou « Panorama Pub », c'est un **résidu à corriger**, pas la cible.

---

## 1. Le projet en une page

**RÉSEAUTEURS** = **« la plateforme nationale du networking »**. Principe : **« le site ne remplace aucun
réseau, il les rassemble »**. Trois entités reliées : **les réseauteurs** (personnes, gratuit), **les
événements**, **les réseaux**.

| Avant (caduc) | Maintenant (cible — ADR-0011) |
|---|---|
| 1 entité (membre) ; réseaux = tags ; **pas d'événements** | **3 entités** : réseauteurs · événements · réseaux (reliées) |
| 1 carte (membres) | **2 cartes** : réseauteurs **+** événements |
| Réseaux = taxonomie seulement | Réseaux = **fiche-entité** **+** taxonomie M2M |
| Freemium **membre** 39 €/an | **Réseauteurs gratuits** ; monétisation **B2B** (réseau partenaire + événement Premium + annonceur) |
| Rôles `admin/membre` | **`reseauteur/organisateur/admin`** |
| Confidentialité par champ + double geom (lourd) | **Champs facultatifs** + RGPD de base + géoloc ville |
| Recherche FTS à facettes (pilier) | **Recherche simple** par filtres |
| — | **Badges** déclaratifs · **priorité absolue : simplicité (< 30 s)** |

**Verdict technique :** `REFACTOR_IN_PLACE` sur **Payload CMS + Next.js + PostgreSQL/PostGIS + MapLibre +
Stripe** (on garde la stack et l'infra ; on construit le domaine 3-entités dedans).

---

## 2. Les documents — qui fait foi

**Sources de vérité du cap produit** (hors `.claude/`) :

| Fichier | Rôle |
|---|---|
| `docs/adr/0011-plateforme-trois-entites-monetisation-b2b.md` | **La décision structurante** (supersède 0010 sur 3 points). |
| `docs/evolution/Reseauteurs - Document de cadrage.md` (v2.0) | **Le pourquoi/quoi** : vision, personas, 3 entités, modèle éco B2B. |
| `docs/evolution/ROADMAP-V1.md` | **Périmètre V1** actionnable + points à trancher. |
| `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` (+ amendement 3-entités) | **État réel du code** : garder/réécrire/supprimer. |
| `ARCHITECTURE.md` (modèle 3 entités) | **Architecture cible** réalignée. |
| `PLAN.md` | **Séquencement** des jalons + agents responsables. |

**Fichiers de configuration Claude :**

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` (racine) | **Mémoire produit partagée** — lue en premier par **tous** les agents. |
| `.claude/AGENTS_PIPELINE.md` | La **chaîne de valeur**, l'ordre des phases, les gates, la parallélisation. |
| `.claude/agents/*.md` | Les **8 subagents** (rôle, périmètre, méthode, garde-fous, Definition of Done). |
| `.claude/design/DESIGN.md` | **Tokens visuels = source de vérité** ; structure home/cartes = modèle 3 entités. |
| `.claude/settings.local.json` | Permissions outils locales. |

---

## 3. Les 8 agents

| Agent | Modèle | Rôle (modèle 3 entités) | Livrable |
|---|---|---|---|
| `codebase-auditor` | opus | Audit lecture seule, verdict de reprise, inventaire garder/réécrire/supprimer. | `AUDIT.md` / delta |
| `solution-architect` | opus | Archi 3 entités, ADR, plan reséquencé. Doc seule. | `ARCHITECTURE.md`, `docs/adr/*`, `PLAN.md` |
| `data-architect` | sonnet | Collections `reseauteurs`/`evenements`/`reseaux`/`partenaires`, badge, M2M, RGPD, index recherche, re-migration. | collections + migrations, `MIGRATION.md` |
| `frontend-builder` | sonnet | Design system, **home 3 piliers**, **3 fiches SSR**, **recherche par filtres**, page Partenaires, dashboards. | composants + pages |
| `map-engineer` | sonnet | **Deux cartes** (réseauteurs + événements), clustering, géo, mobile, **marqueur Premium distinct**. | composants cartes + API géo |
| `accounts-and-billing` | sonnet | Auth + **3 rôles**, dashboards, **monétisation B2B** (réseau partenaire + événement Premium + annonceur). | auth + dashboards + facturation |
| `seo-engineer` | sonnet | JSON-LD **`Person`/`Event`/`Organization`**, sitemap, ISR, maillage, **opt-out indexation**. | couche SEO |
| `qa-reviewer` | sonnet | Gate qualité avant merge (sécurité, RGPD, invariants 3-entités, **simplicité**, perf, a11y). | `docs/qa/REVIEW-<date>.md` |

> **Retirés vs ADR-0010 :** `privacy-engineer` (projection par champ + double geom → abandonnés ; RGPD de base
> repliée dans `data-architect`, opt-out indexation dans `seo-engineer`) et `search-engineer` (FTS à facettes
> → abandonné ; recherche simple repliée dans `frontend-builder` + index dans `data-architect`).

---

## 4. Le workflow — ordre et gates

```
Phase 0  codebase-auditor   →  AUDIT + delta (amendement 3-entités)        ✅ FAIT
   │  gate humain : verdict REFACTOR_IN_PLACE ✅
Phase 1  solution-architect →  ARCHITECTURE.md (3 entités) + ADR-0011 + PLAN.md   ✅ réalignés (à valider)
   │  gate humain : valider l'archi & le plan
Phase 2  data-architect     →  4 collections + badge + M2M + RGPD + fichiers de migration   ⏳ PROCHAINE ACTION
   │  (MIGRATION.md = stratégie déjà écrite ; reste les fichiers de migration + le schéma field-level)
   │  gate humain : valider le schéma & la re-migration (⚠️ down() 0623 destructif)
Phase 3  frontend-builder · map-engineer · accounts-and-billing · seo-engineer  (parallélisable)
Phase 4  qa-reviewer        →  REVIEW-<date>.md (PASS / PASS_WITH_FIXES / BLOCK)
```

**Règle d'or :** aucune implémentation (phase 3+) avant que **`ARCHITECTURE.md` + le schéma** soient validés
par un humain.

### 👉 Démarrer la prochaine phase

```
Use the data-architect subagent to create the reseauteurs/evenements/reseaux/partenaires collections,
the badge field and the réseauteur↔réseaux many-to-many relation, repoint RGPD onto reseauteurs,
add the simple-search indexes, and write MIGRATION.md (re-migration from the 0623 state).
```

---

## 5. Comment invoquer les agents

- **Automatique** : décris la tâche ; le `description` de l'agent route.
- **Explicite** : *« Use the `<agent>` subagent to … »*.
- **Non-interactif** : `claude -p "Use the data-architect subagent to create the reseauteurs collection"`.
- **Vérifier** : commande `/agents`.

### ⚠️ Recharger après édition
Si tu **édites un fichier de `.claude/agents/` ou `CLAUDE.md`**, **redémarre Claude Code** (ou rouvre
`/agents`) pour que les changements soient pris en compte.

---

## 6. Invariants à ne jamais violer (rappel transverse)

1. **Trois entités reliées** : réseauteurs (personnes) · événements · réseaux (fiche-entité **+** taxonomie).
2. **Deux cartes** : réseauteurs (marqueur = personne) et événements (marqueur = événement, **Premium
   distinct**).
3. **Réseauteurs gratuits.** Monétisation **B2B** (réseau partenaire + événement Premium + annonceur). Un
   avantage payant n'est accordé que sur **statut serveur** (jamais client).
4. **Trois rôles & propriété stricte** : réseauteur→son profil ; organisateur→son réseau + ses événements ;
   admin→tout.
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
