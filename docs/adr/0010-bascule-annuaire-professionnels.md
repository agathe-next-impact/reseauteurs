# ADR-0010 — Bascule produit : annuaire de professionnels (RÉSEAUTEURS) — reprise sur Payload, périmètre V1, messagerie en V2

> **⚠️ Partiellement supersédé par [ADR-0011](0011-plateforme-trois-entites-monetisation-b2b.md) (2026-06-28).**
> L'ADR-0011 réintroduit les **événements** et les **réseaux comme entités** (modèle à **3 entités**), bascule
> la monétisation vers le **B2B** (réseauteurs gratuits ; réseau partenaire + événement Premium + annonceur),
> ajoute le rôle **organisateur** et les **badges**, et **abandonne** les piliers « projection de
> confidentialité par champ + double geom » et « recherche FTS à facettes » au nom de la **simplicité**.
> Restent valables de cette ADR : la **reprise sur Payload** (refactor in place), la stack, et le principe
> **« le site ne remplace aucun réseau, il les rassemble »**. **En cas de conflit, l'ADR-0011 prévaut.**

- **Statut :** Accepté — **partiellement supersédé par ADR-0011**
- **Date :** 2026-06-27
- **Décideurs :** Humain (product owner) + analyse Claude
- **Portée :** modèle de domaine, choix de stack, abonnements, périmètre V1, feuille de route, marque
- **Réaffirme :** ADR-0001 (accès Payload), ADR-0002 (PostGIS), ADR-0006 (MapLibre), ADR-0009 (groupes dormants)
- **Amende / supersède :** ADR-0003 (fusion Réseau → entité centrale), ADR-0004 (quota occurrences + 3 paliers), ADR-0005 (SEO/URLs), ADR-0007 (rebranding Panorama→Info-Réseaux), ADR-0008 (récurrence — rendu sans objet au MVP)

> **Cette ADR est structurante.** Elle acte un **repositionnement produit**, pas une itération. Elle révise le modèle de domaine cible décrit dans `ARCHITECTURE.md` (orienté Réseau→Occurrences) au profit d'un modèle centré sur le **profil professionnel individuel**. `ARCHITECTURE.md` devra être réaligné en conséquence (chantier `solution-architect`).

## Contexte

Le document `docs/evolution/Reseauteurs - Document de cadrage.md` (v1.0, 27 juin 2026) redéfinit le produit. Tout le pipeline antérieur (`AUDIT` → `ARCHITECTURE` → ADR 0001-0009 → migrations `data-architect`) a construit **« la carte des événements business »** sur un modèle **Réseau → Occurrences** : une entité durable (un réseau) possède des **événements datés**, et un **organisateur paie 90/130/190 € HT** pour les publier (quota d'occurrences/an).

Le cadrage **inverse l'objet central** :

- **RÉSEAUTEURS** = *« le premier annuaire national des professionnels qui développent leur réseau »*.
- Le marqueur de la carte devient **une personne** (un professionnel), pas un événement ni un réseau.
- **Chaque professionnel** est le client : **freemium Gratuit (0 €) / Premium (39 €/an)**.
- Les réseaux (BNI, DCF, CJD…) ne sont plus des entités possédées mais des **attributs/tags** d'un profil.
- Les **événements sortent du périmètre V1** (agenda national renvoyé en V2).
- Nouveaux piliers absents de l'existant : **profil membre**, **recherche multicritères à facettes**, **messagerie interne**, **confidentialité pilotée par l'utilisateur**, **validation des inscriptions**.

Cette bascule a fait l'objet d'une analyse comparée (reprise vs nouvelle stack) résumée ci-dessous et tracée dans `docs/evolution/ROADMAP-V1.md`. Deux arbitrages humains conditionnent la décision de stack :

1. **La messagerie est reportée en V2** (hors V1).
2. **L'admin Payload est conservé** (pas de back-office à reconstruire).

## Décision

### 1. Stack — reprise sur Payload (refactor in place), domaine reconstruit *dans* le repo

**On conserve le dépôt, la stack et l'infra existants ; on ne crée pas de nouvelle stack.** La couche d'accès reste **Payload CMS** (ADR-0001 réaffirmé), avec son admin auto-généré, son auth, son field-level access, son pipeline média et ses hooks.

Justification de l'écartement du greenfield, compte tenu des deux arbitrages :

- **Reporter la messagerie en V2 retire le seul gain réellement exclusif au greenfield** (pas de besoin temps réel / WebSocket en V1 → Payload ne gêne plus aucun pilier structurant).
- **Conserver l'admin = rester sur Payload** par définition (l'admin auto-généré *est* Payload). Le coût principal du greenfield (reconstruire back-office + auth + access-control + média) n'est pas consenti.
- Tout le reste de la stack (Next.js, Postgres/PostGIS, Stripe, MapLibre, Resend, Vercel, géocodage data.gouv) serait **re-choisi à l'identique** → le greenfield ne paierait qu'un coût de réécriture sans contrepartie.

