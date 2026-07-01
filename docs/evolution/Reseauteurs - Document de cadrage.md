# RÉSEAUTEURS — Document de cadrage projet

> **La plateforme nationale du networking.**

**Définition de la plateforme** — Vision · Positionnement · Périmètre · Orientations produit

| Élément | Valeur |
|---|---|
| **Objet du document** | Définir la plateforme : vision, ambition, périmètre et orientations produit. |
| **Version** | 2.0 (modèle à trois entités) |
| **Date** | 28 juin 2026 |
| **Statut** | Document de travail — à valider |
| **Décision de fond** | `docs/adr/0011-plateforme-trois-entites-monetisation-b2b.md` |
| **Périmètre** | Hors spécifications techniques (traitées dans `ARCHITECTURE.md`). |

> **À propos de ce document** — Il définit le *pourquoi* et le *quoi* du projet. La v2.0 remplace la v1.0
> (annuaire mono-entité, ADR-0010) par le modèle à **trois entités reliées** acté par l'ADR-0011 :
> **réseauteurs**, **événements**, **réseaux**.

---

## Sommaire

1. [Contexte et problématique](#1-contexte-et-problématique)
2. [Vision et positionnement](#2-vision-et-positionnement)
3. [Objectifs du projet](#3-objectifs-du-projet)
4. [Public cible et personas](#4-public-cible-et-personas)
5. [Périmètre de la plateforme](#5-périmètre-de-la-plateforme)
6. [Les trois entités et les piliers fonctionnels](#6-les-trois-entités-et-les-piliers-fonctionnels)
7. [Comptes et rôles](#7-comptes-et-rôles)
8. [Modèle économique](#8-modèle-économique)
9. [Trajectoire produit](#9-trajectoire-produit)
10. [Facteurs clés de succès et risques](#10-facteurs-clés-de-succès-et-risques)
11. [Principe directeur : la simplicité d'abord](#11-principe-directeur--la-simplicité-dabord)

---

## 1. Contexte et problématique

Le réseautage professionnel est une activité de masse, mais profondément **fragmentée**. Chaque semaine, des
centaines de milliers de professionnels participent en France à des événements de networking, répartis dans
des dizaines de réseaux distincts : BNI, DCF, CJD, Cafés Business, Dynabuy, Rotary, Lions Club, Réseau
Entreprendre, CPME, Medef, et bien d'autres.

Cette fragmentation crée un angle mort. Il n'existe aujourd'hui **aucune plateforme** qui permette de
retrouver, au même endroit :

- **les personnes** qui font du réseau ;
- **les événements** business ;
- **les différents réseaux**.

Chaque réseau fonctionne en silo, avec son propre annuaire interne et ses propres rendez-vous. Or la valeur
d'un réseau réside dans les connexions qu'il rend possibles — et aujourd'hui ces connexions s'arrêtent aux
frontières de chaque réseau.

> **Le constat —** une activité de masse, une demande réelle, mais aucune vue d'ensemble.

---

## 2. Vision et positionnement

### Vision

Devenir **la plateforme de référence du networking en France** : le point d'entrée unique où toute personne
qui développe son réseau professionnel a intérêt à être présente, et où tous les événements business sont
centralisés.

### Positionnement

RÉSEAUTEURS **n'est pas un réseau d'affaires de plus**. C'est le **point central qui rassemble tous les
réseaux existants** — une couche de visibilité et de mise en relation qui se superpose à l'écosystème. Le
principe fondateur tient en une phrase :

> ### « Le site ne remplace aucun réseau. Il les rassemble. »

Ce positionnement est un choix stratégique structurant :

- il évite la concurrence frontale avec des réseaux installés et puissants ;
- il transforme ces réseaux en **partenaires** potentiels plutôt qu'en rivaux ;
- il installe RÉSEAUTEURS comme un **bien commun** de l'écosystème : neutre et indépendant.

### Proposition de valeur

| Pour qui | Ce qu'ils y gagnent |
|---|---|
| **Le professionnel (réseauteur)** | Une vitrine nationale géolocalisée et optimisée pour être trouvé — par ses pairs comme par Google et les IA. **Gratuit.** |
| **Le réseau** | Une fiche-vitrine, la mise en avant de ses événements, et l'accès à une communauté transverse à tous les réseaux. |
| **L'écosystème & les annonceurs** | Une cartographie inédite des professionnels actifs et un canal de communication ciblé. |

---

## 3. Objectifs du projet

### Objectif principal

Devenir **la plateforme de référence du networking en France**, en réunissant au même endroit **les
réseauteurs, les événements et les réseaux**, et en permettant à chacun de trouver rapidement la bonne
relation et le bon événement.

### Objectifs opérationnels

1. Référencer et géolocaliser **les professionnels** sur une carte nationale (gratuite).
2. Référencer et géolocaliser **les événements** business sur une seconde carte.
3. Donner à chaque **réseau** une fiche-vitrine reliée à ses membres et ses événements.
4. Offrir une **recherche simple** par filtres (personne, événement, réseau).
5. Maximiser la **visibilité SEO** de chaque fiche (Google et moteurs d'IA).
6. Établir un **modèle économique B2B soutenable dès le lancement**, sans faire payer les réseauteurs.

### Indicateurs de succès (KPIs)

| Dimension | Ce que l'on mesure |
|---|---|
| **Adoption** | Réseauteurs inscrits & validés ; rythme d'inscription ; profils complétés. |
| **Contenu** | Événements publiés ; réseaux représentés ; couverture géographique. |
| **Engagement** | Volume de recherches ; consultations de fiches ; clics « voir le profil » / « s'inscrire ». |
| **Monétisation** | Réseaux partenaires ; événements Premium ; partenaires annonceurs ; revenu récurrent. |
| **Visibilité** | Trafic organique ; positionnement SEO ; citations par les moteurs d'IA. |

---

## 4. Public cible et personas

La plateforme s'adresse à toute personne qui développe activement un réseau professionnel : dirigeants,
entrepreneurs, commerciaux, indépendants, professions libérales, consultants, artisans, investisseurs,
cadres — et, côté B2B, aux **réseaux** et aux **annonceurs**.

#### Claire — 47 ans · Dirigeante de PME *(réseauteuse)*
- Membre du BNI et du CJD. Veut développer son courant d'affaires et recruter par cooptation.
- **Apport :** une vue cartographique de tous les professionnels actifs autour d'elle, au-delà de son réseau,
  et une vitrine gratuite pour être identifiée.

#### Karim — 34 ans · Business developer *(réseauteur)*
- Commercial B2B en prospection. Veut identifier prescripteurs et clients par secteur et zone.
- **Apport :** une recherche par filtres pour cibler des interlocuteurs déjà engagés dans une logique de
  réseau, et un agenda d'événements pour les rencontrer.

#### Sophie — 41 ans · Responsable d'un réseau local *(organisatrice)*
- Anime un réseau d'affaires et organise des événements mensuels.
- **Apport :** une **fiche réseau** visible nationalement, la **publication de ses événements** sur la carte,
  et la **mise en avant Premium** des rendez-vous importants.

#### Léa — 29 ans · Consultante indépendante *(réseauteuse)*
- Freelance en quête de notoriété, difficile d'émerger sur Google.
- **Apport :** une fiche publique optimisée qui la rend visible des moteurs de recherche et d'IA.

---

## 5. Périmètre de la plateforme

### Dans le périmètre de la V1

- **Trois entités reliées** : réseauteurs, événements, réseaux — chacune avec sa **fiche publique**.
- **Deux cartes interactives nationales** : carte des réseauteurs, carte des événements.
- **Recherche simple** par filtres.
- **Trois rôles** : réseauteur (gratuit), organisateur (réseau), administrateur.
- **Badges** réseauteur déclaratifs (Bronze / Argent / Gold / Platinum).
- **Monétisation B2B** dès la V1 : réseau partenaire, événement Premium, partenaire annonceur.
- **Page Partenaires** ; validation des inscriptions + modération.
- **SEO** (Person / Event / Organization) + RGPD proportionné ; responsive (desktop / tablette / mobile).

### Hors périmètre à ce stade

- RÉSEAUTEURS **n'organise pas** d'événements et ne gère pas les inscriptions (inscription = **lien externe**
  vers le réseau).
- Les **évolutions futures** (§9) : conçues dans le modèle de données, **non développées** en V1.
- Spécifications techniques détaillées (architecture, hébergement, sécurité) — `ARCHITECTURE.md`.

---

## 6. Les trois entités et les piliers fonctionnels

### 6.1 Les réseauteurs (personnes)

Chaque réseauteur a une **fiche** et un **marqueur sur la carte des réseauteurs**. Inscription **gratuite**.
Il complète : photo, nom, prénom, entreprise, fonction, description, téléphone *(facultatif)*, email
*(facultatif)*, site, LinkedIn, ville, département, région, secteur d'activité, compétences, **réseaux
fréquentés** (cases à cocher multi), et son **badge** (§6.5). Au clic sur un marqueur : photo, nom,
entreprise, ville, badge, réseaux fréquentés, bouton **« Voir le profil »**.

### 6.2 Les événements

Chaque événement a une **fiche** et un **marqueur sur la carte des événements**. Champs : titre, description,
date, heure, adresse, ville, image, **réseau organisateur**, **lien d'inscription externe**. Au clic sur un
marqueur : image, titre, date, ville, description, bouton **« S'inscrire »** (redirection vers le site du
réseau). Un événement peut être **mis en avant (Premium)** : marqueur spécifique, couleur différente, mise en
avant dans les résultats, badge Premium.

### 6.3 Les réseaux

Chaque réseau a une **fiche** : logo, description, présentation, lien internet, **nombre de réseauteurs**,
**nombre d'événements**. Les réseauteurs peuvent appartenir à plusieurs réseaux ; les événements sont
rattachés à un réseau. Un réseau **partenaire** (abonné) bénéficie d'une fiche enrichie, d'un badge
partenaire, d'un logo en page d'accueil et du droit de publier des événements.

### 6.4 Les deux cartes et la recherche

- **Carte des réseauteurs** — plein écran, marqueurs = personnes, clustering, recherche ville / autour de moi.
- **Carte des événements** — marqueurs = événements (Premium distincts).
- **Recherche simple** — filtres combinables : pour les réseauteurs (nom, entreprise, ville, département,
  région, métier, secteur, réseau, badge) ; pour les événements (réseau, ville, date).

### 6.5 Le badge réseauteur

Question obligatoire : **« Combien d'événements de networking fréquentez-vous chaque mois ? »** →
**0–1 : Bronze · 2–5 : Argent · 6–10 : Gold · plus de 10 : Platinum.** Affiché sur le profil. **Déclaratif**
en V1.

### 6.6 La visibilité et le référencement (SEO)

Chaque fiche (réseauteur, événement, réseau) est conçue pour être trouvée : URL propre, métadonnées, données
structurées (`Person` / `Event` / `Organization`), partage social, présence Google et IA, sitemap. La
visibilité est l'un des principaux moteurs d'acquisition.

### 6.7 L'administration

Espace de pilotage complet : créer / modifier / supprimer réseauteurs, événements, réseaux, partenaires,
abonnements, tarifs, badges, catégories, utilisateurs ; valider les inscriptions ; assurer la modération.

---

## 7. Comptes et rôles

- **Visiteur** (sans compte) — explore les cartes, consulte les fiches, recherche. Zéro friction.
- **Réseauteur** (gratuit) — crée et gère son profil.
- **Organisateur** — gère **uniquement** la fiche de son réseau et ses événements.
- **Administrateur** — gère tout.

### Parcours clés

- **A — Devenir visible (réseauteur).** Inscription gratuite → profil → validation admin → apparition sur la
  carte + fiche publique.
- **B — Trouver (visiteur/réseauteur).** Carte ou recherche par filtres → consultation d'une fiche → « voir le
  profil » / « s'inscrire ».
- **C — Animer un réseau (organisateur).** Réseau partenaire → fiche réseau enrichie → publication
  d'événements → mise en avant Premium d'un événement.

---

## 8. Modèle économique

**Les réseauteurs restent gratuits** — la gratuité construit la densité (et donc la valeur). La monétisation
est **B2B et dès la V1**, via le compte Stripe existant.

| Produit | Type | Inclus | Cible |
|---|---|---|---|
| **Réseau partenaire** | Abonnement annuel | Logo en accueil · badge partenaire · fiche enrichie · publication d'événements · lien. | Réseaux |
| **Événement Premium** | Paiement ponctuel / événement | Marqueur spécifique + couleur · mise en avant · badge Premium. | Organisateurs |
| **Partenaire (annonceur)** | Abonnement | Logo en accueil + page Partenaires + lien. | Entreprises |

Stripe gère : paiement, renouvellement, expiration, gestion des abonnements, factures. À terme, d'autres
relais sont envisagés (voir trajectoire produit).

---

## 9. Trajectoire produit

Le modèle de données est **pensé dès le départ** pour ces évolutions, mais elles **ne sont pas développées en
V1**.

| Version | Apport principal | Horizon |
|---|---|---|
| **V1 — Socle** | 3 entités, 2 cartes, recherche simple, 3 rôles, badges, monétisation B2B, SEO, admin. | Plateforme |
| **V2** | Messagerie entre réseauteurs · agenda personnel · statistiques. | Plateforme |
| **V3** | Application mobile. | Mobilité |
| **V4** | Import automatique d'événements (CSV / iCal / API) · check-in · badge vérifié. | Contenu |
| **V5** | Matching intelligent entre membres · IA. | Intelligence |
| **V6** | Association nationale RÉSEAUTEURS. | Institution |
| **V7** | Congrès national annuel des Réseauteurs. | Institution |

---

## 10. Facteurs clés de succès et risques

### Facteurs clés de succès

- **Simplicité** : un site compris en moins de 30 secondes (cf. §11).
- Densité critique de réseauteurs **et** d'événements par zone — sans densité, pas de valeur.
- Qualité et fraîcheur des données (profils, événements, fiches réseau).
- Neutralité et confiance : indépendance assumée vis-à-vis des réseaux.
- Excellence du référencement : être trouvé est le principal moteur d'acquisition.

### Risques et points de vigilance

| Risque | Réponse |
|---|---|
| Amorçage « poule et œuf » (peu de contenu = peu de valeur). | Amorçage ciblé par zone et par réseau ; gratuité des réseauteurs ; import de réseaux/événements de référence. |
| Complexité (3 entités, 3 produits Stripe) qui dilue le message. | **Simplicité d'abord** : chaque écran cadré, parcours évident, V1 resserrée. |
| Qualité/fiabilité des données (faux comptes, événements obsolètes). | Validation des inscriptions, modération, dates d'événements. |
| RGPD (indexation de personnes physiques). | Champs de contact facultatifs, opt-out d'indexation, géoloc au niveau ville. |
| Conversion B2B insuffisante. | Valeur claire du réseau partenaire / Premium / annonceur ; tarifs lisibles. |

---

## 11. Principe directeur : la simplicité d'abord

> **La priorité absolue est la simplicité.** Le site doit être compris en **moins de 30 secondes** par un
> nouvel utilisateur. Préférer une **V1 avec peu de fonctionnalités mais parfaitement exécutées**, rapide et
> évolutive, à une V1 trop ambitieuse, complexe ou coûteuse à maintenir.

**L'architecture devra permettre d'ajouter facilement de nouvelles fonctionnalités au fil des versions, sans
remettre en cause les fondations du projet.** C'est pourquoi le modèle de données est conçu d'emblée pour les
évolutions de la §9 — quitte à investir un peu plus au départ — plutôt que de devoir tout refaire plus tard.

L'objectif n'est pas de créer un réseau social. L'objectif est de devenir **la plateforme de référence du
networking en France**.

### Prochaines étapes

1. Valider ce cadrage et l'ADR-0011.
2. Valider `ARCHITECTURE.md` (modèle 3 entités) et le schéma de données (`data-architect`).
3. Concevoir les maquettes (home, deux cartes, trois fiches, recherche).
4. Réaliser le socle V1, puis déployer la stratégie d'amorçage.

---

**RÉSEAUTEURS**
*La plateforme nationale du networking.*
