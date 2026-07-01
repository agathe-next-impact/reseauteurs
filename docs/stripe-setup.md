# Procedure de mise en place Stripe — PanoramaPub.fr

Procedure complete pour configurer un compte Stripe **vierge** et le brancher sur l'application. Couvre une installation **TEST** (developpement local + previews Vercel) puis **PROD** (production).

> Reference code : `src/lib/stripe.ts`, `src/app/api/stripe/**`, `src/lib/groupes.ts`, `src/app/api/stripe/webhook/route.ts`.
> API version pinnee dans le code : **`2026-02-25.clover`** — ne pas la changer sans relire `lib/stripe.ts:13-22`.

---

## 0. Prerequis

- Acces proprietaire au compte Stripe (creation produits + webhooks + Tax).
- Stripe CLI installee localement : `https://stripe.com/docs/stripe-cli`.
- Acces au dashboard Vercel du projet (env vars Preview + Production).
- Acces a `.env.local` du repo pour le mode TEST.
- Numero de TVA intracom + adresse legale de PanoramaPub.fr (pour Tax + factures).

Variables a renseigner au final (cf. `CLAUDE.md` section "Variables d'environnement") :

```
STRIPE_SECRET_KEY=sk_test_...      # ou sk_live_... en prod
STRIPE_PUBLISHABLE_KEY=pk_test_... # ou pk_live_... en prod
STRIPE_WEBHOOK_SECRET=whsec_...    # signing secret du webhook /api/stripe/webhook
STRIPE_PREMIUM_PRICE_ID=price_...  # Premium 99 EUR HT/an recurrent
STRIPE_INFINITE_PRICE_ID=price_... # Infinite 219 EUR HT/an recurrent
STRIPE_COUPON_5_ID=...             # -5%  (3-4 membres payants Infinite dans un groupe)
STRIPE_COUPON_10_ID=...            # -10% (5-9 membres)
STRIPE_COUPON_15_ID=...            # -15% (10+ membres)
```

---

## 1. INSTALLATION TEST

Toutes les actions ci-dessous se font dans le dashboard Stripe en mode **Test** (toggle en haut a gauche, "Viewing test data").

### 1.1 Creation du compte / activation du mode Test

