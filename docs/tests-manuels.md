# Recette manuelle — PanoramaPub.fr

Procedure de tests manuels pour valider le bon fonctionnement complet du site avant deploiement production. A executer apres toute release majeure ou modif impactant auth / Stripe / emails / cron.

## 0. Prerequis

### Environnements

| Env | URL | DB | Stripe | Usage |
|-----|-----|-----|--------|-------|
| Local | `http://localhost:3000` | Neon (dev) ou local | mode test | Dev et recette complete |
| Preview Vercel | URL preview par PR | Neon prod | mode test | Validation avant merge |
| Prod | `https://panorama-pub.com` | Neon prod | mode live | Smoke test post-deploy uniquement |

### Setup local

```bash
pnpm install
pnpm devsafe           # clean .next + dev
pnpm stripe:listen     # forward webhooks Stripe dans un autre terminal
```

Verifier dans `.env.local` : `DATABASE_URI`, `PAYLOAD_SECRET`, `STRIPE_SECRET_KEY` (`sk_test_*`), `STRIPE_WEBHOOK_SECRET` (celui affiche par `stripe listen`), `RESEND_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`.

### Comptes et fixtures de test

Prealable : `pnpm seed:revendeurs` pour repeupler les comptes de demo.

| Compte | Email | Plan | Usage |
|--------|-------|------|-------|
| Admin | `admin@panorama-pub.com` | infinite (admin) | Admin Payload, moderation |
| Gratuit | `demo-gratuit@panorama-pub.com` | gratuit | Fiche basique |
| Premium | `demo-premium@panorama-pub.com` | premium | Fiche complete |
| Infinite | `demo-infinite@panorama-pub.com` | infinite | Fiche + evenements |
| Organisateur | a creer | infinite | Fiche organisateur |
| Groupe owner | `demo-groupe1@panorama-pub.com` | infinite | Owner groupe 3 membres |

Passwords seed par defaut (voir `src/scripts/seed-demo.ts`).

### Cartes Stripe test

| Carte | Usage |
|-------|-------|
| `4242 4242 4242 4242` | Paiement reussi |
| `4000 0000 0000 9995` | Fonds insuffisants (decline immediat) |
| `4000 0000 0000 0341` | Authentification 3DS requise puis echec |
| `4000 0025 0000 3155` | Authentification 3DS requise puis reussite |
| `4000 0000 0000 0069` | Carte expiree |
| `4000 0082 6000 3178` | Paiement reussi puis dispute/chargeback |

Date : toute date future. CVC : 3 chiffres quelconques. Code postal : quelconque.

### Outils pour observer

