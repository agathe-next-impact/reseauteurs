# ADR-0014 — Fiche nationale payante · réseaux locaux des réseauteurs Plus · événements par propriété

- **Statut : Accepté (2026-07-17)**
- Amende : ADR-0012 (§3 publication de la fiche conditionnée à l'abonnement, §hiérarchie parent optionnel,
  §quota palier) et la décision 2026-07-16 « admin déclaré » (remplacée par la propriété).

## Contexte

Trois évolutions produit demandées le 2026-07-17 :
1. la fiche d'un réseau national créée par son organisateur doit être payante (« petit abonnement ») ;
2. les réseauteurs Plus peuvent créer des fiches de réseaux locaux, affiliées à un national **ou
   indépendantes** ;
3. les réseauteurs Plus peuvent créer les événements des réseaux locaux dont ils sont **propriétaires** ;
4. si le national voulu n'existe pas, le réseauteur peut lui envoyer une **invitation par email**
   (adresse fournie par lui) à créer son compte organisateur.

## Décisions

### 1. Palier d'entrée « fiche » + publication payante
- Nouveau palier d'abonnement national **`fiche`** (0 groupe local) ajouté à `PALIERS_CONFIG` /
  `PALIERS_NATIONAL` (env `STRIPE_PRICE_NATIONAL_FICHE`). Prix réel : à créer dans Stripe (TODO PO,
  comme les autres paliers).
- La fiche nationale auto-créée au signup organisateur naît **`statut='suspendue'`** (invisible
  publiquement). **N'importe quel palier actif la publie** : le webhook Stripe
  (`activerReseauPartenaire`) pose `statut='publiee'` ; la désactivation (webhook + cron
  `downgrade-expires`) repasse en `suspendue` **les têtes `source='revendique'` uniquement**.
- Invariant réaffirmé : le statut payant/publication est posé **serveur** (webhook/cron), jamais par
  le client. L'email de suspension part via le hook `notifyOnSuspension` existant (transition only).

### 2. Réseaux locaux des réseauteurs Plus
- Un réseauteur Plus peut créer jusqu'à **`MAX_LOCAUX_PLUS = 3`** fiches de réseaux locaux depuis
  son espace **« Mes réseaux »** (`/dashboard/mes-reseaux`). Il en est **propriétaire**
  (`reseaux.user`) — l'index unique DB (`reseaux_user_tete_unique_idx`) n'exclut que les têtes,
  un compte peut posséder N locaux (aucune migration).
- **Réseau indépendant** : le `parent` d'un local devient **optionnel** (vide = indépendant).
  S'il est fourni, il doit être une tête (hiérarchie 2 étages inchangée). Un local indépendant a
  son marqueur carte et sa fiche SEO ; il n'apparaît pas dans l'annuaire des têtes (assumé V1).
- **Affiliation libre** (déclarative) au national choisi à la création, figée ensuite côté self-service ;
  l'admin corrige en back-office.
- **Quota palier du national** : seuls les locaux **possédés par le national** consomment le quota
  (`peutCreerLocalAsync` filtre `user = owner`). Les locaux affiliés par des Plus n'en consomment pas.
  Effet de bord assumé : un local délégué par l'admin sort aussi du décompte.

### 3. Événements par propriété (remplace l'« admin déclaré »)
- Gate de création d'un événement de réseau par un réseauteur : `niveau='local'` + **Plus actif**
  (lecture fraîche) + **`reseau.user === req.user.id`**. L'abonnement du national **ne s'applique
  pas** (même pour un local affilié) : c'est l'abonnement Plus qui couvre.
- Le mécanisme déclaratif `adminReseaux` (décision 2026-07-16) est **déposé** : gate, formulaire de
  déclaration (`/dashboard/plus`) et section publique « Admins du groupe » retirés. Le champ
  `reseauteurs.adminReseaux` reste **dormant** en DB (pas de migration destructive).
- La règle umbrella (ADR-0012 Q8) est conservée : le national garde la main sur les événements de
  ses locaux affiliés (avec, dans SA branche, le gate d'abonnement du national).

### 4. Invitation du réseau national absent
- Encadré dans « Mes réseaux » : nom du réseau + email → server action `inviterReseauNational`
  (Zod, rôle reseauteur + Plus frais, **rate limit 3/jour/compte**), envoi via la plomberie emails
  (`kind='invitation-national'`, lien `/inscription?type=organisateur`, le réseauteur invitant est cité).
- Trace `audit-logs` **`national_invited`** (hash user + nom du réseau + domaine email — jamais
  l'email en clair). Migration additive `20260717_100000` (enum audit_logs.type).

## Conséquences / asymétries assumées (V1)
- **Pas de rétro-migration** : les têtes revendiquées déjà publiées restent publiées ; seuls les
  nouveaux signups naissent suspendus. Une fiche claimée (née publiée) qui s'abonne puis annule
  finit suspendue.
- Les locaux d'un national suspendu restent publiés (statut propre).
- Double email possible à la suspension (fin d'abonnement + fiche dépubliée) — copie à harmoniser.
- Un Plus expiré garde l'édition de ses fiches locales ; seules les créations (réseaux, événements)
  sont re-gatées.
- Correctif au passage : le hook hiérarchie n'efface plus le parent d'un local lors d'un update
  partiel (bug `data.niveau ?? 'national'` → fallback sur `originalDoc.niveau`).
