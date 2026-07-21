# Procédure de tests fonctionnels — RÉSEAUTEURS

> Tests **manuels** à réaliser sur l'environnement local (base docker jetable, jamais Neon prod).
> Complète les suites automatisées : `pnpm test:int:local` (491/492) et `pnpm test:e2e:local` (21/21)
> couvrent l'API, les rôles/gates et le back-office ; **cette procédure cible ce qui ne s'automatise
> pas facilement** — l'interaction visuelle des cartes (dont le clic-cluster), le responsive, les
> parcours Stripe, et une revue « à l'œil » des fiches SEO.
>
> Légende : **[P0]** critique · **[P1]** important · **[P2]** secondaire · 🤖 = déjà couvert en auto
> (à re-confirmer visuellement) · 🖐️ = manuel uniquement.

---

## 0. Prérequis & démarrage de l'environnement

> Docker Desktop démarré. Ne **jamais** pointer sur Neon : tout passe par la base docker locale.

```bash
# 1. Base PostGIS locale + migrations (une fois)
pnpm run test:local:setup          # docker up + migrate

# 2. Jeu de données de démo (réseaux, réseauteurs, événements géolocalisés -> clusters)
pnpm run test:local:seed           # ~57 entités marquées « [démo] »

# 3. Serveur applicatif sur la base locale
pnpm run dev:local                 # http://localhost:3000
```

- ⚠️ Le seed affiche `Base cible : …neon.tech` dans sa bannière — **c'est un bug d'affichage** (il lit
  `DATABASE_URL`) : la connexion réelle utilise `DATABASE_URI` (localhost). Vérifier au besoin :
  `docker exec reseauteurs-postgres-1 psql -U postgres -d reseauteurs -tc "select count(*) from reseauteurs;"`
  (doit renvoyer 18).
- Compte admin de test (créé par les helpers e2e, sinon en créer un via `/admin` first-user) :
  `dev@payloadcms.com` / `test1234`.
- Repartir propre : `docker compose down -v` puis reprendre à l'étape 1.
- **Stripe** : les parcours §6 nécessitent des clés `STRIPE_*` de test dans l'environnement + un
  `stripe listen --forward-to localhost:3000/api/stripe/webhook` (script `pnpm stripe:listen`). Sans clés,
  marquer ces tests « N/A local » et les valider en staging.

---

## 1. Cartes 🖐️ — priorité (fix récent : expansion des clusters)

> Le clic sur un cluster a été **corrigé** (maplibre-gl 5.x : `getClusterExpansionZoom` Promise). C'est
> le test le plus important à repasser visuellement — il ne peut pas être couvert par les tests API.

| # | Prio | Test | Étapes | Résultat attendu |
|---|---|---|---|---|
| 1.1 | **P0** | Carte réseauteurs — rendu | Ouvrir **`/reseauteurs?vue=carte`** | La carte s'affiche plein écran, des **clusters** (pastilles chiffrées) et/ou marqueurs individuels apparaissent sur la France (18 réseauteurs [démo] seedés). |
| 1.2 | **P0** | **Clic-cluster → zoom** ✅fix | Cliquer sur un cluster (pastille chiffrée) | La carte **zoome en douceur** (easeTo) et recentre ; le cluster **s'éclate** en sous-clusters/marqueurs. *(Avant le fix : rien ne se passait.)* |
| 1.3 | **P0** | Clic marqueur individuel | Zoomer jusqu'à un marqueur unique, cliquer | Ouvre la **preview** du réseauteur (nom, fonction, entreprise, badge) ; l'URL reçoit `?r=<slug>`. |
| 1.4 | **P0** | Carte événements — clic-cluster | **`/evenements?vue=carte`**, cliquer un cluster | Idem 1.2 : zoom + éclatement. Clic marqueur → preview événement. |
| 1.5 | **P1** | Carte réseaux — clic-cluster | **`/reseaux?vue=carte`**, cliquer un cluster | Idem 1.2 : zoom + éclatement. |

