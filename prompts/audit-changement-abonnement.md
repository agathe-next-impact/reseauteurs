# AUDIT — Modification & annulation d'abonnement PanoramaPub.fr

## Mission

Analyser de bout en bout la fonctionnalité de **changement de plan** (upgrade/downgrade) et **d'annulation/réactivation** d'abonnement, sous trois angles :

1. **Montant à payer** — proration Stripe, remboursements, doubles débits, factures émises
2. **Fonctionnalités ouvertes** — à quel moment les droits changent (immédiat, fin de période, limbo), cohérence plan effectif
3. **UI** — le site permet-il concrètement à l'utilisateur de déclencher chaque action, avec feedback et sans ambiguïté

Ton factuel, audit non complaisant. Si une fonctionnalité manque dans l'UI alors que le backend la permet (ou inversement), c'est un finding.

## Contexte projet

- Stack : Next.js 16 + Payload CMS 3 + Stripe 20. Détails : [CLAUDE.md](CLAUDE.md).
- 3 plans annuels : Gratuit (0 €), Premium (99 €/an), Infinite (219 €/an).
- Coupons de groupe mutualisés (5/10/15 %).
- Stripe subscriptions annuelles, mode `cancel_at_period_end` privilégié pour l'annulation.

## Périmètre

### Backend — flux de changement de plan

- [src/lib/stripe.ts](src/lib/stripe.ts) — `PLANS`, `resolvePlanFromPriceId`
- [src/app/api/stripe/checkout/route.ts](src/app/api/stripe/checkout/route.ts) — gère-t-elle les upgrades ou uniquement les souscriptions initiales ?
- [src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts) — notamment la section qui annule les anciennes subscriptions après enregistrement de la nouvelle (lignes ~135-153)
- [src/app/api/stripe/cancel/route.ts](src/app/api/stripe/cancel/route.ts)
- [src/app/api/stripe/reactivate/route.ts](src/app/api/stripe/reactivate/route.ts)
- [src/collections/access.ts](src/collections/access.ts) — `getEffectiveFeatureLevel` et la logique `planExpiresAt`

### Frontend — UI exposée

- [src/app/(frontend)/dashboard/abonnement/page.tsx](<src/app/(frontend)/dashboard/abonnement/page.tsx>)
- [src/components/dashboard/PlanCheckoutButton.tsx](src/components/dashboard/PlanCheckoutButton.tsx)
- [src/components/dashboard/CancelSubscriptionButton.tsx](src/components/dashboard/CancelSubscriptionButton.tsx)
- [src/components/dashboard/ReactivateButton.tsx](src/components/dashboard/ReactivateButton.tsx)
- [src/components/ui/PlanBadge.tsx](src/components/ui/PlanBadge.tsx)

### Cron — downgrade automatique

- [src/app/api/cron/downgrade-expires/route.ts](src/app/api/cron/downgrade-expires/route.ts) — bascule à `gratuit` quand `planExpiresAt` est dépassé
- [src/app/api/cron/expiration-alertes/route.ts](src/app/api/cron/expiration-alertes/route.ts)

## Scénarios à analyser (exhaustif)

Pour chaque scénario : analyse statique du code + test actif local + validation UI.

### S1 — Upgrade Premium → Infinite

1. User déjà abonné Premium (sub Stripe active, `planExpiresAt` dans le futur)
2. User clique "passer à Infinite" sur `/dashboard/abonnement`
3. **Montant** : combien paie-t-il ? Stripe calcule-t-il un prorata (différence 219 − 99 = 120 € au prorata du temps restant) ? Ou paie-t-il 219 € complets (double facturation) ?
4. **Fonctionnalités** : les droits infinite sont-ils actifs immédiatement après paiement ? Le plan effectif en BD est-il mis à jour par le webhook ?
5. **UI** : existe-t-il un bouton explicite "Upgrader vers Infinite" distinct de "Souscrire Infinite" ? Le tarif affiché mentionne-t-il le prorata ?
6. **Ancienne sub** : est-elle annulée proprement ? Quand ? Risque de double prélèvement au renouvellement ?

