# Registre des traitements de donnees personnelles

> **Article 30 du RGPD — obligation documentaire interne.**
> Ce registre recense l'ensemble des traitements de donnees personnelles operes par l'editeur du site panorama-pub.com.
> Derniere mise a jour : 17 avril 2026.

## Responsable du traitement

- **Denomination** : {{DENOMINATION_SOCIALE}}
- **Forme juridique** : {{FORME_JURIDIQUE}}
- **Siege social** : {{SIEGE_ADRESSE}}
- **SIREN** : {{SIREN}} — **RCS** : {{RCS_VILLE}}
- **Representant legal** : {{DIRECTEUR_PUBLICATION}}
- **Contact** : contact@panorama-pub.com
- **DPO / referent RGPD** : {{dpo@panorama-pub.com — a confirmer}}

---

## Traitement 1 — Comptes utilisateurs et fiches fournisseurs

| Item | Description |
|------|-------------|
| Finalite | Creation et gestion des comptes B2B. Publication des fiches revendeurs sur l'annuaire public. |
| Base legale | Execution du contrat (art. 6.1.b RGPD) |
| Personnes concernees | Professionnels inscrits, representants legaux des fournisseurs |
| Categories de donnees | Email, mot de passe hache, nom de societe, ville, raison sociale, adresse, code postal, site web, email de contact, telephone, description, logo, banniere, illustrations, categories d'activite |
| Destinataires internes | Equipe technique et support de l'editeur |
| Sous-traitants | Vercel (hebergement + Blob), Neon (DB), API Adresse gouv.fr (geocodage) |
| Transferts hors UE | Oui (Vercel, Neon — US) — clauses contractuelles types |
| Duree de conservation | Compte actif + 3 ans apres la derniere connexion ; suppression immediate sur demande |
| Mesures de securite | TLS, mot de passe bcrypt, verrouillage apres 5 tentatives, acces par role, access control Payload |

## Traitement 2 — Paiement et facturation des abonnements

| Item | Description |
|------|-------------|
| Finalite | Encaissement des abonnements, emission et archivage des factures, conformite fiscale/comptable |
| Base legale | Execution du contrat (art. 6.1.b) + obligation legale (art. 6.1.c — art. L123-22 C. com.) |
| Personnes concernees | Clients payants (Premium / Infinite) |
| Categories de donnees | Identifiant Stripe, nom ou raison sociale de facturation, adresse de facturation, numero TVA intracommunautaire, historique des paiements (montant, date, statut), factures PDF |
| Destinataires internes | Equipe finance / comptabilite |
| Sous-traitants | Stripe Payments Europe Ltd. (Irlande) |
| Transferts hors UE | Non (traitement UE) |
| Duree de conservation | 10 ans (obligation comptable) |
| Mesures de securite | Donnees bancaires non stockees par l'editeur (tokenisation Stripe). Webhook HMAC, rate limit |

## Traitement 3 — Communications marketing (opt-in)

| Item | Description |
|------|-------------|
| Finalite | Envoi d'emails d'information (completion fiche, upgrade plan, decouverte groupe) |
| Base legale | Consentement (art. 6.1.a) — recolte au moment de l'inscription, revocable a tout moment |
| Personnes concernees | Utilisateurs ayant coche l'opt-in marketing |
| Categories de donnees | Email, nom de societe, date du consentement, date de revocation, statut d'envoi des emails J3/J7/J14 |
| Destinataires internes | Equipe marketing |
| Sous-traitants | Resend (US) |
| Transferts hors UE | Oui — clauses contractuelles types |
| Duree de conservation | Jusqu'au retrait du consentement, puis 3 ans a titre de preuve (art. 7 RGPD) |
| Mecanismes d'exercice des droits | Lien de desabonnement dans chaque email + toggle dans l'espace personnel |
| Mesures de securite | Jeton HMAC signe pour le desabonnement, audit logs sur les flips |

## Traitement 4 — Geocodage des adresses

