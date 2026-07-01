# Plan de réalisation — Corrections audit changement d'abonnement 2026-04-20

## Contexte

L'audit du 2026-04-20 (`audits/changement-abonnement-2026-04-20.md`) a identifié **12 findings** sur les flows de changement/annulation d'abonnement. Le bug racine : les upgrades sont implémentés en créant une nouvelle Stripe subscription plein tarif au lieu d'un `subscriptions.update` avec proration, conduisant à un sur-facturation systémique (ex. 318 € payés au lieu de ~145 € prorata pour upgrade Premium→Infinite à 3 mois).

**Décisions prises** :
- Couplage C01/C02/C05/C06 : **1 PR groupé** (état intermédiaire impossible)
- Scope : **les 12 findings**
- Preview prorata : **modale avec montant exact** via `stripe.invoices.upcoming`

**Objectif** : livrer 8 PRs. PR#C-A contient la refonte backend majeure + downgrade cleanup. Les 7 autres sont atomiques.

**Prérequis bloquant** : les priceIds dans `.env.local` pointent vers un produit inexistant côté Stripe test (diagnostic précédent). **Créer les 2 products Stripe 99 € et 219 €** dans le dashboard test AVANT de commencer l'implémentation — impossible de tester PR#C-A sinon.

---

## Ordre d'exécution

```
J+1 à J+5   PR#C-A   Endpoint change-plan + proration + downgrade events + webhook cleanup
J+6 à J+8   PR#C-B   Modale preview prorata (dépend de C-A pour l'endpoint preview)
J+8 à J+9   PR#C-C   Guard cancel_at_period_end (parallélisable avec C-A/B)
J+9 à J+10  PR#C-D   Customer Portal Stripe (indépendant)
J+10 à J+11 PR#C-E   Prochain prélèvement affiché
J+11        PR#C-F   Cancel inline sur card gratuit
J+11        PR#C-G   TODO trial
J+12        PR#C-H   auto_pagination subs.list
```

Total ~12 jours dev sans tests E2E Playwright complets. Avec tests : +2 jours.

---

## PR#C-A — Endpoint change-plan + proration (Critique, 5 j)

**Findings couverts** : AUD-C01, AUD-C02, AUD-C05, AUD-C06.

### Architecture cible

```
Gratuit → Premium/Infinite  :  POST /api/stripe/checkout   (flow existant, inchange)
Premium ⇄ Infinite          :  POST /api/stripe/change-plan (nouveau)
Premium/Infinite → Gratuit  :  POST /api/stripe/cancel      (flow existant, inchange)
Reactivate annulation       :  POST /api/stripe/reactivate  (inchange)
```

### Fichiers

**Nouveau** :
- `src/app/api/stripe/change-plan/route.ts` — endpoint principal
- `src/app/api/stripe/preview-change-plan/route.ts` — endpoint preview pour PR#C-B (skeleton ici, UI en C-B)

**Modifiés** :
- `src/lib/plan-downgrade.ts` — accepter `targetLevel: 'gratuit' | 'premium'`, gérer l'archivage des events sur Infinite→Premium
- `src/app/api/stripe/webhook/route.ts` — retirer le bloc "cancel prior subs" L134-153 (inutile une fois que change-plan utilise subscriptions.update) ; vérifier que le handler `customer.subscription.updated` capture bien le changement de priceId et pousse plan+planExpiresAt+expirationAlerts reset
- `src/app/(frontend)/dashboard/abonnement/page.tsx` — câbler le bouton "Passer à Premium" quand currentPlan=infinite, remplacer les messages statiques "Annulez votre abonnement pour basculer"
- `src/components/dashboard/PlanCheckoutButton.tsx` — renommer en `PlanChangeButton.tsx`, accepter prop `mode: 'checkout' | 'change'` ; route dispatcher vers `/change-plan` ou `/checkout`

### Logique change-plan

