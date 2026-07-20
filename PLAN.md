# PLAN.md — RÉSEAUTEURS

> Plan d'exécution. Réaligné le **2026-06-28** sur le modèle à trois entités (ADR-0011), puis **étendu le
> 2026-06-30** par le plan d'évolution **ADR-0012** (hiérarchie réseaux national↔local, abonnement national,
> locaux délégables, suppression de l'événement Premium, deux pages à bascules).
>
> **Règle d'or (CLAUDE.md §13) :** la phase `data-architect` (schéma + migrations + `MIGRATION.md`) **précède**
> toute implémentation feature. `qa-reviewer` est le **gate final**. La **simplicité (< 30 s) est un critère à
> chaque gate.**
>
> **Structure de ce document :**
> - **Partie A — Base V1 (ADR-0011)** : jalons J1→J4. **Référence** (collections déjà échafaudées, commits « v1 »).
> - **Partie B — Évolution ADR-0012** : jalons E1→E4. **Plan forward actif** à exécuter après le gate humain ADR-0012.
> - **Partie D — Évolution ADR-0013** : jalons P1→P4. **Plan forward actif** (Réseauteur Plus + licences
>   partenaires) — **gate P0 tranché le 2026-07-12**, P1 peut démarrer.
> - **Partie C — Questions ouvertes (gate humain ADR-0012)** : autorité pour les points à trancher.

> ---
> ### ⚠️ ENCART D'AMENDEMENT CONSOLIDÉ — ADR-0014 → 0016 (2026-07-17 / 2026-07-20)
>
> **État réel du build (2026-07-20) :** les **phases 0→4 sont construites** — la **V1 à 3 entités** (Parties A/B/D)
> est livrée et en place. Ce document sert désormais de **référence d'évolution + support de vérification**, non
> de backlog à exécuter. **Seule dépendance PO en suspens :** brancher les **vrais Price Stripe** (les env vars
> `STRIPE_PLUS_PRICE_ID`, `STRIPE_PRICE_NATIONAL_FICHE/_STARTER/_GROWTH/_ENTERPRISE` pointent encore des
> placeholders — sans Price réel à 39 € HT/paliers, le checkout facture un montant erroné).
>
> Trois ADR postérieurs à la rédaction de ce plan (0014-0016) **amendent** les Parties B et D. Résumé et
> localisation des corrections :
>
> - **ADR-0014 (2026-07-17) — fiche nationale payante · locaux des Plus · événements par propriété.** Amende la
>   **Partie B** : l'abonnement réseau national n'est plus un produit unique mais **4 paliers**
>   (`fiche`/`starter`/`growth`/`enterprise`, capacités locaux 0/5/25/999 — `PALIERS_CONFIG` de
>   `lib/reseau-hierarchie.ts`). La **fiche d'une tête revendiquée (`source='revendique'`) naît `suspendue`** et
>   n'est **publiée que par l'abonnement** (webhook ; expiration → re-suspendue ; fiches `importe` épargnées).
>   La **délégation admin (Q2)** est **déposée/dormante** : elle est remplacée par la **propriété** — un
>   **réseauteur Plus possède jusqu'à `MAX_LOCAUX_PLUS = 3` locaux** (affiliés à une tête OU indépendants) créés
>   depuis « Mes réseaux » et **publie leurs événements** (gate = `niveau='local'` + Plus actif +
>   `reseau.user === caller`). Le quota de palier n'est consommé que par les locaux **possédés par le national**.
>   Les gates raisonnent **« tête (non-local) vs local »** via `estTete()`. Voir E1.2 / E1.5 / E2.A (amendés en place).
> - **ADR-0015 (2026-07-17) — suppression des packs de licences « Réseauteur Plus ».** Amende la **Partie D** :
>   les **packs 10/50/100 + code promo** (jalons P1.2, P2.A activation, P2.B section partenaire) ont été **livrés
>   puis RETIRÉS** — checkout pack, route d'activation (`/api/licences/activer` → **410 Gone**), UI et sections
>   d'affiliation supprimées. Le **Réseauteur Plus s'obtient désormais uniquement par abonnement individuel**
>   (`users.plusSource='abonnement'` ; `'licence'` = **legacy en extinction, lecture seule**). Collections
>   `licences-packs`/`licences-activations` **dormantes** (`admin.hidden`) ; cron `expiration-plus` éteint les
>   Plus « licence » restants. Le **partenaire annonceur** ne conserve QUE son abonnement de visibilité + son offre.
> - **ADR-0016 (2026-07-20) — gestion complète de l'abonnement en libre-service, tous rôles.** **Livré** :
>   **hub unique `/dashboard/abonnement`** (réseauteur Plus / organisateur / partenaire) ; résolveur commun
>   `src/lib/abonnement.ts` (`resolveAbonnement` → `AbonnementContext` unifiant les 3 porteurs Stripe `users` /
>   `reseaux` national / `partenaires` ; `fetchLiveStripeState` tolérant aux pannes) ; brique UI partagée
>   `src/components/billing/AbonnementManager.tsx` (souscrire / changer de palier / annuler / réactiver / portail /
>   factures) ; **`cancel`/`reactivate` généralisées aux 3 produits** + route `POST /api/stripe/change-palier`
>   (proration + **garde anti-downgrade** si `maxLocaux(nouveauPalier) < locaux possédés`). `change-plan` /
>   `preview-change-plan` restent **410 Gone**. Factures (`/dashboard/factures`) ouvertes à tout rôle souscripteur
>   avec `stripeCustomerId`. Invariant §11 préservé (statut serveur/webhook ; les actions pilotent Stripe).
> ---

