# ADR-0008 — Gestion des occurrences récurrentes

> **⚠️ Toujours HORS-V1 — recontextualisé par [ADR-0011](0011-plateforme-trois-entites-monetisation-b2b.md) (2026-06-28).**
> La récurrence reste **hors périmètre V1**. **Ce qui change sous l'ADR-0011 :**
> (a) les **événements reviennent en V1** mais en **saisie unitaire** (un événement = une fiche datée +
> un marqueur), rattachés à un réseau, avec **lien d'inscription externe** — RÉSEAUTEURS n'organise pas ;
> (b) la **récurrence / génération assistée** est repoussée dans les **évolutions futures** (cf. cadrage §9 —
> « import automatique d'événements CSV/iCal/API », horizon V4), pas seulement « post-MVP » ;
> (c) **le placeholder `serieId` est RETIRÉ** de la collection `evenements` simplifiée (ADR-0011 §9,
> `ARCHITECTURE.md §5`, `MIGRATION.md`) au nom de la **simplicité d'abord** : on ne réserve pas de schéma
> pour une capacité non planifiée en V1 ; sa réintroduction future sera une migration **additive** ;
> (d) le **quota** discuté ci-dessous est **caduc** (ADR-0011 : pas de quota — voir ADR-0004).
> **En cas de conflit, l'ADR-0011 prévaut.**

- **Statut :** ~~Proposé / différé — HORS-MVP~~ — **hors V1 (évolution future « import auto ») ; placeholder `serieId` retiré (ADR-0011)**
- **Date :** 2026-06-23 (mise à jour 2026-06-23 après arbitrage)
- **Décideurs :** Humain (product owner) + `solution-architect` + métier
- **Portée :** modèle Occurrence, carte, SEO, quota
- **Dépend de :** ADR-0003, ADR-0004

> **Arbitrage humain (résout la Question ouverte Q7) :** la récurrence est **hors-MVP**. Le **MVP fonctionne en saisie occurrence par occurrence** (statu quo de l'existant). `data-architect` doit **uniquement réserver la place dans le schéma** (placeholder `serieId`/`recurrence`), **sans implémenter** la génération RRULE ni l'assistant. La capacité décrite ci-dessous (génération assistée matérialisée) est la **cible d'un jalon ultérieur**, documentée ici pour ne pas avoir à refaire le débat ni une seconde migration structurante.
>
> ⚠️ **Mise à jour ADR-0011 :** l'arbitrage ci-dessus de **réserver un placeholder `serieId`** est **annulé** —
> sous le modèle à 3 entités et le principe « simplicité d'abord », la collection `evenements` simplifiée
> **ne porte pas** `serieId`. La réactivation future de la récurrence (via l'import auto, horizon V4) se fera
> par migration **additive**.

## Contexte

Le positionnement (CLAUDE.md §1) est **réseaux récurrents** : « afterworks récurrents », « un organisateur = des dizaines de points sur la carte ». Le modèle Réseau→Occurrences est précisément choisi pour régler le cold-start via la **multiplicité d'occurrences datées** d'un même réseau.

L'existant ne modélise **pas** la récurrence : chaque occurrence (`Evenements`) est saisie une à une, avec `dateDebut`/`dateFin` uniques (`Evenements.ts:484-492`). L'audit le note (§4) : « Manque : récurrence native (RRULE) — aujourd'hui chaque occurrence est saisie une à une. » Pour un réseau qui se réunit « tous les 2ᵉ mardis du mois », saisir 12+ occurrences manuellement est rédhibitoire pour l'organisateur à terme — d'où la cible ci-dessous, **post-MVP**.

Tension avec ADR-0004 : si le quota porte sur le **nombre d'occurrences/an** (10/20/∞), la façon dont une future récurrence **consomme le quota** doit être décidée (une série = N crédits ? une série = 1 crédit ?). Au MVP, chaque occurrence étant saisie à la main, elle consomme naturellement un crédit — aucune ambiguïté. *(Caduc sous ADR-0011 : pas de quota.)*

## Décision

### Au MVP (ce que `data-architect` et l'implémentation livrent maintenant)

- **Pas de récurrence.** Saisie occurrence par occurrence, comme aujourd'hui.
- ~~**Schéma : réserver la place uniquement.** Prévoir un placeholder neutre sur `evenements` — soit un champ `serieId` (nullable, sans relation active), soit un groupe `recurrence` vide non exposé — pour qu'une future activation soit **additive** et n'impose pas une seconde migration structurante.~~ **Annulé par ADR-0011 :** pas de placeholder `serieId` ; la collection `evenements` simplifiée ne le porte pas (réintroduction future = migration additive). **Ne pas** créer l'entité `series-evenement`, **ne pas** brancher de cron de génération, **ne pas** exposer d'UI d'assistant.

### Cible post-MVP (évolution future — pour mémoire, non à implémenter)

**Génération assistée d'occurrences à partir d'une règle de récurrence, matérialisées en lignes `evenements` distinctes (pas de récurrence purement virtuelle).** *(Sous ADR-0011, cette cible relève des évolutions futures « import automatique CSV/iCal/API », horizon V4 — cadrage §9.)*

1. **Modèle** : champ `serie` (relationTo une entité légère `series-evenement`, ou groupe `recurrence` : `rrule`/`frequence`, `jusquA`, `serieId`). La récurrence décrite une fois ; un assistant **matérialise** les occurrences à venir comme lignes réelles dans `evenements`.
2. **Pourquoi matérialiser** (vs occurrences virtuelles calculées à la volée) :
   - le SEO exige une **fiche par occurrence** (`/evenement/<slug>`, JSON-LD `Event` daté — ADR-0005) ; une occurrence virtuelle n'a pas d'URL stable indexable ;
   - la carte filtre par date sur des points réels indexés spatialement (ADR-0002) ;
   - chaque occurrence garde son slug figé et son cycle de vie (archivage cron existant).
3. **Édition de série** : éditer la série propose de propager aux occurrences futures non encore passées ; les occurrences passées restent figées (cohérence SEO/archive).
4. **Consommation du quota (ADR-0004)** : *(caduc sous ADR-0011 — pas de quota)* historiquement, **chaque occurrence matérialisée consomme un crédit annuel.**
5. **Génération bornée** : matérialiser au plus l'horizon utile (ex. 12 mois glissants), régénérée par un cron, pour éviter d'exploser le volume.

## Conséquences

**Positives :**

- MVP simple et sans risque : aucune logique de récurrence à tester au démarrage.
- L'activation future de la récurrence reste **additive** (migration additive, pas de seconde migration structurante).
- Cible documentée : l'organisateur saisira à terme une règle, pas 12 dates → adoption, cold-start réglé, chaque occurrence restant un actif SEO réel et un point de carte indexé.

**Négatives / risques :**

- Au MVP, saisir des réseaux très récurrents reste manuel — friction acceptée et bornée dans le temps (évolution future).
- Cible : volume d'occurrences matérialisées (cron de génération + cron d'archivage), logique d'édition de série (propagation) non triviale. Tout cela est **hors V1**.

## Alternatives écartées

1. **Occurrences purement virtuelles (RRULE calculée au rendu, pas de lignes).** Écartée (y compris pour la cible) : pas d'URL/SEO stable par occurrence, pas d'indexation spatiale par date, incompatible avec l'exigence SEO forte.
2. **Implémenter la génération assistée dès le MVP/la V1.** Écartée par arbitrage humain : hors chemin critique ; on stabilise d'abord les 3 entités, la géo et la monétisation B2B.
3. ~~**Ne rien réserver dans le schéma.**~~ **Retenue sous ADR-0011 :** au nom de la simplicité, on ne réserve **pas** de placeholder `serieId` ; la réintroduction future sera une migration additive.

> **Séquençage :** hors V1. La capacité complète est planifiée comme **évolution future** (import automatique d'événements, cadrage §9) une fois le socle à 3 entités stabilisé.
