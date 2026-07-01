# Multi-etablissements — Taches avant mise en production

## 1. Configuration Stripe Dashboard

### 1.1 Creer les 6 nouveaux Stripe Prices

| Produit | Type | Montant | Recurrence |
|---------|------|---------|------------|
| Pack 3 Standard | Flat | 188,73 EUR | Annuel |
| Pack 3 Premium | Flat | 404,73 EUR | Annuel |
| Pack 5 Standard | Flat | 297,08 EUR | Annuel |
| Pack 5 Premium | Flat | 637,08 EUR | Annuel |
| Pack 10+ Standard (par fiche) | Per unit | 55,92 EUR | Annuel |
| Pack 10+ Premium (par fiche) | Per unit | 119,92 EUR | Annuel |

> Les 2 prix Pack 10+ doivent etre configures en mode **per_unit** dans Stripe pour que la quantity fonctionne.

### 1.2 Ajouter les variables d'environnement

A ajouter dans `.env` local et dans Vercel (Settings > Environment Variables) :

```
STRIPE_PACK3_STANDARD_PRICE_ID=price_xxx
STRIPE_PACK3_PREMIUM_PRICE_ID=price_xxx
STRIPE_PACK5_STANDARD_PRICE_ID=price_xxx
STRIPE_PACK5_PREMIUM_PRICE_ID=price_xxx
STRIPE_PACK10_STANDARD_UNIT_PRICE_ID=price_xxx
STRIPE_PACK10_PREMIUM_UNIT_PRICE_ID=price_xxx
```

> Conserver les anciennes variables `STRIPE_STANDARD_PRICE_ID` et `STRIPE_PREMIUM_PRICE_ID` pour la compatibilite legacy.

---

## 2. Migration base de donnees

### 2.1 Generer la migration Payload

```bash
pnpm payload migrate:create multi-etablissements
```

### 2.2 Verifier le SQL genere

La migration doit contenir :
- Ajout des colonnes `pack_type`, `feature_level`, `fiche_quota` sur la table `users`
- Suppression de la contrainte unique sur `fournisseurs.user_id`
- Creation d'un index non-unique sur `fournisseurs.user_id`

### 2.3 Migration des donnees existantes

Executer le SQL suivant apres la migration de schema :

```sql
UPDATE users SET
  pack_type = CASE
    WHEN plan IN ('standard', 'premium') THEN 'pack3'
    ELSE 'gratuit'
  END,
  feature_level = CASE
    WHEN plan = 'premium' THEN 'premium'
    WHEN plan = 'standard' THEN 'standard'
    ELSE 'standard'
  END,
  fiche_quota = 1
WHERE pack_type IS NULL;
```

> Les utilisateurs existants avec un plan payant sont migres vers un pack3 avec 1 fiche (leur fiche existante). Ils conservent leur abonnement Stripe en cours.

### 2.4 Executer la migration

```bash
pnpm payload migrate
```

---

## 3. Tests manuels

### 3.1 Parcours gratuit
- [ ] Inscription nouveau compte → plan gratuit, 1 fiche auto-creee
- [ ] Dashboard affiche "Gratuit", quota 1/1
- [ ] Page fiches affiche la fiche unique
- [ ] Bouton "Ajouter une fiche" non visible (quota atteint)
- [ ] Banner "Souscrire un pack" visible

### 3.2 Parcours Pack 3 Standard
- [ ] Page abonnement : 6 cartes de packs visibles (3 Standard + 3 Premium)
- [ ] Clic "Souscrire" sur Pack 3 Standard → redirection Stripe Checkout
- [ ] Paiement OK → retour dashboard
- [ ] Webhook recoit `checkout.session.completed` → user mis a jour (packType=pack3, featureLevel=standard, ficheQuota=3)
- [ ] Fiche en attente auto-publiee
- [ ] Email de confirmation recu avec mention "Pack 3 Standard"
- [ ] Dashboard affiche "Pack 3 Standard", quota 1/3
- [ ] Creation 2eme fiche OK
- [ ] Creation 3eme fiche OK
- [ ] Tentative 4eme fiche → erreur "nombre maximum atteint"

### 3.3 Parcours Pack 5 Premium
- [ ] Upgrade depuis Pack 3 → ancienne subscription annulee
- [ ] Nouvelle subscription creee avec bon priceId
- [ ] ficheQuota passe a 5
- [ ] Champs Premium accessibles (description, galerie)
- [ ] Creation de fiches supplementaires OK jusqu'a 5

### 3.4 Parcours Pack 10+ extensible
- [ ] Souscription Pack 10 Premium avec quantity=10
- [ ] 10 fiches creables
- [ ] A 10 fiches : bouton "Ajouter une fiche (ajuste l'abonnement)" visible
- [ ] Clic → appel `/api/stripe/add-fiche` → quantity Stripe passe a 11
- [ ] ficheQuota en DB passe a 11
- [ ] 11eme fiche creable
- [ ] Verifier dans Stripe Dashboard que la subscription a bien quantity=11

### 3.5 Downgrade et annulation
- [ ] Annulation abonnement (cancel at period end) → banner reactivation visible
- [ ] A l'expiration : cron downgrade → packType=gratuit, ficheQuota=1
- [ ] Premiere fiche passe en "en-attente", fiches supplementaires suspendues
- [ ] Fiches suspendues non visibles sur la carte
- [ ] Re-souscription → fiches suspendues reactiver manuellement (admin)

### 3.6 Migration legacy
- [ ] Utilisateur existant avec plan=standard et pas de packType → fallback legacy fonctionne
- [ ] Dashboard Stripe sync : si packType=gratuit mais subscription active → sync automatique
- [ ] Webhook avec metadata legacy (plan=standard) → migration vers pack3

### 3.7 Carte et pages publiques
- [ ] Marqueurs GeoJSON corrects (gris=gratuit, couleur=payant)
- [ ] Page detail fournisseur `/revendeurs/[slug]` affiche les bonnes infos selon le niveau
- [ ] Plusieurs fiches du meme utilisateur apparaissent independamment sur la carte

---

## 4. Nettoyage post-migration (Phase 2)

A faire une fois la migration validee en production (attendre 1-2 semaines) :

### 4.1 Supprimer le champ `plan` legacy
- [ ] Retirer le champ `plan` de `src/collections/Users.ts`
- [ ] Supprimer le fallback legacy dans `getEffectiveFeatureLevel()`
- [ ] Supprimer `PLANS` et `PaidPlan` de `src/lib/stripe.ts`
- [ ] Supprimer `STRIPE_STANDARD_PRICE_ID` et `STRIPE_PREMIUM_PRICE_ID` des env vars
- [ ] Migration SQL : `ALTER TABLE users DROP COLUMN plan;`

### 4.2 Supprimer le composant legacy
- [ ] Supprimer `src/components/dashboard/UpgradeButton.tsx` (remplace par `PackCheckoutButton`)
- [ ] Supprimer la route redirect `src/app/(frontend)/dashboard/fiche/page.tsx`

### 4.3 Regenerer les types
```bash
pnpm generate:types
pnpm build
```

---

## 5. Communication

- [ ] Preparer un email aux utilisateurs existants expliquant la migration vers les packs
- [ ] Mettre a jour la page publique de tarification (si elle existe)
- [ ] Mettre a jour le CLAUDE.md avec la nouvelle structure de plans