---

## 0. Légende

- **Owner** : `data-architect`, `frontend-builder`, `map-engineer`, `accounts-and-billing`, `seo-engineer`,
  `qa-reviewer`.
- **[SÉRIALISÉ]** : chemin critique / haut risque, finit avant ses dépendants.
- **[PARALLÈLE]** : avance en concurrence une fois ses dépendances levées.
- **Done** : critères d'acceptation vérifiables.

---

# Partie A — Base V1 (ADR-0011) — RÉFÉRENCE

> Jalons J1→J4 du build initial à 3 entités. Conservés pour traçabilité. Les collections `reseauteurs`,
> `evenements`, `reseaux`, `partenaires` sont **échafaudées**. **L'évolution ADR-0012 (Partie B) reprend à
> partir de cet état** et l'amende.

Jalons : **J1 Fondations (schéma) → J2 Chantiers parallèles → J3 Intégration → J4 QA/Gate.**

### J1 — Fondations : schéma & migration  [SÉRIALISÉ]  ·  Owner : `data-architect`
- J1.1 PostGIS & `geom` sur `reseauteurs`+`evenements` ; index GiST ; centroïde ville réseauteurs.
- J1.2 Collection `reseauteurs` (neuve) + référentiels (`categories`, `badges`) + M2M réseaux + badge dérivé.
- J1.3 `evenements` simplifié (`lienInscription`, ~~`premium`~~) + `reseaux` (entité+taxonomie) + `partenaires`.
- J1.4 `users` (3 rôles) + RGPD repointé.
- J1.5 Re-migration `0623` + redirections 301. ⚠️ `down()` `120000` destructif — dry-run + gate humain.

### J2 — Chantiers parallèles  [PARALLÈLE après J1]
- J2.A Comptes & monétisation B2B — `accounts-and-billing`.
- J2.B Deux cartes & géo — `map-engineer`.
- J2.C Frontend, recherche & design — `frontend-builder`.
- J2.D SEO & contenu — `seo-engineer`.

### J3 — Intégration  [SÉRIALISÉ après J2]  ·  J4 — QA & gate  [SÉRIALISÉ final]  ·  Owner : `qa-reviewer`

> Détail complet conservé dans l'historique git de ce fichier. **La Partie B prévaut** là où elle amende
> ces jalons (Premium, hiérarchie réseaux, pages à bascules, gate de publication).

---

# Partie B — Évolution ADR-0012 — PLAN FORWARD ACTIF

> Découle de `docs/adr/0012-...md` + `ARCHITECTURE.md` (encart d'amendement). **Gate humain ADR-0012** en
> sortie de E1 (schéma hiérarchie + drop Premium + questions §Partie C). Aucune implémentation E2 avant ce gate.

Jalons : **E1 Schéma (hiérarchie + drop Premium) → E2 Chantiers parallèles → E3 Intégration → E4 QA/Gate.**

---

## E1 — Schéma : hiérarchie réseaux, drop Premium, recalibrage gate  [SÉRIALISÉ]

> **Owner : `data-architect`.** Gate humain en sortie (re-migration + drop colonnes destructif). Aucune
> feature E2 avant la fin de E1.

### E1.1 `reseaux` — hiérarchie national↔local
> ► **Amendé ADR-0014.** `niveau` livré à **4 valeurs** (`local/regional/national/international`) et non
> `{national, local}` : la **tête** = tout niveau **non-local** (`estTete()` de `lib/reseau-hierarchie.ts`), le
> **groupe** = `local` (terme UI « chapitre » banni). Ajoutés aussi : `source` (`revendique`/`importe`) et
> `statut` (`publiee`/`suspendue`) — une tête revendiquée **naît `suspendue`** (cf. E2.A).
- Ajouter **`niveau`** (enum `{national, local}`) + **`parent`** (self-relationship N-1).
- Validation serveur (hook) : `local` ⇒ `parent` requis **et** `parent.niveau === 'national'` ; `national` ⇒
  `parent` null ; **2 niveaux max**. Garde `beforeDelete` étendu : un national avec locaux n'est pas supprimable.
- **Done** : on crée un national, puis un local sous lui ; tenter un local sans parent → refus FR ; tenter un
  parent local (3ᵉ niveau) → refus FR ; supprimer un national avec locaux → refus FR.

### E1.2 Unicité propriété — « 1 user = au plus 1 national »
> ► **Amendé ADR-0014.** La « table de config métier » ci-dessous est **livrée** : `PALIERS_CONFIG` à **4 paliers**
> `fiche/starter/growth/enterprise` → capacités locaux **0 / 5 / 25 / 999**. `maxLocaux(palier)` en découle.
> **Le quota n'est consommé que par les locaux possédés par le national** (`peutCreerLocalAsync` filtre
> `user=owner`) : les locaux d'un **réseauteur Plus** (cf. E2.A amendé, `MAX_LOCAUX_PLUS=3`) ne le grèvent pas.
- Remplacer l'index partiel unique `reseaux.user WHERE user_id IS NOT NULL` par
  **`WHERE niveau='national'`**. Pas d'unicité sur `local.user`.
