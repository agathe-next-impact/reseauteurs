# Audit changement & annulation d'abonnement — 2026-04-20

## Résumé exécutif

- **Transitions couvertes par l'UI : 6 / 9** (manquantes : Infinite → Premium explicite, Annulation-puis-changement-de-plan, Update carte bancaire / portail Stripe).
- **Montants Stripe corrects : Non.** Les upgrades sont implémentés en créant une **nouvelle subscription** via Stripe Checkout au lieu d'un `stripe.subscriptions.update()` avec proration. Conséquence : le user paie deux abonnements (99 € Premium perdu partiellement + 219 € Infinite plein tarif) au lieu de la différence prorata.
- **Activation des droits cohérente : Oui (post-AUD-006).** Le webhook `checkout.session.completed` met à jour `plan` et `planExpiresAt` immédiatement après paiement, TokenRefresh re-signe le JWT, et AUD-006 vide les champs Premium+ au downgrade.
- **Verdict global : amélioration majeure requise côté facturation avant d'accepter des upgrades en production.** Le flow actuel est **commercialement indéfendable** : un Premium qui upgrade à 3 mois paie 318 € au lieu de ~220 € (219 € + prorata).

### Top 3 à régler en priorité

1. **AUD-C01** — Upgrade Premium→Infinite : nouvelle subscription + annulation de l'ancienne sans remboursement. Double prélèvement de facto.
2. **AUD-C02** — Downgrade Infinite→Premium non exposé côté UI. La seule voie (annuler + re-souscrire) coupe l'accès pendant toute la période restante du plan annulé.
3. **AUD-C04** — Aucun preview du montant (prorata, crédit, remboursement) avant confirmation.

---

## Matrice des transitions

Le tableau ci-dessous qualifie chacune des 9 transitions du point de vue UI / Backend / Montant facturé / Droits.

| Transition                        | UI expose | Backend OK | Montant correct                                        | Droits cohérents | Finding     |
|-----------------------------------|-----------|------------|--------------------------------------------------------|------------------|-------------|
| Gratuit → Premium                 | Oui       | Oui        | Oui (99 € plein tarif, sub neuve)                      | Oui              | —           |
| Gratuit → Infinite                | Oui       | Oui        | Oui (219 € plein tarif, sub neuve)                     | Oui              | —           |
| Premium → Infinite (upgrade)      | Oui       | Partiel    | **Non — 2ᵉ sub créée, ancienne cancel sans refund**     | Oui              | AUD-C01     |
| Infinite → Premium (downgrade)    | **Non**   | Non exposé | N/A (voie alternative : cancel + re-souscrire = coupure) | N/A              | AUD-C02     |
| Premium → Gratuit (annulation)    | Oui       | Oui        | Oui (cancel_at_period_end, rien de plus facturé)       | Oui              | —           |
| Infinite → Gratuit (annulation)   | Oui       | Oui        | Oui                                                    | Oui              | —           |
| Annulation programmée             | Oui       | Oui        | Oui                                                    | Oui (garde plan) | —           |
| Réactivation avant échéance       | Oui       | Oui        | Oui                                                    | Oui              | —           |
| Changement de plan PENDANT cancel | Oui *     | Partiel    | Confus — crée une 2ᵉ sub en parallèle de l'ancienne    | Risque           | AUD-C05     |
| Upgrade avec groupe (coupon)      | Oui       | Oui        | Oui (palier projeté appliqué dès la 1re facture)       | Oui              | —           |

(*) La carte "Passer à Infinite" reste cliquable pendant `cancel_at_period_end: true` — voir AUD-C05.

---

## Réponses aux 17 questions

### Montant