```ts
// Pseudo-code
POST /api/stripe/change-plan { plan: 'premium' | 'infinite' }

1. Auth check, rate limit (10/min/user, cohérent avec cancel/reactivate)
2. freshUser = findByID(user.id)
3. Rejeter si :
   - freshUser.role === 'organisateur' && plan === 'premium'  (AUD-013 symétrique)
   - !freshUser.stripeSubscriptionId (pas de sub → utiliser /checkout)
   - freshUser.plan === plan (no-op)
4. retrieve existingSub + son item subscription_item_id
5. Déterminer proration_behavior selon direction :
   - Upgrade (premium→infinite)  : 'always_invoice' — Stripe charge la différence immédiatement
   - Downgrade (infinite→premium) : 'create_prorations' — crédit reporté sur la prochaine facture
6. stripe.subscriptions.update(subId, {
     items: [{ id: item.id, price: PLANS[plan].priceId }],
     proration_behavior: <calculé>,
     payment_behavior: 'error_if_incomplete',  // evite etat pending sur CB refusee
   })
7. Le webhook customer.subscription.updated fera la mise à jour DB
8. Retourner { success: true, plan }
```

### Downgrade cleanup (AUD-C06)

`lib/plan-downgrade.ts` devient :

```ts
export async function downgradeUserAndClearFields(
  payload: Payload,
  userId: number | string,
  options: { targetLevel: 'gratuit' | 'premium' },
)
```

- `targetLevel: 'gratuit'` : comportement actuel (vide les champs Premium+, pas besoin de toucher aux events car user downgrade complet, quota 0)
- `targetLevel: 'premium'` :
  - Ne vide QUE les champs Infinite-only : `description` (si > 100 mots, tronquer ou vider), `videoYoutube`, et les illustrations > 1 (garde la première, supprime les autres)
  - Archive les événements du user via `payload.update({ collection: 'evenements', where: { 'fournisseur.user': { equals: userId } }, data: { statut: 'archive' } })`

### Webhook cleanup (AUD-C05)

- **Retirer** L134-153 du webhook (cancel des anciennes subs après checkout.session.completed). Ce code n'a plus d'objet : un user avec une sub active n'arrivera jamais sur le flow checkout grâce au guard AUD-007 renforcé par C-C.
- **Vérifier** que `customer.subscription.updated` (status=active) met à jour `plan` ET `planExpiresAt` quand le priceId change. Actuellement le code fait :
  ```
  if (resolvedPlan) updateData.plan = resolvedPlan
  ```
  Ça marche, mais il faut ajouter un `logPlanChange` (AUD-016 déjà posé) pour tracer la transition dans audit-logs.

### Tests

**Unitaires Vitest** :
- change-plan rejette sans sub → 400
- change-plan rejette same plan → 400
- change-plan rejette organisateur + premium → 400
- change-plan appelle bien `stripe.subscriptions.update` avec le bon `proration_behavior` selon direction
- `downgradeUserAndClearFields({ targetLevel: 'premium' })` archive les events du user

**Intégration (local)** :
- Stripe test CB `4242` :
  1. Subscribe Premium (99 €), attendre webhook, plan=premium en DB
  2. Change-plan Infinite → Stripe dashboard montre **1 seule sub active** (pas 2), une facture de proration d'environ `(219-99)*(reste_période/12)` émise
  3. Change-plan Premium → crédit appliqué sur prochaine facture visible dans `stripe.invoices.upcoming`
  4. Events créés pendant Infinite doivent être archivés après downgrade vers Premium

**Effort** : L (5 jours dev + 1 j tests + 1 j review)

---

## PR#C-B — Modale preview prorata (Élevée, 3 j)

**Findings couverts** : AUD-C04, AUD-C10.

### Fichiers

**Nouveau** :
- `src/components/dashboard/PlanChangeConfirmModal.tsx` — modale Base UI avec preview montant + CTAs

**Modifiés** :
- `src/app/api/stripe/preview-change-plan/route.ts` — body complet de l'endpoint (skeleton posé en C-A)
- `src/components/dashboard/PlanCheckoutButton.tsx` (ou PlanChangeButton post C-A) — ouvre la modale au lieu de rediriger directement

### Logique preview endpoint