- Recalibrer `canCreateReseau` → `canCreateNational` (1 national/user) + `peutCreerLocal(user)` (national
  abonné **et sous la capacité de son palier**). Helpers centralisés dans `lib/reseau-hierarchie.ts` :
  `nationalDe`, `abonnementActif`, `maxLocaux`, `peutCreerLocal`, `peutPublierEvenement`, `peutGererReseau`,
  `peutGererEvenement`.
- **Palier (Q5)** : ajouter sur le national un champ **palier** (ou réutiliser `stripePriceId` comme source)
  posé par webhook ; `maxLocaux(palier)` lit une table de config métier (seuils/prix à fournir avant E2.A).
  `peutCreerLocal` refuse (FR) la création d'un local au-delà de la capacité du palier.
- **Done** : un user ne peut posséder 2 nationaux (refus DB+serveur) ; un national possède N locaux dans la
  limite de son palier (refus FR au dépassement) ; les helpers sont unit-testés
  (national/local/délégué/admin + capacité palier).

### E1.3 `evenements` — suppression du Premium
- **Drop** des colonnes `premium` et `stripeCheckoutSessionId` (migration ; `down()` documenté, dry-run).
- Remplacer le gate `if (!reseau.partenaire) throw` par `if (!peutPublierEvenement(reseau)) throw`
  (= `nationalDe(reseau).partenaire`), création **et** réassignation de réseau.
- **Done** : un événement attaché à un **local** dont le **national est abonné** se publie ; si le national
  n'est pas abonné → refus FR ; plus aucune référence `premium`/`stripeCheckoutSessionId` dans le schéma.

### E1.4 `reseauteurs` — affiliation « locaux only »
- Validation serveur : `reseauxFrequentes` refuse tout réseau `niveau='national'` (message FR).
- Dérivation du **national** d'un réseauteur (lecture : distinct des `parent` de ses locaux) — exposée pour
  fiche/filtre, **non stockée**.
- **Done** : cocher un national en affiliation → refus ; cocher un local → OK ; la fiche réseauteur affiche
  le(s) national(aux) dérivé(s).

### E1.5 `users` — auto-création & délégation admin
> ► **Amendé ADR-0014.** Le mécanisme de **délégation admin** (`reseauteurs.adminReseaux`) est **déposé/dormant** :
> il est **remplacé par la propriété** `reseaux.user`. Un **réseauteur Plus crée et possède jusqu'à
> `MAX_LOCAUX_PLUS = 3` locaux** (affiliés à une tête OU **indépendants**, `parent` optionnel) depuis
> « Mes réseaux » (`/dashboard/mes-reseaux`) et **publie leurs événements** (gate = `local` + Plus actif +
> `reseau.user === caller` ; c'est l'abonnement **Plus** qui couvre, pas celui du national). Un national absent
> peut être **invité par email** (`inviterReseauNational`, rate-limit 3/j). Lire « délégué » ci-dessous comme
> **« propriétaire du local »**.
- Auto-création signup : un `organisateur` auto-signé crée un réseau **`niveau='national'`** (et non plat).
- **Délégation (admin — Q2)** : la délégation d'un local se fait par **réassignation admin de `local.user`**
  (back-office Payload / action admin), **pas** par invitation self-serve. Réutiliser le pattern claim-flow
  (`req.context`) pour qu'un compte `organisateur` **destiné à un local** n'auto-crée **pas** de national.
- **Done** : nouvel organisateur auto-signé → 1 national créé ; un compte délégué assigné par l'admin à un
  local n'a **aucun** national ; il ne peut ni créer de local ni souscrire.

### E1.6 Migration des données existantes
- `reseaux` existants : `niveau` **= `national`** par défaut (proposé — §Partie C) ; `parent` null.
- Remap/purge des affiliations existantes pointant vers des lignes devenues `national` (impact faible :
  `reseauteurs` neuf). Sort des champs `partenaire`/`stripeSubscriptionId` sur d'éventuels locaux importés.
- Redirections **301** : `/carte/reseauteurs` → `/reseauteurs?vue=carte` ; `/carte/evenements` →
  `/evenements?vue=carte`. (Sort de `/reseaux` index = §Partie C.)