**Point critique identifié dans le code** : [src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts) annule les anciennes subs _après_ avoir enregistré la nouvelle. Cela signifie-t-il que l'upgrade crée une **nouvelle subscription** au lieu de faire un `stripe.subscriptions.update()` avec changement d'item ? Si oui, **pas de prorata natif Stripe**, et le user paie 219 € alors qu'il lui restait par exemple 6 mois de Premium.

### S2 — Downgrade Infinite → Premium

1. User abonné Infinite
2. User veut repasser à Premium
3. **UI** : cette action est-elle même exposée ? Y a-t-il un bouton "rétrograder" ?
4. **Montant** : avoir ? crédit Stripe sur la prochaine facture ? Aucun remboursement (fin de période) ?
5. **Fonctionnalités** : perd-il l'accès infinite immédiatement ou à la fin de période ? Les événements déjà créés (quota 10) sont-ils supprimés ou restent-ils ? Les illustrations > limite premium ?
6. **Plan effectif** : `planExpiresAt` reflète-t-il correctement la date de bascule ?

### S3 — Downgrade Premium/Infinite → Gratuit (annulation)

1. User clique "annuler mon abonnement" → appelle `/api/stripe/cancel`
2. Stripe passe `cancel_at_period_end: true`
3. **Montant** : pas de remboursement, plus de facture au renouvellement. Vérifier.
4. **Fonctionnalités** : l'utilisateur garde ses droits jusqu'à `planExpiresAt`. Confirmer via `getEffectiveFeatureLevel`.
5. **UI** :
   - L'état "annulation programmée" est-il affiché clairement (date de fin, reactivate possible) ?
   - L'utilisateur sait-il qu'il conserve ses droits jusqu'à la date ?
   - Confirmation avant annulation ?
6. **Cron `downgrade-expires`** : à la date d'expiration, bascule à gratuit. Vérifier que l'email est envoyé et que le palier groupe est recalculé.

### S4 — Réactivation avant expiration

1. User avait annulé, veut réactiver avant la fin de période
2. Appelle `/api/stripe/reactivate` → `cancel_at_period_end: false`
3. **Montant** : pas de nouveau paiement, reprise normale au renouvellement
4. **UI** : bouton "réactiver" visible uniquement si `cancel_at_period_end === true` ? Feedback clair après action ?
5. **Webhook** : `customer.subscription.updated` met-il à jour l'état correctement ?

### S5 — Changement de plan pendant annulation en cours

1. User a annulé (cancel_at_period_end), change d'avis et veut passer à l'autre plan (pas juste réactiver)
2. Ex : Premium annulé + veut passer à Infinite
3. **UI** : ce cas est-il géré ? Ou l'utilisateur doit-il d'abord réactiver, puis upgrader ?
4. **Backend** : que se passe-t-il si le checkout est relancé pendant qu'une sub existe avec `cancel_at_period_end` ? Double sub ? Erreur ?

### S6 — Annulation/modification avec groupe

