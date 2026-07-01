# CLAUDE.md — RÉSEAUTEURS

> Mémoire projet partagée par tous les agents. **Chaque agent lit ce fichier en premier.**
> Si un `CLAUDE.md` existe déjà dans le dépôt, fusionner ce contenu plutôt que l'écraser.
>
> **Ce fichier a été réaligné le 2026-06-28 sur le modèle à TROIS ENTITÉS** (ADR-0011).
> L'ancien produit « Info-Réseaux.fr / la carte des événements business » (modèle Réseau → Occurrences)
> **et** l'annuaire mono-entité de l'ADR-0010 (membre seul, réseaux = tags, sans événements, freemium 39 €)
> sont **caducs**. Sources de vérité du cap actuel :
> `docs/adr/0011-plateforme-trois-entites-monetisation-b2b.md` (décision structurante),
> `docs/evolution/Reseauteurs - Document de cadrage.md`, `docs/evolution/ROADMAP-V1.md`,
> `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` (+ son amendement 3-entités).

## 1. Produit

**RÉSEAUTEURS** — **« la plateforme nationale du networking »**. Le site ne devient **pas** un réseau
d'affaires de plus : il est le **point central qui rassemble tous les réseaux existants**. Aujourd'hui des
centaines de milliers de professionnels fréquentent des réseaux (BNI, DCF, CJD, Dynabuy, Cafés Business,
Rotary, Lions Club, Réseau Entreprendre, CPME, Medef…), répartis partout en France, mais **aucune
plateforme** ne permet de retrouver, au même endroit, **les personnes qui réseautent, les événements
business, et les réseaux**. RÉSEAUTEURS a vocation à devenir cette plateforme.

**Principe fondateur, structurant :** *« Le site ne remplace aucun réseau. Il les rassemble. »*
RÉSEAUTEURS est une **couche de visibilité et de mise en relation** neutre et indépendante, superposée à
l'écosystème. On ne concurrence aucun réseau ; on les transforme en partenaires.

## 2. Trois entités reliées (le cœur du modèle)

La plateforme repose sur **trois bases de données reliées entre elles** (ADR-0011, §1) :

1. **Le réseauteur** (`reseauteurs`) — une **personne**. Inscription **gratuite**. Fiche publique
   (`/reseauteur/<prenom-nom>`) et **marqueur sur la carte des réseauteurs**. Champs : photo, nom, prénom,
   entreprise, fonction, description, téléphone *(facultatif)*, email *(facultatif)*, site, LinkedIn, ville,
   département, région, secteur d'activité, compétences, **réseaux fréquentés** (cases à cocher multi →
   relation many-to-many), **badge** (§5), géolocalisation.
2. **L'événement** (`evenements`) — un **événement business daté**. Fiche publique (`/evenement/<slug>`) et
   **marqueur sur la carte des événements**. Champs : titre, description, date, heure, adresse, ville, image,
   **réseau organisateur** (relation), **lien d'inscription externe**, géolocalisation, **drapeau Premium**
   (mise en avant payante, §4). Le bouton « S'inscrire » **redirige vers le site du réseau** — RÉSEAUTEURS
   **n'organise pas** et ne gère pas l'inscription en V1.
3. **Le réseau** (`reseaux`) — un **réseau d'affaires** (BNI, DCF…). Fiche publique (`/reseau/<slug>`).
   Champs : nom, logo, description, présentation, lien internet, **nombre de réseauteurs** (dérivé),
   **nombre d'événements** (dérivé), drapeau **partenaire** (abonnement actif, §4). Un réseau est **à la
   fois** une fiche-entité **et** la valeur de taxonomie que les réseauteurs cochent.

**Relations :** réseauteur **↔** réseaux = many-to-many (réseaux fréquentés) · événement **→** réseau = N-1
(réseau organisateur) · réseau **→** réseauteurs/événements = dérivés (compteurs).

## 3. Audiences & comptes (trois rôles — ne jamais les confondre)

- **Visiteur** (gratuit, sans compte) : explore les **deux cartes**, consulte les fiches réseauteur /
  événement / réseau, recherche. **Zéro friction.** Compte/email uniquement pour devenir réseauteur ou
  recevoir des alertes.
- **Réseauteur** (`role: reseauteur`, **gratuit**) : crée et gère **son** profil, le rend visible sur la
  carte. Tout le monde peut être réseauteur gratuitement (la gratuité fait la densité, donc la valeur).
- **Organisateur** (`role: organisateur`) : gère **uniquement** la fiche **de son réseau** et **ses
  événements** (1 compte ↔ 1 réseau). C'est le compte d'un **réseau partenaire** (§4).
