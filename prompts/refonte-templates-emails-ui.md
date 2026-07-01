# REFONTE — Templates d'emails : UI & identité visuelle PanoramaPub.fr

## Mission

Refondre **l'intégralité des templates HTML d'emails** de PanoramaPub.fr pour leur donner l'**identité visuelle du site** (couleurs, typographie, logo, composants) tout en restant **robuste aux contraintes des clients mail** (Gmail, Outlook, Apple Mail, Yahoo, clients mobiles).

Objectif : **zéro email "texte brut bleu souligné"**. Chaque email doit être immédiatement reconnaissable comme venant de Panorama Pub, lisible sur tous les clients, compatible dark mode, accessible (WCAG AA) et maintenable via un **système de composants HTML centralisé**.

Aucune régression fonctionnelle : footer RGPD / unsubscribe / blacklist / AuditLogs doivent continuer de fonctionner à l'identique.

## Contexte projet

- Next.js 16 (App Router), Payload CMS 3, Resend. Détails : [CLAUDE.md](CLAUDE.md).
- Envoi via [src/lib/email-sender.ts](src/lib/email-sender.ts) (applique blacklist + AuditLogs, from `RESEND_FROM_EMAIL`, reply-to `RESEND_REPLY_TO_EMAIL`).
- Webhook bounces/complaints : [src/app/api/resend/webhook/route.ts](src/app/api/resend/webhook/route.ts) — alimente `user.emailBlacklisted`.
- Tous les templates actuels : [src/lib/emails.ts](src/lib/emails.ts) — HTML inline minimal, pas de charte.
- Logo officiel : [public/img/logo.png](public/img/logo.png).
- Palette site (extraite de [src/app/(frontend)/styles.css](<src/app/(frontend)/styles.css>)) :
  - Primary : `#EDA82F` (ambre Panorama), hover `#eda21f`, light `#fff3d4`
  - Background secondary : `#fff7e0`
  - Text dark : `#000000`, medium : `#262522`
  - Border : `#EDA82F`, border-light : `#ebb92f`
  - Premium gradient : `#b45309` → `#92400e`
  - Gris neutres : `#9ca3af`, `#6b7280`, `#e5e7eb`
- Domaine public : `panorama-pub.com` (`SITE_URL` / [src/lib/site.ts](src/lib/site.ts)).
- Ton de marque : professionnel B2B, factuel, francophone, **aucun emoji**, tutoiement exclu (vous de politesse).

## Périmètre — 26 templates à refondre

Tous les exports de [src/lib/emails.ts](src/lib/emails.ts) sont concernés. Regroupement logique :

### A. Onboarding & comptes
- `welcomeEmail` — bienvenue après vérification email
- `verifyEmailTemplate` — double opt-in au signup
- `forgotPasswordEmail` — lien reset (15 min)
- `csvInvitationEmail` — invitation admin CSV avec mot de passe temporaire
- `completionReminderEmail` — J+3 remplissage fiche (marketing, footer RGPD)
- `upgradeNudgeEmail` — J+7 push Premium (marketing, footer RGPD)
- `groupLeverageEmail` — J+14 push groupe (marketing, footer RGPD)

### B. Sécurité compte
- `accountLockedEmail` — lockout après 5 échecs
- `passwordChangedEmail` — confirmation changement mdp
- `emailChangedEmail` — envoyé aux DEUX adresses (ancienne + nouvelle)

### C. Abonnement & paiement (Stripe)
- `subscriptionConfirmationEmail` — paiement Premium / Infinite réussi
- `subscriptionCanceledEmail` — annulation fin de période
- `planDowngradedEmail` — passage en gratuit après expiration
- `expirationWarningEmail` — alertes J-30 / J-7 (cron)
- `paymentFailedEmail` — échec renouvellement

### D. Groupes d'affiliation
- `groupInvitationEmail` — invitation par un membre (CTA conditionnel selon existence du compte)
- `groupeCreatedEmail` — confirmation création à l'owner
- `groupeJoinedOwnerEmail` — notification arrivée d'un membre à l'owner
- `groupeOwnershipTransferredEmail` — transfert ownership
- `groupeLeftOwnerEmail` — départ d'un membre

### E. Modération & RGPD
- `ficheRejectedEmail` — suspension fiche (admin)
- `evenementRejectedEmail` — archivage événement par admin
- `accountDeletedEmail` — confirmation suppression compte

### F. Admin / monitoring
- `stripeMisconfigAlertEmail` — alerte config Stripe incohérente