1. User dans un groupe (palier 5/10/15 %)
2. User annule son abonnement
3. **Coupon** : est-il retiré des autres membres si le palier chute ? Quand (immédiat, à l'expiration) ?
4. **`recalculerEtAppliquerPalier`** : est-il appelé au bon moment ?
5. **UI du groupe** : les autres membres voient-ils le nouveau palier ?

### S7 — Échec de paiement au renouvellement

1. Carte expirée, `invoice.payment_failed`
2. Stripe retry automatique selon config
3. Après épuisement des retries → `customer.subscription.deleted` → downgrade
4. **UI** : l'utilisateur est-il alerté ? Lien vers le portail Stripe pour update la carte ?
5. **Montant** : pas de charge, plan conservé jusqu'à suppression effective
6. Vérifier l'envoi du mail `payment-failed` dans [src/lib/emails.ts](src/lib/emails.ts)

### S8 — Double action rapide

1. User clique 2x "annuler" en < 1 s
2. User clique "annuler" puis "réactiver" en < 1 s
3. Vérifier idempotence (Stripe API est idempotente sur `update`), pas d'erreur 500 visible côté UI, pas de loader bloqué

## Questions précises à trancher

Pour chacune : **Oui / Non / Partiel** + preuve (code + ligne, ou capture de test actif).

### Montant

- Q1. Un upgrade Premium → Infinite utilise-t-il `stripe.subscriptions.update()` avec `proration_behavior` explicite, ou crée-t-il une nouvelle subscription (et donc facture le plein tarif) ?
- Q2. Le prorata proposé à l'utilisateur est-il **affiché avant confirmation** dans l'UI (preview de facture) ?
- Q3. Un downgrade donne-t-il lieu à un avoir Stripe, un crédit, ou rien (simple fin de période) ? Conforme à ce qui est affiché à l'utilisateur ?
- Q4. L'ancienne sub est-elle annulée _après_ confirmation de la nouvelle, et sans déclencher une facture immédiate ?
- Q5. En cas d'annulation, le montant restant dû est-il zéro (pas de charge future tant que non réactivé) ?
- Q6. Les coupons de groupe sont-ils correctement réappliqués après un changement de plan ?

### Fonctionnalités ouvertes

- Q7. Après paiement d'upgrade, `user.plan` et `planExpiresAt` sont-ils mis à jour dans le webhook `checkout.session.completed` ou `customer.subscription.updated` ? Délai entre paiement et activation des droits ?
- Q8. Pendant l'annulation programmée (`cancel_at_period_end: true`), `getEffectiveFeatureLevel` retourne-t-il bien le plan payant tant que `planExpiresAt` n'est pas atteinte ?
- Q9. Au downgrade (volontaire ou via cron), les données dépassant les limites du nouveau plan sont-elles : supprimées / masquées / conservées mais inaccessibles ? (illustrations, événements, description longue)
- Q10. Le JWT est-il rafraîchi après un changement de plan, ou le user doit-il se déconnecter/reconnecter pour voir ses droits mis à jour dans l'UI ?

### UI

- Q11. La page `/dashboard/abonnement` expose-t-elle un bouton clair pour **chaque** transition possible : souscrire, upgrader, downgrader, annuler, réactiver ?
- Q12. L'état actuel est-il affiché sans ambiguïté (plan, prochaine échéance, annulation programmée ou non, palier groupe appliqué) ?
- Q13. Avant une action destructive (annulation, downgrade), y a-t-il une confirmation avec impact explicite ("vous perdrez X à partir du Y") ?
- Q14. Après une action, l'UI se met-elle à jour immédiatement (optimistic ou re-fetch), ou faut-il rafraîchir la page ?
- Q15. Les erreurs API (Stripe down, rate limit, carte refusée) sont-elles affichées proprement ?
- Q16. Un utilisateur gratuit voit-il les 3 plans avec un CTA clair ? Un utilisateur Premium voit-il Infinite mis en avant et Gratuit caché/désactivé ?
- Q17. L'historique de factures Stripe est-il affiché et téléchargeable ?

## Méthodologie

### Phase 1 — Analyse statique

1. Lire chaque fichier du périmètre.
2. Tracer le flow précis pour S1-S8 (qui appelle qui, dans quel ordre, avec quels paramètres Stripe).
3. Identifier les `proration_behavior`, `cancel_at_period_end`, `billing_cycle_anchor`, `payment_behavior` passés aux appels Stripe.
4. Vérifier la correspondance webhook event type → mutation BD.

### Phase 2 — Tests actifs locaux

Prérequis : `.env.local` avec clés Stripe test, 2 comptes de test.

```bash
pnpm devsafe
pnpm stripe:listen
```

Pour chaque scénario S1-S8 :

1. Créer l'état initial (signup, subscribe via `4242 4242 4242 4242`)
2. Exécuter l'action depuis l'UI
3. Observer :
   - Réseau DevTools : requêtes API + réponses
   - Stripe Dashboard (test mode) : subscriptions, invoices, customer events
   - BD Payload : `user.plan`, `planExpiresAt`, `stripeSubscriptionId`
   - Logs serveur (`pnpm devsafe` terminal + `stripe:listen` terminal)
4. Documenter : capture d'écran UI + extrait de logs + état BD avant/après

### Phase 3 — Validation UI

Pour chaque transition (souscrire, upgrader, downgrader, annuler, réactiver) :

- Est-elle atteignable depuis `/dashboard/abonnement` sans manipulation d'URL ni console ?
- Temps entre clic et feedback < 2 s ?
- Message d'erreur lisible en cas d'échec ?
- État post-action reflète la réalité Stripe + BD ?

## Format du rapport

Fichier : `audits/changement-abonnement-YYYY-MM-DD.md`.

### Structure

```markdown
# Audit changement & annulation d'abonnement — YYYY-MM-DD

## Résumé exécutif

- Transitions couvertes par l'UI : [N/M] (liste des manquantes)
- Montants Stripe corrects : Oui / Non / Partiel
- Activation des droits cohérente : Oui / Non / Partiel
- Verdict : prêt prod / bloquant / améliorations recommandées

## Matrice des transitions

| Transition             | UI expose | Backend OK | Montant correct | Droits cohérents | Finding |
| ---------------------- | --------- | ---------- | --------------- | ---------------- | ------- |
| Gratuit → Premium      |           |            |                 |                  |         |
| Gratuit → Infinite     |           |            |                 |                  |         |
| Premium → Infinite     |           |            |                 |                  |         |
| Infinite → Premium     |           |            |                 |                  |         |
| Premium → Gratuit      |           |            |                 |                  |         |
| Infinite → Gratuit     |           |            |                 |                  |         |
| Annulation programmée  |           |            |                 |                  |         |
| Réactivation           |           |            |                 |                  |         |
| Changement avec groupe |           |            |                 |                  |         |

## Réponses aux 17 questions

Q1. ... — Oui/Non/Partiel — preuve
Q2. ...

## Findings
```

### Template d'un finding

```markdown
#### AUD-001 — [Titre]

- **Sévérité** : Critique | Élevée | Moyenne | Faible | Info
- **Catégorie** : Montant | Droits | UI | Bug confirmé | Risque
- **Scénario concerné** : S1 / S2 / ...
- **Fichier** : [path:ligne](path#Lxx)
- **Description** : observation factuelle
- **Reproduction** : étapes exactes (local ou via code)
- **Impact utilisateur** : double facturation / perte d'accès / confusion
- **Recommandation** : direction de fix, pas de code complet
- **Effort** : S | M | L
```

## Contraintes

- Toute affirmation sur un montant doit être confirmée par un test actif (Stripe dashboard en test mode) ou par les flags Stripe explicitement passés dans le code.
- Toute affirmation sur l'UI doit être vérifiée dans le navigateur, pas uniquement par lecture de code.
- Citer fichier + n° de ligne pour chaque finding.
- Distinguer bug confirmé / risque / amélioration.
- Français, ton factuel, zéro emoji.
- Si une transition n'est pas exposée dans l'UI, c'est un finding même si le backend la supporte.

## Auto-vérification avant rendu

- [ ] Matrice des 9 transitions renseignée intégralement
- [ ] Les 17 questions ont une réponse explicite avec preuve
- [ ] Chaque scénario S1-S8 a été testé activement
- [ ] Les montants annoncés ont été confrontés au Stripe dashboard test
- [ ] L'UI a été navigée dans un vrai navigateur (pas seulement lue dans le code)
- [ ] Chaque finding critique a une reproduction concrète