```ts
POST /api/stripe/preview-change-plan { plan: 'premium' | 'infinite' }

1. Auth + rate limit
2. freshUser avec stripeSubscriptionId requis (sinon 400 "use checkout")
3. stripe.invoices.createPreview({
     customer: freshUser.stripeCustomerId,
     subscription: freshUser.stripeSubscriptionId,
     subscription_details: {
       items: [{ id: currentItemId, price: PLANS[plan].priceId }],
       proration_behavior: <upgrade → always_invoice, downgrade → create_prorations>,
     },
   })
4. Retourner {
     amountDue: invoice.amount_due / 100,           // montant à payer MAINTENANT
     amountRemainingCredit: max(0, -amount_due),    // crédit si downgrade
     nextRenewalDate: invoice.next_payment_attempt OR sub.current_period_end,
     nextRenewalAmount: PLANS[plan].price / 100 * (1 - palier/100),
     currency: 'EUR',
   }
```

### UI modale

```
┌────────────────────────────────────────────┐
│ Passer à Infinite                       ×  │
├────────────────────────────────────────────┤
│ Récapitulatif de votre changement          │
│                                            │
│ À payer aujourd'hui : 142,50 €             │
│ (proration sur les 9 mois restants)        │
│                                            │
│ Prochain renouvellement : 219 € /an         │
│ le 20 avril 2027                           │
│                                            │
│ [Annuler]          [Confirmer et payer]    │
└────────────────────────────────────────────┘
```

Cas downgrade :
```
À payer aujourd'hui : 0 €
Un crédit de 94,25 € sera appliqué sur votre prochaine facture.
Prochain renouvellement : 4,75 € le 20 avril 2027 (après crédit)
```

### Tests

- Preview endpoint retourne le bon payload sur upgrade Premium→Infinite
- Modale affiche "À payer aujourd'hui" en cas d'upgrade, "Crédit appliqué" en cas de downgrade
- Clic Confirmer → appel POST /api/stripe/change-plan

**Effort** : M (3 jours)

---

## PR#C-C — Guard checkout pendant cancel_at_period_end (Élevée, 1 j)

**Findings couverts** : AUD-C03.

### Modification

`src/app/api/stripe/checkout/route.ts` L60-80 :

```ts
if (freshUser.stripeSubscriptionId) {
  const existingSub = await stripe.subscriptions.retrieve(...)
  const isLive = existingSub.status === 'active' || existingSub.status === 'trialing'

  // AVANT : if (isLive && !existingSub.cancel_at_period_end) → 409
  // APRÈS : tout isLive → 409 (inclut cancel_at_period_end)
  if (isLive) {
    return NextResponse.json(
      {
        error: existingSub.cancel_at_period_end
          ? 'Votre abonnement est programmé pour annulation. Réactivez-le d\'abord pour changer de plan.'
          : 'Un abonnement est déjà actif. Utilisez le dashboard pour changer de plan.',
        code: existingSub.cancel_at_period_end ? 'cancel_pending' : 'already_active',
      },
      { status: 409 },
    )
  }
}
```

UI côté dashboard/abonnement/page.tsx : quand `cancel_at_period_end === true`, masquer tous les boutons de change-plan en faveur d'un message "Votre abonnement est programmé pour annulation. [Réactiver] pour reprendre ou changer de plan."

### Tests

- User avec sub active `cancel_at_period_end=true` tente POST /api/stripe/checkout → 409 avec code `cancel_pending`
- User avec sub active `cancel_at_period_end=false` → 409 avec code `already_active`

**Effort** : S (1 jour)

---

## PR#C-D — Customer Portal Stripe (Moyenne, 2 j)

**Findings couverts** : AUD-C07.

### Fichiers

**Nouveau** :
- `src/app/api/stripe/portal/route.ts` — POST qui crée une session Stripe Billing Portal et renvoie `{ url }`

**Modifiés** :
- `src/app/(frontend)/dashboard/abonnement/page.tsx` — nouveau bouton "Gérer mon moyen de paiement" dans la section "Gestion de l'abonnement"
- `src/components/dashboard/StripePortalButton.tsx` — redirige vers portal après POST

### Logique portal

```ts
POST /api/stripe/portal

1. Auth + rate limit
2. freshUser.stripeCustomerId requis sinon 400
3. session = stripe.billingPortal.sessions.create({
     customer: freshUser.stripeCustomerId,
     return_url: `${SITE_URL}/dashboard/abonnement`,
     // flow_data: { type: 'payment_method_update' } si on veut forcer directement l'écran CB
   })
4. Retourner { url: session.url }
```

### Tests

