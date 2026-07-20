# Pipeline des agents — RÉSEAUTEURS

Équipe de subagents Claude Code pour construire et faire évoluer **RÉSEAUTEURS — la plateforme nationale du
networking** (modèle à **trois entités** : réseauteurs · événements · réseaux). Lire `CLAUDE.md` (racine) pour
le contexte produit complet, puis `.claude/README.md` pour le mode d'emploi.

> **Cap actuel (ADR-0011 → 0016).** Trois entités reliées. Monétisation **mixte** : réseauteur **Gratuit /
> Plus** (39 € HT/an, débloque la création d'événements) · réseau partenaire par **paliers**
> (`fiche`/`starter`/`growth`/`enterprise`, porté par la **tête de réseau**) · partenaire annonceur —
> **gestion en libre-service** via le hub `/dashboard/abonnement` (ADR-0016). **Quatre rôles**
> (réseauteur / organisateur / partenaire / admin). **Deux cartes** (réseauteurs + événements). **Badges**
> déclaratifs. **Recherche simple** par filtres. **Confidentialité proportionnée**. **Priorité absolue : la
> simplicité** (compris en < 30 s). Verdict de reprise : **`REFACTOR_IN_PLACE`** sur Payload.
>
> ⚠️ Caduc : annuaire mono-entité (ADR-0010), **événement Premium** (ADR-0012), **packs de licences /
> codes promo partenaires** (ADR-0015). Les agents `privacy-engineer` et `search-engineer` ont été retirés
> (préoccupations repliées). Il reste **12 agents** (8 construction + 4 audit ciblé).

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
        ├── data-architect.md        (3 entités + partenaires + badges + 4 rôles + RGPD + index)
        ├── frontend-builder.md      (home + 3 fiches + recherche par filtres + dashboards)
        ├── map-engineer.md          (2 cartes : réseauteurs + événements)
        ├── accounts-and-billing.md  (4 rôles + monétisation mixte Stripe + hub abonnement)
        ├── seo-engineer.md          (JSON-LD Person/Event/Organization + opt-out indexation)
        ├── qa-reviewer.md           (gate qualité — lecture + tests)
        ├── test-fonctionnel.md      (parcours métier de bout en bout — API Payload)
        ├── test-securite.md         (autorisation, RGPD, statut payant serveur)
        ├── test-performance.md      (N+1, ISR, index, payloads carte)
        └── test-ux.md               (a11y + clarté + < 30 s)
```

> Les subagents sont chargés au **démarrage de session**. Après avoir édité un fichier sur disque,
> **redémarrer Claude Code** (ou utiliser `/agents`) pour qu'il soit pris en compte.

## Chaîne de valeur (modèle 3 entités)

```
Phase 0  DÉCOUVERTE      codebase-auditor      →  AUDIT.md  +  AUDIT-DELTA-RESEAUTEURS.md   [lecture seule]
            │  ✅ FAIT — verdict REFACTOR_IN_PLACE (amendement 3-entités le 2026-06-28).
            ▼
Phase 1  PLAN            solution-architect    →  ARCHITECTURE.md (modèle 3 entités)
            │                                     docs/adr/*.md (0011 → 0016)
            │                                     PLAN.md (reséquencé)
            │  ✅ FAIT — archi/ADR/plan alignés. (gate humain franchi)
            ▼
Phase 2  FONDATIONS      data-architect        →  collections reseauteurs/evenements/reseaux/partenaires
            │                                     + badge + M2M + 4 rôles + RGPD + index + migrations
            │                                     MIGRATION.md
            │  ✅ FAIT — schéma & re-migration validés.
            ▼
Phase 3  CONSTRUCTION    frontend-builder    ─┐
            │            map-engineer        ─┤ →  V1 CONSTRUITE
            │            accounts-and-billing ┤    (parallélisable, cf. PLAN.md)
            │            seo-engineer        ─┘
            ▼
Phase 4  VÉRIFICATION    qa-reviewer           →  docs/qa/REVIEW-<date>.md      [lecture + tests]
            │            test-fonctionnel     ─┐
            │            test-securite         ┤ →  docs/qa/TEST-*.md            [lecture seule]
            │            test-performance      ┤
            │            test-ux              ─┘
```

## Où en est-on ? (état au 2026-07-20)

- **Phases 0-4 ✅ : la V1 à 3 entités est construite.** Les décisions successives (ADR-0011 → 0016) ont été
  implémentées **in place** : Réseauteur **Plus**, hiérarchie réseau **tête ↔ local** + paliers, inscriptions
  en ligne, suppression des packs de licences, **gestion d'abonnement unifiée** (`/dashboard/abonnement`).
- **Mode courant : évolution + vérification.** Une nouvelle décision → ADR + validation humaine →
  implémentation par l'agent responsable → audit par les agents `test-*` + `qa-reviewer` avant merge.
- **Dépendances PO ouvertes :** prix Stripe réels (`STRIPE_PLUS_PRICE_ID`, `STRIPE_PRICE_NATIONAL_*`) —
  placeholders dans `src/lib/stripe.ts` / `src/lib/reseau-hierarchie.ts`.

## Invocation

Délégation **automatique** : le champ `description` de chaque agent déclenche le routage.

Délégation **explicite** (recommandée pour piloter une évolution) :

```
Use the data-architect subagent to add <champ/collection> and its migration.
Use the accounts-and-billing subagent to implement <évolution de facturation/rôle> and wire it to the /dashboard/abonnement hub.
Use the map-engineer subagent to adjust the réseauteurs / événements maps.
Use the seo-engineer subagent to extend the Person/Event/Organization JSON-LD and the indexation opt-out.
Use the test-fonctionnel subagent to exercise <parcours> end-to-end and report pass/fail.
Use the test-securite subagent to audit authorization & server-side paid-status on the current branch.
Use the qa-reviewer subagent to review the current branch before merge (including the simplicity criterion).
```

## Parallélisation (Phase 3 / évolutions)

Chantiers peu couplés qui avancent en parallèle une fois le schéma figé :

- `frontend-builder` : design system, **home 3 piliers (< 30 s)**, **3 fiches SSR**, **recherche par
  filtres**, page Partenaires, dashboards (réseauteur / organisateur / partenaire).
- `map-engineer` : **deux cartes** (réseauteurs + événements), clustering, géo, mobile.
- `accounts-and-billing` : auth + **4 rôles**, dashboards, **monétisation mixte Stripe** + **hub abonnement**
  (souscrire / changer de palier / annuler / réactiver / factures ; `resolveAbonnement`, webhooks serveur).
- `seo-engineer` : JSON-LD **`Person`/`Event`/`Organization`**, sitemap 3 entités, metadata, ISR, maillage,
  **opt-out d'indexation**.

**Points de contact à surveiller :**
- **Monétisation** : `accounts-and-billing` (statuts serveur `users.plusActif` / `reseaux.partenaire+palier` /
  `partenaires.statut`, hub) × `frontend-builder` (UI dashboards) × `data-architect` (drapeaux/champs Stripe).
- **Cartes × recherche** : `map-engineer` × `frontend-builder` (mêmes filtres alimentent liste + marqueurs).
- **SEO × RGPD** : `seo-engineer` (opt-out indexation) × `data-architect` (RGPD repointé).
- **Slugs** : `data-architect` × `seo-engineer` (3 entités, redirections 301).

## Gates humains (HITL)

0. ✅ Le **verdict** de bascule (`REFACTOR_IN_PLACE`) — *franchi le 2026-06-28*.
1. ✅ **ARCHITECTURE.md (3 entités)** + **ADR-0011** + **PLAN.md**.
2. ✅ Le **schéma** (4 collections + badge + M2M + 4 rôles) et la **re-migration**.
3. **Continu :** toute **nouvelle évolution de schéma ou d'invariant de monétisation** passe par un **ADR +
   validation humaine** avant implémentation ; la **revue QA** (`qa-reviewer` + audits `test-*`) avant merge.

## Modèles

- `opus` : agents de jugement (`codebase-auditor`, `solution-architect`).
- `sonnet` : agents d'implémentation, de revue et d'audit ciblé (`data-architect`, `frontend-builder`,
  `map-engineer`, `accounts-and-billing`, `seo-engineer`, `qa-reviewer`, `test-fonctionnel`, `test-securite`,
  `test-performance`, `test-ux`).
- Ajustable via `CLAUDE_CODE_SUBAGENT_MODEL` ou par agent dans le frontmatter.

## Definition of Done (par agent)

Chaque agent termine par un **artefact durable** (code + migration, ou rapport) + une **checklist cochée**. La
**simplicité** (parcours évident, pas de complexité non nécessaire) est un critère transverse de toutes les
checklists. Le **statut payant/rôle posé côté serveur** (jamais client) est un invariant de toute revue.