| Item | Description |
|------|-------------|
| Finalite | Geolocalisation des fournisseurs et evenements sur les cartes interactives |
| Base legale | Execution du contrat (art. 6.1.b) — donnee necessaire a l'affichage de la fiche publique |
| Personnes concernees | Fournisseurs et organisateurs |
| Categories de donnees | Adresse postale transmise a l'API Adresse (data.gouv.fr) |
| Sous-traitants | API Adresse (service public gouv.fr — France) |
| Transferts hors UE | Non |
| Duree de conservation | Latitude/longitude stockees pendant la duree de vie de la fiche |
| Mesures de securite | Appel cote serveur, pas de transmission cote client |

## Traitement 5 — Affichage des cartes Mapbox

| Item | Description |
|------|-------------|
| Finalite | Rendu des tuiles cartographiques |
| Base legale | Interet legitime (art. 6.1.f) — affichage du service demande par l'utilisateur |
| Personnes concernees | Visiteurs des pages carte |
| Categories de donnees | IP, user-agent (cotes Mapbox, pas cote editeur) |
| Sous-traitants | Mapbox Inc. (US) |
| Transferts hors UE | Oui — clauses contractuelles types |
| Duree de conservation | Non applicable (donnees non stockees par l'editeur) |
| Mesures de securite | Aucune PII transmise a Mapbox par le code applicatif |

## Traitement 6 — Journaux techniques et securite

| Item | Description |
|------|-------------|
| Finalite | Detection d'intrusions, investigation d'incidents, stabilite technique |
| Base legale | Interet legitime (art. 6.1.f) + obligation LCEN |
| Categories de donnees | Adresse IP, user-agent, horodatage, evenements d'authentification, logs d'erreur |
| Sous-traitants | Vercel (logs applicatifs), Neon (logs DB) |
| Duree de conservation | 12 mois maximum |

---

## Mesures de securite transverses

- **Chiffrement en transit** : TLS 1.2+ force sur tous les endpoints
- **Authentification** : JWT HS256, rotation tous les 30 jours, revocation a la deconnexion
- **Mot de passe** : hachage bcrypt, minimum 8 caracteres, lockout apres 5 tentatives (10 min)
- **Controle d'acces** : RBAC Payload (admin / fournisseur / organisateur), access control par champ (Premium+ / Infinite)
- **Rate limiting** : IP-based sur toutes les routes sensibles (webhook Stripe 30/min, groupes 10/min, unsubscribe 10/min, directions 60/min)
- **Separation production/developpement** : bases Neon distinctes, secrets rotatifs
- **Mises a jour** : dependances verifiees hebdomadairement (dependabot Github)
- **Sauvegardes** : PITR Neon 7 jours

## Droits des personnes concernees (art. 15-22 RGPD)

| Droit | Mecanisme |
|-------|-----------|
| Acces | Bouton "Telecharger mes donnees (JSON)" dans /dashboard/compte |
| Rectification | Modification directe depuis /dashboard/fiche et /dashboard/compte |
| Effacement | Bouton "Supprimer mon compte" dans /dashboard/compte — cascade Stripe + DB + medias |
| Limitation | Sur demande ecrite a contact@panorama-pub.com |
| Portabilite | Format JSON structure via /api/account/export |
| Opposition | Toggle optInMarketing + lien desabonnement dans chaque email |
| Retrait consentement | Toggle optInMarketing ou lien desabo — journalise via audit-logs |

## Procedure en cas de violation (art. 33-34 RGPD)

1. Detection : alertes Sentry / monitoring Vercel + veille equipe
2. Qualification : criticite, nature, volume, personnes impactees (sous 24h)
3. Notification CNIL : dans les 72h via cnil.fr si violation de nature a engendrer un risque
4. Notification aux personnes concernees : si risque eleve (art. 34)
5. Documentation : entree dans le journal des violations

## Revue du registre

Le registre est revu a minima annuellement et a chaque ajout/modification substantielle de traitement.