- Click "Gérer mon moyen de paiement" → redirection vers portal.stripe.com
- Portal permet de mettre à jour CB, télécharger factures (redondance avec UI existante OK)
- Retour sur /dashboard/abonnement après action

**Effort** : S (2 jours incluant configuration dashboard Stripe pour activer Billing Portal)

---

## PR#C-E — Prochain prélèvement affiché (Moyenne, 1 j)

**Findings couverts** : AUD-C08.

### Modification

`src/app/(frontend)/dashboard/abonnement/page.tsx` section "Mon abonnement actuel" (L165-195) :

Ajouter un sous-texte :
```
Prochain prélèvement : 89,10 € (-10% groupe Tricolore) le 20 avril 2027
```

Calcul : `PLANS[plan].price * (1 - Number(palierActuel)/100) / 100`

Alternative plus précise : appeler `stripe.invoices.upcoming({ customer, subscription })` mais coût supplémentaire d'un round-trip Stripe à chaque render. Privilégier le calcul local.

### Tests

- User Premium sans groupe → "Prochain prélèvement : 99 € le YY/YY"
- User Premium groupe palier 10% → "89,10 € (-10% groupe X) le YY/YY"
- User avec cancel_at_period_end → masquer le bloc "Prochain prélèvement"

**Effort** : S (1 jour)

---

## PR#C-F — Cancel inline sur card gratuit (Faible UX, 0.5 j)

**Findings couverts** : AUD-C09.

### Modification

`src/app/(frontend)/dashboard/abonnement/page.tsx` L423-428 :

```tsx
if (planKey === 'gratuit' && currentPlan !== 'gratuit') {
  action = <CancelSubscriptionButton />  // au lieu du texte statique
}
```

Le bouton `CancelSubscriptionButton` existe déjà et gère la confirmation inline. Réutilisation directe.

**Effort** : S (30 min)

---

## PR#C-G — TODO trial documenté (Info, 0.5 j)

**Findings couverts** : AUD-C11.

### Modification

Ajouter un commentaire en tête de `src/app/api/stripe/checkout/route.ts` et `webhook/route.ts` :

```ts
// TODO trial : si un trial period est ajouté aux PLANS (ex. trial_period_days: 30),
// compléter :
// - checkout : PLANS[plan].priceId + subscription_data.trial_period_days
// - webhook : handler customer.subscription.trial_will_end (email 3j avant)
// - webhook : handler trialing → active → update planExpiresAt
// - dashboard/abonnement : afficher "Essai gratuit jusqu'au YY/YY"
// Guard anti-double-checkout AUD-C03 accepte déjà `status === 'trialing'`
// comme "live", mais n'est pas testé dans ce scénario.
```

**Effort** : S (15 min)

---

## PR#C-H — auto_pagination sur subs.list (Faible, 0.5 j)

**Findings couverts** : AUD-C12.

### Modification

Après le fix AUD-C05 (webhook nettoyé), le seul endroit qui reste lister les subs actives est le fallback dashboard `page.tsx:68-72` avec `limit: 1`. Plus de `limit: 100`.

Action : vérifier qu'il ne reste aucun `stripe.subscriptions.list({limit: 100})` non paginé. Si oui, passer à `autoPagingEach`. Sinon, finding clos "consommé par AUD-C05" sans PR nécessaire.

**Effort** : S (30 min de revue)

---

## Fichiers critiques touchés (récap)

| Fichier | PRs |
|---------|-----|
| `src/app/api/stripe/change-plan/route.ts` (nouveau) | C-A |
| `src/app/api/stripe/preview-change-plan/route.ts` (nouveau) | C-A (skeleton), C-B (body) |
| `src/app/api/stripe/portal/route.ts` (nouveau) | C-D |
| `src/app/api/stripe/checkout/route.ts` | C-A, C-C, C-G |
| `src/app/api/stripe/webhook/route.ts` | C-A (cleanup), C-G |
| `src/lib/plan-downgrade.ts` | C-A (extended) |
| `src/app/(frontend)/dashboard/abonnement/page.tsx` | C-A, C-D, C-E, C-F |
| `src/components/dashboard/PlanCheckoutButton.tsx` | C-A (renommé) |
| `src/components/dashboard/PlanChangeConfirmModal.tsx` (nouveau) | C-B |
| `src/components/dashboard/StripePortalButton.tsx` (nouveau) | C-D |
| `CLAUDE.md` | C-A (mise à jour des 5 règles critiques + endpoints table) |

