# ADR-0013 — Palier « Réseauteur Plus » (création d'événements), rôle partenaire self-service, packs de licences Plus activées par code promo

- **Statut :** Accepté (décision produit **tranchée par l'humain** le 2026-07-12 ; **gate P0 tranché le
  2026-07-12** — D1 organisateur=réseauteur, D2 tarifs 59 €/300/600/1 000 €, D3 checkout one-shot,
  D4 expiration alignée + reconduction) — **à mettre en œuvre** (plan : `PLAN.md` Partie D)
- **Date :** 2026-07-12
- **Décideurs :** Humain (product owner) + analyse Claude
- **Portée :** monétisation (B2C + B2B), comptes & rôles, gate de création d'événements, espace partenaire, espace réseauteur, modèle de données (users, partenaires, licences), Stripe
- **Amende l'ADR-0011 et l'ADR-0012 sur trois points :**
  1. **Lève l'invariant « réseauteurs strictement gratuits / pas de palier payant côté réseauteur »** : le
     réseauteur a désormais **2 niveaux** — **Gratuit** (inchangé) et **Plus** (abonnement) qui débloque la
     **création d'événements**.
  2. **Lève l'affirmation « pas de quatrième rôle »** (ADR-0012 §Contexte) : le rôle **`partenaire`** existe
     (livré le 2026-07-10 avec l'espace partenaire self-service, la fiche `/partenaire/<slug>` et l'offre
     réservée aux réseauteurs). La présente ADR l'**acte** et l'**étend** (packs de licences).
  3. Le **gate de création/publication d'événements** (ADR-0012 §4) est **étendu** : organisateur d'un réseau
     national abonné **OU réseauteur Plus actif**.
- **Réaffirme (inchangé) :** les **réseaux** (hiérarchie national↔local, abonnement porté par le national,
  délégation — ADR-0012) ; trois entités reliées + fiches SSR/ISR ; SEO `Person`/`Event`/`Organization` ;
  géoloc ville/centroïde ; RGPD proportionné + opt-out ; **simplicité d'abord (< 30 s)** ; stack inchangée ;
  refactor in place par migrations ; **statut payant = source de vérité serveur (webhooks Stripe), jamais le
  client** ; l'**événement Premium ponctuel reste supprimé** (ADR-0012) ; groupes/affiliation ADR-0009
  **restent dormants** (les packs de licences n'utilisent PAS la machinerie de coupons de groupe).

> **Cette ADR est structurante.** Elle fait passer le revenu d'un modèle 100 % B2B à un **mix B2C + B2B** :
> l'offre « Plus » monétise les réseauteurs les plus actifs (ceux qui veulent **créer** des événements, pas
> seulement y participer), et les **packs de licences** donnent aux partenaires un levier de sponsoring
> concret (offrir le Plus à leur communauté), créant un canal d'acquisition B2B2C.

---

## Contexte

Le brief produit du 2026-07-12 fait évoluer la monétisation sur trois axes :

1. **Réseauteurs — 2 niveaux d'accès.** Le niveau **Gratuit** reste le système actuel (profil, carte,
   participation aux événements, offres partenaires — la gratuité fait la densité). Un niveau **Plus**
   (abonnement) donne accès à la **création d'événements** — jusqu'ici réservée aux organisateurs de réseaux
   partenaires. Constat : des réseauteurs actifs (animateurs d'afterworks, freelances organisateurs de
   rencontres) veulent publier des événements sans représenter un réseau constitué.
2. **Réseaux — inchangés.** L'abonnement réseau national (paliers, umbrella locaux, délégation — ADR-0012)
   n'est pas modifié.
3. **Partenaires — 1 abonnement + packs de licences.** L'abonnement annonceur (espace publicitaire : logo
   accueil + page Partenaires + fiche perso + **offre réservée aux réseauteurs** dans leur espace) est
   **déjà livré** (2026-07-10). S'y ajoutent des **packs de licences « Réseauteur Plus »** par paliers
   (**10 / 50 / 100+**) : le partenaire achète un lot de licences et **diffuse un code promo** à ses
   réseauteurs ; chacun active sa licence en saisissant le code, dans la limite du quota.

