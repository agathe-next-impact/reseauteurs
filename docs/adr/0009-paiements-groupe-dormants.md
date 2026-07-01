# ADR-0009 — Paiements de groupe / affiliation : conservés DORMANTS (hors-MVP)

- **Statut :** Accepté
- **Date :** 2026-06-23
- **Décideurs :** Humain (product owner) + `solution-architect`
- **Portée :** facturation/affiliation, collection `groupes`, UI dashboard, crons, emails
- **Dépend de :** ADR-0001 (accès Payload), ADR-0003 (fusion Réseau), ADR-0004 (quota/abonnements)

## Contexte

L'existant porte une fonctionnalité complète d'**affiliation de groupe** : un compte « tête de groupe » crée un groupe avec un **code d'affiliation**, d'autres comptes le rejoignent, et des **remises Stripe par paliers** (coupons) s'appliquent automatiquement selon le nombre de membres. L'audit la mentionnait laconiquement (« Groupes — hors scope cible immédiat — à conserver inactif »), sans définition ni ADR. Cette ADR comble ce vide.

**Inventaire réel des actifs « groupe » (vérifié) :**

- Collection `src/collections/Groupes.ts` (codes `GRP-XXXXXX`, owner, membres, paliers de coupon Stripe, soft-delete ; visible en admin sous le groupe `Abonnement`).
- Logique métier `src/lib/groupes.ts` (`recalculerEtAppliquerPalier`, gestion des coupons Stripe).
- 5 routes `src/app/api/groupes/*` : `create`, `invite`, `join`, `leave`, `validate-code`.
- Cron `src/app/api/cron/retry-groupe-sync/route.ts` (resync des paliers/coupons).
- Composants dashboard `src/components/dashboard/Groupe*.tsx` : `GroupeBenefits`, `GroupeCreateForm`, `GroupeInviteForm`, `GroupeJoinForm`, `GroupeMemberView`, `GroupePromoCodeInput`.
- Templates email `src/lib/emails/templates/groupes.ts`.
- Champs sur `users` : `groupe` (relation), `pendingGroupeCode` (`Users.ts:478-499`) + hooks de resync `afterChange`/`afterDelete` (`Users.ts:127-176, 413-443`).
- Page dashboard `src/app/(frontend)/dashboard/groupe/page.tsx`.
- Script de diagnostic `src/scripts/diag-groupes.ts`.
- Migrations associées : `20260411_053500_plan_groupes`, `20260420_110000_audit_logs_add_groupe_sync_failed`, `20260420_130000_groupes_soft_delete`, `20260426_100000_audit_logs_add_groupe_lifecycle`, `20260426_110000_add_pending_groupe_code`.

Cette fonctionnalité est **orthogonale** au modèle Réseau→Occurrences et au quota d'occurrences/an (ADR-0004). Elle n'est pas un besoin du MVP réseaux-first, mais c'est du code production-grade testé : le supprimer serait une perte sèche et une migration de retrait risquée pour zéro gain.

## Décision

**Les paiements de groupe sont CONSERVÉS DORMANTS au MVP. Définition précise de « dormant » :**

1. **Conservation intégrale — rien n'est supprimé.** La collection `groupes`, `lib/groupes.ts`, les 5 routes `api/groupes/*`, le cron `retry-groupe-sync`, les composants `Groupe*`, les templates email groupe, les champs `users.groupe`/`pendingGroupeCode` + leurs hooks, et **toutes les migrations associées** restent en place. **Aucune migration de retrait**, aucun drop de colonne/table.

