# Registre des sous-traitants — Article 28 RGPD

> Derniere mise a jour : 17 avril 2026.
> Recense les prestataires tiers ayant acces a des donnees personnelles, leur role, leur localisation, et les garanties contractuelles en vigueur.

## Vue d'ensemble

| Sous-traitant | Role | Localisation | Garantie | DPA signe |
|---------------|------|--------------|----------|-----------|
| Vercel Inc. | Hebergement applicatif + stockage medias (Blob) | US (Washington) | Clauses contractuelles types UE | Oui (vercel.com/legal/dpa) |
| Neon Inc. | Base de donnees PostgreSQL | US (us-west-2) | Clauses contractuelles types UE | A verifier |
| Stripe Payments Europe Ltd. | Paiement, facturation, subscription management | Irlande (UE) | Etablissement UE — pas de transfert | Inclus dans les Services Agreement |
| Resend | Envoi emails transactionnels et marketing | US | Clauses contractuelles types UE | A verifier |
| Mapbox Inc. | Rendu cartes interactives (tiles) | US | Clauses contractuelles types UE | Aucune PII echangee |
| API Adresse (Etalab / data.gouv.fr) | Geocodage adresses postales | France | Service public — exemption | Non applicable |

---

## Vercel Inc.

- **Site** : https://vercel.com
- **Role** : Hebergement de l'application Next.js + stockage des medias via Vercel Blob
- **Donnees traitees** : integralite du trafic HTTP, logs techniques, contenus medias (logos, bannieres, illustrations)
- **Politique de confidentialite** : https://vercel.com/legal/privacy-policy
- **DPA** : https://vercel.com/legal/dpa (acceptation implicite via Terms of Service)
- **Region** : par defaut `iad1` (Washington DC, US) — envisager la migration vers `cdg1` (Paris) pour reduire les transferts hors UE
- **Revue** : annuelle

## Neon Inc.

- **Site** : https://neon.tech
- **Role** : Base de donnees PostgreSQL serverless (donnees principales de l'application)
- **Donnees traitees** : toutes les donnees persistees (users, fournisseurs, evenements, groupes, factures, logs d'audit)
- **Politique de confidentialite** : https://neon.tech/privacy-policy
- **DPA** : https://neon.tech/dpa
- **Region actuelle** : AWS us-west-2 — **action recommandee** : migrer vers eu-central-1 (Francfort)
- **Revue** : annuelle

## Stripe Payments Europe Ltd.

- **Site** : https://stripe.com/fr
- **Role** : Encaissement, facturation, gestion des abonnements, coupons de groupe
- **Donnees traitees** : email, nom, adresse de facturation, numero TVA intracommunautaire, historique de paiements, donnees bancaires (stockees par Stripe, jamais par l'editeur)
- **Politique de confidentialite** : https://stripe.com/fr/privacy
- **DPA** : https://stripe.com/fr/legal/dpa
- **Region** : UE (siege Irlande) — aucun transfert hors UE pour les Customers europeens
- **Revue** : annuelle

## Resend

- **Site** : https://resend.com
- **Role** : Envoi des emails transactionnels (verification, bienvenue, paiement, expiration) et marketing (J3/J7/J14)
- **Donnees traitees** : adresses email des destinataires, contenu des emails, logs d'envoi
- **Politique de confidentialite** : https://resend.com/legal/privacy-policy
- **DPA** : https://resend.com/legal/dpa
- **Region** : US
- **Revue** : annuelle

## Mapbox Inc.

- **Site** : https://www.mapbox.com
- **Role** : Rendu des cartes interactives (tiles) + direction routing (API Directions)
- **Donnees traitees** : IP, user-agent des visiteurs, requetes de tiles. **Aucune donnee applicative** (nom, email) transmise par le code.
- **Politique de confidentialite** : https://www.mapbox.com/legal/privacy
- **Region** : US
- **Revue** : annuelle

## API Adresse (data.gouv.fr)

- **Site** : https://adresse.data.gouv.fr
- **Role** : Geocodage des adresses postales pour l'affichage cartographique
- **Donnees traitees** : adresses postales transmises par le serveur de l'editeur
- **Politique** : service public — regime legal specifique
- **Region** : France
- **Revue** : annuelle

---

## Processus d'integration d'un nouveau sous-traitant

Avant toute contractualisation, l'editeur verifie :

1. Conformite RGPD du prestataire (politique publique, DPA accessible)
2. Localisation du traitement et garanties pour les transferts hors UE (CCT, decision d'adequation, BCR)
3. Mesures de securite (chiffrement au repos, certifications ISO 27001, SOC 2)
4. Clauses de sous-traitance en cascade (autorisation prealable des sous-sous-traitants)
5. Mise a jour du present registre et de la politique de confidentialite publique

## Rupture contractuelle

En cas de fin de contrat avec un sous-traitant, l'editeur s'assure :
- que les donnees sont restituees ou detruites selon instruction
- qu'une attestation de destruction est obtenue
- que le registre et la politique de confidentialite sont mis a jour