> URLs vérifiées (serveur local, HTTP 200). Note : `/carte/reseauteurs` et `/carte/evenements` **redirigent** (308) vers `…?vue=carte` ; utiliser directement les URLs `?vue=carte` ci-dessus.
| 1.6 | **P1** | Filtres carte | Appliquer un filtre (ville/dépt/secteur/type…) | Les marqueurs se restreignent au filtre ; le compteur/liste se met à jour. |
| 1.7 | **P1** | Mobile-first 🖐️ | Réduire à une largeur mobile (~375px) | Carte **plein écran** + bottom-sheet, pas une carte rétrécie au-dessus d'une liste. |

---

## 2. Pages publiques & SEO 🖐️

| # | Prio | Test | Étapes | Résultat attendu |
|---|---|---|---|---|
| 2.1 | **P0** | Home comprise < 30 s | `/` | En-tête → hero + accès aux 2 cartes → bandeau réseaux → 3 piliers (Réseauteurs/Événements/Réseaux) → chiffres clés → partenaires → footer. Pas de 500. |
| 2.2 | **P0** | Fiche réseauteur | `/reseauteur/<prenom-nom>` (ex. un « [démo] ») | Photo, nom, entreprise, fonction, réseaux fréquentés, badge, ville. `<title>`/meta dynamiques ; JSON-LD `Person` présent (voir source). |
| 2.3 | **P0** | Fiche événement | `/evenement/<slug>` | Titre, type, date/lieu/département, participation, organisateur, bouton d'inscription. JSON-LD `Event`. |
| 2.4 | **P0** | Fiche réseau | `/reseau/<slug>` | Nom, logo, présentation, niveau, responsable, compteurs (réseauteurs/événements). JSON-LD `Organization`. |
| 2.5 | **P1** | Fiche partenaire | `/partenaire/<slug>` | Fiche annonceur + offre réservée aux réseauteurs. |
| 2.6 | **P1** | Recherche / filtres | Page de recherche réseauteurs & événements | Filtres ville/département/réseau/type/gratuit-payant/date fonctionnent ; résultats cohérents. |
| 2.7 | **P2** | SEO transverse | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | Se chargent ; le sitemap liste les 3 types de fiches. Opt-out d'indexation respecté sur un profil qui l'a activé. |

---

## 3. Authentification & comptes 🤖🖐️

| # | Prio | Test | Étapes | Résultat attendu |
|---|---|---|---|---|
| 3.1 | **P0** | Inscription réseauteur | `/inscription`, créer un compte réseauteur | Compte + profil squelette créés ; email de bienvenue (DRY_RUN → log). Redirection vers le dashboard. |
| 3.2 | **P0** | Login (page custom) | `/login`, identifiants valides | Connexion OK, cookie `payload-token` posé, redirection `/dashboard` (ou `?redirect=`). |
| 3.3 | **P0** | Garde d'auth | Accéder à `/dashboard` **déconnecté** | Redirection vers `/login`. 🤖 |
| 3.4 | **P1** | Login erreur | `/login`, identifiants invalides | Message d'erreur affiché, pas de connexion. 🤖 |
| 3.5 | **P1** | Slug réseauteur | Compléter le profil (prénom/nom) puis publier | Slug = `prenom-nom` (pas `nomSociete`), figé à la publication, collision → `-2`. |

---

## 4. Rôles, propriété & gates 🤖🖐️

> Le cœur métier — largement couvert par `test:int:local`, à re-confirmer sur l'UI.

| # | Prio | Test | Étapes | Résultat attendu |
|---|---|---|---|---|
| 4.1 | **P0** | Gate Plus — création événement | En **réseauteur gratuit**, tenter de créer un événement | **Refusé** (gate Plus). En **réseauteur Plus** : création autorisée, publication auto sur la carte. |
| 4.2 | **P0** | Propriété réseauteur | Tenter de modifier le profil d'un **autre** réseauteur | Refusé (403). N'agit que sur SON profil. 🤖 |
| 4.3 | **P0** | Organisateur | Compte organisateur → sa fiche réseau + ses événements + ses locaux | Peut éditer SON réseau/SES événements uniquement ; XOR organisateur d'événement (réseau **ou** réseauteur, jamais deux). 🤖 |
| 4.4 | **P1** | Partenaire | Compte partenaire → sa fiche + son offre | Édite sa fiche perso + l'offre réservée aux réseauteurs. |
| 4.5 | **P1** | Admin back-office | `/admin` en admin | Sidebar = collections 3-entités (Users, Reseauteurs, Reseaux, Evenements, Partenaires, Media…) ; navigation list/create OK. 🤖 |
| 4.6 | **P2** | Groupes (dormant) | Routes `/api/groupes/*` | Réservées à l'admin (403 sinon) — fonctionnalité dormante, ne pas exposer côté UI. 🤖 |