- DevTools reseau (requetes API, cookies `payload-token`)
- Terminal Stripe CLI (`pnpm stripe:listen`) pour voir les webhooks
- Console Payload `/admin` pour verifier les donnees
- [resend.com/emails](https://resend.com/emails) pour confirmer envoi des mails
- [dashboard.stripe.com/test](https://dashboard.stripe.com/test) pour subscriptions + invoices

---

## 1. Site public (non connecte)

### 1.1 Pages statiques

- [ ] `/` : page d'accueil s'affiche, testimonials visibles, CTAs `/inscription` et `/revendeurs` cliquables
- [ ] `/a-propos` : contenu rendu correctement
- [ ] `/contact` : lien mailto `contact@panorama-pub.com` present
- [ ] `/devenir-revendeur` : redirection 308 vers `/inscription`
- [ ] `/mentions-legales`, `/cgu`, `/cgv`, `/confidentialite`, `/cookies` : rendues sans erreur, `CONTACT_EMAIL` correctement interpole
- [ ] Footer present avec liens legaux + reseaux sociaux
- [ ] Navigation mobile (burger menu) ouvre/ferme correctement
- [ ] Responsive : smartphone (375px), tablette (768px), desktop (1440px)

### 1.2 Map Revendeurs (`/revendeurs`)

- [ ] La carte charge avec tous les markers (demo + reels)
- [ ] Styles Mapbox : switcher `light` / `dark` / `satellite` fonctionne
- [ ] Couleur des markers = couleur de `categorie-activite` principale ; gris pour plan gratuit
- [ ] Clic sur un marker ouvre le slideover avec les infos de la fiche
- [ ] Bouton "Voir la fiche complete" → redirige vers `/revendeurs/[slug]`
- [ ] Filtres (categories, ville, plan) raffinent le resultat sans re-render complet
- [ ] Bouton "itineraire" ouvre le panneau directions, selection profil `driving`/`walking`/`cycling` fonctionne, trace dessine sur la carte
- [ ] Fiche detail fournisseur : toutes les infos affichees, illustrations en galerie, lien vers boutique en ligne / site web ouvre en nouvel onglet
- [ ] Page detail : OpenGraph image generee dynamiquement (verifier via [opengraph.dev](https://www.opengraph.dev))

### 1.3 Map Evenements (`/evenements`)

- [ ] Carte charge avec markers cyan (evts organisateurs externes) et colores (evts fournisseurs)
- [ ] Vue **Agenda** bascule et affiche la liste chronologique
- [ ] Filtres type d'evenement + date range fonctionnent
- [ ] Clic marker → slideover, lien "Participer" visible si non-connecte → redirige vers `/login?redirect=...`
- [ ] Clic "Exporter (.ics)" telecharge un fichier `.ics` valide (ouvrable dans Google Calendar / Outlook)
- [ ] Fiche detail evenement : date, lieu, lien inscription https opere

### 1.4 SEO & meta

- [ ] `/sitemap.xml` renvoie un XML valide listant fournisseurs et evenements publies
- [ ] `/robots.txt` present
- [ ] `/llms.txt` present (si rollout)
- [ ] Meta description + og:image differentes par page (fiche revendeur, evenement, homepage)

---

## 2. Inscription, connexion, auth

### 2.1 Inscription revendeur

1. [ ] `/inscription` avec role `Revendeur` : remplir tous les champs (email, mot de passe >= 8 car., nom societe, ville, activite, CGU, Confidentialite)
2. [ ] Clic "Creer mon compte" → toast succes, redirige vers `/verify` ou page en attente
3. [ ] Email `verify-email` arrive dans [resend.com/emails](https://resend.com/emails) avec le bon `to:`
4. [ ] Clic sur le lien de verification → `_verified: true` dans Payload admin, redirige vers `/dashboard`
5. [ ] Email `welcome` arrive apres verification
6. [ ] Une fiche `fournisseurs` a ete auto-creee avec `statut='publiee'`, `user` lie
7. [ ] `cguAcceptedAt` et `confidentialiteAcceptedAt` renseignes

### 2.2 Inscription organisateur

1. [ ] Meme flux mais role `Organisateur` selectionne
2. [ ] Fiche `organisateurs-evenements` auto-creee (pas de `fournisseurs`)
3. [ ] `/dashboard` affiche "Fiche organisateur" dans le menu

### 2.3 Mots de passe faibles / doublons

- [ ] Mot de passe < 8 car. → erreur client + serveur
- [ ] Email deja existant → erreur 400 claire, pas de crash

### 2.4 Connexion

- [ ] `/login` avec credentials valides → cookie `payload-token` pose, redirection `/dashboard`
- [ ] Credentials invalides → message d'erreur, cookie non pose
- [ ] 5 echecs consecutifs → compte lock pendant 10 min + email `account-locked` envoye
- [ ] Apres lock, login valide refuse pendant 10 min avec message explicite
- [ ] Attendre 10 min + login valide → debloque

### 2.5 Mot de passe oublie

- [ ] `/mot-de-passe-oublie` : saisir email existant → email `forgotPassword` envoye
- [ ] Clic lien → `/reset-password?token=...` s'affiche
- [ ] Nouveau mot de passe < 8 car. → rejete
- [ ] Nouveau mot de passe valide → succes, peut se connecter avec, email `password-changed` envoye
- [ ] Email inexistant → ne pas reveler (reponse succes generique cote UI)

### 2.6 Changement email

1. [ ] Connecte, `/dashboard/compte` → changer l'email
2. [ ] Email `email-changed` envoye aux DEUX adresses (ancienne et nouvelle)
3. [ ] Reconnexion avec la nouvelle adresse OK

---

## 3. Dashboard — Fiche fournisseur (`/dashboard/fiche`)

### 3.1 Plan Gratuit

- [ ] Seuls `raisonSociale`, `ville`, `logo` sont modifiables ; les autres champs sont disabled / caches
- [ ] Banniere, illustrations, description, RSE, reseaux sociaux : bloques avec un message "Debloquer avec Premium"
- [ ] Marker sur la map reste gris

### 3.2 Plan Premium

- [ ] Tous les champs Premium+ accessibles : adresse, CP, siteWeb, boutique, devis, email, tel, reseaux sociaux (array), description, labels RSE, descriptionRSE, banniere, **1 illustration**
- [ ] Description : limite **100 mots** appliquee en save (erreur si depasse)
- [ ] Tentative d'ajouter une 2e illustration → rejete
- [ ] Video YouTube : champ cache (Infinite uniquement)
- [ ] Apres save, la page detail publique affiche les nouveaux champs
- [ ] Si adresse modifiee → auto-geocodage, marker bouge sur la map (verifier `lat/lng` dans Payload admin)

### 3.3 Plan Infinite

- [ ] Description limite **300 mots**
- [ ] Jusqu'a **6 illustrations**
- [ ] Champ videoYoutube accessible, validation URL YouTube active
- [ ] Section "Evenements" apparait dans la sidebar

### 3.4 Photos (`/dashboard/photos`)

- [ ] Upload logo / banniere / illustrations (jpg, png, webp)
- [ ] Fichier > 5 Mo → rejete avec message clair
- [ ] Autre format (gif, pdf) → rejete
- [ ] 3 tailles auto-generees (thumbnail 300, card 600, full 1200) : verifier dans Payload admin
- [ ] Suppression d'une illustration : media orphelin effectivement supprime du Vercel Blob (verifier cote Vercel dashboard)

### 3.5 Statut

- [ ] Admin passe fiche a `suspendue` depuis `/admin` → email `ficheRejectedEmail` envoye au user
- [ ] La fiche disparait de `/revendeurs` et du detail public (404 ou masquee)
- [ ] Admin remet `publiee` → fiche re-visible, pas de nouvel email

---

## 4. Dashboard — Fiche organisateur (`/dashboard/fiche-organisateur`)

- [ ] Tous les champs editables : nom, ville, adresse, tel, site web, emailContact, reseaux sociaux, activites, description (500 mots max), banniere, logo, illustrations (6 max), videoYoutube
- [ ] Description > 500 mots → rejetee (sauf admin)
- [ ] Tentative d'ajouter une 7e illustration → rejete
- [ ] Le `videoYoutube` exige une URL YouTube valide
- [ ] Page publique `/organisateurs/[slug]` affiche toutes les infos

---

## 5. Evenements (Infinite uniquement)

### 5.1 Creation (`/dashboard/evenements`)

- [ ] User Premium → creation bloquee / CTA upgrade
- [ ] User Infinite → creation OK : titre, type, dateDebut, lieuVille (required)
- [ ] Description courte > 400 car. → rejete
- [ ] Fournisseurs associes : seuls les user Infinite apparaissent dans le selecteur
- [ ] Quota : 10 evenements actifs max → 11e rejete avec message
- [ ] `lienInscription` non-https → rejete
- [ ] Apres save, marker apparait sur `/evenements` (attendre ISR ou revalidation)

### 5.2 Evenement avec organisateur externe

- [ ] Un evenement ne peut avoir a la fois `fournisseur` et `organisateurExterne` (mutuellement exclusif)
- [ ] Un admin ou organisateur cree un evenement avec `organisateurExterne` rattache a une fiche organisateur publiee

### 5.3 Participer

- [ ] Fournisseur A (Infinite) cree un evenement E
- [ ] Fournisseur B (Infinite) sur la page detail E clique "Participer" → `participantsSignales` mis a jour
- [ ] User gratuit / Premium : bouton masque ou desactive

### 5.4 Archivage et modification

- [ ] User modifie `titre` → email declenche ? (Non, seul l'admin passant a `archive` declenche `evenementRejectedEmail`)
- [ ] Admin passe l'evenement a `archive` → email envoye
- [ ] Cron `archiver-evenements` (test : passer `dateFin` a hier et declencher manuellement) → evenements passes archives, PAS d'email

### 5.5 .ics export

- [ ] `/api/ical/[id]` retourne un .ics RFC 5545 importable (VEVENT, DTSTART UTC, LOCATION, SUMMARY)

---

## 6. Abonnement (`/dashboard/abonnement`)

### 6.1 Souscription initiale

1. [ ] User gratuit voit les 3 plans, Gratuit marque "plan actuel"
2. [ ] Clic "Souscrire Premium" → redirige vers Stripe Checkout
3. [ ] Payer avec `4242 4242 4242 4242` → webhook Stripe `checkout.session.completed` arrive (visible dans `pnpm stripe:listen`)
4. [ ] Redirige vers `/dashboard/abonnement?success=true&session_id=...`
5. [ ] `user.plan='premium'`, `user.stripeCustomerId` et `user.stripeSubscriptionId` renseignes, `user.planExpiresAt` = date anniversaire dans 1 an
6. [ ] AuditLog `plan_changed` avec reason `checkout_completed` cree
7. [ ] Page affiche "Plan actuel : Premium", date prochaine echeance
8. [ ] Email de confirmation Stripe recu (si active cote Stripe)

### 6.2 Checkout avec groupe (coupon projete)

1. [ ] User deja membre d'un groupe de 3 membres payants avant souscription
2. [ ] Lors du checkout, le total Stripe affiche -5% (coupon applique via `palierProjeteAvecUtilisateurPayant`)
3. [ ] Apres paiement, le palier est recalcule a 5% et applique a tous les membres du groupe

### 6.3 Guard AUD-C03 (double-checkout)

- [ ] User Premium clique "Souscrire Infinite" → redirige vers Checkout
- [ ] Backend refuse avec 409 + message "abonnement deja actif", UI redirige vers bouton "Changer de plan" a la place
- [ ] User avec `cancel_at_period_end=true` tente un checkout → 409 avec code `cancel_pending`, message "reactivez-le d'abord"

### 6.4 Change plan (Premium → Infinite)

1. [ ] User Premium clique "Passer a Infinite"
2. [ ] **Modale preview proration** s'affiche avec montant a payer maintenant + nouvelle date d'echeance
3. [ ] Confirmation → `subscriptions.update` avec `proration_behavior='always_invoice'`
4. [ ] Webhook `customer.subscription.updated` + `invoice.paid` → `user.plan='infinite'`
5. [ ] AuditLog `plan_changed` avec reason `subscription_updated`
6. [ ] UI reflete Infinite, prochaine echeance inchangee (billing_cycle_anchor preserve)
7. [ ] Nouvelle facture visible dans Stripe dashboard

### 6.5 Downgrade (Infinite → Premium)

1. [ ] User Infinite avec 3 illustrations + description 250 mots + videoYoutube
2. [ ] Modale preview : credit sur prochaine facture (downgrade = `create_prorations`)
3. [ ] Confirmation → `user.plan='premium'` via webhook
4. [ ] Fiche : `videoYoutube` vide, description videe si > 100 mots, illustrations tronquees a 1, evenements actifs archives
5. [ ] Limites Premium appliquees en re-edition

### 6.6 Annulation

1. [ ] User paid clique "Annuler" → confirmation
2. [ ] `cancel_at_period_end=true` cote Stripe
3. [ ] UI affiche "Annulation programmee pour le YYYY-MM-DD"
4. [ ] Bouton "Reactiver" visible
5. [ ] Bouton "Annuler" disparait (remplace par "Reactiver")
6. [ ] Pas de charge future tant que non reactive
7. [ ] Affichage sur card Gratuit : bouton "Annuler directement" si `cancel_at_period_end=true` (AUD-C09)
8. [ ] Ligne "Prochain prelevement" disparait (AUD-C08)

### 6.7 Reactivation

1. [ ] User avec annulation programmee clique "Reactiver"
2. [ ] `cancel_at_period_end=false` cote Stripe
3. [ ] UI repasse en etat normal, "Annuler" redispo
4. [ ] Ligne "Prochain prelevement" reapparait avec montant apres reduction groupe (AUD-C08)

### 6.8 Customer Portal (AUD-C07)

1. [ ] Clic "Gerer mes moyens de paiement" → redirige vers `billing.stripe.com/...`
2. [ ] Peut voir ses factures, les telecharger
3. [ ] Peut changer de CB (tester avec `4000 0000 0000 0069` expiree, puis `4242`)
4. [ ] Retour au site : moyen de paiement mis a jour cote Stripe

### 6.9 Cron downgrade-expires

- [ ] Passer `planExpiresAt` a `NOW() - 1 day` dans Payload admin
- [ ] Declencher `GET /api/cron/downgrade-expires` avec `Authorization: Bearer $CRON_SECRET`
- [ ] User passe `plan='gratuit'`, `stripeSubscriptionId=null`, `planExpiresAt=null`
- [ ] Champs Premium+ de la fiche vides (description, illustrations, reseaux sociaux, RSE, banniere...)
- [ ] AuditLog `plan_changed` avec reason `expired_cron`
- [ ] Email "votre abonnement a expire" envoye

### 6.10 Cron expiration-alertes

- [ ] Passer `planExpiresAt` a `NOW() + 30 days` → cron envoie l'email J-30 une seule fois (flag `expirationAlertes.j30Sent`)
- [ ] Meme user, cron relance → pas de doublon
- [ ] J-7 : meme logique avec flag distinct

---

## 7. Groupes (`/dashboard/groupe`)

### 7.1 Creation (paid only)

- [ ] User gratuit : page affiche CTA upgrade, formulaire bloque
- [ ] User Premium cree un groupe avec nom → code `GRP-XXXXXX` genere, palier 0%
- [ ] User devient owner et membre

### 7.2 Invitation

- [ ] Owner entre 3 emails separes → emails d'invitation envoyes a chacun avec le code
- [ ] Emails deja membres : ignores
- [ ] Rate limit : > 10 invites/min → 429

### 7.3 Adhesion

- [ ] User prospect Premium entre le code `GRP-XXXXXX` correct → rejoint
- [ ] Code invalide → erreur
- [ ] Deja dans un autre groupe → rejete
- [ ] Gratuit essaie de rejoindre → accepte (mais ne compte pas comme payant)

### 7.4 Palier et coupons

- [ ] Groupe a 2 membres payants, palier 0%, aucun coupon Stripe sur les subs
- [ ] Ajout 3e membre payant → palier passe a 5%, coupon `STRIPE_COUPON_5_ID` applique sur les 3 subscriptions actives
- [ ] Verifier dans Stripe dashboard > Customer > Subscription > Discounts
- [ ] Ajout 2 membres (total 5) → palier 10%, coupon remplace sur les 5 subs
- [ ] Retrait d'un membre (quit ou annulation) → palier recalcule
- [ ] AuditLog `groupe_sync_failed` si une mise a jour de sub echoue

### 7.5 Quitter / transfert ownership

- [ ] Membre non-owner quitte → palier recalcule, email confirm
- [ ] Owner quitte avec autres membres → **confirmation modale** + transfert ownership au plus ancien + email dedie au nouvel owner
- [ ] Owner quitte seul → groupe supprime (soft-delete, AuditLog `groupe_soft_deleted`)

---

## 8. RGPD (`/dashboard/compte`)

### 8.1 Preferences emails

- [ ] Toggle "opt-in marketing" : transitions tracked (`optInMarketingAt` / `optOutMarketingAt`)
- [ ] AuditLog `consent_given` ou `consent_revoked` cree
- [ ] Email de desinscription (lien `/api/emails/unsubscribe?token=...`) : token valide 90j, desactive `optInMarketing`
- [ ] Token expire 91j → erreur claire

### 8.2 Export donnees

- [ ] Clic "Exporter mes donnees" → telechargement JSON contenant user + fiche + groupe + evenements
- [ ] AuditLog `data_exported` cree
- [ ] Rien d'identifiant non-masque pour les autres users (IDs anonymes)

### 8.3 Suppression compte

- [ ] Clic "Supprimer mon compte" → confirmation (mot de passe ou confirmation texte)
- [ ] User + fiche + groupe (owner → transfert ou delete) supprimes
- [ ] Subscription Stripe annulee immediatement (pas au prochain cycle)
- [ ] AuditLog `account_deleted` (userIdHash anonymise)
- [ ] Email de confirmation de suppression envoye
- [ ] Redirect vers `/desabonnement/confirme`

---

## 9. Emails transactionnels — liste exhaustive

A valider : chaque email arrive, template HTML correct, footer present, lien unsubscribe pour les non-transactionnels.

| Trigger | Template | Destinataire |
|---------|----------|--------------|
| Inscription | `verify-email` | nouveau user |
| Verification email | `welcome` | user |
| Change password | `password-changed` | user |
| Change email | `email-changed` | ancienne + nouvelle adresse |
| 5 echecs login | `account-locked` | user |
| Fiche suspendue par admin | `ficheRejectedEmail` | owner fiche |
| Evenement archive par admin | `evenementRejectedEmail` | owner evenement |
| Paiement reussi (webhook) | Stripe default | user |
| Paiement echoue | `payment-failed` | user + `CONTACT_EMAIL` |
| Abonnement expire (cron) | `plan-expired` | user |
| J-30 expiration | `expiration-j30` | user |
| J-7 expiration | `expiration-j7` | user |
| Welcome J+3 | `onboarding-j3` | user |
| Welcome J+7 | `onboarding-j7` | user |
| Welcome J+14 | `onboarding-j14` | user |
| Invite groupe | `groupe-invite` | destinataire |
| Transfert ownership groupe | `groupe-ownership-transferred` | nouveau owner |
| priceId Stripe inconnu | `stripeMisconfigAlertEmail` | `CONTACT_EMAIL` |
| Resend bounce / complaint (webhook) | blacklist positionnee | (pas d'email) |

### Verifier aussi

- [ ] Envoi respecte la blacklist : user avec `emailBlacklisted=true` ne recoit rien (sauf `skipBlacklistCheck: true` pour les emails securite)
- [ ] Lien unsubscribe present dans footer des emails non-transactionnels

---

## 10. Webhooks

### 10.1 Stripe

- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` en marche
- [ ] Verifier que chaque evt liste dans CLAUDE.md (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.trial_will_end` si trial active) est handle
- [ ] Envoi d'un evt duplique (meme eventId) → idempotence via `StripeEvents` UNIQUE constraint, pas de double traitement
- [ ] Signature invalide → 400
- [ ] Rate limit 30/min par IP : depasser → 429

### 10.2 Resend

- [ ] Simuler un `email.bounced` hard (via Resend dashboard ou payload curl signe Svix) → user passe `emailBlacklisted=true, reason='hard-bounce'`
- [ ] Simuler `email.complained` → `reason='complaint'`
- [ ] Signature Svix invalide → 400
- [ ] Rate limit 60/min

---

## 11. Admin Payload (`/admin`)

### 11.1 Acces

- [ ] User `role='admin'` peut acceder, les autres sont redirige vers `/dashboard` par le middleware
- [ ] Widgets dashboard admin : stats users / fournisseurs / evenements affichees

### 11.2 Collections

- [ ] Naviguer chaque collection (Users, Fournisseurs, Evenements, Groupes, Organisateurs, Media, CategoriesActivite, TypesEvenement, LabelsRSE, Testimonials, AuditLogs, StripeEvents)
- [ ] Tri, filtres, pagination fonctionnent
- [ ] Creation / edition / suppression OK pour admin
- [ ] Bouton "Import CSV" sur Users ouvre l'interface, import d'un fichier test reussit

### 11.3 AuditLogs

- [ ] La liste affiche les logs recents (plan_changed, account_deleted, etc.)
- [ ] Les userIdHash sont anonymes (pas d'email visible)
- [ ] Update bloque (`update: () => false`) → editer un doc renvoie erreur
- [ ] Filtrer par type

### 11.4 Moderation

- [ ] Passer un fournisseur a `suspendue` → email + disparition publique
- [ ] Passer un evenement a `archive` → email + disparition

---

## 12. Securite et middleware

- [ ] `/dashboard` sans cookie `payload-token` → redirige vers `/login?redirect=/dashboard`
- [ ] `/admin` avec un user non-admin → redirige vers `/dashboard`
- [ ] Cookie vole / expire : re-login requis
- [ ] `SITE_PROTECTION_ENABLED=true` : toutes les routes (sauf `/api/*`, `/admin`, `/_next/*`, `/img/*`) demandent Basic Auth
- [ ] Tentative d'appeler `/api/stripe/webhook` avec un mauvais secret → 400
- [ ] Rate limit sur `/api/stripe/cancel`, `/api/stripe/reactivate`, `/api/stripe/change-plan`, `/api/stripe/portal`, `/api/groupes/*`, `/api/directions`, `/api/resend/webhook`
- [ ] CSP headers presents (verifier en DevTools, `Content-Security-Policy`)
- [ ] CSRF : Payload protege via cookie + same-origin ; pas de token CSRF explicite mais verifier que POST cross-origin echoue

---

## 13. Cas limites et robustesse

### 13.1 Network et race conditions

- [ ] Double-clic rapide sur "Annuler abonnement" → une seule requete ou idempotente cote Stripe
- [ ] Double-clic sur "Creer groupe" → rate limit ou idempotence UI
- [ ] Offline : l'UI affiche un message / toast d'erreur, pas de crash
- [ ] Slow network (throttle 3G en DevTools) : spinners / skeletons visibles partout

### 13.2 Permissions

- [ ] User Premium essaie de modifier un champ Infinite-only via fetch direct → 403 ou champ rejete silencieusement par le beforeChange
- [ ] Fournisseur A essaie d'editer la fiche de Fournisseur B → 403
- [ ] Non-admin essaie de changer son propre `plan` via PATCH `/api/users/:id` → rejete (admin-only field)

### 13.3 Medias

- [ ] Supprimer un media reference dans `banniere` → rejete avec message clair (`beforeDelete`)
- [ ] Media uploade mais non reference apres 24h → (si regle existe) purge ; sinon reste orphelin
- [ ] Hot-reload dev : upload puis redemarrage → fichier toujours accessible

### 13.4 Donnees edge

- [ ] Fiche avec 0 illustration : page publique ne casse pas
- [ ] Evenement sans `dateFin` : affichage "date unique"
- [ ] Groupe avec 1 seul membre payant (owner) : palier 0%, pas de coupon
- [ ] User avec adresse invalide : geocodage echoue → marker absent de la carte, pas de crash backend
- [ ] Description avec caracteres speciaux (emoji exclus, accents OK) : rendu correct

---

## 14. Cron — declenchement manuel

Header requis : `Authorization: Bearer $CRON_SECRET`.

| Endpoint | Test |
|----------|------|
| `/api/cron/archiver-evenements` | Evt `dateFin < now` passent a `archive`, pas d'email |
| `/api/cron/downgrade-expires` | User avec `planExpiresAt < now` → `plan='gratuit'`, fiche nettoyee, AuditLog, email |
| `/api/cron/purge-anciens` | Donnees > N jours purgees (voir CLAUDE.md pour fenetre) |
| `/api/cron/expiration-alertes` | J-30 et J-7 envoyes, flags poses, pas de doublon |
| `/api/cron/onboarding-emails` | Users non-verifies ou recents recoivent J+3 / J+7 / J+14 selon leur age, flag pose |

Sans header → 401. Avec mauvais secret → 401.

---

## 15. Performance et build

- [ ] `pnpm build` passe sans erreur TypeScript ni warning bloquant
- [ ] `pnpm lint` zero erreur
- [ ] `pnpm test:int` passe
- [ ] `pnpm test:e2e` passe (Playwright)
- [ ] Lighthouse sur la homepage : Performance >= 80, Accessibility >= 90, Best Practices >= 90, SEO >= 95 (mobile)
- [ ] Map Revendeurs en prod : charge en < 3s sur 3G simulee
- [ ] Images servies en webp quand supportees, tailles responsives respectees

---

## 16. Smoke test post-deploy prod

5 min max, sur `https://panorama-pub.com` :

- [ ] `/` rend, logo et testimonials OK
- [ ] `/revendeurs` affiche la carte avec markers
- [ ] `/evenements` affiche au moins 1 evenement
- [ ] `/login` + test compte admin : connexion OK
- [ ] `/admin` accessible en tant qu'admin
- [ ] `/api/health` retourne 200
- [ ] `/sitemap.xml` rend
- [ ] Un email de verification fictif (inscription test) arrive bien

Si un de ces points casse → rollback Vercel immediat vers le deploy precedent, ouvrir incident.

---

## 17. Incidents a surveiller les 24h

Apres release majeure :

- [ ] Taux de 5xx sur Vercel Analytics
- [ ] Emails bounces / complaints sur Resend dashboard
- [ ] Webhooks Stripe en erreur (Stripe dashboard > Webhooks > Events)
- [ ] Users inscrits mais non-verifies : si pic anormal, verifier le template verify-email et la delivrabilite
- [ ] AuditLogs `stripe_misconfig` : si present, priceId Stripe mal configure → correction urgente

---

## Annexes

### Reset base de test local

```bash
# Option 1 : wipe + re-seed (detruit tout, uniquement sur DB dev/test)
pnpm payload migrate:reset
pnpm payload migrate
pnpm seed:revendeurs

# Option 2 : supprimer juste les comptes demo
pnpm tsx src/scripts/list-users.ts
pnpm tsx src/scripts/delete-user-full.ts <userId>
```

### Simuler un webhook Stripe en local

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

### Tester un cron manuellement

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/downgrade-expires
```

### Voir les AuditLogs en live

```bash
pnpm tsx -e "
import { getPayload } from 'payload'
import config from '@payload-config'
const p = await getPayload({ config })
const r = await p.find({ collection: 'audit-logs', sort: '-createdAt', limit: 20, overrideAccess: true })
console.table(r.docs.map(d => ({ type: d.type, createdAt: d.createdAt, meta: JSON.stringify(d.metadata).slice(0, 100) })))
"
```