2. **Masquage de l'UI.** Aucun **point d'entrée** « créer / rejoindre un groupe » n'est exposé au MVP, ni dans l'UI publique ni dans le dashboard organisateur : la page `dashboard/groupe`, les CTA et les composants `Groupe*` ne sont **pas rendus / pas liés** depuis la navigation visiteur ou organisateur. Le masquage est cosmétique (retrait des points d'entrée), pas une suppression. La collection `groupes` **reste visible en admin Payload** (`admin.group: 'Abonnement'`) pour l'exploitation/support.

3. **`data-architect` ne touche pas aux groupes.** Lors de la fusion Réseau (ADR-0003), la collection `groupes` et ses migrations sont **laissées intactes** — elles sont orthogonales à la fusion `fournisseurs`+`organisateurs`→`reseaux`. Le champ `users.groupe` et `users.pendingGroupeCode` sont **conservés** lors de la conversion de l'enum `users.role`.

4. **`accounts-and-billing` ne recâble pas la logique groupe.** La logique de coupons/paliers groupe est **laissée telle quelle**, simplement **non exposée**. Elle **n'est pas** réimplémentée sur les nouveaux paliers (Accès/Développement/Premium, ADR-0004). **Contrainte d'isolation :** les coupons/remises de groupe **ne doivent pas interférer avec le quota d'occurrences/an** (ADR-0004) — le quota porte sur le nombre d'occurrences créées (12 mois glissants), totalement indépendant des remises de prix Stripe. `canCreateOccurrence` n'a aucune dépendance sur l'état groupe.

5. **Non-régression silencieuse.** Comme la collection et ses hooks restent actifs côté serveur (admin Payload peut toujours éditer un groupe), les hooks de resync (`recalculerEtAppliquerPalier`) restent fonctionnels pour l'exploitation. Ils ne sont déclenchés par aucun parcours utilisateur public (UI masquée), mais restent corrects si un admin manipule un groupe.

## Réversibilité (piste produit post-MVP)

Angle de réactivation identifié : **fédération** — une **tête de réseau** (fédération nationale, marque, organisme) qui **finance les sections locales** de son réseau (chaque section = un compte organisateur). Le mécanisme groupe (code d'affiliation + paliers de remise) se prête directement à ce cas. La réactivation consisterait à **ré-exposer les points d'entrée UI** et à **aligner les paliers de coupon** sur les nouveaux abonnements — sans reconstruire la logique (elle est conservée). **Non implémenté au MVP**, documenté pour mémoire.

## Conséquences

**Positives :**

- Aucune perte d'actif, aucune migration de retrait risquée.
- Périmètre MVP épuré (un seul parcours d'abonnement visible : 3 paliers individuels).
- Isolation claire vis-à-vis du quota d'occurrences (pas de couplage prix↔quota).
- Réactivation future peu coûteuse (ré-exposition UI + recalibrage coupons).

**Négatives / risques :**

- **Code dormant = dette latente** : la logique groupe n'est pas exercée par les parcours MVP, donc moins surveillée. Mitigation : tests existants conservés, collection visible en admin, et `qa-reviewer` vérifie qu'aucun point d'entrée groupe ne fuit dans l'UI MVP.
- Risque de **fuite d'un CTA groupe** dans l'UI si le masquage est incomplet → checklist `qa-reviewer`.
- Les champs `users.groupe`/`pendingGroupeCode` subsistent dans le schéma sans usage visible — assumé (réversibilité).

## Alternatives écartées

1. **Supprimer la fonctionnalité groupe (collection + code + migrations).** Écartée : perte d'un actif testé, migration de retrait risquée (drops de colonnes référencées par `users`, coupons Stripe), pour un besoin qui pourrait revenir (fédération). Contraire à l'esprit REFACTOR_IN_PLACE (récupérer le maximum d'actifs).
2. **Recâbler les groupes sur les nouveaux paliers dès le MVP.** Écartée : hors scope réseaux-first, ajoute de la complexité et un couplage prix↔quota non désiré au démarrage.
3. **Masquer aussi la collection en admin.** Écartée : l'admin doit pouvoir exploiter/diagnostiquer les groupes existants (support) ; seul le parcours utilisateur public/organisateur est masqué.