---

## 5. Inscriptions en ligne aux événements Plus 🖐️

| # | Prio | Test | Étapes | Résultat attendu |
|---|---|---|---|---|
| 5.1 | **P0** | S'inscrire | Réseauteur connecté → événement **organisé par un réseauteur Plus**, publié et à venir → « Je m'inscris » | Inscription enregistrée ; désinscription possible. |
| 5.2 | **P0** | Événement de réseau | Ouvrir un événement **de réseau** → « S'inscrire » | **Redirige vers le site du réseau** (pas d'inscription sur la plateforme). |
| 5.3 | **P1** | Liste des inscrits | En tant qu'organisateur Plus, ouvrir la liste des inscrits de SON événement | Voit ses inscrits. Un **tiers** ne voit **pas** la liste (0). 🤖 |

---

## 6. Monétisation Stripe (hub `/dashboard/abonnement`) 🖐️

> Nécessite clés `STRIPE_*` de test + `pnpm stripe:listen`. Sinon → « N/A local », valider en staging.
> Le statut payant est **toujours** posé côté serveur (webhook) — vérifier qu'aucune action client ne le mute.

| # | Prio | Test | Étapes | Résultat attendu |
|---|---|---|---|---|
| 6.1 | **P0** | Souscrire Plus | `/dashboard/abonnement` → souscrire Réseauteur Plus (39 € HT/an), payer en carte test | Après webhook : `plusActif=true`, création d'événements débloquée. |
| 6.2 | **P0** | Annuler | Depuis le hub → annuler | `cancel_at_period_end` posé côté Stripe ; accès conservé jusqu'à échéance ; état « annulation programmée ». |
| 6.3 | **P0** | Réactiver | Après annulation programmée → réactiver | Annulation levée ; abonnement de nouveau actif. |
| 6.4 | **P1** | Changer de palier (organisateur) | Réseau partenaire → changer de palier | Proration Stripe ; garde anti-downgrade respectée. `change-plan`/`preview-change-plan` = **410 Gone**. |
| 6.5 | **P1** | Factures | Hub → factures | Liste des factures PDF téléchargeables. |
| 6.6 | **P2** | Échec de paiement | Carte test « decline » | Email d'échec (DRY_RUN → log) ; pas de bascule d'accès prématurée. |

---

## 7. Régressions ciblées de cette session 🖐️

| # | Prio | Test | Attendu |
|---|---|---|---|
| 7.1 | **P0** | Clic-cluster (les 3 cartes) | Cf. §1.2/1.4/1.5 — zoome et s'éclate. **Le test qui motive cette procédure.** |
| 7.2 | **P1** | Badges sur la carte réseauteurs | Les marqueurs/preview affichent la bonne couleur/label de badge (Bronze/Argent/Gold/Platinum). |
| 7.3 | **P1** | Régénération des types | `pnpm generate:types` puis `pnpm exec tsc --noEmit` → 0 erreur (les collections ne sont plus sous `@ts-nocheck`). |

---

## 8. Journal d'exécution

| Date | Testeur | Env (local/staging) | P0 pass/fail | Anomalies (id) | Verdict |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

> Reporter chaque anomalie avec : n° de test, URL, étapes, attendu vs observé, capture. Les tests 🤖
> qui échouent en manuel alors qu'ils passent en auto → suspecter un écart d'environnement (données,
> Stripe, secret) avant de conclure à un bug produit.