---

## Fonctions & utilitaires réutilisés

- `rateLimit` ([src/lib/rate-limit.ts](../src/lib/rate-limit.ts)) — sur tous les nouveaux endpoints
- `logPlanChange` ([src/lib/audit.ts](../src/lib/audit.ts)) — déjà posé par l'audit principal, réutilisé dans webhook + change-plan
- `downgradeUserAndClearFields` ([src/lib/plan-downgrade.ts](../src/lib/plan-downgrade.ts)) — étendu dans C-A
- `recalculerEtAppliquerPalier` ([src/lib/groupes.ts](../src/lib/groupes.ts)) — à réinvoquer après change-plan (nouveau plan ne change pas le palier puisque membres payants inchangés, mais défense en profondeur)
- `palierProjeteAvecUtilisateurPayant` ([src/lib/groupes.ts](../src/lib/groupes.ts)) — à adapter pour preview endpoint (récupérer coupon projeté)
- `CancelSubscriptionButton` ([src/components/dashboard/CancelSubscriptionButton.tsx](../src/components/dashboard/CancelSubscriptionButton.tsx)) — réutilisé en C-F
- `ReactivateButton` — réutilisé dans le message "réactivez avant de changer" de C-C
- Base UI `Dialog` (déjà dans le bundle via `@base-ui/react`) pour la modale de C-B

---

## Vérification end-to-end

Chaque PR :
- `pnpm generate:types` si collection ou schéma modifié
- `pnpm build` sans erreur TS
- `pnpm test:int` vert
- `pnpm lint` sans warning

Après chaque bloc mergé :
- Scénario smoke manuel correspondant de la checklist (fichier précédent)
- Stripe dashboard test : cohérence subs / invoices / credit notes
- audit_logs : traces attendues présentes (`plan_changed` sur chaque transition)

**Smoke test critique après PR#C-A** (à ajouter à la checklist) :
1. User Premium `demo-premium@` avec 3 mois consommés
2. `POST /api/stripe/change-plan { plan: 'infinite' }` (via fetch DevTools ou bouton si C-B déjà mergé)
3. Stripe dashboard : une seule sub active, status=active, item price=infinite
4. Facture émise avec ligne de proration (~100-110 €, pas 219 €)
5. DB user : plan=infinite, planExpiresAt inchangé (même anniversaire de facturation)
6. `audit_logs`: ligne `plan_changed` avec reason=subscription_updated
7. Revenir Premium (downgrade) : crédit créé sur prochaine facture, events archivés

### Rollback

PR#C-A est la plus risquée. Rollback possible :
- Revert du commit (pas de migration DB)
- Les subs Stripe déjà mises à jour via `subscriptions.update` restent valides (priceId applicable), le code revert retombe sur le path checkout → mais `stripeSubscriptionId` sur user pointe toujours vers la bonne sub. Compatible.
- Les events archivés par le downgrade restent archivés (comportement souhaité).

---

## Checklist préparatoire avant PR#C-A

- [ ] Products Stripe test créés : 99 €/an et 219 €/an (`stripe prices create ...`)
- [ ] `.env.local` mis à jour avec les bons priceIds (DIFFÉRENTS entre premium et infinite)
- [ ] `pnpm stripe:listen` démarré, `STRIPE_WEBHOOK_SECRET` copié depuis sa sortie
- [ ] Les 5 migrations de l'audit principal appliquées (batch 17 confirmé)
- [ ] Smoke test initial : souscription Premium de base fonctionne (confirme que le socle est sain)

---

## Synthèse

Le plan couvre les 12 findings en 8 PRs, avec un cœur coupled (C-A) de ~5 jours et 7 PRs atomiques plus petits. La complexité est concentrée sur le design Stripe (proration_behavior, payment_behavior, création d'invoices proration). L'UI s'enchaîne naturellement une fois l'endpoint en place. À la fin du chantier, le flow d'abonnement est conforme aux standards SaaS (proration native Stripe, preview montant, portail client, audit trail complet) et prêt pour une campagne commerciale.