## Livrables attendus

### 1. Nouveau module `lib/emails/` (remplace le fichier plat)

Découpe modulaire :

```
src/lib/emails/
  index.ts                  # Re-exports publics (compat avec imports actuels)
  layout.ts                 # renderEmail(opts) — wrapper HTML commun
  components.ts             # button(), card(), divider(), infoRow(), alertBox(), table() — briques typées
  theme.ts                  # Tokens : couleurs, fontFamily, tailles, radius, spacing
  footer.ts                 # footerTransactional() + footerMarketing(userId) — RGPD/LCEN
  templates/                # Un fichier par famille
    onboarding.ts           # welcome, verify, forgot-password, csv-invitation, completion-reminder, upgrade-nudge, group-leverage
    security.ts             # account-locked, password-changed, email-changed
    subscription.ts         # subscription-confirmation, canceled, downgraded, expiration-warning, payment-failed
    groupes.ts              # invitation, created, joined-owner, ownership-transferred, left-owner
    moderation.ts           # fiche-rejected, evenement-rejected, account-deleted
    admin.ts                # stripe-misconfig
  tokens.ts                 # generateUnsubscribeToken + verifyUnsubscribeToken (inchangés, déplacés depuis emails.ts)
  esc.ts                    # esc() — escaping HTML
```

**Compat stricte** : `src/lib/emails/index.ts` doit réexporter **exactement** les mêmes noms que [src/lib/emails.ts](src/lib/emails.ts) pour que tous les imports existants continuent de fonctionner. Ne pas casser [src/lib/email-sender.ts](src/lib/email-sender.ts), [src/collections/Users.ts](src/collections/Users.ts), les routes Stripe/cron/groupes.

### 2. `renderEmail(opts)` — wrapper HTML commun

Signature :

```typescript
renderEmail(opts: {
  preheader?: string              // Texte masqué de preview (Gmail)
  heading: string                 // H1 principal
  intro?: string                  // Paragraphe d'accroche sous le H1
  content: string                 // Corps HTML (utilise les briques components.ts)
  footer: 'transactional' | { kind: 'marketing'; userId: number | string }
  accent?: 'primary' | 'premium' | 'danger' | 'neutral'  // Couleur bande top + H1
}): string
```

Doit produire un HTML :

- `<!DOCTYPE html>` + `<html lang="fr">` + `<meta charset="utf-8">` + `viewport` mobile
- **Table-based layout** (600px center) — compatible Outlook (VML pour bouton si nécessaire)
- **CSS inline** via un helper (pas de `<style>` globaux non inline — sauf `@media` et dark mode dans `<head>`)
- **Header** : logo Panorama Pub (URL absolue `${SITE_URL}/img/logo.png`, 160×auto) + bande accent colorée
- **Preheader** caché (`display:none;max-height:0;overflow:hidden`) pour preview Gmail/Outlook
- **Body** : card blanche sur fond `#fff7e0` avec border `#EDA82F`, padding 32px, radius 8px
- **Footer** : signature "L'équipe Panorama Pub" + liens légaux (mentions, contact) + adresse société + (si marketing) lien unsubscribe HMAC
- **Dark mode** : `@media (prefers-color-scheme: dark)` ajustant background et texte (attention : Gmail Android ignore)
- Fallback **plain text** : chaque template exporte aussi une version texte (`.text`) pour Resend — améliore la délivrabilité

### 3. Briques UI typées (`components.ts`)

```typescript
button({ href, label, variant = 'primary' | 'secondary' | 'danger' | 'premium' }): string
card({ title?, body, variant?: 'default' | 'highlight' | 'warning' | 'success' | 'danger' }): string
divider(): string
infoRow({ label, value }): string                // Ligne label/value pour récap abonnement
alertBox({ tone: 'info' | 'warning' | 'danger' | 'success'; text }): string
table(rows: Array<{ label: string; value: string }>): string  // Récap transactionnel
codeBlock(code: string): string                  // Pour codes groupe GRP-XXXXXX, mot de passe temporaire
```

Chaque brique rend du HTML inline robuste (pas de flexbox, pas de grid, pas de `rem` — tout en `px`).

### 4. Thème centralisé (`theme.ts`)

Exporter les tokens de design pour usage programmatique :