Le travail n'est donc **pas** un choix de stack mais une **reconstruction du modèle métier in place** : on greenfield le *domaine* à l'intérieur du dépôt, et on **retire franchement** (≠ dormant) le modèle événementiel devenu caduc.

### 2. Entité centrale — le Profil membre (personne)

Introduction d'une collection **`membres`** (profil professionnel individuel) : identité, photo, fonction, entreprise, secteurs, compétences, **réseaux fréquentés (multi)**, **« ce que je recherche »** (client / partenaire / fournisseur / investisseur / recrutement / sous-traitance), zone d'intervention, géolocalisation (`geom`, ADR-0002), galerie, agenda personnel. Règle pressentie : **1 user = 1 membre** (réversible, même esprit que ADR-0003/Q4). Détail du schéma laissé à `data-architect`.

### 3. Les réseaux deviennent une taxonomie (ADR-0003 amendé)

Le modèle **Réseau → Occurrences** n'est plus le cœur du produit. Les réseaux (BNI, DCF…) deviennent un **référentiel** que les membres se taguent (relation many-to-many `membre ↔ réseaux`), **pas** une entité possédée à raison d'« 1 user = 1 réseau ». Sort de `data-architect` à trancher : **repurposer** la collection `reseaux` existante en référentiel plat, **ou** la mettre dormante (pattern ADR-0009) et créer un référentiel dédié. La collection `evenements` et le quota associé sont **hors V1** (voir §4 et §6).

### 4. Freemium — 2 paliers, suppression du quota d'occurrences (ADR-0004 superséd­é)

- **Gratuit (0 €)** : présence sur la carte, photo, métier, entreprise, fiche simple.
- **Premium (39 €/an)** : + coordonnées, galerie, agenda, référencement renforcé, mise en avant.

Le **quota d'occurrences/an (12 mois glissants)** et les **3 paliers 90/130/190 €** sont **supprimés** : ils n'ont plus d'objet (pas d'occurrences à publier en V1). La plomberie Stripe (checkout, portal, webhooks, factures, crons) est **conservée** mais **recalibrée sur un palier payant unique**. `getEffectiveFeatureLevel` passe d'un modèle à 3 niveaux à un modèle **binaire gratuit/premium**, et les gates de champ (`isPremium…`) sont réalignées sur le déverrouillage profil (coordonnées/galerie/agenda).

### 5. Contact V1 = déverrouillage des coordonnées ; messagerie en V2

La **messagerie interne** (pilier 6.4 du cadrage) est **reportée en V2**, en même temps que l'agenda national. En V1, le mécanisme de mise en relation est : **Premium déverrouille l'affichage des coordonnées** (email / téléphone / site) → contact en direct. Logique freemium assumée : **gratuit = visible, Premium = joignable**.

**Couture pour ne pas bloquer la V2** (coût V1 ~nul) :
- Conserver une **identité adressable** sur le profil membre (de quoi alimenter une future boîte de réception).
- Prévoir un champ **préférence de contact** plutôt que de coder en dur « contact = coordonnées ».
- Aucune copie UI affirmant « pas de messagerie ».

La messagerie étant un **module auto-contenu et faiblement couplé** (futures collections `conversations`/`messages`), son report est peu risqué — contrairement à la récurrence (ADR-0008) qui touchait le modèle d'événement.

### 6. Périmètre V1 — resserrement assumé vs cadrage

Le cadrage place la **messagerie dans le périmètre V1** (§5 et pilier 6.4). La reporter en V2 est un **resserrement délibéré du périmètre V1**, acté ici. Le périmètre V1 retenu et la trajectoire complète sont détaillés dans `docs/evolution/ROADMAP-V1.md`.

### 7. Modération & confidentialité