- **Administrateur** (`role: admin`) : back-office complet — créer / modifier / supprimer **réseauteurs,
  événements, réseaux, partenaires, abonnements, tarifs, badges, catégories, utilisateurs**.

## 4. Monétisation — B2B, dès la V1 (Stripe)

**Les réseauteurs sont et restent gratuits.** Le revenu est **B2B**, branché sur le **compte Stripe
existant** (paiement, renouvellement, expiration, gestion des abonnements, factures) — ADR-0011 §3.

| Produit | Type | Inclus |
|---|---|---|
| **Réseau partenaire** | Abonnement **annuel** (Subscription) | Logo en page d'accueil · badge partenaire · **fiche réseau enrichie** · **droit de publier des événements** · lien vers le site. |
| **Événement Premium** | Paiement **ponctuel** / événement (Checkout one-shot) | **Marqueur spécifique** + **couleur différente** · **mise en avant** dans les résultats · **badge Premium**. |
| **Partenaire (annonceur)** | Abonnement | Logo en **page d'accueil** + **page Partenaires** + lien vers le site. |

> Il n'y a **pas** de palier payant côté réseauteur. Le « freemium membre 39 €/an », le quota d'événements
> et les 3 paliers 90/130/190 € sont **supprimés du périmètre**. La plomberie Stripe (checkout, portal,
> webhooks idempotents signés, factures PDF, crons d'expiration) est **conservée** et **recalibrée** sur ces
> trois produits B2B.

## 5. Badge réseauteur (déclaratif, simple)

Question obligatoire à l'inscription : **« Combien d'événements de networking fréquentez-vous chaque mois ? »**
→ **0–1 : Bronze · 2–5 : Argent · 6–10 : Gold · plus de 10 : Platinum.** Affiché sur le profil et le
marqueur. **Purement déclaratif** en V1 (le « badge vérifié » est une évolution future, §12). L'admin gère
le référentiel des badges.

## 6. Stack (CONFIRMÉE — refactor in place — ADR-0001/0011)

- **Framework :** Next.js (App Router, TypeScript strict). SSR/ISR indispensable pour le SEO des fiches.
- **Couche d'accès / back-office :** **Payload CMS** (admin auto-généré, auth, **field-level access**,
  pipeline média, hooks) — réaffirmé ADR-0001. Accès SQL via **Drizzle** + SQL paramétré pour la géo et la
  recherche. *(Ne pas introduire Prisma.)*
- **Base de données :** **PostgreSQL** + **PostGIS** (ADR-0002) pour la géo (`geom`,
  `geography(Point,4326)`, index GiST, `ST_DWithin`).
- **Cartes :** **MapLibre GL JS** + tuiles OpenStreetMap (ADR-0006). **Deux cartes** (réseauteurs +
  événements). Géocodage via **data.gouv** (existant, conservé).
- **Recherche :** **simple, par filtres** dans Postgres via Payload (`find` + colonnes indexées, `pg_trgm`
  optionnel pour la tolérance de frappe). **Pas de moteur FTS à facettes, pas de moteur externe** (§10, §8).
- **Auth :** **Payload** (JWT, lockout, verify, reset). Rôles `admin/organisateur/reseauteur`.
- **Paiement :** Stripe (Subscriptions + Checkout one-shot + Customer Portal + webhooks + factures PDF),
  recalibré sur les 3 produits B2B.