```typescript
export const emailTheme = {
  color: {
    primary: '#EDA82F',
    primaryHover: '#eda21f',
    primaryLight: '#fff3d4',
    bgPage: '#fff7e0',
    bgCard: '#ffffff',
    textDark: '#000000',
    textMedium: '#262522',
    textMuted: '#6b7280',
    border: '#EDA82F',
    borderLight: '#ebb92f',
    premiumFrom: '#b45309',
    premiumTo: '#92400e',
    danger: '#dc2626',
    success: '#059669',
    warning: '#f59e0b',
    infoBg: '#eff6ff',
    dangerBg: '#fef2f2',
    successBg: '#f0fdf4',
  },
  font: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  radius: { sm: '4px', md: '6px', lg: '8px' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
} as const
```

### 5. Refonte de chaque template

Chaque fonction existante (`welcomeEmail`, `subscriptionConfirmationEmail`, etc.) doit :

1. Déléguer à `renderEmail(...)` avec des `content` composés via les briques.
2. Conserver **exactement la même signature** (mêmes paramètres, même nom, mêmes types).
3. Ajouter **un preheader** pertinent (première phrase de preview).
4. Proposer **un CTA bouton** explicite si l'email en nécessite un (reset, checkout, dashboard, join groupe).
5. Préférer un **récap structuré** (table / infoRow) aux paragraphes quand il y a des données (plan, dates, codes, montants).
6. Respecter le ton : salutation `Bonjour {nomSociete},` quand `nomSociete` fourni, sinon `Bonjour,`.
7. Signature finale : `L'équipe Panorama Pub` + lien dashboard.

Exemples de nouveautés UX :

- `subscriptionConfirmationEmail` : card "success" verte, table récap (plan, prochain prélèvement si disponible, montant), bouton "Accéder à mon espace".
- `expirationWarningEmail` : card "warning" ambre, bouton "Renouveler mon abonnement" → `${SITE_URL}/dashboard/abonnement`.
- `groupInvitationEmail` : card highlight, `codeBlock(code)` pour le code GRP-XXXXXX, bouton dont le label et l'URL changent selon `userExists`.
- `accountLockedEmail` : card "danger" rouge, info "déblocage automatique dans 10 minutes", lien "Réinitialiser mon mot de passe".
- `verifyEmailTemplate` / `forgotPasswordEmail` : bouton CTA principal + URL brute en secours (clients qui bloquent les liens).

### 6. Préservation du footer RGPD / unsubscribe

- `marketingFooter(userId)` (privé dans `emails.ts`) doit être remplacé par `footerMarketing(userId)` **sans changer la logique HMAC** (`generateUnsubscribeToken` / `verifyUnsubscribeToken` — voir [src/app/api/emails/unsubscribe/route.ts](src/app/api/emails/unsubscribe/route.ts)).
- Le lien `/dashboard/compte` reste présent.
- Respecter le TTL 90j du token et la compat ascendante du format 2-parts.
- Les emails **transactionnels** (verify, forgot, lockout, password changed, email changed, subscription confirm / cancel / downgrade, payment failed, account deleted, fiche/evenement rejected, csv invitation) **ne doivent pas** porter le footer marketing.
- Les emails **marketing** (completion-reminder, upgrade-nudge, group-leverage) **doivent** garder le footer marketing et rester gated par `optInMarketing` côté `email-sender`.

### 7. Images & assets

