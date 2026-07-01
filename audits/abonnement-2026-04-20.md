# Audit abonnement & droits — 2026-04-20

## Résumé exécutif

Audit statique du système d'abonnement PanoramaPub.fr (Stripe + 3 plans + groupes d'affiliation + crons d'expiration) sur 24 fichiers du périmètre A-E. Cœur du système globalement solide : idempotence webhook persistée (`stripe-events` UNIQUE), HMAC correctement ordonné, `getFreshUser` systématique sur les checks critiques, rate limit posé sur les routes sensibles, middleware constant-time. La majorité des risques identifiés concernent les flows d'update d'événements (attribution croisée), la cohérence palier groupe / coupons Stripe (non atomique), et plusieurs cas dégradés du cron d'expiration et du cron d'alertes.

- **Total** : 22 findings — 3 Critique, 5 Élevée, 7 Moyenne, 5 Faible, 2 Info
- **Verdict global** : prêt production **sous réserve** de corriger les 3 findings Critique (attribution événement, double-envoi alertes, past_due downgrade immédiat) avant release commerciale. Les 5 Élevées devraient suivre dans les 2 sprints.

### Top 5 Critique / Élevée (à corriger avant prod)

1. AUD-001 — Attribution d'événement transférable via update (escalade inter-comptes)
2. AUD-002 — Cron `expiration-alertes` peut doubler les emails (pas de flag per-user)
3. AUD-003 — Statut `past_due` / `unpaid` provoque un downgrade immédiat pendant les retries Stripe
4. AUD-004 — `recalculerEtAppliquerPalier` non atomique DB / Stripe : divergence durable possible
5. AUD-005 — priceId Stripe inconnu → utilisateur facturé mais reste `gratuit`, sans alerte

### Top 5 quick wins (effort S, impact élevé)

- AUD-010 — Ajouter un rate limit sur `/api/stripe/cancel` et `/api/stripe/reactivate`
- AUD-013 — Bloquer l'achat Premium côté backend pour les comptes `role='organisateur'`
- AUD-017 — Ajouter `{CHECKOUT_SESSION_ID}` au `success_url` pour tracer les incidents
- AUD-018 — Consommer l'ownership transfer de groupe via confirmation explicite côté `GroupeMemberView`
- AUD-009 — Ajouter un test `afterDelete` de ré-check du quota de 10 événements sur `update`

---

## Findings par sévérité

### Critique

#### AUD-001 — Attribution d'événement transférable par un propriétaire via update (escalade + contournement de quota)

