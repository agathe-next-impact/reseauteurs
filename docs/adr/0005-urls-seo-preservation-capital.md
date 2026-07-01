# ADR-0005 — Schéma d'URLs cible et préservation du capital SEO

> **➕ En vigueur, amendé par [ADR-0011](0011-plateforme-trois-entites-monetisation-b2b.md) (2026-06-28).**
> Le principe — **URLs propres au singulier + redirections 301 exhaustives + slugs figés** — reste **pleinement
> valable**. **Ce qui change sous l'ADR-0011 :** le schéma d'URLs couvre désormais **trois entités** —
> **`/reseauteur/<prenom-nom>`** (nouveau, JSON-LD `Person`), `/evenement/<slug>` (JSON-LD `Event`,
> `organizer` = réseau), `/reseau/<slug>` (JSON-LD `Organization`). Les redirections 301 listées plus bas
> (`/revendeurs/*`, `/organisateurs/*`, `/evenements/*` → cibles au singulier) **restent les sources legacy à
> couvrir**. La **collision de slug réseauteur** (homonymes) est à trancher par `data-architect`/`seo-engineer`
> (suffixe déterministe ; voir `ARCHITECTURE.md §8`). **En cas de conflit, l'ADR-0011 prévaut.**

- **Statut :** Accepté — **en vigueur, étendu à 3 entités (+`/reseauteur`) par ADR-0011**
- **Date :** 2026-06-23 (mise à jour 2026-06-23 après arbitrage)
- **Décideurs :** Humain (product owner) + `solution-architect` + `seo-engineer`
- **Portée :** routing, SEO, redirections, sitemap
- **Dépend de :** ADR-0003

## Contexte

L'audit identifie le **SEO/SSR comme actif majeur** (5/5, §5) : SSR+ISR par fiche, `generateMetadata` dynamique, JSON-LD `Event`/`LocalBusiness`/`Breadcrumb`/`FAQ` (`lib/jsonld.ts`), sitemap dynamique filtré noindex+date (`sitemap.ts`), redirections 308 legacy-id→slug déjà en place (`evenements/[slug]/page.tsx:41-58`). **Préserver ce capital est une contrainte forte** (CLAUDE.md §7, audit §7 « slugs et URLs existants à préserver via redirections »).

Le CLAUDE.md §7 demande des URLs **`/reseau/<slug>`** et **`/evenement/<slug>`** (singulier). L'existant sert :

- `/evenements/<slug>` (pluriel) — `src/app/(frontend)/evenements/[slug]/page.tsx`
- `/revendeurs/<slug>` — `src/app/(frontend)/revendeurs/[slug]/page.tsx`
- `/organisateurs/<slug>` — `src/app/(frontend)/organisateurs/[slug]/page.tsx`

Ces URLs sont **déjà indexées** (sitemap `sitemap.ts:63-89`). Tout changement de chemin doit être accompagné de **redirections 301** pour ne pas perdre le jus SEO. La fusion d'entités (ADR-0003) supprime de toute façon `/organisateurs/*` comme espace distinct.

> **Arbitrage humain (résout la Question ouverte Q3) :** **on adopte les URLs au singulier `/reseau/<slug>` et `/evenement/<slug>`, conformes au CLAUDE.md §7**, avec redirections 301 exhaustives depuis les anciennes URLs PanoramaPub. La cohérence de marque (rebranding Panorama→Info-Réseaux, ADR-0007) justifie la refonte d'URLs, et la fusion d'entités impose de toute façon une convergence des chemins réseau.

## Décision

**Schéma d'URLs cible (tranché) :**

| Concept | URL cible | Existant | Redirection 301 requise |
|---|---|---|---|
| Réseau (fiche) | `/reseau/<slug>` | `/revendeurs/<slug>` + `/organisateurs/<slug>` | `/revendeurs/<slug>` → `/reseau/<slug>` ; `/organisateurs/<slug>` → `/reseau/<slug>` (post-fusion, slugs préservés/dédoublonnés) |
| Occurrence (fiche) | `/evenement/<slug>` | `/evenements/<slug>` | `/evenements/<slug>` → `/evenement/<slug>` |
| Liste réseaux | `/reseaux` | `/revendeurs` | `/revendeurs` → `/reseaux` |
| Liste/carte occurrences | `/evenements` + `/carte` | `/evenements` | conserver `/evenements` (liste) + ajouter `/carte` (carte plein écran) |

**Mécanique de préservation :**

1. **Slugs figés et préservés** à la migration (ADR-0003) — aucune régénération de slug.
2. **Redirections** déclarées dans `next.config.ts` `redirects()` (statique, comme la redirect www→apex existante `next.config.ts:76-85`) et/ou table de redirections en base pour les cas dynamiques (slugs dédoublonnés). Conserver le **fallback legacy-id→slug** existant (`evenements/[slug]/page.tsx:41-58`) adapté aux nouveaux chemins `/evenement/<slug>` et `/reseau/<slug>`.
3. **Sitemap** (`src/app/sitemap.ts`) régénéré sur les nouvelles URLs au singulier et l'entité unique `reseaux` (suppression de la 3e branche `organisateurs`).
4. **Canonical/OG** mis à jour vers les nouvelles URLs (`lib/seo.ts`).
5. **JSON-LD `Event`** conservé et enrichi (la fiche occurrence reste la cible longue-traîne ; ajouter `organizer` = Réseau, `location` géocodée). Le JSON-LD est déjà échappé XSS (`JsonLd.tsx:9`) — ne pas régresser.
6. **Maillage interne** « réseaux à proximité / même catégorie » (CLAUDE.md §7) servi par les requêtes `ST_DWithin` (ADR-0002).

## Conséquences

**Positives :**

- Cohérence d'URLs avec le positionnement réseaux-first et le CLAUDE.md §7 ; un seul espace d'URLs réseau après fusion.
- Capital SEO préservé dès lors que les redirections 301 sont exhaustives et testées.

**Négatives / risques :**

- **Toute redirection manquante = perte de position.** Exige une checklist exhaustive et des tests (e2e sur les redirections) avant déploiement. `qa-reviewer` doit vérifier chaque ancienne URL indexée.
- Période de transition : Google met du temps à propager les 301 ; surveiller la Search Console.
- Les slugs dédoublonnés à la fusion (ADR-0003) créent des cas particuliers de redirection à mapper individuellement.

## Alternatives écartées

1. **Conserver le pluriel existant** (`/evenements/<slug>`, et ne créer `/reseau` que parce que la fusion l'impose). Écartée par l'arbitrage humain : la cohérence de marque (singulier conforme CLAUDE.md §7) prime, et le rebranding + la fusion d'entités justifient la refonte d'URLs de toute façon.
2. **Changer les slugs eux-mêmes (re-slugifier).** Écartée formellement : détruirait le capital SEO. Les slugs restent figés (déjà la règle existante : `Evenements.ts:159-161`).
3. **Pas de redirections, on laisse les anciennes URLs 404.** Écartée : perte directe du trafic acquis, contraire à l'audit §7.
