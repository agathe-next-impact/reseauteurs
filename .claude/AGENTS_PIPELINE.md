# Pipeline des agents — RÉSEAUTEURS

Équipe de subagents Claude Code pour construire **RÉSEAUTEURS — la plateforme nationale du networking**
(modèle à **trois entités** : réseauteurs · événements · réseaux). Lire `CLAUDE.md` (racine) pour le contexte
produit complet, puis `.claude/README.md` pour le mode d'emploi.

> **Cap actuel (ADR-0011, 2026-06-28).** Trois entités reliées. **Réseauteurs gratuits** ; monétisation
> **B2B** (réseau partenaire + événement Premium + partenaire annonceur). Trois rôles
> (réseauteur / organisateur / admin). **Deux cartes** (réseauteurs + événements). **Badges** déclaratifs.
> **Recherche simple** par filtres. **Confidentialité proportionnée** (champs facultatifs + RGPD de base).
> **Priorité absolue : la simplicité** (compris en < 30 s). Verdict de reprise : **`REFACTOR_IN_PLACE`** sur
> Payload.
>
> ⚠️ L'annuaire mono-entité de l'ADR-0010 (membre seul, sans événements, freemium 39 €, projection de
> confidentialité + FTS à facettes) est **caduc**. Les agents `privacy-engineer` et `search-engineer` ont été
> **retirés** (préoccupations repliées). Il reste **8 agents**.

## Installation

```
<repo>/
├── CLAUDE.md                        (mémoire produit — lue en premier par tous)
└── .claude/
    ├── README.md                    (mode d'emploi)
    ├── AGENTS_PIPELINE.md           (ce fichier)
    ├── design/
    │   ├── DESIGN.md                (tokens = source de vérité ; structure = modèle 3 entités)
    │   └── info-reseaux-plasma.html (maquette — référence de TOKENS uniquement)
    └── agents/
        ├── codebase-auditor.md      (audit — lecture seule)
        ├── solution-architect.md    (archi + ADR + plan — doc seule)
        ├── data-architect.md        (3 entités + partenaires + badges + RGPD + index recherche)
        ├── frontend-builder.md      (home + 3 fiches + recherche par filtres + dashboards)
        ├── map-engineer.md          (2 cartes : réseauteurs + événements)
        ├── accounts-and-billing.md  (3 rôles + monétisation B2B Stripe)
        ├── seo-engineer.md          (JSON-LD Person/Event/Organization + opt-out indexation)
        └── qa-reviewer.md           (gate qualité — lecture + tests)
```

> Les subagents sont chargés au **démarrage de session**. Après avoir édité un fichier sur disque,
> **redémarrer Claude Code** (ou utiliser `/agents`) pour qu'il soit pris en compte.

## Chaîne de valeur (modèle 3 entités)

```
Phase 0  DÉCOUVERTE      codebase-auditor      →  AUDIT.md  +  AUDIT-DELTA-RESEAUTEURS.md   [lecture seule]
            │  ✅ FAIT — verdict REFACTOR_IN_PLACE (amendement 3-entités ajouté le 2026-06-28).
            ▼
Phase 1  PLAN            solution-architect    →  ARCHITECTURE.md (modèle 3 entités)
            │                                     docs/adr/*.md (0011 acté, statuts amendés)
            │                                     PLAN.md (reséquencé)
            │  ✅ Réalignés dans la passe docs du 2026-06-28 — à valider/affiner. (gate humain)
            ▼
Phase 2  FONDATIONS      data-architect        →  collections reseauteurs/evenements/reseaux/partenaires
            │                                     + badge + M2M + RGPD repointé + index recherche
            │                                     MIGRATION.md (re-migration 0623, down() destructif)
            │  (gate humain : valider le schéma & la re-migration)
            ▼
Phase 3  CONSTRUCTION    frontend-builder    ─┐
            │            map-engineer        ─┤ →  implémentation V1
            │            accounts-and-billing ┤    (parallélisable, cf. PLAN.md)
            │            seo-engineer        ─┘
            ▼
Phase 4  VÉRIFICATION    qa-reviewer           →  docs/qa/REVIEW-<date>.md   [lecture + tests]
```