- Logo hébergé sur le domaine public : URL absolue `${SITE_URL}/img/logo.png`. Prévoir un fallback `alt="Panorama Pub"` pour clients qui bloquent les images.
- Aucun embed base64 (alourdit l'email, fait tomber dans les spams).
- Si ajout d'images additionnelles (icônes CTA, bannière hero), servir depuis `public/img/emails/` — fichiers PNG optimisés < 100 ko.

### 8. Tests & vérifications

- Tests unitaires Vitest : un fichier `tests/integration/emails.test.ts` vérifie, pour chaque template :
  - Le HTML contient `<!DOCTYPE html>`, la balise `<title>`, le preheader, le lien unsubscribe si marketing
  - L'échappement de `nomSociete` / `email` contenant `<script>` (XSS)
  - La présence des variables injectées (URL reset, code groupe, etc.)
  - La longueur du preheader ≤ 110 caractères
- Tests de rendu visuel : documenter la procédure avec [Litmus](https://litmus.com) ou [Email on Acid](https://www.emailonacid.com) ou a minima l'inbox de test Resend + `/api/dev/send-test-email` pour chaque template (boucle locale).
- Commande utile ajoutée : `pnpm email:preview` (optionnel) — sert les HTML rendus sur `http://localhost:3000/dev/emails/<kind>` en dev uniquement.

### 9. Documentation

Ajouter / mettre à jour un court guide dans `docs/emails.md` (créer si absent) :

- Liste des templates et leurs déclencheurs
- Conventions : transactional vs marketing
- Comment ajouter un nouveau template (checklist)
- Checklist de rendu cross-client
- Variables d'environnement relatives (`RESEND_*`, `SITE_URL`)

## Standards à respecter

### Compatibilité clients mail

- **Layout table-based** (pas de flexbox/grid) — Outlook 2016+ ne supporte pas le CSS moderne.
- **CSS inline obligatoire** sur chaque balise (style attr), sauf media queries et dark mode dans `<head>`.
- **Police web safe** uniquement (`-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) — pas de `@font-face`.
- **Bouton** : `<a>` stylé en block + fallback VML pour Outlook (generator `bulletproof button`).
- **Images** : `alt` obligatoire, `display:block`, `border:0`, `outline:none`, dimensions explicites.
- **Largeur max 600px** centré.
- **Mobile first** : media query `@media (max-width: 600px)` pour passer le body en full-width, padding réduit, boutons full-width.
- **Dark mode** : `@media (prefers-color-scheme: dark)` — attention, Gmail (webmail & Android) l'ignore et inverse souvent les couleurs automatiquement. Tester.

### Accessibilité

- Contraste texte/fond ≥ 4.5:1 (WCAG AA).
- `<a>` sans texte type "cliquez ici" — label explicite.
- `alt` image descriptif (ou vide `alt=""` si purement décoratif).
- `role="presentation"` sur toutes les `<table>` de layout.
- `lang="fr"` sur le `<html>`.

### Délivrabilité

- Ratio HTML/texte : prévoir **texte brut équivalent** pour chaque template.
- Pas de mots déclencheurs spam ("GRATUIT!!!", majuscules, ponctuation excessive).
- Pas de raccourcisseurs d'URL (bit.ly, etc.). URL absolues sur `panorama-pub.com`.
- `List-Unsubscribe` header déjà géré par Resend si configuré — vérifier la config côté provider (hors scope HTML, mais à mentionner dans `docs/emails.md`).

### Sécurité

- **XSS** : toutes les valeurs utilisateur doivent passer par `esc()` avant injection. Vérifier chaque template refait.
- **Preheader** aussi `esc()`-é.
- URL : toujours absolues, toujours HTTPS, toujours basées sur `SITE_URL`.
- Jamais exposer `tempPassword` en clair dans un preheader (risque d'apparaître dans l'overview Gmail).
- Footer marketing : `generateUnsubscribeToken` avec TTL 90j — **ne pas changer** la signature HMAC.

## Méthodologie

### Phase 1 — Inventaire et décisions
1. Lire [src/lib/emails.ts](src/lib/emails.ts) et [src/lib/email-sender.ts](src/lib/email-sender.ts) pour cartographier les 26 templates et leurs signatures.
2. Lister chaque site d'appel (via grep des exports) pour garantir la compat après refonte.
3. Décider avec l'utilisateur :
   - Quel logo utiliser dans les emails ? Taille ? Coupé ou plein fond ?
   - Le site a-t-il un social kit (Twitter/LinkedIn) à référencer dans le footer ?
   - Faut-il créer une page `mentions-legales` dédiée aux emails ?
   - Autoriser dark mode auto ou forcer light ?

### Phase 2 — Fondations
1. Créer l'arborescence `src/lib/emails/` avec `theme.ts`, `esc.ts`, `tokens.ts`.
2. Implémenter `components.ts` (briques) et écrire des tests de rendu HTML.
3. Implémenter `renderEmail()` dans `layout.ts` et `footer.ts`.
4. Ajouter un endpoint dev `src/app/api/dev/preview-email/[kind]/route.ts` (gated `NODE_ENV==='development'`) qui rend un exemple de chaque template.

### Phase 3 — Migration des 26 templates
1. Refaire famille par famille (ordre : onboarding → security → subscription → groupes → moderation → admin).
2. Pour chaque template : écrire d'abord la version HTML via `renderEmail`, puis la version texte, puis le test unitaire.
3. À la fin de chaque famille : `pnpm test:int` + preview manuelle locale.

### Phase 4 — Compat & bascule
1. `src/lib/emails/index.ts` réexporte tous les noms à l'identique.
2. Déplacer le fichier historique `src/lib/emails.ts` en le faisant simplement réexporter depuis `./emails/index` (ou supprimer et mettre à jour tous les imports — au choix selon coût).
3. `pnpm build` : zéro erreur TS.
4. Lancer `pnpm test` complet (intégration + E2E).

### Phase 5 — Validation cross-client
1. Envoyer via `/api/dev/send-test-email` à des adresses tests (Gmail, Outlook.com, Yahoo, iCloud, Proton).
2. Visualiser dans : Gmail web, Gmail Android, Gmail iOS, Outlook 2019+, Outlook web, Apple Mail (macOS + iOS), Thunderbird.
3. Vérifier : rendu clair + sombre, mobile + desktop, avec + sans images bloquées.
4. Corriger les écarts (VML Outlook, ghosts padding, etc.).

### Phase 6 — Monitoring post-déploiement
1. Vérifier taux de bounce / complaint sur Resend pendant 48h post-déploiement.
2. Vérifier webhook Svix toujours opérationnel (blacklist alimentée).
3. Vérifier liens unsubscribe toujours fonctionnels (un email marketing test → clic → `/api/emails/unsubscribe`).

## Format du livrable final

Fichier `audits/emails-refonte-YYYY-MM-DD.md` listant :

- Templates refaits (tableau : nom / famille / preheader / CTA / variant / footer)
- Nouveaux fichiers créés (chemin + rôle)
- Tests ajoutés (chemin + couverture)
- Résultats des rendus cross-client (captures ou liens hébergés)
- Écarts connus (par client mail, par thème sombre)
- Todo restant (si décisions produit en attente)

## Contraintes strictes

- **Zéro régression** sur les signatures des fonctions exportées de [src/lib/emails.ts](src/lib/emails.ts) — tous les imports existants doivent continuer de compiler.
- **Zéro régression** sur le flux unsubscribe HMAC (TTL 90j, compat legacy 2-parts).
- **Zéro régression** sur le footer marketing gated par `optInMarketing`.
- **Zéro emoji** dans les sujets ni les corps.
- **Aucun CSS externe** (`<link rel="stylesheet">`), aucun `<script>`, aucun formulaire interactif.
- **Aucune dépendance externe** (mjml, react-email, etc.) — on reste sur du HTML/TS pur pour garder le contrôle et limiter le bundle. Si une dépendance est jugée nécessaire (ex : `mjml` en build-time), la proposer en plan et attendre validation.
- **Largeur max 600px**. Hauteur total recommandée < 1200px pour éviter le clipping Gmail.
- **Images absolues HTTPS** sur `panorama-pub.com` uniquement.
- **Types TypeScript stricts** : pas de `any`, pas de `as unknown as`.
- **`pnpm build` passe à chaque étape**.
- **`pnpm test:int` passe** — les tests existants qui lisent le HTML des templates doivent continuer de marcher (si un test assertait une chaîne précise, soit l'adapter, soit préserver la chaîne).
- **Conformité RGPD** : footer marketing obligatoire sur les 3 emails marketing ; footer transactionnel minimal avec adresse société + liens légaux sur les autres.
- Après toute modification impactant Payload (improbable ici) : `pnpm generate:types`.

## Auto-vérification avant rendu

- [ ] Les 26 templates ont été refondus et passent par `renderEmail()`
- [ ] Les 26 signatures publiques sont strictement identiques à l'existant
- [ ] `src/lib/emails/index.ts` réexporte tout, `grep -r "from '@/lib/emails'"` montre que tous les call sites fonctionnent
- [ ] Chaque template a un preheader, un CTA (si pertinent), un footer correctement typé (marketing vs transactional)
- [ ] Chaque template a une version texte brut équivalente
- [ ] Aucun emoji, aucune URL relative, aucun `<script>`, aucun CSS externe
- [ ] Toutes les valeurs utilisateur sont `esc()`-ées (y compris preheaders)
- [ ] Le logo apparaît dans le header avec `alt` et URL absolue
- [ ] Le footer marketing génère un token HMAC via `generateUnsubscribeToken` (signature inchangée)
- [ ] Tests Vitest couvrent les 26 templates (XSS + structure + preheader)
- [ ] `pnpm build` passe
- [ ] `pnpm test` passe
- [ ] Rendu vérifié sur Gmail + Outlook + Apple Mail (desktop & mobile)
- [ ] Dark mode rendu correctement (ou fallback light forcé documenté)
- [ ] Flux unsubscribe testé de bout en bout (email marketing → clic → `optInMarketing=false`)
- [ ] `audits/emails-refonte-YYYY-MM-DD.md` livré