- **Done** : dry-run rejoué 2× sans divergence ; rollback testé ; 0 perte ; lignes existantes valides sous les
  nouveaux invariants ; 301 couvrent les `/carte/*`.

**Artefacts E1** : migrations + helpers `lib/reseau-hierarchie.ts` + `MIGRATION.md` mis à jour + **levée des
questions §Partie C**. **GATE HUMAIN ADR-0012.**

---

## E2 — Chantiers parallèles  [PARALLÈLE après E1]

### E2.A — Comptes, délégation & monétisation national  ·  Owner : `accounts-and-billing`  [PARALLÈLE]
Dépend de : E1.1/E1.2 (hiérarchie+propriété+palier), E1.3 (gate), E1.5 (délégation admin).
> ► **Amendé ADR-0014/0016.** Les **4 paliers** sont livrés : `STRIPE_PRICE_NATIONAL_FICHE/_STARTER/_GROWTH/_ENTERPRISE`
> (**vrais Price = TODO PO**, placeholders). Le palier **`fiche`** publie la fiche sans droit de groupe local ; la
> **fiche d'une tête revendiquée naît `suspendue`** et n'est **publiée** (`statut='publiee'`) que par le webhook
> d'activation (`activerReseauPartenaire`) ; **expiration → re-`suspendue`** (webhook + cron `downgrade-expires`),
> les fiches `importe` épargnées. Le **changement de palier** passe par la route unifiée **`POST /api/stripe/change-palier`**
> (proration + garde anti-downgrade) du hub `/dashboard/abonnement` (**ADR-0016**), pas par une UI ad hoc.
- **Abonnement réseau national par paliers (Q5)** : Subscription Stripe posée sur le national, **plusieurs
  produits/prix** (paliers indexés sur le nombre de locaux) → webhook pose `national.partenaire` actif +
  **palier** (+ `stripeSubscriptionId`, `partenaireExpireAt`). Changement de palier (upgrade/downgrade) géré.
  Customer Portal + factures conservés. **Seuils/prix = config métier à fournir avant ce chantier.**
- **Suppression Premium one-shot** : retirer la route Checkout one-shot, le webhook one-shot, l'UI « mettre en
  avant », les libellés Premium.
- **Annonceur** : Subscription `partenaires` **inchangée**.
- **Délégation (admin — Q2)** : action **admin** de réassignation de `local.user` (pas d'invitation self-serve
  en V1). Dashboard national → créer/gérer ses locaux (dans la limite du palier) + abonnement. Dashboard
  délégué : son local + ses événements uniquement (`peutGererReseau`). Le national garde la main (umbrella, Q8).
- Gate publication : **toujours** via `peutPublierEvenement` (national effectif), jamais via le client.
  Gate création de local : `peutCreerLocal` (abonné **et** capacité palier).