1. Creer le compte Stripe (https://dashboard.stripe.com/register) ou se connecter au compte existant.
2. Activer **Mode Test** (cle visible en sk_test_ / pk_test_).
3. Renseigner les infos minimales requises pour debloquer Stripe Tax et Billing (raison sociale, adresse, secteur). En test, pas besoin du KYC complet.

### 1.2 Configuration des branding & devise

- Stripe Dashboard > **Settings > Business settings > Branding** : logo carre + icone + couleur de marque (utilisee dans Checkout et Billing Portal).
- **Settings > Account > Public details** : nom public = `PanoramaPub.fr`, email support = `contact@panorama-pub.com`, site = `https://panorama-pub.com`.
- **Settings > Account > Account details** : devise par defaut = **EUR**.

### 1.3 Activation de Stripe Tax

Le code active `automatic_tax: { enabled: true }` et `tax_id_collection: { enabled: true }` au Checkout (`src/app/api/stripe/checkout/route.ts:220-223`). Sans Tax active, le Checkout echoue.

1. **Tax > Settings** : activer Stripe Tax.
2. Renseigner l'**adresse d'origine** (siege PanoramaPub.fr).
3. Activer la collecte pour la **France** (et autres pays UE si applicable). Pour chaque pays, choisir la categorie de produit par defaut **`txcd_10000000`** (services numeriques B2B/B2C, taxable).
4. Activer la collecte du **numero de TVA intracom acheteur** (eu_vat) : par defaut active avec `tax_id_collection`.
5. (Optionnel test) : ajouter une **tax registration** factice France pour voir la TVA s'afficher dans Checkout.

### 1.4 Creation des produits et prix

Dashboard **Products > Add product**. Creer **deux** produits.

#### Produit 1 — Premium

- Name : `Premium`
- Description : `Abonnement annuel Premium PanoramaPub.fr`
- Tax behavior : **Exclusive** (le code utilise `automatic_tax`, les prix sont HT)
- Tax code : **`txcd_10000000`** (Services numeriques)
- Pricing :
  - Type : **Recurring**
  - Billing period : **Yearly**
  - Amount : **99,00 EUR**
  - Currency : EUR
  - Include tax in price : **No** (HT)
- Save -> noter le **`price_...`** -> **`STRIPE_PREMIUM_PRICE_ID`**

#### Produit 2 — Infinite

- Name : `Infinite`
- Description : `Abonnement annuel Infinite PanoramaPub.fr`
- Tax behavior : **Exclusive**
- Tax code : **`txcd_10000000`**
- Pricing :
  - Type : **Recurring**
  - Billing period : **Yearly**
  - Amount : **219,00 EUR**
  - Currency : EUR
  - Include tax in price : **No**
- Save -> noter le **`price_...`** -> **`STRIPE_INFINITE_PRICE_ID`**

### 1.5 Creation des coupons de groupe

Dashboard **Products > Coupons > Create coupon**. Trois coupons, tous **percentage**, **forever** (recurrents) — voir `src/lib/groupes.ts:289` pour la logique d'application.

| Coupon | Type | Pourcentage | Duration | Var env |
|--------|------|-------------|----------|---------|
| Groupe 3-4 membres | Percentage | **5%** | Forever | `STRIPE_COUPON_5_ID` |
| Groupe 5-9 membres | Percentage | **10%** | Forever | `STRIPE_COUPON_10_ID` |
| Groupe 10+ membres | Percentage | **15%** | Forever | `STRIPE_COUPON_15_ID` |

Pour chacun :
1. Type = **Percentage off**
2. Percentage = 5 / 10 / 15
3. Duration = **Forever**
4. **Ne pas** cocher "Limit the date range" ni "Limit the number of times this coupon can be redeemed"
5. **Ne pas** restreindre a un produit specifique (les 3 coupons doivent etre applicables a Premium et Infinite — meme si l'app n'applique le coupon que sur les souscriptions Infinite, ne pas restreindre cote Stripe pour eviter les erreurs 400 sur subscriptions.update lors d'un futur changement de regle).
6. Noter l'`id` du coupon (visible dans l'URL ou colonne ID).

### 1.6 Configuration du Customer Portal (Billing Portal)

`src/app/api/stripe/portal/route.ts` ouvre une session Billing Portal pour mettre a jour CB / consulter factures.

Dashboard **Settings > Billing > Customer portal** :

1. **Functionality** :
   - Customer information : Update email, billing address, tax ID -> **OFF** (l'email est gere par notre flow `/api/account/change-email`, l'adresse via Checkout, le VAT via `tax_id_collection`. Laisser ON cree des desyncs avec la DB Payload).
   - Payment methods : **ON** (mise a jour CB)
   - Invoice history : **ON**
   - **Cancel subscriptions** : **OFF** — le code dispose d'un endpoint dedie `/api/stripe/cancel` qui declenche les emails et journalise. Si ON, l'utilisateur peut annuler depuis le portail sans declencher nos hooks.
   - **Update subscriptions** (switch plan) : **OFF** — gere par `/api/stripe/change-plan` avec preview de proration.
2. **Business information** : nom = `PanoramaPub.fr`, lien CGV = `https://panorama-pub.com/cgv`, lien confidentialite = `https://panorama-pub.com/confidentialite`.
3. **Branding** : herite de Settings > Branding.
4. Save.

### 1.7 Email & receipts Stripe

Dashboard **Settings > Emails** :

- **Successful payments** : OFF (notre webhook envoie `subscriptionConfirmationEmail` via Resend pour controler le branding et la trace AuditLog).
- **Failed payments** : OFF (notre webhook envoie `paymentFailedEmail`).
- **Subscription canceled** : OFF (notre webhook envoie `subscriptionCanceledEmail`).
- **Refunds** : ON (rare, geres manuellement).
- **Disputes** : ON.

### 1.8 Webhook endpoint local (Stripe CLI)

Pour le dev local, on **ne cree pas** de webhook dans le dashboard. On utilise le forwarding CLI.

```bash
stripe login
pnpm stripe:listen   # alias defini dans package.json -> stripe listen --forward-to localhost:3000/api/stripe/webhook
```

La CLI affiche un **`whsec_...`** au demarrage : c'est ton **`STRIPE_WEBHOOK_SECRET`** local. Le copier dans `.env.local`.

Tant que `stripe listen` tourne, les events sont relayes vers `localhost:3000`. Sans ca, aucun event n'arrive et les paiements de test ne mettront jamais a jour `user.plan`.

### 1.9 (Optionnel) Webhook endpoint pour les previews Vercel

Si on veut tester les previews deployees (PR/branches sur `*.vercel.app`) sans relancer la CLI :

1. **Developers > Webhooks > Add endpoint**.
2. URL : `https://<preview-deployment>.vercel.app/api/stripe/webhook` (variable, mieux : URL d'un deploiement stable comme `optimisations.vercel.app`).
3. Events : voir liste section **2.7** ci-dessous (identique TEST/PROD).
4. Copier le `whsec_...` dans les env vars Vercel **Preview**.

Limitation : un seul webhook secret par environnement, donc soit on l'attache a un deploiement Preview pinnee, soit on accepte que les autres previews recoivent des events sans pouvoir les verifier (et donc renvoient 400). Pour un projet a un seul dev, l'option CLI suffit dans 99% des cas.

### 1.10 Renseigner `.env.local`

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # depuis `stripe listen`
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_INFINITE_PRICE_ID=price_...
STRIPE_COUPON_5_ID=...
STRIPE_COUPON_10_ID=...
STRIPE_COUPON_15_ID=...
```

Sur les **Vercel Preview** env vars (dashboard Vercel projet > Settings > Environment Variables, scope **Preview**) : meme valeurs sauf `STRIPE_WEBHOOK_SECRET` qui peut etre celui du webhook prevue en 1.9 ou un placeholder.

### 1.11 Verifications TEST

1. `pnpm dev` + `pnpm stripe:listen` dans deux terminaux.
2. Inscription d'un nouvel user role `fournisseur` -> dashboard.
3. **Premium** : `/dashboard/abonnement` > Premium > Checkout. Carte test : `4242 4242 4242 4242` exp `12/34` CVC `123`. Adresse FR.
   - Verifier que la TVA s'affiche au Checkout.
   - Apres paiement, redirection vers `/dashboard/abonnement?success=true`.
   - Verifier en DB : `user.plan = 'premium'`, `stripeCustomerId` et `stripeSubscriptionId` remplis, `planExpiresAt` ~ +1 an.
   - Verifier l'email Resend `subscriptionConfirmationEmail` recu.
   - Verifier `AuditLogs` : `type=plan_changed`, `metadata.reason=checkout_completed`.
4. **Change plan Premium -> Infinite** : depuis `/dashboard/abonnement`, modale de preview proration -> confirmer. Verifier `subscriptions.update` cote Stripe + email `planUpgradedEmail`.
5. **Coupons groupe** : creer un groupe via `/dashboard/groupe`, faire passer 3 users en Infinite, verifier que le coupon `STRIPE_COUPON_5_ID` est applique sur les 3 subs (Stripe Dashboard > Subscriptions > Discounts).
6. **Webhook idempotence** : `stripe events resend evt_...` -> verifier en DB que `stripe-events` n'a pas duplique et que `user.plan` n'a pas re-bouge.
7. **Cancel** : `/dashboard/abonnement > Annuler`. Verifier `cancel_at_period_end=true` cote Stripe + email `subscriptionCanceledEmail`.
8. **Reactivate** : `/dashboard/abonnement > Reactiver`. Verifier `cancel_at_period_end=false`.
9. **Billing portal** : bouton "Gerer mes informations de facturation" -> session Stripe ouvre. Verifier que **Cancel** et **Switch plan** ne sont **pas** proposes (cf. 1.6).
10. **Echec paiement** : carte `4000 0000 0000 0341` (paiement initial OK puis echec sur renouvellement) — necessite de simuler `invoice.payment_failed` via `stripe trigger invoice.payment_failed`.
11. **Guard double paiement** (AUD-C03) : tenter un Checkout alors qu'une sub est active -> 409 attendu.

---

## 2. INSTALLATION PROD

A faire **apres** validation complete des points 1.11. Le compte peut etre le meme (Stripe sait isoler test/live) — il suffit de basculer en mode **Live**.

### 2.1 Activation du compte Live

1. Dashboard Stripe > toggle **Live mode**.
2. Completer le KYC : raison sociale + SIREN + RIB + identite des representants. Stripe peut demander quelques jours de verification.
3. Tant que le compte n'est pas active, les cles `sk_live_` / `pk_live_` existent mais le Checkout est bloque.

### 2.2 Branding & coordonnees (live)

Refaire **Settings > Business settings > Branding** + **Public details** + **Account details** en live (les reglages live sont independants des test).

- Devise : EUR
- Public business name : `PanoramaPub.fr`
- Email support : `contact@panorama-pub.com`
- URL : `https://panorama-pub.com`

### 2.3 Stripe Tax (live)

Reproduire 1.3 en live :

1. **Tax > Settings** : activer.
2. Adresse d'origine : siege PanoramaPub.fr.
3. **Tax registrations** : ajouter la **France** avec le **vrai numero de TVA intracom** + date de debut. Idem pour autres pays UE si on franchit le seuil OSS / on a une immatriculation locale.
4. Categorie produit par defaut : **`txcd_10000000`**.
5. Verifier la **politique de seuils OSS** : Stripe Tax peut basculer en TVA pays acheteur des qu'on franchit 10 000 EUR/an de ventes B2C UE — confirmer la regle avec le comptable.

### 2.4 Produits et prix (live)

Refaire 1.4 en live. **Les `price_...` live sont differents des test.** Bien noter les nouveaux IDs.

- Premium : 99,00 EUR HT / an / Recurring / `txcd_10000000` / Tax exclusive
- Infinite : 219,00 EUR HT / an / Recurring / `txcd_10000000` / Tax exclusive

> Important : `STRIPE_PREMIUM_PRICE_ID` / `STRIPE_INFINITE_PRICE_ID` doivent contenir les IDs **live** dans Vercel Production. Une erreur ici = utilisateurs payants en TEST en production = catastrophe.

### 2.5 Coupons de groupe (live)

Refaire 1.5 en live. Trois coupons percentage forever : 5% / 10% / 15%. Noter les nouveaux IDs.

### 2.6 Customer Portal (live)

Refaire 1.6 en live (les reglages live sont independants des test). Memes choix :
- Cancel subscriptions : **OFF**
- Update subscriptions : **OFF**
- Update payment methods : **ON**
- Update tax ID / billing address / email : **OFF**
- Liens CGV + Confidentialite : `https://panorama-pub.com/cgv` et `/confidentialite`.

### 2.7 Webhook endpoint (live, OBLIGATOIRE)

**Developers > Webhooks > Add endpoint** (en mode live).

- URL : **`https://panorama-pub.com/api/stripe/webhook`**
- API version : **`2026-02-25.clover`** (matcher exactement la valeur pinnee dans `lib/stripe.ts:21`).
- Events to send (cocher exactement les 5 traites dans `src/app/api/stripe/webhook/route.ts:251-897`) :
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `customer.updated`

> Ne pas activer "Send all events" : le code rate-limit par type (`stripe-webhook:${event.type}`) et tout event non traite consomme un bucket pour rien. Le code retourne quand meme 200 sur les types inconnus, donc Stripe ne retentera pas, mais on pollue les logs.

Recuperer le **Signing secret** (`whsec_...`) du endpoint -> **`STRIPE_WEBHOOK_SECRET`** Vercel Production.

### 2.8 Email Stripe (live)

Refaire 1.7 en live : OFF pour Successful/Failed/Canceled (geres par Resend), ON pour Refunds + Disputes.

### 2.9 Variables d'environnement Vercel Production

Dashboard Vercel > projet > Settings > Environment Variables, scope **Production** uniquement (NE PAS pousser ces valeurs en Preview ni Development) :

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # secret du webhook live cree en 2.7
STRIPE_PREMIUM_PRICE_ID=price_...      # ID live
STRIPE_INFINITE_PRICE_ID=price_...     # ID live
STRIPE_COUPON_5_ID=...                 # ID live
STRIPE_COUPON_10_ID=...                # ID live
STRIPE_COUPON_15_ID=...                # ID live
```

Apres ajout : **redeployer la production** (les env vars ne sont chargees qu'au build).

### 2.10 Verifications PROD (sanity check non destructif)

A faire le jour de la mise en prod, AVANT d'annoncer publiquement.

1. **Health check** : `curl https://panorama-pub.com/api/health` -> 200.
2. **Page tarifs** charge sans erreur, prix 99 et 219 EUR affiches.
3. **Webhook reception** : Dashboard Stripe > Developers > Webhooks > endpoint > "Send test webhook" sur `customer.updated` -> verifier reception 200 dans les logs Vercel et **aucune** erreur de signature.
4. **API version** du webhook = `2026-02-25.clover` (sinon les events `customer.subscription.updated` arrivent avec un format different et le code peut casser sur `getSubscriptionPeriodEnd`).
5. **Premier paiement reel** (compte interne, carte CB equipe) : Premium 99 EUR.
   - Verifier `user.plan = 'premium'` en prod DB.
   - Verifier facture recue + AuditLog `plan_changed`.
   - **Rembourser immediatement** depuis le dashboard Stripe (`Refund` sur l'invoice). Le code n'a pas de hook automatique sur refund — verifier que `user.plan` reste `premium` jusqu'a `customer.subscription.deleted` ou expiration. Si le remboursement n'annule pas la sub (cas standard), passer manuellement par `/dashboard/abonnement > Annuler` ou cancel via Stripe Dashboard.
6. **Coupon groupe** : creer un groupe interne avec 3 comptes Infinite test reels (ou simuler en TEST avant) pour valider l'application du coupon en live au moins une fois.
7. **Cron Vercel** : verifier dans Vercel Dashboard > Crons que les 5 jobs sont actifs (en particulier `downgrade-expires` qui depend de Stripe).

### 2.11 Acces Dashboard pour le proprietaire

- Activer la **2FA** sur le compte Stripe (obligatoire en live).
- Inviter l'equipe en **Members** avec le role **Developer** (vue read + Logs + webhooks) ou **Admin** selon le besoin.
- Activer les **alertes par email** : Settings > Team & security > Email notifications -> Disputes + Failed payouts + Webhook delivery failures.

---

## 3. Annexes

### 3.1 Mapping events Stripe -> code

| Event Stripe | Handler | Effet |
|---|---|---|
| `checkout.session.completed` | `webhook/route.ts:252` | Cree la sub, set `user.plan` + `planExpiresAt`, attache `pendingGroupeCode`, recalcule palier groupe |
| `customer.subscription.updated` | `webhook/route.ts:506` | Sync `user.plan` (upgrade/downgrade), recalcule palier groupe, gere `cancel_at_period_end` |
| `customer.subscription.deleted` | `webhook/route.ts:795` | `downgradeUserAndClearFields(user, 'gratuit')`, recalcule palier groupe, email `subscriptionCanceledEmail` |
| `invoice.payment_failed` | `webhook/route.ts:872` | Email `paymentFailedEmail`, ne change pas `user.plan` (Stripe retentera) |
| `customer.updated` | `webhook/route.ts:897` | Sync `billingAddress`, `vatNumber`, `raisonSocialeFacturation` depuis Stripe Customer |

### 3.2 Cartes de test utiles

| Carte | Comportement |
|---|---|
| `4242 4242 4242 4242` | Succes |
| `4000 0025 0000 3155` | Succes avec 3DS |
| `4000 0000 0000 9995` | Refusee : insufficient_funds |
| `4000 0000 0000 0341` | Reussit puis echec au renouvellement (declenche `invoice.payment_failed`) |
| `4000 0000 0000 0259` | Disputes / chargeback |

### 3.3 Triggers Stripe CLI utiles

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

### 3.4 Pieges connus

- **API version webhook** : Stripe envoie les events au format de l'API version du **webhook endpoint** (visible dans Developers > Webhooks > endpoint > settings), PAS de la cle API. Si elle est ancienne, `getSubscriptionPeriodEnd` peut renvoyer null car le champ `current_period_end` a migre de la subscription vers l'item. Toujours pinner le webhook sur `2026-02-25.clover`.
- **Tax inactive** : sans Stripe Tax actif, `automatic_tax: { enabled: true }` provoque une erreur 400 au Checkout. Symptome : "Tax is not enabled for this account".
- **Coupons restreints a un produit** : si on coche "Apply to specific products" sur un coupon, l'application a une sub Premium echoue silencieusement. Toujours laisser non restreint.
- **TWebhook secret partage entre TEST et PROD** : impossible, ce sont deux objets differents. Verifier que `STRIPE_WEBHOOK_SECRET` en Vercel Production correspond bien au webhook **live**, pas au CLI test.
- **Customer Portal cancel ON** : si laisse ON par erreur, un user qui annule depuis le portail ne declenche pas notre email + AuditLog. Toujours OFF.
- **Multi-membres groupe** : le coupon n'est applique que sur les Infinite, pas Premium (`src/app/api/stripe/checkout/route.ts:179`). C'est volontaire.

### 3.5 Checklist 1 minute avant go-live

- [ ] Compte live KYC valide (banner verte sur le dashboard)
- [ ] Stripe Tax active en live + immatriculation FR ajoutee
- [ ] Premium + Infinite crees en **EUR**, **HT**, **annuel**, tax_code `txcd_10000000`
- [ ] 3 coupons crees (5/10/15%, percentage, forever, non restreints)
- [ ] Webhook live URL = `https://panorama-pub.com/api/stripe/webhook`, API version `2026-02-25.clover`, 5 events coches
- [ ] Customer Portal : Cancel OFF, Switch plan OFF, Update CB ON, liens CGV/Confidentialite
- [ ] Emails Stripe Successful/Failed/Canceled : OFF (geres par Resend)
- [ ] 8 env vars Vercel Production renseignees + redeploiement effectue
- [ ] Test webhook depuis dashboard -> 200
- [ ] Premier paiement reel -> remboursement -> sub annulee (verifications 2.10)
- [ ] 2FA activee + alertes mail Disputes/Failed payouts/Webhook failures