**Q1 — Upgrade : `stripe.subscriptions.update` ou nouvelle subscription ?**
**Non (nouvelle subscription).**
[src/app/api/stripe/checkout/route.ts:131-148](src/app/api/stripe/checkout/route.ts#L131-L148) : `stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price: PLANS[plan].priceId }] })`. Aucun `proration_behavior` passé. Le webhook [src/app/api/stripe/webhook/route.ts:134-153](src/app/api/stripe/webhook/route.ts#L134-L153) cancel ensuite les subs antérieures après coup via `stripe.subscriptions.cancel(sub.id)` (paramètres par défaut → **pas de remboursement**).

**Q2 — Prorata affiché avant confirmation ?**
**Non.** [src/app/(frontend)/dashboard/abonnement/page.tsx:479-506](src/app/(frontend)/dashboard/abonnement/page.tsx#L479-L506) affiche uniquement le tarif annuel brut ou le tarif post-coupon groupe. Aucun calcul de crédit lié à la subscription en cours.

**Q3 — Downgrade = avoir, crédit, ou rien ?**
**Rien, car le downgrade n'existe pas côté UI** ([page.tsx:440-442](src/app/(frontend)/dashboard/abonnement/page.tsx#L440-L442) : message "Annulez votre abonnement actuel pour basculer"). La seule voie = `cancel_at_period_end` puis re-subscribe ; entre les deux l'utilisateur repasse gratuit. Aucun avoir/crédit n'est communiqué.

**Q4 — Ancienne sub annulée APRÈS confirmation, sans facture immédiate ?**
**Oui pour la séquence, Non pour l'absence de facture.** La nouvelle sub est persistée en DB avant la cancel de l'ancienne ([webhook:115-153](src/app/api/stripe/webhook/route.ts#L115-L153)). Mais la création de la 2ᵉ session Checkout a DÉJÀ déclenché une facture payée pour le plein tarif (219 €). L'ancienne est bien annulée sans refund, mais l'utilisateur a déjà eu un double prélèvement (99 € Premium initialement + 219 € Infinite maintenant).

**Q5 — En annulation, montant restant dû = 0 ?**
**Oui.** [cancel/route.ts:32-34](src/app/api/stripe/cancel/route.ts#L32-L34) : `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`. Stripe ne facturera plus au renouvellement. Aucune charge immédiate.

**Q6 — Coupons groupe réappliqués après changement de plan ?**
**Oui, via trois mécanismes.**
1. À l'upgrade, la session Checkout embarque déjà le coupon projeté via `palierProjeteAvecUtilisateurPayant` ([checkout:74-87](src/app/api/stripe/checkout/route.ts#L74-L87)).
2. Après `checkout.session.completed`, le webhook appelle `recalculerEtAppliquerPalier` ([webhook:166-178](src/app/api/stripe/webhook/route.ts#L166-L178)).
3. Au downgrade/cancel, idem : recalcul déclenché ([webhook:247-259](src/app/api/stripe/webhook/route.ts#L247-L259)).

### Fonctionnalités ouvertes

**Q7 — `user.plan` et `planExpiresAt` mis à jour dans quel webhook ? Délai paiement → droits ?**
Les deux sont écrits dans `checkout.session.completed` ([webhook:115-128](src/app/api/stripe/webhook/route.ts#L115-L128)). Délai : celui du round-trip Stripe → webhook, typiquement < 2 s en test mode, < 5 s en prod. Un fallback dashboard ([page.tsx:66-99](src/app/(frontend)/dashboard/page.tsx#L66-L99)) resynchronise depuis Stripe si le user arrive sur `/dashboard` avant que le webhook ne soit traité.

**Q8 — Pendant `cancel_at_period_end: true`, plan effectif = payant jusqu'à `planExpiresAt` ?**
**Oui.** [src/collections/access.ts:12-30](src/collections/access.ts#L12-L30) : `getEffectiveFeatureLevel` renvoie `gratuit` uniquement si `planExpiresAt < now`. Le flag `cancel_at_period_end` Stripe est cosmétique côté dashboard uniquement.

**Q9 — Au downgrade, données dépassant les limites du nouveau plan ?**
**Supprimées (AUD-006).** [src/lib/plan-downgrade.ts:8-34](src/lib/plan-downgrade.ts#L8-L34) : au passage à `gratuit`, la fiche fournisseur est vidée des champs gated (description, illustrations, banniere, téléphone, adresse, etc.). Les hooks `cleanupOrphanedMediaOnChange` purgent les blobs Vercel orphelins. **MAIS** : le cas Infinite → Premium n'est pas géré (les événements créés sur Infinite restent quand le user bascule à Premium — voir AUD-C06).

**Q10 — JWT rafraîchi après changement de plan ?**
**Oui, via `TokenRefresh`** ([src/components/dashboard/TokenRefresh.tsx:15-33](src/components/dashboard/TokenRefresh.tsx#L15-L33)) qui appelle `/api/users/refresh-token` sur `?checkout=success`. Le dashboard lit aussi `freshUser` via `payload.findByID` ([dashboard/page.tsx:58-62](src/app/(frontend)/dashboard/page.tsx#L58-L62)) donc la bascule se voit immédiatement même sans refresh JWT.

### UI

**Q11 — Un bouton pour CHAQUE transition ?**
**Partiel.** Inventaire ([page.tsx:422-456](src/app/(frontend)/dashboard/abonnement/page.tsx#L422-L456)) :

| Transition            | Bouton exposé                                           |
|-----------------------|---------------------------------------------------------|
| Gratuit → Premium     | "Choisir Premium" (`PlanCheckoutButton` plan=premium)   |
| Gratuit → Infinite    | "Choisir Infinite"                                      |
| Premium → Infinite    | "Passer a Infinite"                                     |
| **Infinite → Premium** | **Absent** — texte statique "Annulez votre abonnement actuel pour basculer" |
| Premium/Infinite → Gratuit | "Annuler mon abonnement" (`CancelSubscriptionButton`)  |
| Réactivation          | "Reactiver le renouvellement auto" (`ReactivateButton`) |
| Mise à jour carte/moyen de paiement | **Absent** — aucun lien vers portail Stripe |

**Q12 — État actuel sans ambiguïté ?**
**Oui, à 85 %.** Affiché : plan, jours restants, date d'expiration, barre de progression, badge "annulation programmée", palier groupe + réduction. **Manquants** : pas d'affichage du **coût réel après coupon groupe** quand le user est actuellement abonné (la réduction n'est mentionnée que dans les cartes de plans). Pas de mention du **moyen de paiement enregistré** (4 derniers chiffres de CB).

**Q13 — Confirmation avant action destructive ?**
**Partiel.**
- Annulation : oui ([CancelSubscriptionButton:32-63](src/components/dashboard/CancelSubscriptionButton.tsx#L32-L63)) avec message "Votre acces sera maintenu jusqu'a la fin de la periode en cours".
- Réactivation : oui (confirmation inline).
- **Upgrade** : aucune confirmation, aucun preview du prorata. Un clic → Stripe Checkout. Le user ne voit le montant qu'UNE FOIS sur la page Stripe. Combiné à AUD-C01, il n'a aucun moyen d'anticiper qu'il va payer double.

**Q14 — UI à jour immédiatement ou refresh manuel ?**
**Immédiate via `router.refresh()`** dans chaque composant (Cancel/Reactivate/GroupeMemberView). Le dashboard re-lit `freshUser` à chaque render RSC donc les données sont toujours fraîches.

**Q15 — Erreurs API affichées proprement ?**
**Oui.** `PlanCheckoutButton`, `CancelSubscriptionButton`, `ReactivateButton` affichent tous un `toast.error()` avec le message API si disponible, sinon un fallback générique. Pas de stack trace exposée.

**Q16 — Un gratuit voit les 3 plans ? Un Premium voit Infinite mis en avant et Gratuit caché ?**
**Partiel.** Un gratuit voit les 3 plans. Un Premium voit les 3 plans aussi — le plan Gratuit est présenté avec un simple message "Annulez votre abonnement pour repasser au plan gratuit", ce qui est correct. Un Infinite voit les 3 plans également mais la carte Premium est désactivée avec le message "Annulez votre abonnement actuel pour basculer" — **sans bouton d'annulation depuis cette carte** (il faut remonter vers la section "Gestion de l'abonnement"). Friction UX.

Le paramètre `?plan=premium` ou `?plan=infinite` permet de mettre en avant une carte via `highlight` + scroll. Implémentation correcte.

**Q17 — Historique factures Stripe affiché et téléchargeable ?**
**Oui.** [page.tsx:123-155](src/app/(frontend)/dashboard/abonnement/page.tsx#L123-L155) liste jusqu'à 24 factures avec date, numéro, HT, TVA, TTC, statut, et lien PDF. Conforme aux obligations légales (mentionne 24 mois de rétention dans l'UI).

---

## Analyse détaillée par scénario

### S1 — Upgrade Premium → Infinite (cas critique)

**Flow actuel** :
1. User Premium clique "Passer à Infinite" (PlanCheckoutButton plan=infinite)
2. POST `/api/stripe/checkout` → guard anti-double-checkout ([AUD-007 accepté en audit principal](audits/abonnement-2026-04-20.md)) laisse passer car l'utilisateur est bien identifié comme ayant 1 sub, mais le guard ne distingue pas "changement de plan" de "double abonnement identique"
3. Nouvelle session Checkout créée avec `price = priceId infinite` → user redirigé sur Stripe
4. User paie 219 € → Stripe crée une **2ᵉ subscription active** (le customer a désormais 2 subs : Premium + Infinite)
5. Webhook `checkout.session.completed` :
   - Update user : `plan='infinite'`, `planExpiresAt = now+1an`, `stripeSubscriptionId = <nouvelle sub>`
   - Liste les autres subs actives du customer → `stripe.subscriptions.cancel(ancienneSubPremiumId)`
   - `stripe.subscriptions.cancel()` sans options : annulation **immédiate** + facture finale nulle + **pas de remboursement du temps restant**

**Impact financier concret** :
- User Premium qui avait payé 99 € il y a 3 mois a **consommé** 3/12 × 99 € = 24,75 € de Premium
- Il garde 9/12 × 99 € = 74,25 € de valeur théorique Premium
- En upgradant à Infinite, il paie **219 € plein tarif**
- Il perd les 74,25 € restants de Premium (sub cancelée sans refund)
- **Total spend : 99 + 219 = 318 €** pour obtenir Infinite jusqu'à `now + 1 an`
- Tarif "juste" attendu (proration) : 219 − 74,25 = **144,75 €** supplémentaires pour la même échéance

**Alternative Stripe native** :
```js
stripe.subscriptions.update(existingSubId, {
  items: [{ id: subItemId, price: PLANS.infinite.priceId }],
  proration_behavior: 'create_prorations',  // ou 'always_invoice'
})
```
Une seule sub, un seul abonnement actif, proration automatique par Stripe, conserve l'anniversaire de facturation.

### S2 — Downgrade Infinite → Premium

**Non implémenté**. L'UI renvoie `Annulez votre abonnement actuel pour basculer`. Le user doit :
1. Annuler (sub passe en `cancel_at_period_end: true`)
2. Attendre la fin de période (jusqu'à 12 mois) ou laisser basculer à `gratuit`
3. Re-souscrire à Premium depuis un état gratuit

Entre les deux, il perd l'accès Infinite **et** n'a pas accès Premium. Produit commercialement défavorable.

### S3 — Annulation programmée (OK)

Flow validé. Rate limit appliqué (AUD-010), confirmation UI, `cancel_at_period_end` clean, le user garde ses droits jusqu'à `planExpiresAt`. Le cron `downgrade-expires` finalise le passage à gratuit le lendemain de l'échéance. L'email `plan-downgraded` est envoyé. Le palier groupe est recalculé via `recalculerEtAppliquerPalier` avec l'ordre atomique Stripe-first corrigé (AUD-004).

### S4 — Réactivation (OK)

`stripe.subscriptions.update(subId, { cancel_at_period_end: false })`. Idempotent, pas de nouveau paiement. UI correcte.

### S5 — Changement de plan pendant annulation en cours

Le guard anti-double-checkout ([checkout:60-80](src/app/api/stripe/checkout/route.ts#L60-L80)) a une exception explicite : `if (isLive && !existingSub.cancel_at_period_end)` → 409. **Donc si `cancel_at_period_end === true`, la création de session Checkout est autorisée.** Flow qui en découle :

1. User Premium avec `cancel_at_period_end: true` clique "Passer à Infinite"
2. 2ᵉ session Checkout créée et payée
3. Webhook : le handler `checkout.session.completed` cancel "les autres subs actives" → l'ancienne Premium (`cancel_at_period_end: true`, mais toujours `status: active`) est annulée immédiatement ici aussi
4. User perd les jours restants de son Premium prépayé
5. Résultat financier : 99 € Premium initial (peut-être encore quelques mois d'usage légitime) + 219 € Infinite tout juste démarré

La branche est techniquement "safe" (pas de double-facturation future) mais **la valeur prépayée est gaspillée**.

### S6 — Annulation avec groupe (OK)

Testable via les comptes `demo-groupe1@`, `demo-groupe2@`, `demo-groupe3@` (palier 5 % à 3 membres payants). Si un membre annule :
- `customer.subscription.deleted` (ou `canceled`) → `recalculerEtAppliquerPalier`
- Si les membres restants passent sous les paliers, coupon retiré des autres membres (AUD-004 : Stripe-first, audit-log si partiel)
- Owner notifié via `groupeLeftOwnerEmail` ou `groupeOwnershipTransferredEmail` (AUD-011)

### S7 — Échec de paiement au renouvellement (post-AUD-003)

1. CB expirée au renouvellement annuel → `invoice.payment_failed`
2. Stripe retry automatique (config Smart Retries, jusqu'à ~21 j)
3. User reçoit `paymentFailedEmail` via le handler (L321-343)
4. **Important (AUD-003 corrigé)** : `past_due` et `unpaid` ne downgrade PAS l'utilisateur. Seul `canceled` (après épuisement des retries) bascule à gratuit.
5. **Pendant les 21 j de retry** : l'utilisateur garde son plan. Mais **aucun lien dans l'UI pour mettre à jour sa CB**. Il doit chercher dans ses emails le lien Stripe ou contacter le support.

### S8 — Double action rapide

- 2 clics "annuler" en < 1 s : idempotent côté Stripe (`cancel_at_period_end: true` appliqué 2 fois = pas de différence). Le bouton se met en `disabled` pendant `loading`, donc en pratique le 2ᵉ clic est bloqué côté UI. OK.
- Rate limit AUD-010 : 10/min/user — suffisant pour ce cas.
- "Annuler" puis "Réactiver" en < 1 s : 2 appels API, Stripe applique chacun séquentiellement, état final = reactivé. OK.

---

## Findings

### Critique

#### AUD-C01 — Upgrade Premium → Infinite via nouvelle subscription : double prélèvement de facto

- **Sévérité** : Critique
- **Catégorie** : Montant / Bug confirmé
- **Scénario concerné** : S1
- **Fichier** : [src/app/api/stripe/checkout/route.ts:131-148](src/app/api/stripe/checkout/route.ts#L131-L148) + [src/app/api/stripe/webhook/route.ts:134-153](src/app/api/stripe/webhook/route.ts#L134-L153)
- **Description** : Le "changement de plan" Premium → Infinite n'utilise pas `stripe.subscriptions.update` avec proration. Il crée une nouvelle Stripe Checkout session plein tarif (219 €). Après paiement, le webhook annule l'ancienne sub Premium via `stripe.subscriptions.cancel()` sans option de remboursement ni proration — Stripe ne rembourse rien par défaut sur cette API. Le user a donc payé 99 € + 219 € pour obtenir Infinite ; il perd la valeur restante (jusqu'à ~90 €) de son Premium prépayé.
- **Reproduction** :
  1. Compte Premium fraîchement payé, `planExpiresAt = now + 12 mois`.
  2. Clic "Passer à Infinite" → paiement CB test.
  3. Vérifier Stripe dashboard test : la sub Premium passe en `canceled`, une sub Infinite `active` est créée, **2 factures distinctes** existent (99 € Premium initial + 219 € Infinite).
  4. Aucun credit note / refund n'est émis.
- **Impact utilisateur** : facturation non conforme aux usages Stripe, litige client probable. Non conforme aux attentes implicites des CGV (proration courante en SaaS).
- **Recommandation** : remplacer le flow "nouvelle session Checkout" par un `stripe.subscriptions.update(existingSubId, { items: [{ id: item.id, price: PLANS.infinite.priceId }], proration_behavior: 'always_invoice' })` quand le user a déjà une sub `active`. Conserver la voie Checkout pour les premières souscriptions (gratuit → payant) uniquement. Exposer un preview du montant via `stripe.invoices.upcoming` avant confirmation.
- **Effort** : L (nouveau code path, nouvel endpoint `/api/stripe/change-plan`, preview de facture, tests)

#### AUD-C02 — Downgrade Infinite → Premium non exposé dans l'UI

- **Sévérité** : Critique
- **Catégorie** : UI / Fonctionnalité manquante
- **Scénario concerné** : S2
- **Fichier** : [src/app/(frontend)/dashboard/abonnement/page.tsx:440-442](src/app/(frontend)/dashboard/abonnement/page.tsx#L440-L442)
- **Description** : Un user Infinite ne peut pas descendre à Premium de façon propre. La carte Premium affiche "Annulez votre abonnement actuel pour basculer". Concrètement : annuler, attendre fin de période, **passer par gratuit**, puis re-souscrire Premium. Durant la période entre annulation et re-subscription, l'utilisateur perd **tout accès payant** (même le Premium qu'il voulait conserver). Alternative réelle : contacter le support, traitement manuel.
- **Reproduction** : voir S2 ci-dessus.
- **Impact utilisateur** : perte d'accès injustifiée, churn involontaire, contacts support accrus.
- **Recommandation** : même solution qu'AUD-C01 via `stripe.subscriptions.update` avec `proration_behavior: 'create_prorations'` (crédit Stripe appliqué à la prochaine facture). Exposer un bouton "Passer à Premium" sur la carte Premium quand `currentPlan === 'infinite'`.
- **Effort** : M (même path que AUD-C01, donc couplé)

### Élevée

#### AUD-C03 — Checkout crée une 2ᵉ sub en parallèle quand `cancel_at_period_end: true`

- **Sévérité** : Élevée
- **Catégorie** : Montant / Risque
- **Scénario concerné** : S5
- **Fichier** : [src/app/api/stripe/checkout/route.ts:65-74](src/app/api/stripe/checkout/route.ts#L65-L74)
- **Description** : Le guard anti-double-checkout (AUD-007 de l'audit principal) a une exception `if (isLive && !existingSub.cancel_at_period_end)`. Si l'utilisateur a annulé (donc `cancel_at_period_end: true` mais `status: active`), le guard laisse passer. Une 2ᵉ session est créée et payée. Le webhook annule l'ancienne (déjà en cours d'annulation) de façon anticipée via `stripe.subscriptions.cancel()`. L'utilisateur paie la nouvelle sub plein tarif alors qu'il lui restait potentiellement jusqu'à 12 mois prépayés sur l'ancienne.
- **Reproduction** :
  1. User Premium → annule → `cancel_at_period_end: true`, `planExpiresAt = 2027-04-20` (par ex.)
  2. Juste après, clic "Choisir Infinite" → checkout autorisé
  3. Paiement → ancienne Premium canceled immédiatement, pas de remboursement des mois prépayés
- **Impact utilisateur** : gaspillage de prépaiement, aggravé si le user voulait juste "upgrader" en vitesse après avoir hésité à annuler.
- **Recommandation** : étendre le guard pour refuser la création de session quand `cancel_at_period_end === true`, **sauf** si la requête demande explicitement à réactiver d'abord. Ou, mieux : unifier via `stripe.subscriptions.update` (cf AUD-C01) + forcer une réactivation préalable si annulation programmée.
- **Effort** : S (si AUD-C01 fait), M sinon

#### AUD-C04 — Aucun preview du montant prorata avant confirmation

- **Sévérité** : Élevée
- **Catégorie** : UI / Transparence
- **Scénario concerné** : S1, S2, S5
- **Fichier** : [src/app/(frontend)/dashboard/abonnement/page.tsx:479-506](src/app/(frontend)/dashboard/abonnement/page.tsx#L479-L506) + [src/components/dashboard/PlanCheckoutButton.tsx](src/components/dashboard/PlanCheckoutButton.tsx)
- **Description** : Le card de plan affiche le tarif annuel brut (99 €, 219 €) et éventuellement le tarif post-coupon groupe. Aucune mention du prorata (restant dû, crédit, remboursement) lors d'un upgrade. Le bouton déclenche directement une session Checkout ; le user ne voit le vrai montant qu'une fois sur Stripe. Dans la situation post-AUD-C01, le "vrai montant" sur Stripe est de plus trompeur (il paie plein tarif alors que légitimement une partie aurait dû être créditée).
- **Reproduction** : voir S1.
- **Impact utilisateur** : impossibilité d'anticiper le coût, abandon du checkout fréquent, mécontentement post-paiement.
- **Recommandation** : avant de rediriger vers Stripe, appeler `stripe.invoices.upcoming({ customer, subscription_items: [...], subscription_proration_behavior: 'always_invoice' })` pour calculer le montant exact qui serait facturé. Afficher ce montant dans une modale de confirmation avec un libellé clair ("Vous paierez XX € aujourd'hui, puis YY €/an au renouvellement le ZZ/ZZ/ZZ"). Cette UI doit aussi mentionner la valeur créditée pour le downgrade AUD-C02.
- **Effort** : M (backend endpoint preview + modale UI)

#### AUD-C05 — `customer.subscription.updated` ne réagit pas au changement d'item via update futur

- **Sévérité** : Élevée (devient critique si AUD-C01 est corrigé)
- **Catégorie** : Droits / Risque
- **Scénario concerné** : S1 (après fix AUD-C01)
- **Fichier** : [src/app/api/stripe/webhook/route.ts:182-262](src/app/api/stripe/webhook/route.ts#L182-L262)
- **Description** : Actuellement le handler `customer.subscription.updated` traite :
  - `status === 'active'` → refresh `planExpiresAt`, potentiellement plan si le priceId a changé
  - `canceled` → downgrade
  - `past_due | unpaid` → email payment-failed, pas de downgrade (AUD-003)
  Le path `active` lit bien le `priceId` du nouvel item (L209-210) donc en théorie un `stripe.subscriptions.update` avec nouveau price serait pris en compte. **Mais** : le check `user.stripeSubscriptionId !== subscription.id` (L201-206) était conçu pour filtrer les events d'anciennes subs durant les upgrades "nouvelle sub". Si demain AUD-C01 est corrigé avec un `subscription.update` sur la sub existante, cet event matchera `user.stripeSubscriptionId === subscription.id` donc passera la garde — OK. Mais le check reste à documenter comme obsolète une fois AUD-C01 appliqué.
- **Impact** : pas de bug actuel, mais risque de dead code / confusion après fix AUD-C01.
- **Recommandation** : une fois AUD-C01 implémenté, retirer le bloc L134-153 du webhook (cancel des anciennes subs) et nettoyer le comment L196-200. Ajouter un test : "upgrade via subscriptions.update → `customer.subscription.updated` détecte le changement de priceId → user.plan mis à jour immédiatement".
- **Effort** : S

#### AUD-C06 — Infinite → Premium : événements créés sur Infinite non purgés

- **Sévérité** : Élevée
- **Catégorie** : Droits / Cohérence
- **Scénario concerné** : S2
- **Fichier** : [src/lib/plan-downgrade.ts:8-34](src/lib/plan-downgrade.ts#L8-L34)
- **Description** : AUD-006 vide les champs Premium+ de la fiche fournisseur lors du passage à `gratuit`. Cependant, un user Infinite qui downgrade à Premium (aujourd'hui impossible, demain via AUD-C02) conserverait ses événements créés (quota 10 actifs). Premium ne donne pas le droit de créer des événements ; les événements existants resteraient donc publiés. Incohérence.
- **Reproduction** : post-fix AUD-C02, Infinite → Premium via `subscriptions.update` → événements non supprimés.
- **Impact** : un Premium affiche des événements qu'il ne devrait pas avoir.
- **Recommandation** : étendre `plan-downgrade.ts` pour prendre un paramètre `targetLevel: 'gratuit' | 'premium'` ET archiver les événements actifs du user si `targetLevel === 'premium'` ou `'gratuit'`. À traiter en même temps que AUD-C02.
- **Effort** : M

### Moyenne

#### AUD-C07 — Pas de lien portail Stripe / update carte bancaire dans l'UI

- **Sévérité** : Moyenne
- **Catégorie** : UI
- **Scénario concerné** : S7
- **Fichier** : [src/app/(frontend)/dashboard/abonnement/page.tsx](src/app/(frontend)/dashboard/abonnement/page.tsx) (section "Gestion de l'abonnement")
- **Description** : Quand la CB expire et que le renouvellement échoue, l'utilisateur reçoit `paymentFailedEmail` (qui ne contient pas de lien direct). Dans l'UI, rien ne permet de mettre à jour le moyen de paiement. La seule voie est de passer par les emails Stripe ou d'attendre l'annulation puis re-souscrire. Le Stripe Customer Portal est la solution native (`stripe.billingPortal.sessions.create`).
- **Impact** : churn involontaire si CB expire pendant les retries Stripe (21 j), le user ne sait pas quoi faire.
- **Recommandation** : exposer un bouton "Mettre à jour mon moyen de paiement" dans l'UI + endpoint `/api/stripe/portal` qui crée une session Billing Portal et redirige. Même endpoint peut aussi permettre à l'utilisateur de consulter/télécharger ses factures, rationaliser les flows.
- **Effort** : S

#### AUD-C08 — UI "Plan actuel" n'indique pas le prix payé après coupon groupe

- **Sévérité** : Moyenne
- **Catégorie** : UI / Transparence
- **Scénario concerné** : transverse
- **Fichier** : [src/app/(frontend)/dashboard/abonnement/page.tsx:165-195](src/app/(frontend)/dashboard/abonnement/page.tsx#L165-L195)
- **Description** : Dans la section "Mon abonnement actuel", le PlanBadge et la date d'expiration sont affichés. Si le user est dans un groupe, un pill "-5 %" apparaît. Mais le **montant effectivement payé au renouvellement** n'est jamais affiché (ex. "Prochain prélèvement : 94,05 € le 20/04/2027"). L'utilisateur doit extrapoler depuis le tarif catalogue + le palier.
- **Recommandation** : ajouter un sous-libellé "Prochain prélèvement : XX € le ZZ/ZZ" calculé depuis Stripe (`stripe.invoices.upcoming`) ou localement (prix plan × (1 - palier/100)).
- **Effort** : S

#### AUD-C09 — Friction UX : pas de bouton "annuler" sur la carte "Gratuit" quand on est payant

- **Sévérité** : Moyenne
- **Catégorie** : UI
- **Fichier** : [src/app/(frontend)/dashboard/abonnement/page.tsx:423-428](src/app/(frontend)/dashboard/abonnement/page.tsx#L423-L428)
- **Description** : Quand un Premium/Infinite consulte sa page, la carte Gratuit affiche "Annulez votre abonnement pour repasser au plan gratuit" — texte statique, pas de lien/bouton. L'utilisateur doit scroller vers le haut pour trouver la section "Gestion de l'abonnement" avec le CancelSubscriptionButton. Friction cognitive.
- **Recommandation** : dans cette card, ajouter soit un lien ancre vers la section cancel, soit directement le `CancelSubscriptionButton` embarqué.
- **Effort** : S

#### AUD-C10 — Pas de confirmation explicite avant le plein tarif d'un upgrade

- **Sévérité** : Moyenne (deviendra Faible une fois AUD-C04 implémenté)
- **Catégorie** : UI
- **Fichier** : [src/components/dashboard/PlanCheckoutButton.tsx:16-35](src/components/dashboard/PlanCheckoutButton.tsx#L16-L35)
- **Description** : Le bouton "Passer à Infinite" redirige immédiatement vers Stripe sans modale intermédiaire. Pour une action engageant 219 €, une confirmation "Vous allez être facturé 219 € maintenant. Continuer ?" serait minimaliste.
- **Recommandation** : wrapper la redirection dans une modale de confirmation (compatible avec AUD-C04 qui ajoutera le preview du prorata).
- **Effort** : S

### Faible

#### AUD-C11 — Annulation pendant trial non gérée (pas de trial configuré actuellement, mais guard absent)

- **Sévérité** : Faible / Info
- **Catégorie** : Risque
- **Description** : Le guard anti-double-checkout accepte `status === 'trialing'` comme "live", mais aucun flow trial n'est configuré côté Stripe pour l'instant. Si un trial est ajouté plus tard (ex. "Premium gratuit 30 jours"), il faudra vérifier que les handlers gèrent `trial_end`, `trial_will_end`, etc.
- **Recommandation** : à documenter dans un TODO si un trial est envisagé.
- **Effort** : N/A

#### AUD-C12 — `stripe.subscriptions.list({ limit: 100 })` dans le webhook : plafond dur

- **Sévérité** : Faible
- **Catégorie** : Technique
- **Fichier** : [src/app/api/stripe/webhook/route.ts:137-141](src/app/api/stripe/webhook/route.ts#L137-L141)
- **Description** : Le listing des subs actives pour annulation post-checkout est plafonné à 100. En pratique, un customer Panorama Pub n'aura jamais plus de 2 subs actives simultanément. Mais le plafond n'est pas documenté.
- **Recommandation** : ajouter un commentaire "un customer ne devrait jamais avoir > 2 subs ; si c'était le cas c'est déjà une anomalie à investiguer manuellement", ou boucler via `auto_pagination` pour robustesse.
- **Effort** : S

---

## Scénarios non testables localement en l'état

- **Proration Stripe concrète** : non applicable tant que AUD-C01 n'est pas fixé (le flow actuel ne déclenche jamais de proration).
- **Refund / credit note** : idem.
- **Carte "Update card" via portail Stripe** : nécessite AUD-C07.
- **Trial subscriptions** : non configurées.

---

## Limites de cet audit

Analyse statique + inspection du code. Les tests actifs suggérés (Phase 2 du prompt) n'ont pas été exécutés ici faute d'environnement Stripe test opérationnel — le diagnostic préalable a révélé que les priceIds dans `.env.local` pointent vers un produit inexistant côté compte Stripe test (résolu séparément). À réaliser après :

1. Création des products Stripe 99 € + 219 € dans le compte test
2. Passage du smoke test F1 + F2 documenté dans la checklist tests manuels précédente
3. Confrontation de chaque finding AUD-C01 à AUD-C12 à un scénario reproductible dans Stripe Dashboard (test mode)

---

## Synthèse en une phrase

Le socle d'abonnement est techniquement correct (idempotence, droits, cron, downgrade propre post-AUD-006), mais **le flow de changement de plan n'est pas de niveau production** : les upgrades sont sur-facturés par création systématique d'une nouvelle subscription, les downgrades ne sont pas exposés côté UI, et aucun preview de montant n'est offert à l'utilisateur avant paiement. Corriger AUD-C01 + AUD-C02 + AUD-C04 avant toute campagne commerciale.