- **GROUPES DORMANTS (ADR-0009)** : UI masquée, logique non recâblée (la hiérarchie ne réactive pas les coupons).
- **Done** : un national non abonné ne peut ni créer de local ni publier d'événement (refus FR) ; au-delà de la
  capacité de son palier, la création de local est refusée (FR, invite à monter de palier) ; après paiement
  (webhook), il peut créer/publier **et ses locaux aussi** ; un délégué (assigné par l'admin) ne voit/édite que
  son local ; aucun reliquat Premium (route/UI/webhook) ; réseauteurs 100 % gratuits ; tests critiques verts.

### E2.B — Cartes & géo (réseaux locaux, retrait Premium)  ·  Owner : `map-engineer`  [PARALLÈLE]
Dépend de : E1.1 (hiérarchie), PostGIS sur `reseaux`.
- **Nouvelle route** `/api/geo/reseaux` : marqueurs = réseaux **`niveau='local'`** (centroïde ville), bbox/rayon
  + filtres (national parent, catégorie), **Zod**, Drizzle paramétré, sortie **GeoJSON**.
- **Carte des événements** : **retirer** la branche marqueur/couleur **Premium** → un seul type de marqueur.
- Intégrer les vues carte dans les **pages à bascules** (réseauteurs ↔ réseaux ; événements). Clusters,
  recherche ville / autour de moi, **mobile-first** (bottom-sheet).
- **Done** : la vue carte « réseaux » affiche les locaux (pas les nationaux) ; filtrer par national restreint
  aux locaux du parent ; carte événements sans marqueur Premium ; `EXPLAIN` confirme GiST sur les 3 sources ;
  bottom-sheet OK à ~380px.

### E2.C — Frontend : 2 pages à bascules + dashboards national/local  ·  Owner : `frontend-builder`  [PARALLÈLE]
Dépend de : E1.* (schéma), `DESIGN.md`.
- **Page combinée « Réseauteurs et réseaux »** (`/reseauteurs` préselect réseauteurs ; `/reseaux` préselect
  réseaux — même composant) : **bascule entité** (navigation entre les 2 URLs) + **bascule vue** (carte ↔
  annuaire) `?vue=` + **filtres** (query, deep-linkables) appliqués aux 2 entités et aux 2 vues.
  - Entité réseaux : annuaire = **nationaux (logos + compteurs agrégés)** ; carte = **locaux** ; filtre par
    national.
- **Page « Événements »** (`/evenements`) : bascule vue **carte (à venir) ↔ agenda (grille)** + filtres.
- **Dashboards** : national (fiche + **gestion des locaux** + **délégation** + abonnement + événements) ;
  local délégué (1 local + ses événements) ; réseauteur (profil + affiliation **locaux**). Coquilles billing
  remplies par E2.A.
- **Fiches SSR inchangées** ; fiche réseau **local** affiche son **national** (lien) ; fiche national affiche
  ses locaux + compteurs agrégés.
- **Done** : bascules entité/vue fonctionnelles et deep-linkables ; filtres synchro liste↔carte↔URL ; parcours
  « compris en < 30 s » (revue ~380px + desktop) ; a11y (bascules au clavier, focus) ; aucun reliquat « mettre
  en avant »/Premium.

### E2.D — SEO & contenu (canonical bascules, parentOrganization)  ·  Owner : `seo-engineer`  [PARALLÈLE]
Dépend de : E1.6 (301), E1.1 (hiérarchie).
- **Fiches inchangées** (capital SEO) : ne pas re-slugifier. JSON-LD `Organization` d'un **local** référence
  son **national** via `parentOrganization`.
- **Pages à bascules** : `/reseauteurs` et `/reseaux` **self-canonical** ; **état `?vue=`/filtres non
  canonicalisé** (canonical épuré) ; éviter le duplicate content.
- **301** : `/carte/*` → bascules. Sort de `/reseaux` index (landing vs 301) appliqué selon §Partie C.
- Maillage interne : proximité / même métier / même réseau / **même national**. Sitemap des fiches indexables
  (opt-out + `noindex` non-validés respectés).
- **Done** : JSON-LD valide (Rich Results) ; `parentOrganization` présent sur les locaux ; canonical correct
  sur les bascules ; chaque `/carte/*` → 301 ; sitemap propre.

---

## E3 — Intégration  [SÉRIALISÉ après E2]

- **Hiérarchie bout en bout** : national → crée locaux → délègue → délégué publie un événement (gate national)
  → l'événement apparaît sur la carte événements et sur la fiche du national (compteur agrégé).
- **Monétisation** : webhook nationale → `partenaire` actif → déblocage locaux + publication (cohérent UI/DB) ;
  expiration → re-gate.
- **Recherche × cartes** : mêmes filtres (national, niveau, badge, ville…) alimentent annuaire et marqueurs.
- **Rebranding final** : purge des reliquats Premium et des libellés caducs.
- **Done** : parcours visiteur (page combinée → bascules → fiche) et parcours national/délégué (abonnement →
  locaux → délégation → publier) fonctionnent en staging.

---

## E4 — Vérification & gate  [SÉRIALISÉ — final]  ·  Owner : `qa-reviewer`

> Artefact : `docs/qa/REVIEW-<date>.md`.

Checklist (delta ADR-0012, en sus de la base) :
- **Hiérarchie** : 2 niveaux respectés ; affiliation **locaux only** ; unicité `WHERE niveau='national'` ;
  garde suppression national-avec-locaux.
- **Monétisation** : avantages (création locaux, publication événements) accordés **uniquement** sur
  `nationalDe(reseau).partenaire` (statut serveur) ; **réseauteurs 100 % gratuits** ; **aucun reliquat
  Premium** (champ, route Checkout one-shot, webhook, marqueur, UI).
- **Délégation** : délégué strictement borné à son local ; national umbrella OK ; révocation OK.
- **Cartes** : marqueurs réseaux = **locaux** ; un seul type de marqueur événement ; GiST utilisé (3 sources).
- **SEO** : fiches inchangées ; canonical bascules ; `parentOrganization` ; 301 `/carte/*` ; opt-out/`noindex`.
- **Données** : migration rejouable, rollback testé, 0 perte ; `groupes` intactes (ADR-0009).
- **Sécurité/a11y** : CSP sans Mapbox ; Zod serveur (rôle/propriété/niveau/parent jamais déduits du client) ;
  webhooks signés ; bascules accessibles clavier.
- **Tests** : suite verte ; nouveaux tests (hiérarchie, affiliation locaux-only, gate national effectif,
  délégation, géo réseaux-locaux, absence Premium, canonical bascules).

**Done E4 / GATE HUMAIN FINAL** : REVIEW signé → merge autorisé.

---

## Récapitulatif des dépendances (ADR-0012)

```
E1 data-architect ──┬──▶ E2.A accounts-and-billing (abo national + délégation + drop Premium) ─┐
   [SÉRIALISÉ]      ├──▶ E2.B map-engineer (réseaux-locaux + retrait Premium)                  ├──▶ E3 ──▶ E4 qa
   GATE HUMAIN      ├──▶ E2.C frontend (2 pages à bascules + dashboards national/local)         │   [SÉR.]   [gate]
   ADR-0012         └──▶ E2.D seo-engineer (canonical bascules + parentOrganization + 301)      ┘
                         [E2.A/B/C/D PARALLÈLES]
```

| Chantier | Owner | Dépend de | Parallélisable | Risque |
|---|---|---|---|---|
| E1.1 hiérarchie niveau/parent | data-architect | — | non | moyen |
| E1.2 unicité « 1 national » + helpers | data-architect | E1.1 | non | moyen |
| E1.3 drop Premium + gate effectif | data-architect | E1.1 | non | **élevé** (drop colonnes) |
| E1.4 affiliation locaux-only | data-architect | E1.1 | non | faible |
| E1.5 auto-create national + flow délégué | data-architect | E1.1/2 | non | moyen |
| E1.6 migration données + 301 | data-architect | E1.1→5 | non | **élevé** (re-migration) |
| E2.A abo national + délégation + drop Premium UI | accounts-and-billing | E1.1/2/3/5 | oui | moyen |
| E2.B cartes réseaux-locaux + retrait Premium | map-engineer | E1.1 | oui | moyen |
| E2.C 2 pages à bascules + dashboards | frontend-builder | E1.* | oui | moyen |
| E2.D SEO canonical bascules + parentOrg | seo-engineer | E1.6/1.1 | oui | faible |
| E3 intégration | tous | E2.* | non | moyen |
| E4 QA | qa-reviewer | E3 | non | gate |

> **À conserver tel quel** : pipeline Stripe **Subscriptions** (checkout abo/portal/webhooks/factures),
> machinerie SEO multi-types (JSON-LD/sitemap/robots/ISR), Payload Auth, claim-flow (réemployé pour la
> délégation), crons, RGPD, géocodage data.gouv, carte/PostGIS, CSP/headers/rate-limit. **Groupes dormants
> (ADR-0009).** L'ADR-0012 **étend** et **retire le Premium** ; elle n'assainit pas le reste.

---

# Partie C — Décisions du gate humain ADR-0012  ·  TRANCHÉ le 2026-06-30

> Les huit points ci-dessous ont été **tranchés par l'humain (product owner) le 2026-06-30**. Ils constituent
> désormais le **contrat** pour E1/E2. Deux décisions **changent le défaut** proposé (Q2, Q5) — voir la colonne.

| # | Question | **Décision retenue** | Note d'implémentation |
|---|---|---|---|
| Q1 | Rôle dédié vs niveau dérivé | **Niveau dérivé** (pas de 4ᵉ rôle) | national = possède un `niveau=national` ; pas de migration d'enum. |
| Q2 | Mécanisme de délégation d'un local | **Assignation par l'admin** ⚠️ *change le défaut* | Pas d'invitation email self-serve en V1. L'admin réassigne `local.user` (back-office Payload / action admin). Claim-flow réutilisé pour qu'un compte délégué `organisateur` n'auto-crée **pas** de national. Invitation self-serve = évolution future. |
| Q3 | Sort des routes index `/reseauteurs` `/reseaux` | **Deux landing self-canonical** | Bascule entité = navigation entre les 2 URLs ; `/carte/*` → 301. |
| Q4 | Niveau par défaut des `reseaux` existants | **`national`** + remap/purge des affiliations | Impact faible (`reseauteurs` neuf). |
| Q5 | Abonnement national : prix unique ou paliers | **Paliers selon la taille** ⚠️ *change le défaut* | Paliers indexés sur le **nombre de locaux**. Schéma E1 : champ **palier** (ou `stripePriceId`) sur le national. Billing E2.A : produits/prix Stripe multiples + `maxLocaux(palier)` + gate de capacité sur `peutCreerLocal` (refus FR au dépassement). **Seuils/prix = config métier à fournir avant E2.A.** |
| Q6 | Champs `partenaire`/`stripeSubscriptionId` sur locaux importés | **Inertes sur les locaux** | Significatifs au national uniquement ; clear/ignore sur les locaux. |
| Q7 | Agrégation des compteurs nationaux | **À l'affichage SSR** (somme des locaux) | Pas de hook d'agrégation stocké. |
| Q8 | Droit du national sur les événements d'un local délégué | **Umbrella** (le national garde la main) | `peutGererReseau` conserve la 3ᵉ ligne (parent national). |

> Ces décisions **n'altèrent aucun invariant verrouillé** (abonnement national ; annonceur conservé ; Premium
> supprimé ; locaux délégables ; réseauteurs gratuits ; SSR/SEO/géoloc ville/RGPD/simplicité/stack).
> **Le gate ADR-0012 est LEVÉ** : E1 (schéma) peut démarrer ; un **gate humain subsiste en sortie de E1**
> (re-migration + drop colonnes destructif) avant E2.
>
> *(NB 2026-07-12 : l'invariant « réseauteurs gratuits » ci-dessus est depuis **levé par l'ADR-0013** —
> voir Partie D. Les décisions Q1→Q8 restent valides pour le périmètre réseaux.)*