- **Validation des inscriptions** (Parcours A, étape 2) : un profil n'apparaît qu'après validation admin. Implémentée par un champ `statut` (en attente / validé / suspendu) + la vue liste filtrable de l'admin Payload — usage natif et économique de Payload.
- **Confidentialité par champ** (pilier 6.6) : visibilité public/masqué par champ (coordonnées, adresse exacte → **localisation approchée** sur la carte).
  - **⚠️ Correction post-audit (voir `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` §5.1) :** le field-level access de Payload **ne suffit PAS** pour le rendu public. Les fiches publiques sont rendues en SSR avec `overrideAccess: true` (routes geo, sitemap, pages publiques), ce qui **bypasse** le field-access. La confidentialité d'affichage doit donc reposer sur une **projection de visibilité explicite** (drapeaux par champ lus et appliqués dans le composant de rendu ET la route geo), pas sur le field-access seul — sinon **fuite de coordonnées/adresse exacte**.
  - La **localisation approchée** exige un **`geom` approché distinct du `geom` exact** (jitter déterministe / centroïde commune), seul l'approché étant servi par `api/geo/membres` (sinon reverse-geocoding trivial). Brique neuve.
  - Ces deux points sont à cadrer dans un **ADR dédié** avant implémentation. (Sans messagerie en V1, il n'y a en revanche pas de correspondance privée à protéger.)

### 8. Marque (ADR-0007 superséd­é)

Identité cible **RÉSEAUTEURS** (et non plus Info-Réseaux). Domaine, vocabulaire (« professionnels / profils / membres » en place de « réseaux / occurrences »), copie et emails à réaligner. `lib/site.ts` reste le point de centralisation.

## Conséquences

**Positives :**

- Aucun choix de stack à refaire : l'infra testée (Stripe, RGPD, SEO/JSON-LD, carte, géocodage, auth, emails, sécurité, crons, PostGIS) est **conservée**.
- Périmètre V1 simplifié : suppression du quota d'occurrences, des 3 paliers et de la publication d'événements ; Stripe réduit à un palier.
- Modération et confidentialité tirent parti des points forts natifs de Payload (admin, field-access).
- Report de la messagerie peu risqué (module auto-contenu) + couture documentée.

**Négatives / risques :**

- **`ARCHITECTURE.md` et plusieurs ADR (0003, 0004, 0005, 0007, 0008) sont à réaligner** : un delta d'audit + une révision d'architecture sont nécessaires (chantier `solution-architect`) avant la reprise d'implémentation.
- **Trois modules neufs** (profil membre, recherche multicritères, messagerie en V2) — l'essentiel de l'effort, indépendant du choix de stack.
- **Le travail récent de `data-architect`** (collection `reseaux`, migrations de fusion, refonte `evenements`/quota) est en grande partie **à démonter ou neutraliser** — coût irrécupérable partiel assumé.
- **⚠️ Précision post-audit (delta §0/§6) : le dépôt n'est PAS « Réseau→Occurrences abouti » mais à moitié migré.** Le 1er pivot (PanoramaPub→Info-Réseaux) n'a touché que ~5 fichiers + 4 migrations ; le fond reste **massivement PanoramaPub** (≈78 fichiers « Panorama Pub », plans 99/219 €, objet publicitaire, `jsonld`/`sitemap`/geo/downgrade jamais migrés). La bascule est donc un **double démontage** (PanoramaPub résiduel + Réseau→Occurrences à demi construit, ≈70-80 fichiers source) suivi de la construction membre — mécanique mais à chiffrer comme tel.
- **⚠️ Bug latent à corriger en passant (delta §5.6) :** `Users.ts:85` force `plan = 'gratuit'` à l'inscription alors que l'enum `plan` et la migration `20260623_130000` ne contiennent que `acces/developpement/premium` → **toute inscription non-admin casse si cette migration est appliquée**. Le passage au binaire `gratuit/premium` résout l'incohérence, à condition de le faire de bout en bout.
- **SEO de profils de personnes physiques** : enjeux RGPD / e-réputation (indexation de noms, droit au déréférencement, opt-out d'indexation) à intégrer dès la conception.
- **Code mort à retirer proprement** (quota, paliers, `participer`/`participantsSignales`, branches événementielles) — préférer la suppression franche à la dormance pour éviter un modèle zombie.

## Alternatives écartées

1. **Créer une nouvelle stack (greenfield).** Écartée : hors coût de dev, le seul gain exclusif (liberté messagerie temps réel + sortie de Payload) tombe dès lors que la messagerie passe en V2 et que l'admin Payload est conservé. Le reste de la stack serait re-choisi à l'identique. Le greenfield ne paierait qu'une réécriture d'infra non différenciante (Stripe/RGPD/SEO/sécurité), au prix de la vitesse d'amorçage — facteur clé de succès n°1 du cadrage.
2. **Conserver le modèle Réseau → Occurrences et l'étendre.** Écartée : le cadrage inverse l'objet central (personne, pas événement) ; le modèle événementiel ne converge pas vers l'annuaire de professionnels.
3. **Implémenter la messagerie dès la V1 (conforme au cadrage §5).** Écartée par arbitrage : module à forte surface RGPD/anti-spam/temps réel, non nécessaire à la densité d'amorçage ; reportée en V2 avec l'agenda national.
4. **Mettre le modèle événementiel « dormant » (pattern ADR-0009) plutôt que de le retirer.** Partiellement écartée : la dormance se justifie pour les groupes (actif isolé, réactivation crédible) mais le modèle Réseau→Occurrences est au cœur du domaine basculé — le laisser dormant créerait un modèle zombie ambigu. Préférence pour un **retrait franc**, sauf si `data-architect` démontre une réutilisation propre en référentiel.
