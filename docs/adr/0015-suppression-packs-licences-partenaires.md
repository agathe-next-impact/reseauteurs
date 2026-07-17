# ADR-0015 — Suppression des packs de licences « Réseauteur Plus » des partenaires

- **Statut : Accepté (2026-07-17)**
- Amende : ADR-0013 (§3 packs de licences + codes promo, §4.3 CLAUDE.md).

## Contexte

Décision produit du 2026-07-17 : supprimer la fonctionnalité d'achat de licences groupées
(packs 10/50/100 + diffusion par code promo) pour les entreprises partenaires. Le partenaire
ne conserve que **l'abonnement de visibilité** (logo accueil + page Partenaires + fiche perso)
avec son **offre réservée aux réseauteurs**. Le seul chemin vers Réseauteur Plus devient
l'**abonnement individuel** (39 € HT/an).

## Décisions

### Surface supprimée
- **Stripe** : type de checkout `licences_pack` (route checkout), handler webhook
  `creerPackLicences`, `PACKS_LICENCES`/`PRODUITS.licencesPack` (lib/stripe), env
  `STRIPE_PACK_10/50/100_PRICE_ID` (plus lus).
- **Activation** : route `POST /api/licences/activer` → **410 Gone** (précédent :
  /api/stripe/change-plan) ; `activerLicence` retirée de lib/licences.
- **UI** : bloc « J'ai un code partenaire » (/dashboard/plus), section « Packs de licences »
  de l'espace partenaire (`LicencesSection` supprimé), sections publiques « Réseauteurs
  affiliés » (fiche partenaire) et « Entreprise » (fiche réseauteur) — lib/affiliation supprimée.
- **Emails** : `pack-achete` et `licence-activee` (kinds + templates).
- **Seeds** : `seed-reseauteurs-plus` supprimé ; `seed-demo-plus` sans pack ni compte licencié.

### Conservé (legacy, extinction naturelle)
- Collections `licences-packs` / `licences-activations` : **dormantes** (masquées en admin,
  aucune écriture applicative), pas de migration destructive — traçabilité RGPD conservée,
  purge avec le compte via /api/account/delete inchangée.
- Champs `users.plusSource='licence'` / `users.plusLicencePack` : legacy en lecture seule ;
  les comptes Plus issus d'une licence **gardent leur accès jusqu'à `plusExpireAt`**.
- Cron `expiration-plus` : la passe « packs expirés → cascade de désactivation des Plus
  licence » (`desactiverPlusDuPack`) reste en place pour éteindre proprement l'existant.

## Conséquences
- Monétisation partenaire = abonnement annonceur uniquement (fiche + offre) — déjà livré.
- Réseauteur Plus = abonnement individuel uniquement.
- L'« affiliation » partenaire⇄réseauteur (dérivée des licences) disparaît des fiches publiques.
- Les 12 comptes de démo `plus-*@demo.reseauteurs.fr` (cohorte licence) restent Plus jusqu'à
  expiration de leur pack, puis redeviennent gratuits automatiquement.