---

# Partie D — Évolution ADR-0013 — PLAN FORWARD (Réseauteur Plus + licences partenaires)

> Source : `docs/adr/0013-reseauteur-plus-licences-partenaires.md` (accepté le 2026-07-12).
> **Déjà livré en amont (2026-07-10/12, hors jalons)** : rôle `partenaire`, espace partenaire self-service
> (fiche + offre + abonnement annonceur), fiche publique `/partenaire/<slug>`, offres côté réseauteur
> (`/dashboard/offres`), participation réseauteur↔événements. La Partie D construit **par-dessus**.

> ► **AMENDEMENT ADR-0015 (2026-07-17) — les licences partenaires sont SUPPRIMÉES.** Tout ce qui, ci-dessous,
> concerne les **packs de licences 10/50/100 + code promo** (jalons D2/D3/D4, P1.2, l'activation de P2.A, la
> section partenaire de P2.B, une partie de P3/récap) a été **construit puis RETIRÉ** — ne le lire **ni** comme
> à faire **ni** comme actif. **Le Réseauteur Plus s'obtient uniquement par abonnement individuel** (39 € HT/an,
> `plusSource='abonnement'` ; `'licence'` = legacy en extinction, lecture seule). Ce qui **subsiste** de l'ADR-0013 :
> l'abonnement Plus, l'invariant XOR organisateur d'événement, les inscriptions en ligne (collection `inscriptions`),
> le CRUD événements du Plus. **Prix révisé : 39 € HT/an** (décision 2026-07-16, remplace le 59 € de D2).