- **Sévérité** : Critique
- **Axe** : Sécurité
- **Fichier** : [src/collections/Evenements.ts:210-241](../src/collections/Evenements.ts#L210-L241)
- **Catégorie** : Bug confirmé
- **Description** : L'ownership check sur `fournisseur` / `organisateurExterne` n'est appliqué que lorsque `operation === 'create'`. Sur `update`, un utilisateur Infinite qui détient déjà un événement peut modifier son champ `fournisseur` pour pointer vers la fiche d'un autre utilisateur Infinite. Conséquences : (a) l'événement quitte l'espace du propriétaire initial et bascule dans celui de la cible (les access.update/delete utilisent `fournisseur.user = current_user`) ; (b) la cible voit apparaître un événement qu'elle n'a pas créé ; (c) le quota de 10 événements actifs de la cible est dépassable, puisqu'il n'est revérifié qu'à la création (L182-204). `ensureInfinite` est la seule validation qui subsiste — insuffisante.
- **Reproduction** :
  1. Deux comptes Infinite A et B, chacun propriétaire de sa fiche fournisseur.
  2. A crée un événement X (`fournisseur = A.ficheId`).
  3. A envoie `PATCH /api/evenements/{X.id}` avec `fournisseur = B.ficheId`. Le middleware d'update passe (A possède encore X), `beforeValidate` ne vérifie pas l'ownership, `ensureInfinite` passe.
  4. Après save, `access.update` de X donne accès à B uniquement. Si B avait déjà 10 événements actifs, le quota passe à 11.
- **Impact** : Escalade de privilège limitée (B doit être Infinite pour être ciblé) mais permet de pourrir les espaces d'autrui et de contourner la limite produit affichée. Potentiel vecteur de DoS applicatif sur les fiches Infinite populaires.
- **Recommandation** : Étendre l'ownership check de `Evenements.beforeValidate` à `operation === 'update'` lorsque `data.fournisseur` ou `data.organisateurExterne` diffère de `originalDoc`. Appliquer également la revalidation du quota de 10 événements actifs sur le *nouveau* propriétaire si l'attribution change.
- **Effort** : S

#### AUD-002 — Cron `expiration-alertes` peut renvoyer les emails J-30 / J-7 à chaque ré-exécution

- **Sévérité** : Critique
- **Axe** : Fonctionnel
- **Fichier** : [src/app/api/cron/expiration-alertes/route.ts:22-57](../src/app/api/cron/expiration-alertes/route.ts#L22-L57)
- **Catégorie** : Bug confirmé
- **Description** : Le cron sélectionne les utilisateurs dont `planExpiresAt` tombe dans la fenêtre `[startOfDay(today+N), endOfDay(today+N)]` pour N ∈ {30, 7} et envoie l'email sans écrire aucun flag. En cas de ré-exécution manuelle le même jour, de retry Vercel Cron, ou de double provisionnement (blue/green), le même user reçoit plusieurs fois l'email. Aucun champ `expirationWarningSentJ30 / J7` n'est défini sur `Users`, alors que le pattern existe déjà pour `onboardingEmails` (Users.ts L444-459).
- **Reproduction** :
  1. Utilisateur U avec `planExpiresAt = aujourd'hui + 30j`.
  2. `GET /api/cron/expiration-alertes` avec header cron secret — email J-30 reçu.
  3. Rejouer la même requête une minute plus tard — second email reçu.
- **Impact** : Spam utilisateur, déclenchement de plaintes Resend (webhook bounce/complaint), potentiel blacklisting `emailBlacklisted`. Atteint la délivrabilité globale du domaine d'envoi.
- **Recommandation** : Ajouter un group `expirationAlerts` sur `Users` analogue à `onboardingEmails`, poser le flag après `sendEmail` si `result.sent === true`, filtrer les users déjà flaggés dans la requête.
- **Effort** : M

#### AUD-003 — Downgrade immédiat sur statut `past_due` / `unpaid` coupe l'accès pendant les retries Stripe

- **Sévérité** : Critique
- **Axe** : Fonctionnel
- **Fichier** : [src/app/api/stripe/webhook/route.ts:226-260](../src/app/api/stripe/webhook/route.ts#L226-L260)
- **Catégorie** : Bug confirmé
- **Description** : Le handler `customer.subscription.updated` traite `past_due` et `unpaid` comme équivalents à `canceled` et invoque `downgradeUser` + email d'annulation. Stripe passe en `past_due` dès la 1re tentative de prélèvement échouée et ré-essaie pendant ~21 jours par défaut (Smart Retries) avant de passer en `canceled`. Un utilisateur dont la CB est temporairement refusée se voit immédiatement rétrogradé et reçoit un email "votre abonnement a été annulé", alors qu'il est encore sur une période facturée et qu'une relance peut encore aboutir.
- **Reproduction** :
  1. Configurer un compte test avec une CB `4000000000000341` (rate "always fails").
  2. Attendre le renouvellement annuel (ou simuler via `stripe trigger invoice.payment_failed` suivi d'un update vers `past_due`).
  3. Observer `plan=gratuit` en DB immédiatement et réception de l'email d'annulation.
- **Impact** : Perte d'accès facturée au client, réclamations support, churn provoqué par un faux négatif. En cas de coupon groupe, le palier est aussi recalculé en cascade, pénalisant les autres membres.
- **Recommandation** : Ne downgrade que sur `canceled`. Sur `past_due` / `unpaid` : envoyer l'email `paymentFailedEmail` (déjà défini L321-343) et laisser Stripe terminer ses retries. `planExpiresAt` reste à sa valeur jusqu'à cancellation effective ou expiration normale, prise en charge par le cron `downgrade-expires`.
- **Effort** : S

### Élevée

#### AUD-004 — `recalculerEtAppliquerPalier` non atomique : divergence durable DB / coupons Stripe

- **Sévérité** : Élevée
- **Axe** : Technique
- **Fichier** : [src/lib/groupes.ts:103-165](../src/lib/groupes.ts#L103-L165)
- **Catégorie** : Risque
- **Description** : La fonction (a) met à jour `Groupes.palierActuel` + `stripeCouponId` en DB, puis (b) boucle sur les membres payants et appelle `stripe.subscriptions.update` pour chacun. Tout échec Stripe sur un sous-ensemble des membres est logué (L158-163) mais n'annule rien. Conséquence : DB indique palier=10 alors que certaines subscriptions restent au coupon 5%, ou inversement. Aucun mécanisme de reprise n'existe : seul un nouveau changement de palier retentera l'application. Ajout de difficulté : plusieurs appels concurrents (join + leave quasi simultanés) lisent chacun l'état pré-update et peuvent se doubler, laissant le palier DB incohérent avec le nombre réel de membres payants (pas de verrou transactionnel).
- **Reproduction** : Rejouer `recalculerEtAppliquerPalier` avec Stripe indisponible sur 1/N abonnements (monkey-patcher `stripe.subscriptions.update` pour throw sur le 2ᵉ appel). Observer DB mis à jour mais certains abonnements sans coupon correct.
- **Impact** : Facturation erronée du client (trop ou pas assez discount), différend commercial, nécessite une réconciliation manuelle via Stripe CLI.
- **Recommandation** : Appliquer les coupons Stripe AVANT d'écrire le nouveau palier en DB, marquer chaque application comme réussie dans un journal léger (ex. colonne `couponSyncedAt` par user ou une table `groupe_coupon_sync`), et fournir un cron de réconciliation (ou exposer une commande admin) qui repasse sur les `stripeSubscriptionId` du groupe pour détecter les désynchronisations. Alternativement, envelopper dans un try/catch global qui rollback `palierActuel` en cas d'échec Stripe persistant.
- **Effort** : L

#### AUD-005 — priceId Stripe inconnu : utilisateur facturé mais reste `gratuit`, aucune alerte

- **Sévérité** : Élevée
- **Axe** : Fonctionnel
- **Fichier** : [src/app/api/stripe/webhook/route.ts:91-95](../src/app/api/stripe/webhook/route.ts#L91-L95)
- **Catégorie** : Bug confirmé
- **Description** : Dans `checkout.session.completed`, si `resolvePlanFromPriceId(priceId)` retourne `null` (env `STRIPE_PREMIUM_PRICE_ID` / `STRIPE_INFINITE_PRICE_ID` non à jour, ou nouveau price créé côté Stripe sans redeploy), le handler log `[stripe-webhook] Unknown priceId ... for user ...` et `break`. L'abonnement Stripe est encaissé et actif, mais l'utilisateur reste `plan='gratuit'`. Aucun mail d'erreur n'est envoyé à l'équipe, aucun flag DB ne permet de retrouver les users impactés. Le dashboard propose un fallback de resync (page.tsx L66-103) mais il appelle `resolvePlanFromPriceId` à son tour et échouera identiquement.
- **Reproduction** :
  1. Modifier temporairement `STRIPE_PREMIUM_PRICE_ID` à une valeur erronée.
  2. Compléter un checkout premium en test mode.
  3. Webhook reçoit le `checkout.session.completed`, logue, skip. User reste gratuit malgré paiement.
- **Impact** : Churn immédiat — l'utilisateur voit "Plan gratuit" juste après avoir payé 99 €. Réclamation support inévitable, atteinte à la confiance produit.
- **Recommandation** : En cas de priceId inconnu, (a) écrire un `audit-logs` de type `stripe_misconfig` avec `stripeCustomerId` / `stripeSubscriptionId` / `priceId` en metadata, (b) notifier `contact@panorama-pub.com` par email transactionnel, (c) retourner 500 pour que Stripe réessaye (ce qui laisse une chance à un redeploy récent de corriger en vol).
- **Effort** : S

#### AUD-006 — Illustrations Premium/Infinite conservées en DB après downgrade vers `gratuit`

- **Sévérité** : Élevée
- **Axe** : Fonctionnel / Sécurité
- **Fichier** : [src/app/api/stripe/webhook/route.ts:353-364](../src/app/api/stripe/webhook/route.ts#L353-L364) + [src/app/api/cron/downgrade-expires/route.ts:55-65](../src/app/api/cron/downgrade-expires/route.ts#L55-L65)
- **Catégorie** : Risque
- **Description** : `downgradeUser` (webhook) et le cron `downgrade-expires` se contentent de `plan='gratuit'` + suppression de `stripeSubscriptionId` / `planExpiresAt`. Les champs gelés par plan sur `fournisseurs` (description longue, banniere, 1-6 illustrations, videoYoutube, descriptionRSE, labelsRSE) restent en base. Le field-level access `isPremiumOrAbove` sur ces champs empêche seulement l'**édition** future, pas leur rendu côté public : `/api/fournisseurs/public/[slug]` les sert, les clients publics les affichent. Résultat : un ex-Premium downgradé continue d'exposer ses illustrations et sa description RSE sans payer, contournant de facto la monétisation.
- **Reproduction** :
  1. Compte Premium avec `description` (100 mots) + banniere + illustration.
  2. Cron downgrade-expires passé (ou annulation via Stripe).
  3. `GET /api/fournisseurs/public/{slug}` — tous les champs Premium sont toujours renvoyés.
- **Impact** : Perte de revenu par contournement, incohérence de produit. Également, les medias Vercel Blob restent stockés (coût).
- **Recommandation** : Dans `downgradeUser` et le cron, recharger la fiche fournisseur du user et vider (`null` / `[]`) les champs gelés au nouveau niveau. Alternative moins destructive : filtrer ces champs dans `/api/fournisseurs/public/[slug]` en fonction de `getEffectiveFeatureLevel(user)`.
- **Effort** : M

#### AUD-007 — Race sur double checkout : deux sessions complétées concurremment laissent un état non-déterministe

- **Sévérité** : Élevée
- **Axe** : Technique
- **Fichier** : [src/app/api/stripe/webhook/route.ts:80-179](../src/app/api/stripe/webhook/route.ts#L80-L179)
- **Catégorie** : Risque
- **Description** : La garde anti-doublon persiste sur `event.id`, pas sur `userId`. Si l'utilisateur ouvre deux onglets et complète deux checkouts en parallèle (ex. clic hâtif), deux `checkout.session.completed` distincts (event IDs différents) sont traités. Chaque handler (a) écrit `user.stripeSubscriptionId = subX` puis (b) liste les subs actives de l'utilisateur et annule toutes sauf celle de son propre event. Selon l'entrelacement, les deux finissent par s'annuler mutuellement, ou par laisser `user.stripeSubscriptionId` pointant sur la plus récente tandis que l'ancienne est annulée (souhaité). Dans le pire cas : les deux handlers entrent en phase (a) avant que l'autre n'entre en phase (b) → user avec deux subs actives facturées, une seule liée en DB. `recalculerEtAppliquerPalier` est invoqué deux fois en parallèle et peut laisser le palier groupe incohérent (cf. AUD-004).
- **Reproduction** :
  1. Ouvrir deux onglets et compléter deux checkouts en <2 s.
  2. Vérifier côté Stripe que les deux subscriptions sont actives avant que les webhooks se résolvent.
- **Impact** : Double facturation immédiate, palier groupe erroné, réconciliation manuelle nécessaire.
- **Recommandation** : Côté `POST /api/stripe/checkout` : refuser si `freshUser.stripeSubscriptionId` existe et que l'abonnement Stripe correspondant est `active` (ne pas juste passer outre comme en L42-45). Sinon, sérialiser la gestion de l'user dans le webhook via un verrou DB (advisory lock postgres `pg_advisory_xact_lock(user.id)`).
- **Effort** : M

#### AUD-008 — Rate limit in-memory non partagé entre instances Vercel — contournable par scale-out

- **Sévérité** : Élevée
- **Axe** : Sécurité
- **Fichier** : [src/lib/rate-limit.ts:16-39](../src/lib/rate-limit.ts#L16-L39)
- **Catégorie** : Risque
- **Description** : Le store est un `Map` local à chaque lambda / conteneur. Sur Vercel serverless, Vercel spawn plusieurs instances quand la charge monte — un attaquant en face d'un rate limit 10 req/min par IP peut en pratique atteindre 10·N req/min où N = nombre d'instances. L'éviction est également naïve : lorsque `store.size > 10_000`, elle supprime les premières clés par ordre d'insertion (pas LRU). Un attaquant qui pulvérise des clés uniques (IPs forgées via X-Forwarded-For — atténué par `getClientIp` qui préfère `x-vercel-forwarded-for`, mais toujours contournable par rotation d'IP réelle) peut évacuer les entrées légitimes.
- **Impact** : Atténuation de la protection DoS sur `/api/stripe/checkout`, `/api/groupes/*`, `/api/account/delete`. Stripe a ses propres rate limits globaux (100 req/s), mais la facture Resend et le bruit en DB sont pour le compte du produit.
- **Recommandation** : Migrer vers un rate limit persistant à base de `@upstash/ratelimit` (Redis) ou via la table `audit-logs` / une table dédiée côté Postgres. À défaut, accepter la limite par instance explicitement dans un commentaire de module et renforcer la protection via l'anti-duplication au niveau business (AUD-007).
- **Effort** : L

#### AUD-009 — Quota de 10 événements actifs non revérifié sur update (corollaire d'AUD-001)

- **Sévérité** : Élevée
- **Axe** : Fonctionnel
- **Fichier** : [src/collections/Evenements.ts:182-204](../src/collections/Evenements.ts#L182-L204)
- **Catégorie** : Bug confirmé
- **Description** : Le check `MAX_ACTIVE_EVENEMENTS = 10` ne s'exécute que sur `operation === 'create'`. Un événement en statut `archive` peut être remis à `publie` via update (champ `statut` a un access `isAdmin` — restreint, OK ; mais `visible: true` bascule l'affichage sans toucher `statut` et ne compte pas dans la limite). Surtout, combiné à AUD-001, une réattribution d'événement vers une autre fiche ne revérifie pas le quota de la cible.
- **Impact** : Contournement de la limite produit affichée côté commercial (10 événements / Infinite).
- **Recommandation** : Extraire le check quota dans un helper, l'appeler aussi sur `update` quand `data.fournisseur` ou `data.organisateurExterne` diffère, ET sur `update` quand un champ `statut` passe de `archive` à `publie` (si cette transition redevient autorisée hors admin).
- **Effort** : S

### Moyenne

#### AUD-010 — Pas de rate limit sur `/api/stripe/cancel` et `/api/stripe/reactivate`

- **Sévérité** : Moyenne
- **Axe** : Sécurité
- **Fichier** : [src/app/api/stripe/cancel/route.ts:12-44](../src/app/api/stripe/cancel/route.ts) + [src/app/api/stripe/reactivate/route.ts:11-43](../src/app/api/stripe/reactivate/route.ts)
- **Catégorie** : Risque
- **Description** : Les deux endpoints sont `auth` uniquement. Un client authentifié peut les marteler, chaque requête provoquant un `stripe.subscriptions.update`. Stripe applique son propre throttling à 100 req/s par clé API, mais le produit peut être retourné contre lui-même (token legitimate volé → épuisement de quota Stripe partagé par d'autres endpoints + logs parasites). Les autres routes Stripe / groupes ont un rate limit (cf. checkout, groupes/create, account/delete).
- **Impact** : Atténuation DoS sur quota Stripe partagé ; effet secondaire : bruit dans les logs + éventuellement effet cascade sur `customer.subscription.updated` webhook (re-processing idempotent mais pompe).
- **Recommandation** : Appliquer `rateLimit(...:${user.id}, { limit: 10, windowMs: 60_000 })` comme sur `/api/groupes/create`. Clé user, pas IP.
- **Effort** : S

#### AUD-011 — Transfert d'ownership d'un groupe sans consentement du nouveau propriétaire

- **Sévérité** : Moyenne
- **Axe** : UX / Fonctionnel
- **Fichier** : [src/app/api/groupes/leave/route.ts:88-119](../src/app/api/groupes/leave/route.ts#L88-L119)
- **Catégorie** : Amélioration
- **Description** : Quand le propriétaire quitte un groupe non vide, le membre le plus ancien devient propriétaire automatiquement. Il n'est informé qu'*a posteriori* par l'email `groupe-left-owner`, sans possibilité de refus. Ceci porte des responsabilités implicites (gérer les invitations, subir la suppression du groupe s'il quitte à son tour, voir son email affiché comme "propriétaire" dans les notifications des autres membres). Le message de confirmation dans `GroupeMemberView.tsx:171` mentionne uniquement "Vous perdrez la réduction" sans signaler le transfert d'ownership au propriétaire sortant.
- **Impact** : Surprise utilisateur, potentiel conflit commercial si un groupe finit aux mains de quelqu'un qui ne souhaite pas ce rôle.
- **Recommandation** : (a) Enrichir le message de confirmation côté owner avec "Le membre le plus ancien deviendra propriétaire" ; (b) ajouter un email `groupe-ownership-transferred` distinct du `groupe-left-owner` actuel ; (c) à terme, un flow d'acceptation explicite (mais bloquant si le nouvel owner ne répond pas — hors scope immédiat).
- **Effort** : M

#### AUD-012 — Fallback plan dashboard calcule `planExpiresAt` à today+1an au lieu de `current_period_end` Stripe

- **Sévérité** : Moyenne
- **Axe** : Fonctionnel
- **Fichier** : [src/app/(frontend)/dashboard/page.tsx:66-103](../src/app/(frontend)/dashboard/page.tsx#L66-L103)
- **Catégorie** : Bug confirmé
- **Description** : Quand le webhook `checkout.session.completed` rate (ex. Stripe livre après un timeout de la route), le dashboard resynchronise via `stripe.subscriptions.list`. Il pose alors `planExpiresAt = now + 1 an`. Si l'utilisateur s'est abonné il y a 3 mois (webhook perdu + fallback tardif), son expiration DB indique 12 mois alors qu'il ne reste que 9 mois payés. Le cron `expiration-alertes` et `downgrade-expires` se basent sur ce champ.
- **Impact** : Sur-crédit de période, prolongation injustifiée de l'accès Premium/Infinite. Délai avant downgrade décalé de 3 mois dans l'exemple.
- **Recommandation** : Utiliser `activeSub.current_period_end * 1000` comme dans le webhook (L97-98).
- **Effort** : S

#### AUD-013 — Un compte `role='organisateur'` peut acheter Premium côté backend

- **Sévérité** : Moyenne
- **Axe** : Fonctionnel
- **Fichier** : [src/app/api/stripe/checkout/route.ts:11-30](../src/app/api/stripe/checkout/route.ts#L11-L30)
- **Catégorie** : Bug confirmé
- **Description** : La page `/dashboard/abonnement` masque la carte Premium aux organisateurs (page.tsx L275-297). Mais la route accepte `{plan: 'premium'}` pour n'importe quel utilisateur. Un organisateur pouvant forger la requête POST reçoit une session Checkout premium. Le webhook l'enregistre `plan='premium'` — or aucune feature premium n'existe pour `organisateurs-evenements` : l'utilisateur paie sans bénéfice.
- **Impact** : UX fortement dégradée (paiement sans contrepartie → litige / chargeback). Également : l'accès `access.create` des `Evenements` vérifie `level === 'infinite'`, donc un organisateur Premium ne peut toujours pas créer d'événement. Paiement "mort".
- **Recommandation** : Dans `checkout/route.ts`, rejeter (`400`) si `freshUser.role === 'organisateur'` et `plan !== 'infinite'`.
- **Effort** : S

#### AUD-014 — Onboarding `welcomeSent` flaggé uniquement sur `result.sent === true` : perte silencieuse si Resend renvoie un sent puis throw

- **Sévérité** : Moyenne
- **Axe** : Technique
- **Fichier** : [src/collections/Users.ts:214-239](../src/collections/Users.ts#L214-L239)
- **Catégorie** : Risque
- **Description** : Le flag `welcomeSent` est positionné seulement si `sendEmail` retourne `{sent: true}`. Sur timeout (10s) ou erreur transitoire Resend, l'email est considéré non envoyé, le flag reste à false. Prochain update du user → relivraison potentielle (si `justVerified` reste vrai, ce qui n'arrive pas puisque `_verified` n'est basculé qu'une fois). Donc la plupart des utilisateurs qui ont cette panne n'auront **jamais** leur welcome email, pas de retry automatique. L'intention initiale "pas de spam" est correcte mais le résultat est "pas d'email". Pas de cron de rattrapage sur `welcomeSent=false AND _verified=true`.
- **Impact** : Perte d'un levier onboarding pour une fraction (~1-2 %) des inscriptions.
- **Recommandation** : Ajouter un rattrapage dans le cron `onboarding-emails` pour les users `_verified=true AND onboardingEmails.welcomeSent=false AND createdAt < now-1h`.
- **Effort** : S

#### AUD-015 — Cron `downgrade-expires` charge tous les users expirés d'un coup (`limit: 0`)

- **Sévérité** : Moyenne
- **Axe** : Technique
- **Fichier** : [src/app/api/cron/downgrade-expires/route.ts:29-39](../src/app/api/cron/downgrade-expires/route.ts#L29-L39)
- **Catégorie** : Risque
- **Description** : `limit: 0` en Payload signifie "pas de limite". Si 10 000+ abonnements expirent la même journée (ex. campagne d'acquisition massive il y a un an), le chargement + la boucle séquentielle dépassent la lambda timeout Vercel (60 s default hors `vercel.json`) et consomment la RAM. Chaque itération émet un email + potentiellement un `recalculerEtAppliquerPalier`. La route n'a pas de `maxDuration` / `memory` configuré dans `vercel.json` (seul `(payload)/api/[...slug]` en a).
- **Impact** : Cron interrompu mi-traitement, une partie des users downgradés (et notifiés) puis rien ; pas d'idempotence sur une ré-exécution (les users déjà downgradés n'apparaissent plus dans le filtre — OK) mais les emails partis sont partis.
- **Recommandation** : Paginer (`limit: 500`, `page`) avec boucle, ou passer à Payload Jobs si la roadmap s'y prête. Ajouter `maxDuration: 300` dans `vercel.json` pour cette route.
- **Effort** : S

#### AUD-016 — Event `checkout.session.completed` n'écrit pas `stripeCustomerId` dans `audit-logs` — audit trail faible sur les transitions de plan

- **Sévérité** : Moyenne
- **Axe** : Bonnes pratiques / RGPD
- **Fichier** : [src/collections/AuditLogs.ts](../src/collections/AuditLogs.ts) (non lu) + [src/app/api/stripe/webhook/route.ts](../src/app/api/stripe/webhook/route.ts)
- **Catégorie** : Amélioration
- **Description** : La collection `AuditLogs` n'est nourrie que par `/api/account/delete` et les flows consentement/export. Les transitions critiques (upgrade premium→infinite, downgrade forcé, cancel volontaire, application d'un coupon) ne laissent aucune trace horodatée dans la DB de l'application. L'historique Stripe existe mais n'est pas consultable par le support interne sans accès direct au dashboard Stripe. En cas de litige client ("on m'a baissé mon plan sans prévenir"), pas de preuve locale.
- **Impact** : Audit RGPD limité, support client plus lent.
- **Recommandation** : Écrire un `audit-logs` avec `type='plan_changed'` (ou similaire) dans le webhook à chaque `checkout.session.completed`, `subscription.updated` → active, `subscription.deleted`, ainsi que dans le cron `downgrade-expires`. Metadata: `oldPlan`, `newPlan`, `reason`.
- **Effort** : M

### Faible

#### AUD-017 — `success_url` sans `{CHECKOUT_SESSION_ID}` : troubleshoot post-checkout limité

- **Sévérité** : Faible
- **Axe** : Bonnes pratiques
- **Fichier** : [src/app/api/stripe/checkout/route.ts:105-106](../src/app/api/stripe/checkout/route.ts#L105-L106)
- **Catégorie** : Amélioration
- **Description** : `success_url: ${SITE_URL}/dashboard?checkout=success` n'incorpore pas le paramètre Stripe `{CHECKOUT_SESSION_ID}`. Le dashboard ne peut donc pas identifier la session Stripe à des fins de fallback (AUD-012) ou de logging. `TokenRefresh.tsx` ne dispose que du flag booléen.
- **Impact** : Debug plus lent en cas d'incident (webhook retardé, resync impossible sans parcourir Stripe dashboard).
- **Recommandation** : `success_url: \`${SITE_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}\``. Ne pas logger le session_id complet (pas sensible mais inutile de l'encombrer).
- **Effort** : S

#### AUD-018 — Message de confirmation `GroupeMemberView` ne mentionne pas le transfert d'ownership pour l'owner

- **Sévérité** : Faible
- **Axe** : UX
- **Fichier** : [src/components/dashboard/GroupeMemberView.tsx:169-173](../src/components/dashboard/GroupeMemberView.tsx#L169-L173)
- **Catégorie** : Amélioration
- **Description** : Le composant reçoit `isOwner` (L55) mais le message de confirmation reste identique que l'utilisateur soit simple membre ou propriétaire : "Vous perdrez la réduction de groupe sur votre prochain renouvellement. Confirmer ?". Pour un owner, les conséquences additionnelles (transfert d'ownership, ou suppression du groupe si dernier membre, avec perte du code d'affiliation) ne sont pas signalées.
- **Recommandation** : Brancher la formulation sur `isOwner` + `membresTotal`.
- **Effort** : S

#### AUD-019 — Token d'unsubscribe sans expiration : valide à vie

- **Sévérité** : Faible
- **Axe** : Sécurité
- **Fichier** : [src/lib/emails.ts:19-43](../src/lib/emails.ts#L19-L43)
- **Catégorie** : Risque
- **Description** : `generateUnsubscribeToken` produit un HMAC(user_id) non daté. Tout email marketing émis contient un lien valable indéfiniment. Un ancien email archivé → forwardé → utilisé par un tiers permet de désabonner la victime. Impact limité (effet = flipping `optInMarketing=false`), mais également exploitable pour énumérer : un attaquant testant `id=1..N` peut identifier quels IDs existent (même si `verifyUnsubscribeToken` nécessite la signature : il ne les a pas sans leak du secret).
- **Impact** : Faible. Si `PAYLOAD_SECRET` fuit un jour, rotation nécessaire → ancien secret révoque rétroactivement tous les tokens émis (acceptable).
- **Recommandation** : Incorporer un timestamp signé (ex. `{id}.{issuedAt}.{sig}`) et rejeter si `issuedAt > 90 jours`. L'utilisateur peut toujours désinscrire depuis `/dashboard/compte`.
- **Effort** : S

#### AUD-020 — Suppression automatique d'un groupe vide sans soft-delete ni audit

- **Sévérité** : Faible
- **Axe** : Bonnes pratiques / RGPD
- **Fichier** : [src/app/api/groupes/leave/route.ts:102-109](../src/app/api/groupes/leave/route.ts#L102-L109) + [src/app/api/account/delete/route.ts:124-131](../src/app/api/account/delete/route.ts#L124-L131)
- **Catégorie** : Amélioration
- **Description** : Quand le dernier membre quitte (ou supprime son compte), le groupe est supprimé en dur via `payload.delete`. Aucun audit (ni dans `AuditLogs` ni dans Stripe). Le code `GRP-XXXXXX` disparaît → les invitations envoyées par email contiennent un code mort qui donnera "Code de groupe invalide" sans message explicatif. Pas de chemin de récupération.
- **Recommandation** : Soft-delete (ajouter un champ `deletedAt` sur `Groupes`, filtrer dans les lookups) et/ou écrire un `audit-logs` type `groupe_auto_deleted`.
- **Effort** : M

#### AUD-021 — `countWords` côté fournisseurs : comptage naïf dépendant de la locale (split `\s+`)

- **Sévérité** : Faible
- **Axe** : Fonctionnel
- **Fichier** : [src/collections/Fournisseurs.ts:42-44](../src/collections/Fournisseurs.ts#L42-L44)
- **Catégorie** : Bug confirmé (mineur)
- **Description** : `countWords` splitte sur `\s+`. Un utilisateur qui colle un texte avec des retours chariot multiples ou des tabulations passe ; mais les apostrophes/guillemets typographiques + mots collés ne sont pas détectés. Un texte "mot"×50 séparé par des `&nbsp;` (copié depuis Word) serait compté comme 1 mot. À l'inverse, des tirets long-dash ("mot—autre") sont comptés 1. Le utilisateur Premium qui devrait être capé à 100 mots peut en publier 150 en jouant avec les séparateurs.
- **Impact** : Contournement mineur des quotas descriptifs.
- **Recommandation** : Remplacer par un split plus robuste (`\p{L}+` avec flag `u`) ou accepter la limite en caractères au lieu des mots (cohérent avec `maxLength: 400` sur descriptionCourte événements).
- **Effort** : S

### Info

#### AUD-022 — JWT stale sur `plan` : bien géré via `getFreshUser` + TokenRefresh

- **Sévérité** : Info
- **Axe** : Technique
- **Fichier** : [src/collections/access.ts:39-55](../src/collections/access.ts#L39-L55) + [src/components/dashboard/TokenRefresh.tsx](../src/components/dashboard/TokenRefresh.tsx)
- **Catégorie** : Non-problème (documenté)
- **Description** : `plan` est `saveToJWT: true` (Users.ts L380). Le JWT reste donc stale jusqu'à expiration ou refresh explicite. Toutes les vérifications critiques (`isPremiumOrAbove`, `isInfinite`, `canCreateFiche`, `Evenements.access.create`, `Fournisseurs.beforeChange` limits) utilisent `getFreshUser` ou `payload.findByID` pour relire le user en base — pas de bypass possible par JWT stale. Le frontend recharge via `/api/users/refresh-token` après un `?checkout=success`. Toutes les pages dashboard lisent `freshUser`. Point non bloquant, mais on pourrait poser `saveToJWT: false` sur `plan` pour éliminer la classe de bug par défaut et déclarer `getFreshUser` explicitement partout (ce qui est déjà le cas).
- **Recommandation** : Envisager `saveToJWT: false` sur `plan` + `planExpiresAt`. Pas urgent.

#### AUD-023 — Idempotence webhook Stripe : robuste (UNIQUE DB + HMAC pré-traitement)

- **Sévérité** : Info
- **Axe** : Technique
- **Fichier** : [src/app/api/stripe/webhook/route.ts:20-77](../src/app/api/stripe/webhook/route.ts#L20-L77) + [src/migrations/20260418_200000_add_stripe_events.ts](../src/migrations/20260418_200000_add_stripe_events.ts)
- **Catégorie** : Non-problème
- **Description** : L'ordre est correct : `request.text()` → `constructEvent` (HMAC sur raw body) → insertion `stripe-events` avec UNIQUE sur `eventId` → traitement. La migration confirme `CREATE UNIQUE INDEX "stripe_events_event_id_idx"`. Deux instances serverless reçevant simultanément le même event retry perdront la course via conflit d'insertion, pas de double-apply possible. Le rate limit 100/min/eventType est appliqué post-HMAC, donc un spoof ne l'épuise pas.
- **Recommandation** : Rien à faire. Seul bémol : la route `/api/stripe/webhook` n'a pas de `maxDuration` explicite dans `vercel.json`. Stripe attend < 5 s sinon il retry. Le handler actuel fait jusqu'à 2 calls Stripe + N update coupons (AUD-004) — envisager d'ajouter `maxDuration: 30` si le palier concerne des groupes > 20 membres.

---

## Points à investiguer (14) — conclusions explicites

| # | Sujet | Verdict | Finding associé |
|---|-------|---------|-----------------|
| 1 | JWT stale sur `plan` | **Non-problème** (getFreshUser systématique, TokenRefresh sur success) | AUD-022 |
| 2 | Race conditions subscription (double checkout / upgrade) | **Risque confirmé** | AUD-007 |
| 3 | Rate limit absent sur cancel/reactivate | **Risque confirmé** | AUD-010 |
| 4 | Rate limit in-memory, éviction 10k | **Risque confirmé** | AUD-008 |
| 5 | Recalcul palier non atomique (partial Stripe failure, concurrent calls) | **Bug confirmé** | AUD-004 |
| 6 | Transfert ownership sans consent | **Risque UX confirmé** | AUD-011 |
| 7 | Suppression groupe vide sans audit | **Amélioration** | AUD-020 |
| 8 | Illustrations orphelines au downgrade | **Bug confirmé** | AUD-006 |
| 9 | Cron downgrade non paginé (`limit: 0`) | **Risque confirmé** | AUD-015 |
| 10 | Alertes expiration double-envoi | **Bug confirmé** | AUD-002 |
| 11 | priceId inconnu dans webhook | **Bug confirmé** | AUD-005 |
| 12 | Body size webhook | **Non-problème** (Vercel cap 4.5 MB, events Stripe < 50 KB) | — |
| 13 | Token unsubscribe sans expiration | **Risque faible confirmé** | AUD-019 |
| 14 | Access check événements : fresh vs JWT | **Non-problème** (payload.findByID systématique) | AUD-022 |

---

## Flows F1-F6 — conclusions de traçabilité

| Flow | Résultat | Observations |
|------|----------|--------------|
| **F1 subscribe** (gratuit → premium) | OK fonctionnel | TokenRefresh déclenche refresh JWT, dashboard lit freshUser. AUD-005 en cas de priceId inconnu. |
| **F2 upgrade** (premium → infinite) | OK fonctionnel | Checkout route ne cancel pas l'ancienne sub (par design, L42-45). Webhook cancel les anciennes subs après save (L134-153). Guards L201-206 et L283 évitent de repasser en gratuit sur l'event `canceled` de l'ancienne sub. Attention AUD-007 si double-click. |
| **F3 downgrade cron** | OK fonctionnel | `limit: 0` — voir AUD-015. Palier groupe recalculé en cascade — voir AUD-004. Illustrations conservées — voir AUD-006. |
| **F4 cancel / reactivate** | OK fonctionnel | Pas de rate limit — AUD-010. UI `cancelAtPeriodEnd` cohérente. |
| **F5 groupe** (create → join → leave owner) | OK fonctionnel avec réserves | Transfert ownership auto → AUD-011. Palier Stripe non atomique → AUD-004. |
| **F6 delete account** | OK fonctionnel | Stripe sub cancelled (try/catch silent OK), groupe géré (ownership transfer OU delete), evenements supprimés, associés detachés, audit-log anonymisé. Bon niveau. |

---

## Axes de couverture — récapitulatif

- **UX** : AUD-011, AUD-013, AUD-017, AUD-018
- **Fonctionnel** : AUD-002, AUD-003, AUD-005, AUD-006, AUD-009, AUD-012, AUD-014, AUD-015, AUD-021
- **Global / flows** : AUD-007 (race checkout), F1-F6 documentés
- **Bonnes pratiques** : AUD-016, AUD-020
- **Technique** : AUD-004, AUD-008, AUD-015, AUD-022, AUD-023
- **Sécurité** : AUD-001, AUD-008, AUD-010, AUD-019

## Limites de cet audit

L'audit est **statique** uniquement : les scénarios webhook Stripe n'ont pas été rejoués localement (pas d'environnement test configuré dans cette session). Les findings marqués "Bug confirmé" reposent sur une analyse de code avec reproduction décrite — ils gagneraient à être validés via `stripe trigger` + tests E2E Playwright avant correction. Les findings "Risque" décrivent des scénarios plausibles qu'un test actif permettrait de confirmer ou d'écarter.

Les tests actifs recommandés en priorité :
1. Forger un PATCH `/api/evenements/{id}` qui change `fournisseur` vers la fiche d'un autre user Infinite (AUD-001).
2. Rejouer `cron/expiration-alertes` deux fois d'affilée, vérifier le double email (AUD-002).
3. Provoquer un `invoice.payment_failed` + transition `past_due` via `stripe trigger`, observer le downgrade immédiat (AUD-003).
4. Monkey-patcher `stripe.subscriptions.update` pour throw sur le 2ᵉ appel, déclencher `recalculerEtAppliquerPalier` sur un groupe de 3 membres payants (AUD-004).
