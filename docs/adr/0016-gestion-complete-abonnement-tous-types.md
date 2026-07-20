# ADR-0016 — Gestion complète de l'abonnement, en libre-service, pour tous les types

- **Statut : Accepté (2026-07-20)**
- Complète : ADR-0011 (§4 monétisation), ADR-0012 (paliers réseau national),
  ADR-0013 (Réseauteur Plus), ADR-0014 (fiche nationale payante).

## Contexte

Objectif produit : permettre à **chaque type d'utilisateur qui souscrit** de gérer
entièrement son abonnement depuis l'application. Avant cette décision, la gestion était
**éclatée et inégale** selon le rôle :

- **Réseauteur Plus** (`/dashboard/plus`) : souscrire + portail Stripe. Ni annulation, ni
  réactivation, ni factures in-app.
- **Organisateur** (`/dashboard/abonnement`) : souscrire, portail, factures ; les routes
  `cancel`/`reactivate` existaient mais **n'étaient câblées à aucune UI** ; le changement de
  palier renvoyait au portail Stripe.
- **Partenaire annonceur** (`/dashboard/partenaire`) : souscrire + portail, factures ;
  `cancel`/`reactivate` **refusés** (routes réservées `organisateur`).
- Deux composants `CancelConfirmModal` / `ReactivateConfirmModal` existaient mais **orphelins**
  (copie legacy « Premium/Infinite » héritée de PanoramaPub).

## Décisions

### Hub unique + résolveur commun
- **`/dashboard/abonnement` devient le hub unique** de gestion, ouvert à **tous les rôles
  souscripteurs** (réseauteur Plus, organisateur, partenaire). L'admin gère via le back-office.
- **`src/lib/abonnement.ts`** — `resolveAbonnement(freshUser, payload)` renvoie un descripteur
  commun `AbonnementContext` qui unifie les **3 porteurs** de données Stripe : `users`
  (Plus : `plusActif`/`plusExpireAt`/`plusSource`/`stripeSubscriptionId`/`stripeCustomerId`),
  réseau national `reseaux` (`partenaire`/`palier`/`partenaireExpireAt`/`stripeSubscriptionId`),
  `partenaires` (`statut`/`abonnementExpireAt`/`stripeSubscriptionId`/`stripeCustomerId`).
  `fetchLiveStripeState` enrichit avec l'état **live Stripe** (`status`, `current_period_end`,
  `cancel_at_period_end`, palier) — **tolérant aux pannes** (retombe sur la DB).
- **Brique partagée `src/components/billing/AbonnementManager.tsx`** : état (actif / annulation
  programmée / échec de paiement), souscrire, changer de palier, annuler, réactiver, moyen de
  paiement (portail), factures.

### Généralisation des mutations
- **`cancel` / `reactivate`** généralisées aux **3 produits** via `resolveAbonnement`.
  L'**ownership est garanti par construction** : `resolveAbonnement` ne résout que le porteur du
  caller — on n'agit jamais sur l'abonnement d'un tiers.
- **Nouvelle route `POST /api/stripe/change-palier`** (organisateur) : swap du `price` de la
  subscription + proration immédiate, avec **garde anti-downgrade** (refus si
  `maxLocaux(nouveauPalier) < groupes locaux possédés`). Remplace le renvoi au portail.
- Modals `Cancel`/`Reactivate` **câblés** et rendus génériques (copie paramétrée par le label).

### Persistance
- **`activerReseauteurPlus`** (webhook) pose désormais `users.stripeSubscriptionId` — sans lui,
  l'annulation native du Plus ne retrouve pas son abonnement. Les 3 porteurs portent donc
  uniformément le `subscriptionId`. **Pas de migration** : l'état « annulation programmée » est
  lu **en direct** chez Stripe (pages à faible trafic, toujours exactes).

### Invariant conservé (§11)
Le **statut d'accès reste posé côté serveur** (webhooks Stripe). Les actions in-app **pilotent
Stripe** (cancel_at_period_end, swap de price) ; la DB n'est jamais mutée directement par le
client. Le hub lit le détail live pour l'affichage, la DB pour l'accès.

### Divers
- Portail Stripe : `return_url` unifié → `/dashboard/abonnement`.
- Factures (`/dashboard/factures`) accessibles à **tout rôle souscripteur** ayant un
  `stripeCustomerId` (réseauteur Plus inclus).
- Sidebar : « Abonnement » (tous rôles souscripteurs) + « Factures » (idem). `/dashboard/plus`
  reste la page d'**upsell** du réseauteur gratuit.

## Conséquences

- Surface de gestion **cohérente et complète** pour les 3 types, sans dépendre du portail Stripe
  pour les mutations d'état (le portail ne sert plus qu'au moyen de paiement + historique).
- Un compte **actif sans abonnement Stripe en ligne** (accès accordé manuellement / démo) affiche
  un état actif + une note de contact, sans action inopérante.
- **Non couvert / dépendances PO** : le changement de palier et la souscription réseau national
  requièrent les prix `STRIPE_PRICE_NATIONAL_*` (toujours TODO PO) ; `STRIPE_PLUS_PRICE_ID` pour
  le Plus. `change-plan` / `preview-change-plan` restent `410 Gone`.