- **Emails :** Resend (onboarding, sécurité, modération, expiration d'abonnement) — conservé, à rebrander.
- **Hébergement :** Vercel ; SSL obligatoire.

## 7. État réel de l'existant (lire avant de toucher au code)

Le dépôt est historiquement **PanoramaPub.fr** (annuaire de revendeurs + événements + carte + Stripe 3
paliers + SEO complet), partiellement pivoté vers « Info-Réseaux » (modèle Réseau→Occurrences, migrations
`20260623_*`). **Bonne nouvelle pour le modèle à 3 entités :** événements et réseaux-entités, que l'ADR-0010
avait prévu de **démonter**, **reviennent** — donc une **plus grande part de l'existant se réutilise** :

- **`evenements`** : à **conserver et simplifier** (retirer `participer`/quota/`serieId`/archivage de
  l'ancien modèle ; ajouter `lienInscription` externe + drapeau **Premium**). ⚠️ Pas d'organisation
  d'événements ni de gestion d'inscrits en V1.
- **`reseaux`** (créée par les migrations `0623`) : à **conserver comme entité** (fiche, logo, présentation,
  compteurs) **et** comme valeur de taxonomie M2M. Possédée par un compte **organisateur**.
- **Machinerie SEO multi-types** (`Event`, `Organization`, `LocalBusiness`, sitemap, ISR), **carte
  MapLibre/PostGIS**, **Stripe**, **RGPD**, **auth**, **géocodage**, **emails**, **sécurité HTTP** : **infra
  agnostique de qualité production → réutilisée**.
- À **créer** : collection **`reseauteurs`** (personne), collection **`partenaires`** (annonceurs), champ
  **badge**, relation M2M réseauteur↔réseaux, **carte des réseauteurs**, recalibrage Stripe B2B.
- **Dormant (ADR-0009 inchangé) :** groupes/affiliation — conservés, masqués.

> Détail garder/réécrire/supprimer : `docs/evolution/AUDIT-DELTA-RESEAUTEURS.md` **+ son amendement
> 3-entités** (les verdicts « SUPPRIMER » de l'événementiel/réseaux y sont **revus** : ils reviennent).

## 8. Design — tokens conservés, structure simple

Le **système visuel est conservé** comme identité de marque ; la **structure** est (ré)écrite vers le modèle
à 3 entités, **sous contrainte de simplicité** (§10). Références :

- **`.claude/design/DESIGN.md`** — **tokens (typo, couleurs, rayons, composants) = source de vérité
  conservée** ; **structure home + deux cartes = décrites pour le modèle 3 entités**.
- **`.claude/design/info-reseaux-plasma.html`** — maquette : **référence de TOKENS uniquement** (palette,
  typo, rayons, style des clusters/cartes). Sa **structure** est indicative.

Tokens clés (détail dans `DESIGN.md`) :
- **Police : Hanken Grotesk** (Google Fonts, 400→800), via `next/font`.
- **Mode clair dominant** sur canvas **`#faf9f5`** ; surfaces blanches ; **bandes sombres** (`#0d0d10`).
- **Bleu primaire `#2563EB`**, navy `#16284f`, **accent orange `#f5851f`** (conversion / Premium / CTA),
  violet secondaire `#a855f7`, neutres zinc, bordure `#e4e4e7`.
- **Rayons généreux** (~12px ; conteneurs 16px ; pills 999px) ; sentence case ; deux graisses ; ombres
  discrètes. Copie UI **en français**.

Structure de la home (modèle 3 entités, **comprise en < 30 s** — voir `DESIGN.md §5`) : En-tête → Hero +
accès aux **deux cartes** → Bandeau logos réseaux (« tous les réseaux réunis ») → **Trois piliers**
(Réseauteurs · Événements · Réseaux) → Comment ça fonctionne → Chiffres clés (réseauteurs / événements /
réseaux / villes) → **Bandeau Partenaires** (logos annonceurs) → Newsletter → Pied de page.

## 9. SEO + RGPD (transverse, exigence forte — « comme PanoramaPub »)

Chaque fiche (réseauteur, événement, réseau) est un **actif de référencement longue traîne**. Obligatoire :
URLs propres au singulier (`/reseauteur/<prenom-nom>`, `/evenement/<slug>`, `/reseau/<slug>`),
`<title>`/meta dynamiques, **JSON-LD `Person` / `Event` / `Organization`**, `sitemap.xml` dynamique,
canonical/OG, **optimisation IA** (`llms.txt`), rendu SSR/ISR, maillage interne (à proximité / même métier /
même réseau / mêmes événements).

**RGPD — proportionné (ADR-0011 §7).** On indexe des **personnes physiques** (réseauteurs) : respecter
consentement, export, suppression, purge, audit, **opt-out d'indexation** (sitemap + robots + `<meta>`),
droit au déréférencement. **Le contrôle de confidentialité du réseauteur = les champs de contact
facultatifs** (téléphone/email) qu'il choisit de renseigner. **Géolocalisation par défaut au niveau
ville/commune** (centroïde) — on n'a pas besoin de l'adresse personnelle exacte → pas de double `geom`
obligatoire ni de projection par champ (allègement assumé vs ADR-0010).

## 10. Principe directeur — la simplicité d'abord (NON négociable)

> **La priorité absolue est la simplicité. Le site doit être compris en moins de 30 secondes par un nouvel
> utilisateur.** Préférer une V1 avec **peu de fonctionnalités mais parfaitement exécutées**, rapide et
> évolutive, à une V1 trop ambitieuse, complexe ou coûteuse à maintenir.

**Corollaire d'architecture :** investir dès le départ sur un **modèle de données propre et extensible**,
pour ajouter facilement les évolutions futures (§12) **sans remettre en cause les fondations** — mais **ne
pas développer** ces évolutions maintenant. Chaque écran (carte, fiche, recherche, dashboard) est cadré par
cette contrainte : un parcours évident, pas de fonctionnalité « parce qu'on peut ».

## 11. Conventions de code (toutes les implémentations)

- TypeScript strict ; Server Components par défaut, Client Components seulement si nécessaire.
- **Aucun secret en clair** (Stripe, DB, Resend…) → variables d'environnement uniquement.
- Validation des entrées (Zod) côté serveur ; jamais confiance au client (statut payant, rôle, propriété).
- **Autorisation stricte** : un réseauteur n'agit que sur **son** profil ; un organisateur uniquement sur
  **son** réseau et **ses** événements ; l'admin sur tout.
- **RGPD** : consentement, export, suppression, purge, audit, opt-out d'indexation respectés de bout en bout.
- Accessibilité (a11y) : contrastes, labels, navigation clavier, focus visibles.
- Tests sur la logique métier (rôles & propriété, monétisation B2B, géo-filtrage des deux cartes, badges,
  recherche par filtres, slugs/SEO). ⚠️ Les **specs existantes valident PanoramaPub** et sont en partie
  caduques — à re-spécifier sur le modèle 3 entités.
- Mobile-first sur les cartes (plein écran + bottom-sheet, pas une carte rétrécie au-dessus d'une liste).
- Commits atomiques, messages clairs ; ne jamais committer `.env`.

## 12. Périmètre V1 / V2+ (ne pas déborder — simplicité)

- **Dans la V1 :** les **3 entités** (réseauteurs, événements, réseaux) + leurs fiches publiques SSR ; les
  **2 cartes** (réseauteurs + événements) ; **recherche simple par filtres** ; comptes + **3 rôles**
  (réseauteur / organisateur / admin) ; **badges** déclaratifs ; **monétisation B2B Stripe** (réseau
  partenaire + événement Premium + partenaire annonceur) ; **page Partenaires** ; validation des
  inscriptions + modération ; SEO `Person`/`Event`/`Organization` + RGPD proportionné ; responsive
  (desktop / tablette / mobile).
- **Conçu dès le départ dans le modèle de données, mais NON développé en V1 (évolutions futures) :**
  application mobile · messagerie entre réseauteurs · agenda personnel · import automatique d'événements
  (CSV / iCal / API) · check-in aux événements · badge vérifié · statistiques · association RÉSEAUTEURS ·
  congrès annuel · matching entre membres · IA.
- **Retiré (caduc) :** modèle Réseau→Occurrences, quota d'occurrences, 3 paliers 90/130/190 €, freemium
  membre 39 €, objet publicitaire `fournisseurs`/`revendeurs`, route/champ
  `participer`/`participantsSignales`, **projection de confidentialité par champ + double geom obligatoire**,
  **moteur de recherche FTS à facettes**.
- **Dormant (ADR-0009 inchangé) :** groupes/affiliation — conservés, masqués.

## 13. Pipeline d'agents et artefacts

Voir `.claude/AGENTS_PIPELINE.md` et `.claude/README.md`. **8 agents.** Ordre et livrables :

1. `codebase-auditor` → **`AUDIT.md`** + **`AUDIT-DELTA-RESEAUTEURS.md`** *(lecture seule ; delta + amendement
   3-entités déjà produits ; verdict `REFACTOR_IN_PLACE`)*.
2. `solution-architect` → **`ARCHITECTURE.md`** (modèle 3 entités), **ADR** (0011 acté ; statuts amendés),
   **`PLAN.md`** reséquencé. *(Réalignés dans la passe docs du 2026-06-28 ; à valider/affiner.)*
3. `data-architect` → collections **`reseauteurs`**, **`evenements`** (simplifié), **`reseaux`** (entité +
   taxonomie), **`partenaires`**, champ **badge**, relation M2M ; **RGPD** repointé ; recalibrage `users.role`
   (3 rôles) ; index de recherche simple ; **`MIGRATION.md`**.
4. Implémentation parallélisable (cf. `PLAN.md`) : `frontend-builder` (home + 3 fiches + recherche par
   filtres + dashboards) · `map-engineer` (**2 cartes** réseauteurs/événements, marqueurs Premium) ·
   `accounts-and-billing` (3 rôles + monétisation B2B Stripe) · `seo-engineer`
   (`Person`/`Event`/`Organization` + opt-out indexation).
5. `qa-reviewer` → **`docs/qa/REVIEW-<date>.md`** (gate qualité avant merge).

**Règle d'or :** aucune implémentation (phase 3) ne démarre avant que **`ARCHITECTURE.md` + le schéma soient
validés** (humain dans la boucle entre les phases). La **simplicité** est un critère de revue à chaque gate.