## Où en est-on ? (état au 2026-06-28)

- **Phases 0-1 ✅** : audit + delta (avec amendement 3-entités) produits ; `ARCHITECTURE.md` / ADR-0011 /
  `PLAN.md` réalignés sur le modèle 3 entités. **Gate humain : valider l'archi & le plan.**
- **Phase 2 ⏳ (prochaine action)** : `data-architect` crée les collections + le schéma + les fichiers de
  migration, et **finalise** `MIGRATION.md` (la **stratégie** de migration y est déjà rédigée).
- **Phases 3-4** : après validation du schéma (règle d'or).

## Invocation

Délégation **automatique** : le champ `description` de chaque agent déclenche le routage.

Délégation **explicite** (recommandée pour piloter les phases) :

```
Use the data-architect subagent to create the reseauteurs/evenements/reseaux/partenaires collections, the badge field, the réseauteur↔réseaux M2M relation, repoint RGPD, and write MIGRATION.md.
Use the map-engineer subagent to build the two maps (réseauteurs and événements) with distinct Premium event markers.
Use the accounts-and-billing subagent to implement the three roles and the B2B monetization (réseau partenaire subscription, événement Premium one-shot, partenaire annonceur subscription).
Use the seo-engineer subagent to add Person/Event/Organization JSON-LD and the indexation opt-out.
Use the qa-reviewer subagent to review the current branch before merge (including the simplicity criterion).
```

## Parallélisation (Phase 3)

Une fois le schéma figé, ces chantiers avancent en parallèle (peu couplés) :

- `frontend-builder` : design system, **home 3 piliers (< 30 s)**, **3 fiches SSR**, **recherche par
  filtres**, page Partenaires, coquilles dashboards.
- `map-engineer` : **deux cartes** (réseauteurs + événements), clustering, géo, mobile ; **Premium distinct**.
- `accounts-and-billing` : auth + **3 rôles**, dashboards réseauteur/organisateur, **monétisation B2B Stripe**.
- `seo-engineer` : JSON-LD **`Person`/`Event`/`Organization`**, sitemap 3 entités, metadata, ISR, maillage,
  **opt-out d'indexation**.

**Points de contact à surveiller :**
- **Monétisation** : `accounts-and-billing` (statuts partenaire/Premium serveur) × `frontend-builder`
  (UI dashboards, badges Premium) × `map-engineer` (marqueur Premium) × `data-architect` (drapeaux).
- **Cartes × recherche** : `map-engineer` × `frontend-builder` (mêmes filtres alimentent liste + marqueurs).
- **SEO × RGPD** : `seo-engineer` (opt-out indexation) × `data-architect` (RGPD repointé).
- **Slugs** : `data-architect` × `seo-engineer` (3 entités, redirections 301).

## Gates humains (HITL)

> Numérotation **alignée sur `PLAN.md`** : le **verdict** de bascule est le **gate 0** (déjà franchi) ; les
> gates **1→3** restent à valider.

0. ✅ Le **verdict** de bascule (`REFACTOR_IN_PLACE`) — *franchi le 2026-06-28*.
1. L'**ARCHITECTURE.md (3 entités)** + l'**ADR-0011** + le **PLAN.md** (réalignés ; à valider).
2. Le **schéma** (4 collections + badge + M2M) et la **stratégie de re-migration** (⚠️ `down()` `0623`
   destructif).
3. La **revue QA finale** (`qa-reviewer` → `docs/qa/REVIEW-<date>.md`) avant merge.

## Modèles

- `opus` : agents de jugement (`codebase-auditor`, `solution-architect`).
- `sonnet` : agents d'implémentation et de revue (`data-architect`, `frontend-builder`, `map-engineer`,
  `accounts-and-billing`, `seo-engineer`, `qa-reviewer`).
- Ajustable via `CLAUDE_CODE_SUBAGENT_MODEL` ou par agent dans le frontmatter.

## Definition of Done (par agent)

Chaque agent termine par un **artefact durable** + une **checklist cochée**. La **simplicité** (parcours
évident, pas de complexité non nécessaire) est un critère transverse de toutes les checklists.