Jalons : **P0 Gate décisions → P1 Schéma (Plus + licences + organisateur d'événement) → P2 Chantiers
parallèles → P3 Intégration → P4 QA/Gate.**

## P0 — Décisions du gate humain ADR-0013  ·  TRANCHÉ le 2026-07-12

| # | Question | **Décision retenue** | Note d'implémentation |
|---|---|---|---|
| D1 | Relation organisateur de l'événement | **Le réseauteur EST l'organisateur de ses événements** | `evenements.organisateurReseauteur` (N-1 optionnel) + `reseau` relâché ; invariant serveur « **exactement un** organisateur » (réseau XOR réseauteur) ; fiche/carte/SEO : « Organisé par \<prénom nom\> » (lien fiche réseauteur, `Event.organizer` = `Person`). **Toujours valide.** |
| D2 | Tarifs | ~~**Plus = 59 €** · packs 10/50/100 = 300/600/1 000 €~~ → **Plus = 39 € HT/an ; packs SUPPRIMÉS** ⚠️ *ADR-0015/0016* | Plus **annuel**, `STRIPE_PLUS_PRICE_ID` (**vrai Price 39 € HT = TODO PO**, placeholder). `STRIPE_PACK_*` **retirés**. |
| D3 | ~~Paiement des packs — checkout one-shot~~ **CADUC (ADR-0015)** | Checkout pack retiré du code | Aucun `mode:'payment'` licence ; produit `licences_pack` retiré du checkout/webhook. |
| D4 | ~~Renouvellement des licences~~ **CADUC (ADR-0015)** | Extinction seulement | Le cron `expiration-plus` **éteint** les Plus `licence` restants à échéance ; aucune reconduction/rachat de pack. |

> **Le gate P0 est LEVÉ** : P1 (schéma) peut démarrer. Un **gate humain léger subsiste en sortie de P1**
> (validation du schéma) avant P2.
> ⚠️ **Post-livraison (ADR-0015/0016)** : D2/D3/D4 ne sont plus le contrat — voir l'amendement en tête de Partie D.

## P1 — Schéma : Plus, licences, organisateur d'événement  [SÉRIALISÉ après P0]  ·  Owner : `data-architect`
- P1.1 `users` : `plusActif` (bool, serveur-only), `plusExpireAt`, `plusSource` (`abonnement|licence`),
  `plusLicencePack` (N-1). Migration + field-access (jamais éditable client).
  > ► **ADR-0015** : `plusSource` livré mais `'abonnement'` est **le seul chemin d'obtention** ; `'licence'` et
  > `plusLicencePack` sont **dormants (legacy, lecture seule, en extinction)**.
- P1.2 Collections **`licences_packs`** (partenaire N-1, taille 10/50/100+, quota/quotaUtilise, `code`
  unique non devinable généré serveur, statut, expireAt, champs Stripe) et **`licences_activations`**
  (pack N-1, user N-1 **unique**, activeAt). Index + contraintes (1 activation/user, quota ≥ utilisé).
  > ► **ADR-0015 — livré puis RETIRÉ** : ces deux collections existent mais sont **dormantes** (`admin.hidden`,
  > traçabilité legacy) ; aucune création/activation de pack n'est possible (route `/api/licences/activer` → **410**).
- P1.3 `evenements` : selon D1 — `organisateurReseauteur` + `reseau` nullable + invariant serveur
  « exactement un organisateur » ; compteurs `nbEvenements` inchangés (réseaux seulement).
- P1.4 Helpers serveur centralisés : `estPlus(user)` ; `peutCreerEvenement(user)` (organisateur national
  abonné OU réseauteur Plus OU admin) — remplace le gate actuel partout (une seule source).
- ⚠️ Gate humain léger en sortie de P1 (validation schéma) avant P2.

## P2 — Chantiers parallèles  [PARALLÈLE après P1]
### P2.A — Billing Plus & packs  ·  Owner : `accounts-and-billing`
> ► **Amendé ADR-0015/0016.** Seul l'**abonnement Plus** subsiste (webhook `activerReseauteurPlus` →
> `plusActif`, `plusSource='abonnement'`, `stripeSubscriptionId`, `plusExpireAt` ; cron `expiration-plus`). Toute
> la partie **packs** (checkout pack, webhook pack, génération/décrément de code, activation par code, cron
> d'expiration des packs) est **retirée**. La gestion in-app de l'abonnement Plus passe désormais par le **hub
> `/dashboard/abonnement`** (`resolveAbonnement` / `AbonnementManager`, cancel/reactivate — **ADR-0016**).
- Produits/prix Stripe : abonnement Plus + 3 packs (config D2). Checkout Plus (réseauteur) ; checkout pack
  (partenaire, D3). Webhooks idempotents : activation/expiration Plus (`plusSource='abonnement'`),
  création/activation du pack + génération du code. Crons : expiration Plus, expiration packs → désactivation
  en cascade des Plus `licence` du pack. Portal : retours par rôle. Emails transactionnels (confirmation
  Plus, pack acheté, licence activée, expiration) via les templates rebrandés.
- **Activation par code** : route serveur (rate-limitée) — vérifs atomiques (code actif, quota, unicité par
  user) → décrément transactionnel + activation + trace. **(RETIRÉ — ADR-0015 ; route → 410 Gone.)**
### P2.B — Frontend réseauteur & partenaire  ·  Owner : `frontend-builder`
- Espace réseauteur : bloc « Passer Plus » (abonnement ~~OU saisie de code~~ — **abonnement seul, ADR-0015**) ;
  état Plus visible ; **CRUD de ses événements** (création/édition, statut de modération existant) gaté par
  `peutCreerEvenement`.
- Espace partenaire : ~~section « Licences Réseauteur Plus » (acheter un pack, voir quota/activations, code à
  diffuser)~~ **— SUPPRIMÉE (ADR-0015)** ; le partenaire ne conserve que sa fiche, son offre et son abonnement
  annonceur (géré via le hub `/dashboard/abonnement`).
### P2.C — Fiches & cartes  ·  Owner : `frontend-builder` + `map-engineer`
- Fiche événement : « Organisé par <réseauteur> » (lien fiche) quand organisateurReseauteur ; carte des
  événements : aucun marqueur nouveau (simplicité — un seul type, ADR-0012 réaffirmé).
### P2.D — SEO  ·  Owner : `seo-engineer`
- JSON-LD `Event.organizer` = `Person` (réseauteur) quand applicable ; sitemap inchangé.

## P3 — Intégration  [SÉRIALISÉ après P2]
- Parcours complets : réseauteur → Plus (abonnement) → crée un événement → visible carte/fiche/SEO ;
  ~~partenaire → achète pack 10 → diffuse code → réseauteur active → crée un événement ; expiration pack →
  Plus retombe~~ **(CADUC — ADR-0015)** ; expiration de l'**abonnement Plus** → création bloquée (l'existant
  reste publié). S'ajoute (ADR-0014) : réseauteur Plus → crée un **local** → publie **ses** événements.

## P4 — Vérification & gate  [SÉRIALISÉ — final]  ·  Owner : `qa-reviewer`
- Autorisation stricte (jamais confiance au client : statut Plus, quota, propriété du pack) ; concurrence
  d'activation (pas de sur-allocation) ; monétisation (webhooks idempotents, crons) ; a11y ; RGPD
  (traçabilité activations minimale) ; simplicité (< 30 s : le gratuit reste le message principal).
- **`docs/qa/REVIEW-<date>.md`** avant merge.

## Récapitulatif des dépendances (ADR-0013)
P0 ✅ (tranché 2026-07-12) → P1 (schéma+helpers) → gate léger → P2.A/B/C/D en parallèle → P3 → P4.
~~**Avant P2.A :** créer les produits/prix dans Stripe (Plus 59 € ; packs 300/600/1 000 €)~~
> ► **Post-livraison (ADR-0015/0016)** : plus de packs. **Seule dépendance PO restante** = brancher le **vrai
> Price Stripe du Plus à 39 € HT** (`STRIPE_PLUS_PRICE_ID`) — et les Price des 4 paliers réseau
> (`STRIPE_PRICE_NATIONAL_*`) côté ADR-0014 ; tous placeholders aujourd'hui.
