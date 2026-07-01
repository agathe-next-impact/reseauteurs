# ADR-0007 — Rebranding Panorama-Pub → Info-Réseaux.fr

> **⚠️ Cible de marque CADUQUE — amendé par [ADR-0011](0011-plateforme-trois-entites-monetisation-b2b.md) (2026-06-28)** (déjà amendé par [ADR-0010](0010-bascule-annuaire-professionnels.md)).
> La **marque cible n'est plus « Info-Réseaux »** mais **RÉSEAUTEURS** (« la plateforme nationale du
> networking »). Partout où ce document écrit « Info-Réseaux » / « info-reseaux.fr » / « carte des événements
> business », lire **RÉSEAUTEURS** et le positionnement « rassembler, pas remplacer ».
> **Reste pleinement valable :** le **mécanisme** de centralisation de l'identité (`lib/site.ts` source unique,
> emails/CSP/domaine/OG via env, purge exhaustive de « Panorama Pub ») — appliqué désormais à la marque
> RÉSEAUTEURS. **En cas de conflit, l'ADR-0011 prévaut.** Détail : `CLAUDE.md §1`, `ARCHITECTURE.md §5`.

- **Statut :** Accepté (mécanisme) — **cible de marque amendée → RÉSEAUTEURS (ADR-0011)**
- **Date :** 2026-06-23
- **Décideurs :** `solution-architect`
- **Portée :** transverse (identité, config, copies, emails, CSP, SEO, design)
- **Dépend de :** ADR-0003 (vocabulaire de domaine), ADR-0005 (URLs), ADR-0006 (CSP carte)

## Contexte

Le dépôt **est** PanoramaPub.fr (annuaire d'objets publicitaires), à transformer en **Info-Réseaux.fr** (carte des réseaux business). Le branding « Panorama Pub » est **codé en dur** à de nombreux endroits, dont :

- `lib/site.ts` : `SITE_NAME = 'Panorama Pub'`, `SITE_TAGLINE`, `SITE_DESCRIPTION`, `CONTACT_EMAIL = 'contact@panorama-pub.com'`, défaut `SITE_URL = 'https://panorama-pub.com'`.
- `next.config.ts:10` : `siteSources = 'https://panorama-pub.com https://www.panorama-pub.com'` (injecté dans la CSP), redirect www→apex hardcodée sur `panorama-pub.com` (`:76-85`).
- Emails : sujets et corps « Panorama Pub » dans `Users.ts` (verify `:40`, reset `:48`, password-changed `:189`, email-changed `:215`, account-locked `:257`, welcome `:288`), `Fournisseurs.ts:54,93`, et `lib/emails/*`. Adresse `mailto:contact@panorama-pub.com` en dur (`Users.ts:190,213`).
- `payload.config.ts:75` : `defaultFromName: 'Panorama Pub'`.
- `package.json:2` : `name: 'panorama-pub'`.
- Vocabulaire objet-pub (revendeur/fournisseur/RSE/boutique) — traité fonctionnellement par ADR-0003 ; sa trace **textuelle/UI** relève aussi du rebranding.

Le design cible est **figé** (`DESIGN.md`, maquette `info-reseaux-plasma.html`) : police Hanken Grotesk, canvas `#faf9f5`, bleu `#2563EB`, orange conversion `#f5851f`, etc. — c'est `frontend-builder` qui l'implémente, mais le rebranding fournit les constantes (nom, tagline, descriptions FR réseaux-first).

## Décision

**Centraliser l'identité dans la configuration et purger toute occurrence « Panorama Pub » / « panorama-pub.com » du code, des copies et des emails, en faveur de « Info-Réseaux » / « info-reseaux.fr ».**

1. **`lib/site.ts`** devient la source unique d'identité : `SITE_NAME = 'Info-Réseaux'`, `SITE_TAGLINE` / `SITE_DESCRIPTION` réseaux-first (« La carte des événements business en France »), `CONTACT_EMAIL` sur le nouveau domaine, défaut `SITE_URL` = domaine cible. Tout le reste **importe** ces constantes (déjà le cas pour les URLs verify/reset via `SITE_URL`, `Users.ts:36,46`).
2. **Emails** : remplacer toutes les chaînes « Panorama Pub » en dur par `SITE_NAME` (et le `mailto:` par `CONTACT_EMAIL`). `payload.config.ts:75` `defaultFromName` ← `SITE_NAME`. `RESEND_FROM_EMAIL` pointe sur le nouveau domaine (env).
3. **CSP / domaines** (`next.config.ts`) : `siteSources` et la redirect www→apex sur le nouveau domaine. Coordonner avec ADR-0006 (retrait Mapbox) pour réécrire la CSP en une passe.
4. **`package.json`** : `name` ← `info-reseaux`.
5. **Vocabulaire UI** : « revendeur/fournisseur » → « réseau », « organisateur » conservé (= client), retrait des libellés RSE/boutique/emploi (cohérent ADR-0003). Copies **en français**, sentence case (DESIGN.md).
6. **Assets de marque** : logo, favicon, OG image (`DEFAULT_OG_IMAGE`, `opengraph-image`) à remplacer par l'identité Info-Réseaux — livrés par `frontend-builder` selon la maquette.
7. **Variables d'env** : aucune valeur de marque/secret en dur (CLAUDE.md §9) ; domaine et emails passent par l'env (`NEXT_PUBLIC_SITE_URL`, `RESEND_FROM_EMAIL`).

## Conséquences

**Positives :**

- Identité cohérente et centralisée ; un seul point de configuration du domaine/nom/emails.
- Suppression du vocabulaire objet-pub résiduel, alignement réseaux-first.

**Négatives / risques :**

- **Transverse et facile à oublier partiellement** : une chaîne « Panorama Pub » oubliée dans un email = fuite de l'ancienne marque. → recherche exhaustive (`grep "Panorama"` / `"panorama-pub"`) + revue `qa-reviewer`.
- Le changement de domaine impacte : CSP, redirects, liens emails, OG/canonical, et la propagation SEO (coordonner avec ADR-0005, redirections inter-domaines si l'ancien domaine reste en service).
- DNS/SSL/email-sending domain (SPF/DKIM Resend) sur le nouveau domaine = tâches d'infra hors-code à planifier.

## Alternatives écartées

1. **Rebranding cosmétique uniquement (UI), garder `panorama-pub.com` en backend.** Écartée : incohérent, fuite de marque dans les emails et la CSP.
2. **Big-bang sans redirections inter-domaines.** Écartée si l'ancien domaine était indexé : coordonner avec ADR-0005 pour ne pas perdre le SEO acquis.