Contrainte invariante de **simplicité** : un seul avantage Plus en V1 (créer des événements), un seul niveau
payant réseauteur (pas d'échelle), des packs à trois tailles, un code par pack.

---

## Décision

### 1. Réseauteur Plus — abonnement individuel OU licence partenaire

Le niveau est porté par le **compte** (`users`), pas par la fiche `reseauteurs` :

- `users.plusActif` (boolean, **posé serveur uniquement**) + `users.plusExpireAt` (date) +
  `users.plusSource` (enum `{ abonnement, licence }`) + `users.plusLicencePack` (relation, si source=licence).
- **Deux chemins d'activation :**
  - (a) **Abonnement individuel** — Subscription Stripe (mensuelle ou annuelle — tarif = config métier,
    à fournir avant implémentation). Réutilise la plomberie existante (checkout, portal, webhooks
    idempotents, factures, crons d'expiration).
  - (b) **Licence partenaire** — activation par **code promo** (§3) : mêmes droits, expiration alignée sur
    le pack ; **aucun paiement** côté réseauteur.
- Helper serveur **centralisé** : `estPlus(user) = plusActif === true && (plusExpireAt == null || plusExpireAt > now)`.

### 2. Gate de création d'événements — étendu

`peutCreerEvenement(user)` (helper serveur unique, remplace le gate actuel « organisateur seulement ») :

```
organisateur : nationalDe(reseauPossédé).partenaire === true      // ADR-0012, inchangé
reseauteur   : estPlus(user) === true                              // NOUVEAU
admin        : toujours
```

**Modèle de données de l'événement créé par un réseauteur — ACTÉ (gate P0, 2026-07-12) :**
ajouter `evenements.organisateurReseauteur` (relation N-1 optionnelle vers `reseauteurs`) et relâcher
`evenements.reseau` en optionnel, avec **invariant serveur « exactement un organisateur »** (réseau XOR
réseauteur). La fiche et la carte affichent « Organisé par <prénom nom> » (lien fiche réseauteur) au lieu du
réseau. Les compteurs `nbEvenements` des réseaux ne comptent que les événements de réseaux (inchangé).
*Alternative écartée a priori : forcer le rattachement à un réseau fréquenté — elle interdirait les
événements indépendants, cas d'usage principal du Plus.*

### 3. Packs de licences partenaires — quota + code promo

Deux collections nouvelles (pas de réutilisation des groupes ADR-0009, qui restent dormants) :

- **`licences_packs`** — `partenaire` (N-1), `taille` (enum `{ 10, 50, 100+ }` → quota numérique),
  `quota` / `quotaUtilise` (dérivé), **`code`** (unique, non devinable, généré serveur), `statut`
  (`actif/epuise/expire`), `expireAt` (aligné sur l'abonnement annonceur du partenaire),
  champs Stripe (paiement du pack).
- **`licences_activations`** — `pack` (N-1), `user` (N-1, **unique** — une seule licence Plus active par
  réseauteur), `activeAt`. Traçabilité : qui a activé quel code, quand.

**Parcours :** le partenaire achète un pack depuis son espace (`/dashboard/partenaire`) → paiement Stripe
(**Checkout one-shot par pack** — acté au gate P0) → le
webhook crée/active le pack et son code → le partenaire diffuse le code à sa communauté → le réseauteur
saisit le code dans son espace (`/dashboard`) → **vérifications serveur atomiques** : code valide et actif,
quota disponible, pas d'activation antérieure pour ce user → décrément du quota + création de l'activation +
passage du user en Plus (`plusSource = licence`).

**Invariants (validés serveur, jamais confiance au client) :**
- le décrément de quota et la création d'activation sont **transactionnels** (pas de sur-allocation en cas
  de concurrence) ;
- **une seule activation** par réseauteur (index unique) ;
- l'expiration du pack (ou de l'abonnement annonceur qui le porte) **désactive** les Plus issus de ce pack
  (cron d'expiration existant, étendu) ;
- le code appartient à **un** partenaire ; l'admin peut révoquer un pack/code.

### 4. Rôle `partenaire` — acté

Quatre rôles : `reseauteur / organisateur / partenaire / admin`. Le rôle `partenaire` (1 compte ↔ 1 fiche
`partenaires`), l'espace self-service, la fiche publique `/partenaire/<slug>` et l'**offre réservée aux
réseauteurs** (visible dans `/dashboard/offres`) sont **déjà livrés** — cette ADR les inscrit au modèle
officiel et y ajoute la gestion des packs de licences.

---

## Conséquences

**Positives.** Nouveau revenu B2C (Plus) + B2B (packs) sans toucher aux réseaux ; canal d'acquisition B2B2C
(le partenaire finance le Plus de sa communauté) ; densité préservée (le gratuit ne perd rien) ; plomberie
Stripe et espaces déjà en place largement réutilisés.

**Négatives / risques.** Le mix B2C complexifie le pitch (« gratuit » reste le message principal — le Plus
est un upsell discret) ; la création d'événements par des individus ouvre un risque de spam/qualité →
les événements de réseauteurs Plus suivent la **même modération/statut** que le reste ; deux collections de
plus (licences) à administrer.

**Décisions du gate P0 — TRANCHÉES par l'humain le 2026-07-12 :**
1. **Relation organisateur** : le réseauteur **est** l'organisateur de ses événements →
   `evenements.organisateurReseauteur` + `reseau` relâché, invariant « exactement un organisateur »
   (réseau XOR réseauteur) — confirme l'orientation du §2.
2. **Tarifs** : abonnement **Plus = 59 €** (périodicité annuelle, cohérente avec les autres produits) ;
   packs : **10 licences = 300 €** · **50 = 600 €** · **100 = 1 000 €**.
3. **Paiement des packs** : **Checkout one-shot** par pack — confirme l'orientation du §3.
4. **Renouvellement des licences** : **expiration alignée sur le pack + reconduction au rachat**
   (rachat/renouvellement du pack → réactivation, même code, quota rechargé).

**Migration (esquisse — détail en `PLAN.md` Partie D).** `users` : + `plusActif`, `plusExpireAt`,
`plusSource`, `plusLicencePack` ; `evenements` : + `organisateurReseauteur`, `reseau` nullable + invariant ;
nouvelles tables `licences_packs`, `licences_activations` ; produits/prix Stripe (Plus + 3 packs) ;
webhooks + crons étendus.

---

## Registre

| ADR | Impact de la présente décision |
|---|---|
| 0011 | **Amendé** — l'invariant « réseauteurs gratuits, pas de palier payant » est levé (2 niveaux). |
| 0012 | **Amendé** — gate d'événements étendu aux réseauteurs Plus ; « pas de 4ᵉ rôle » levé (`partenaire`). Hiérarchie réseaux + abonnement national : **inchangés**. |
| 0009 | **Réaffirmé** — groupes/coupons restent dormants ; les licences utilisent des collections dédiées. |
