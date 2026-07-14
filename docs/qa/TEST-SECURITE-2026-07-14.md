# TEST-SECURITE-2026-07-14 — Audit securite applicative + RGPD (RESEAUTEURS)

**Perimetre.** Branche `master` (HEAD `f6e0be4`), audit statique/local. Focus : ADR-0013 (Reseauteur
Plus, licences, inscriptions en ligne, role partenaire), routes API mutantes, `access` Payload,
`overrideAccess`, SQL brut, RGPD (opt-out, geoloc, contacts facultatifs). Aucune attaque reelle contre un
service tiers ; aucune valeur de secret divulguee ; aucun code modifie.

**Methode.** Lecture de `CLAUDE.md`, ADR-0013, `lib/rate-limit.ts` ; revue de toutes les collections Payload
(`src/collections/*.ts`), de toutes les routes `src/app/api/**/route.ts`, des libs metier
(`lib/licences.ts`, `lib/inscriptions.ts`, `lib/acces-plus.ts`, `lib/reseau-hierarchie.ts`), des fiches SSR
(reseauteur/evenement/partenaire/reseau), du sitemap/robots/JSON-LD, et verification du comportement reel du
framework Payload (`node_modules/payload/dist/fields/hooks/beforeValidate/promise.js`) pour confirmer
empiriquement (au niveau du code, pas d attaque live) le comportement des acces de champ sur `create`.

---

## CRITIQUE

### C1 - Elevation de privilege / contournement total du paiement via POST /api/users (role admin, Reseauteur Plus gratuit)

**Fichiers.** `src/collections/Users.ts:15` (`create: () => true`), `:53-78` (hook beforeChange),
`:504-517` (champ `role`, aucun `access`), `:538-575` (`plusActif`/`plusExpireAt`/`plusSource`/
`plusLicencePack`, `access: { update: isAdmin }` seulement, jamais `create`) ; `src/app/(payload)/api/[...slug]/route.ts`
(monte l API REST generique Payload, y compris POST /api/users, sans garde additionnelle) ; confirme au
niveau framework dans `node_modules/payload/dist/fields/hooks/beforeValidate/promise.js:216`
(`if (field.access && field.access[operation])` : un champ qui ne declare QUE `access.update` n est jamais
verifie lors d un `create`, quel que soit l appelant).

**Cause racine.** Le hook beforeChange de Users.ts qui nettoie role/plan/plusActif/stripeCustomerId
etc. contient une sortie anticipee :

```
if (ctx?.webhookTrusted === true) return data
if (!req.user) return data          // ligne 78 : sortie AVANT tout nettoyage
if (operation === 'create' && req.user.role !== 'admin') { ... }
```

req.user est toujours absent lors d une auto-inscription anonyme, c est-a-dire le cas normal et
attendu de POST /api/users. Le hook ne nettoie donc rien du tout dans ce cas precis, alors que c est
justement le cas qu il est cense proteger. En parallele, le champ role ne declare aucune restriction
access (ni create ni update), et plusActif/plusExpireAt/plusSource/plusLicencePack/plan/
stripeCustomerId/stripeSubscriptionId/planExpiresAt ne declarent qu access.update: isAdmin, jamais
access.create. Or Payload ne verifie l acces d un champ que pour l operation explicitement declaree : sur
un create, field.access['create'] est undefined, donc aucune verification n a lieu, la valeur
fournie par le client passe telle quelle.

**Scenario d exploitation.** Requete HTTP unique, non authentifiee, contre l API REST generique de Payload
(montee par defaut, aucune route custom ne masque /api/users) :

```
POST /api/users
Content-Type: application/json

{
  "email": "attaquant@example.com",
  "password": "MotDePasse123!",
  "nomSociete": "X",
  "ville": "Paris",
  "role": "admin"
}
```

Resultat : compte cree avec role "admin". Payload envoie automatiquement l email de verification (le
flux REST generique ne passe pas par disableVerificationEmail: true, propre a la route custom
/api/auth/register) ; l attaquant clique le lien recu dans sa propre boite et obtient un compte
administrateur complet du back-office (/admin), avec acces a toutes les collections (reseauteurs,
evenements, reseaux, partenaires, licences, utilisateurs).

Variante non-admin, plus discrete et tout aussi grave economiquement :

```
{
  "email": "attaquant2@example.com",
  "password": "MotDePasse123!",
  "nomSociete": "X",
  "ville": "Paris",
  "role": "reseauteur",
  "plusActif": true,
  "plusExpireAt": "2099-01-01T00:00:00.000Z",
  "plusSource": "abonnement"
}
```

Resultat : compte Reseauteur Plus actif a vie, sans jamais payer les 59 euros/an (paragraphe 4.1
CLAUDE.md) ni utiliser de code de licence partenaire (paragraphe 4.3). Contourne integralement l invariant
central du projet : statut payant / quota / role = serveur uniquement, jamais depuis un body de requete
(CLAUDE.md paragraphe 11).

**Correction proposee.**
1. Ajouter access: { create: isAdmin, update: isAdmin } (au lieu d update seul) sur tous les champs
   sensibles de Users (role, plan, plusActif, plusExpireAt, plusSource, plusLicencePack,
   stripeCustomerId, stripeSubscriptionId, planExpiresAt, cguAcceptedAt, confidentialiteAcceptedAt,
   optInMarketingAt, optOutMarketingAt, billingAddress, vatNumber, raisonSocialeFacturation,
   emailBlacklisted et champs lies, pendingEmail et champs lies). Les ecritures serveur legitimes (webhook,
   /api/auth/register, crons) passent deja par overrideAccess: true, qui ignore l access de champ, donc
   aucune regression attendue.
2. Corriger le hook : retirer le if (!req.user) return data premature, ou au minimum forcer
   data.role = 'reseauteur' et supprimer plusActif/plusExpireAt/plusSource/plusLicencePack/plan/
   les champs Stripe avant ce guard (le cas anonyme est justement le cas le plus expose, pas celui a
   ignorer).
3. Verifier ce meme schema (access.update seul + hook conditionne a req.user truthy) sur toutes les
   autres collections avant merge (voir C2/C3 ci-dessous, l audit n a couvert que les collections centrales
   a ADR-0011/0012/0013 dans le temps imparti).

---

### C2 - Usurpation de fiche reseauteur : Reseauteurs.user assignable a un compte tiers via create

**Fichiers.** `src/collections/Reseauteurs.ts:113-136` (access, create: !!user, c est-a-dire tout
utilisateur connecte, quel que soit son role), `:200-213` (garde 1 user = 1 reseauteur), `:384-398`
(champ user, access: { update: isAdmin } seul, jamais create).

**Cause racine.** Meme schema que C1. Le hook qui garantit 1 user = 1 reseauteur verifie uniquement que
l appelant (req.user.id) ne possede pas deja de profil :

```
const { totalDocs } = await req.payload.count({
  collection: 'reseauteurs',
  where: { user: { equals: req.user.id } },   // verifie req.user, PAS data.user
  ...
})
```

Il ne verifie jamais que data.user === req.user.id. Combine a l absence d access.create sur le champ
user, n importe quel compte authentifie (reseauteur, organisateur ou partenaire) peut creer un document
reseauteurs rattache a un autre compte, typiquement un compte organisateur/partenaire/admin qui
n a jamais de profil reseauteur auto-cree (seuls les comptes role: reseauteur en obtiennent un
automatiquement, cf. Users.ts hook afterChange).

**Scenario d exploitation.** Un attaquant authentifie (compte gratuit) connait ou devine l ID numerique d un
compte organisateur ou partenaire cible (IDs sequentiels dans Postgres/Payload, triviaux a enumerer en
petit nombre) et appelle :

```
POST /api/reseauteurs
Authorization: cookie de session de l attaquant

{ "user": 42, "prenom": "Faux", "nom": "Profil", "ville": "Paris", "evenementsParMois": 0 }
```

Resultat : une fiche publique /reseauteur/faux-profil est creee, rattachee au compte 42. Le contenu (nom,
description, photo, secteur) est entierement choisi par l attaquant. Si le compte 42 (organisateur/
partenaire) se connecte ensuite a /dashboard/profil, il decouvre, et peut desormais gerer, un profil
qu il n a jamais cree, avec un contenu potentiellement diffamatoire ou trompeur, indexe publiquement (SEO,
sitemap) tant qu il n est pas noindex. Impact : usurpation d identite / defacement d un compte tiers,
violation directe de l invariant un reseauteur n agit que sur son profil (CLAUDE.md paragraphe 11).

**Correction proposee.** Ajouter access.create (en plus d update) forcant isAdmin, et durcir le
hook pour rejeter tout create ou data.user (une fois resolu) differe de req.user.id (sauf admin),
defense en profondeur meme si l access de champ est corrige.

---

### C3 - Abonnement reseau partenaire contournable a la creation (Reseaux.partenaire, conditions restreintes)

**Fichiers.** `src/collections/Reseaux.ts:91-105` (access.create : organisateur ou admin),
`:373-397` (niveau, access.update seul), `:419-438` (palier, idem), `:779-824`
(partenaire/stripeSubscriptionId/partenaireExpireAt, idem, jamais access.create).

**Cause racine.** Identique a C1/C2. Le gate metier (canCreateNational, validation hierarchie
national/local) s execute dans les hooks beforeChange, apres la phase de resolution des champs ou
l access de champ aurait du s appliquer, et de toute facon aucun hook ne nettoie/rejette data.partenaire,
data.niveau ou data.palier fournis par le client a la creation.

**Scenario d exploitation.** L exploitation directe est bornee par canCreateNational (un organisateur
auto-inscrit possede deja une tete de reseau auto-creee, donc canCreateNational renvoie false pour un
second create). Mais deux chemins realistes levent cette contrainte :
1. Un compte organisateur delegue par l admin (POST /api/admin/deleguer-local, mode B, fonctionnalite
   legitime ADR-0012 paragraphe 6) ne possede aucune tete de reseau (skipAutoCreateReseau: true) et
   satisfait donc canCreateNational.
2. Tout organisateur dont la tete de reseau a ete supprimee/reassignee par un admin retrouve
   canCreateNational === true.

Dans ces deux cas, l organisateur peut appeler directement :

```
POST /api/reseaux
{ "nom": "Mon Reseau", "ville": "Lyon", "niveau": "national", "partenaire": true, "statut": "publiee" }
```

Resultat : un reseau tete est cree avec partenaire true sans jamais passer par Stripe, debloquant
immediatement la publication d evenements, le badge partenaire, le logo en page d accueil (paragraphe 4.2
CLAUDE.md).

**Correction proposee.** Meme remede que C1 : access: { create: isAdmin, update: isAdmin } sur partenaire,
niveau, palier, stripeSubscriptionId, partenaireExpireAt, nbReseauteurs, nbEvenements, statut,
latitude, longitude, source.

---

### C4 - Fuite du contenu de l offre partenaire reservee aux reseauteurs via l API generique (contourne la route dediee)

**Fichiers.** `src/collections/Partenaires.ts:45-55` (lecture publique de la collection si statut: actif),
`:163-177` (groupe offre, aucun access declare) ; `src/app/api/partenaires/[slug]/offre/route.ts`
(route dediee, elle, correctement gardee : canSee = user?.role === 'reseauteur' || user?.role === 'admin',
ligne 42) ; `src/app/(payload)/api/[...slug]/route.ts` (monte GET /api/partenaires sans garde
supplementaire) ; GraphQL (`src/app/(payload)/api/graphql/route.ts`) expose la meme donnee par la meme
faille (aucun graphQL: false dans payload.config.ts).

**Cause racine.** Le commentaire du code affirme explicitement l intention : Le contenu de l offre
n entre jamais dans le HTML statique, il n est renvoye qu aux reseauteurs/admin, mais cette garantie
n existe que dans la route custom. La collection Payload elle-meme autorise la lecture publique de tout
document statut: actif, et le champ offre (groupe titre/description/lien) ne restreint sa lecture a
personne : sans access.read explicite, Payload applique true par defaut
(`node_modules/payload/dist/fields/config/sanitize.js:156-158`, un champ sans access explicite obtient
field.access = {}, donc aucune restriction).

**Scenario d exploitation.** Un visiteur anonyme (aucun compte, aucune session) :

```
GET /api/partenaires?where[slug][equals]=SLUG_DU_PARTENAIRE&depth=0
```

ou l equivalent GraphQL, obtient directement offre.titre, offre.description, offre.lien, alors que la
route /api/partenaires/[slug]/offre renvoie { hasOffre: true, canSee: false } (sans contenu) pour ce meme
visiteur. Le controle d acces metier (offre reservee aux reseauteurs connectes, argument RGPD/ciblage B2B
explicite dans le code) est totalement contournable.

**Correction proposee.** Ajouter un access.read sur le groupe offre (ou sur chacun de ses sous-champs) dans
Partenaires.ts, restreint aux roles reseauteur et admin. Verifier aussi que la fiche
SSR (/partenaire/[slug]) continue de fonctionner : elle utilise overrideAccess: true cote serveur donc
n est pas affectee.

---

### C5 - Falsification possible du journal d audit RGPD (audit-logs)

**Fichiers.** `src/collections/AuditLogs.ts:12-17` (create: () => true, aucune restriction de champ sur
type/userIdHash/metadata).

**Cause racine.** La collection presentee dans son propre commentaire comme Journal d audit RGPD
(anonymise). Preuve de conformite accepte des ecritures non authentifiees sans aucune validation de
coherence (n importe quelle valeur de type, userIdHash, metadata JSON arbitraire).

**Scenario d exploitation.**

```
POST /api/audit-logs
{ "type": "consent_given", "userIdHash": "HASH_ARBITRAIRE", "metadata": { "faux": true } }
```

Resultat : entree acceptee. Un attaquant peut (a) polluer le registre de preuve de conformite RGPD avec des
entrees forgees (fausses preuves de consentement/suppression pour n importe quel userIdHash, y compris
celui d une victime reelle si le hash est reconstituable, sha256(userId + PAYLOAD_SECRET), non trivial
sans le secret, mais un hash arbitraire suffit deja a saper la valeur probante globale du registre) ;
(b) saturer la table par spam. Impact direct sur l invariant RGPD audit intact (CLAUDE.md paragraphes
9/11).

**Correction proposee.** create: isAdmin au niveau collection (toutes les ecritures legitimes, routes
account/delete, account/export, webhooks, hooks Users.ts/Groupes.ts, passent deja par
overrideAccess: true, donc aucune regression).

---

### C6 - Idempotence des webhooks Stripe pre-emptible (stripe-events)

**Fichiers.** `src/collections/StripeEvents.ts:21-26` (create: () => true).

**Cause racine.** Meme schema que C5, applique a la table d idempotence des webhooks Stripe. Exploitabilite
plus faible en pratique (il faut connaitre a l avance un eventId Stripe reel, chaine opaque non
previsible, pour pre-inserer la ligne et faire ignorer l evenement legitime comme duplicate par
markEventSeen() dans src/app/api/stripe/webhook/route.ts), mais le principe de moindre privilege est
viole : cette table ne devrait jamais accepter d ecriture publique.

**Correction proposee.** create: isAdmin (le webhook ecrit deja en overrideAccess: true).

---

## A CORRIGER (moyen)

### M1 - Crons : pas de refus explicite si CRON_SECRET est absent (6 des 7 routes)

**Fichiers.** `src/app/api/cron/archiver-evenements/route.ts:17`, `downgrade-expires/route.ts:23`,
`expiration-alertes/route.ts:24`, `onboarding-emails/route.ts:30`, `purge-anciens/route.ts:15`,
`retry-groupe-sync/route.ts:22`, tous comparent le header Authorization directement a la valeur de
CRON_SECRET sans verifier au prealable que process.env.CRON_SECRET est bien defini. Seuls
`cron/expiration-plus/route.ts:24` et `dev/send-test-email/route.ts:249` font le controle correct
(!process.env.CRON_SECRET en plus de la comparaison stricte).

**Scenario d exploitation.** Si CRON_SECRET n est pas configure en production (erreur de deploiement,
scenario non nominal mais plausible, ex nouvel environnement de preview Vercel sans variables d env), le
template literal produit la chaine Bearer undefined. Un attaquant envoyant litteralement le header
Authorization: Bearer undefined passerait le controle et declencherait le cron manuellement (purge de
donnees, downgrade d abonnements, envoi d emails en masse). N est pas exploitable si CRON_SECRET est
correctement configure (cas nominal attendu).

**Correction proposee.** Harmoniser tous les crons sur le motif deja present dans expiration-plus :
verifier l absence de process.env.CRON_SECRET en plus de la comparaison stricte du header.

### M2 - Suppression de compte incomplete pour le role partenaire

**Fichiers.** `src/app/api/account/delete/route.ts:71-110`, la logique gere explicitement
role reseauteur et role organisateur, mais aucune branche pour role partenaire.

**Detail.** L annulation Stripe en tete de fonction (hadSubscription base sur
freshUser.stripeSubscriptionId) ne s applique jamais a un partenaire : l abonnement annonceur est stocke
sur partenaires.stripeSubscriptionId (pose par activerPartenaireAnnonceur dans le webhook), jamais sur
users.stripeSubscriptionId (confirme : `src/app/api/stripe/webhook/route.ts:217-235`,
`src/app/api/stripe/checkout/route.ts:259-274` ne mirorrent que stripeCustomerId sur users). Consequence :
quand un partenaire supprime son compte, (a) son abonnement Stripe continue d etre facture sans qu il
puisse plus jamais le gerer (le stripeCustomerId du user disparait avec le compte), (b) sa fiche
partenaires est orpheline (user mis a null via ON DELETE SET NULL) mais reste statut actif, continuant
d apparaitre sur la home, la page /partenaires et sa fiche publique, avec ses packs de licences et codes
promo toujours valides.

**Correction proposee.** Ajouter une branche role partenaire : annuler
partenaires.stripeSubscriptionId via Stripe, passer statut a expire, et documenter le sort des packs de
licences deja distribues (a minima les marquer expire pour stopper toute nouvelle activation).

### M3 - access update sans miroir create : schema a auditer systematiquement

Au-dela des instances confirmees (C1/C2/C3), le motif seul access.update declare, jamais access.create
est systemique dans ce depot (Evenements.ts : statut, lieuLatitude, lieuLongitude, sans impact grave car
le create est de toute facon garde par des hooks metier robustes ; LicencesPacks.ts : mitige par
create: isAdmin au niveau collection ; etc.). Les instances trouvees avec un impact reel ont ete promues
en CRITIQUE ; celles ou la collection restreint deja create a l admin (donc sans impact) n ont pas ete
listees. Recommandation : revue exhaustive de toutes les collections avant merge, remplacer
systematiquement access update seul par access create et update ensemble sur tout champ pose serveur
uniquement, ou mieux : ecrire un test automatise qui echoue si un champ sensible (liste explicite) ne
declare pas create et update.

### M4 - Groupes : creation directe possible en contournant la route metier (impact limite, fonctionnalite dormante)

**Fichiers.** `src/collections/Groupes.ts:24` (create: Boolean(user), tout utilisateur connecte) versus
`src/app/api/groupes/create/route.ts:58-63` (verifie getEffectiveFeatureLevel different de infinite).
getEffectiveFeatureLevel (`src/collections/access.ts:107-118`) ne retourne jamais la valeur litterale
infinite (seulement acces, developpement ou premium), la route legacy est donc deja structurellement
non-fonctionnelle (toujours 403) pour tout le monde. Un appel direct POST /api/groupes contourne cette
route cassee et permet de creer des lignes groupes orphelines. Impact reel negligeable : la fonctionnalite
est dormante et masquee cote UI (ADR-0009), et le pendant /api/groupes/join est egalement toujours
bloque. Recommandation : create: isAdmin au niveau collection en attendant une remise en etat ou une
suppression propre du module dormant.

### M5 - Server action updatePartenaire utilise overrideAccess true plutot que la delegation stricte

**Fichier.** `src/app/(frontend)/dashboard/partenaire/actions.ts:44-58`. La mutation est actuellement sure
(le payload envoye a payload.update est construit explicitement, sans jamais inclure statut/stripe),
mais le motif differe de celui, plus robuste, utilise dans mes-evenements/actions.ts
(overrideAccess false plus user courant, qui delegue a l access control de la collection comme filet de
securite supplementaire). Recommandation (defense en profondeur) : aligner sur overrideAccess false,
pour que toute evolution future du formulaire ne puisse pas accidentellement reintroduire un champ
sensible sans qu une seconde barriere (l access de la collection) ne l intercepte.

---

## DURCISSEMENT

- **D1 - Rate-limit codes de licence / activation** : POST /api/licences/activer limite a 5
  tentatives par minute par compte (`src/app/api/licences/activer/route.ts:27-33`), suffisant vu l espace
  de codes (32 caracteres puissance 8, environ 1,1 fois dix puissance 12 combinaisons, generes par
  crypto.randomBytes) mais uniquement par compte, un attaquant multi-comptes (limite par le rate-limit
  register 5 par heure par IP) pourrait paralleliser. Non prioritaire vu l entropie des codes ; envisager
  un compteur global/IP en complement si le volume de partenaires grandit.
- **D2 - rel noopener noreferrer manquant sur quelques Link target blank internes** (ex.
  `src/app/(frontend)/dashboard/(reseauteur)/mes-evenements/MesEvenementsClient.tsx:379,416`,
  `src/app/(frontend)/inscription/page.tsx:405,413`), tous vers des URLs internes (meme origine), donc
  sans risque de tabnabbing cross-origin reel. Toutes les URLs externes controlees par un tiers (site
  web, LinkedIn, reseaux sociaux, plaquette PDF, offre partenaire, lien d inscription) ont bien
  rel noopener noreferrer, verifie par balayage exhaustif du depot. Correction cosmetique seulement.
- **D3 - Captcha/anti-bot sur /api/auth/register** : le rate-limit IP (5 par heure) est une bonne defense
  en profondeur documentee comme telle (lib/rate-limit.ts, limites connues en environnement serverless
  multi-instance). Envisager un captcha (Turnstile/hCaptcha) si le volume d inscriptions automatisees
  devient un probleme observe en production.
- **D4 - En-tetes de securite HTTP** (CSP, X-Frame-Options, Referrer-Policy) non verifies dans le
  perimetre de cet audit (hors next.config.ts), a revoir separement si non deja couvert par un audit
  precedent.

---

## Points verifies - PASS

- **Inscriptions aux evenements Plus** (/api/evenements/inscription, lib/inscriptions.ts) : gardes
  serveur completes (evenement Plus + publie + a venir, profil reseauteur requis, unicite applicative +
  index unique DB inscriptions_evenement_reseauteur_idx). Liste des inscrits (listerInscrits, utilisee
  dans dashboard/(reseauteur)/mes-evenements/page.tsx:48-55) strictement scopee aux evenements dont
  organisateurReseauteur correspond au profil de l utilisateur connecte, aucune fuite inter-organisateurs.
  Collection Inscriptions : create/update/delete reserves a isAdmin (les routes passent en overrideAccess),
  read scope (reseauteur voit ses inscriptions, organisateur voit celles de ses evenements).
- **Activation de licence** (lib/licences.ts) : transaction atomique SELECT FOR UPDATE sur le pack et
  sur users, decrement de quota et passage Plus dans la meme transaction, unicite applicative + index
  unique DB licences_activations_user_idx, rate-limit 5 par minute par compte, format de code valide cote
  serveur (regex stricte), appartenance du code au partenaire verifiee via jointure SQL parametree.
- **/api/partenaires/[slug]/offre** (la route elle-meme, isolement) : ne renvoie le contenu qu aux
  roles reseauteur et admin, valide l URL du lien (http/https), ne fuit rien dans le HTML statique
  de la fiche SSR (le contournement possible via l API generique est documente en C4).
- **SQL brut d agregat /reseaux** (`src/app/(frontend)/reseaux/page.tsx:176-205`) : nationalIds filtre a
  des entiers finis (Number.isFinite) avant interpolation dans la requete SQL parametree, aucune chaine
  attaquant-controlee n atteint la requete. Idem pour les endpoints bbox geospatiaux
  (/api/geo/reseaux, /api/geo/reseauteurs, /api/geo/evenements) : validation Zod stricte
  (bornes lat/lng, enum, longueur max) avant toute requete PostGIS parametree.
- **Webhook Stripe** : signature HMAC verifiee (stripe.webhooks.constructEvent) avant tout traitement,
  idempotence persistante (stripe-events, contrainte UNIQUE eventId), tous les statuts payants poses en
  overrideAccess true cote serveur uniquement, jamais depuis le body client.
- **/api/stripe/checkout** : auth requise, ownership verifiee serveur (reseau/partenaire/pack), garde
  anti-double-checkout, rate-limit 10 par minute par compte.
- **/api/auth/register** : rate-limit 5 par heure par IP (corrige le gap de l audit precedent), roles
  limites a reseauteur/organisateur/partenaire (jamais admin), mot de passe 8 caracteres minimum,
  allowlist explicite de champs (pas de spread du body brut).
- **Crons** : tous proteges par Authorization Bearer CRON_SECRET (defaut correct pour 1 sur 7 ;
  comparaison stricte pour les 6 autres, voir M1 pour la nuance sur le cas secret non configure).
- **RGPD reseauteur** : geolocalisation au niveau ville/centroide uniquement (jamais l adresse, hook de
  geocodage appele sans adresse ni code postal, Reseauteurs.ts:340-352) ; contacts telephone/email
  affiches uniquement si renseignes (verifie fiche SSR + route publique + export RGPD) ; noindex force
  tant que statut est different de valide et respecte par le sitemap (exclusion explicite) et le JSON-LD
  Person (rendu conditionne a isIndexable, telephone/email jamais inclus dans le JSON-LD, commentaire
  explicite scrapable dans reseauteur/[slug]/page.tsx:115) ; robots.ts bloque /api/, /dashboard/, /admin/.
  Export RGPD (/api/account/export) et suppression (/api/account/delete) fonctionnels pour
  reseauteur/organisateur (voir M2 pour la lacune partenaire) avec audit-log pseudonymise (hashUserId).
- **.env non versionnes** : seul test.env est suivi par git, il ne contient qu une variable NODE_OPTIONS
  non sensible (aucun secret). Aucune cle Stripe/DB/Resend/CRON en clair trouvee dans le code source
  (toutes via process.env).
- **Liens externes** : rel noopener noreferrer systematique sur tous les liens target blank vers
  des domaines tiers (verifie par balayage exhaustif) ; URLs validees cote serveur (protocole http/https)
  avant stockage (site, siteWeb, lienInscription, plaquetteUrl, offre lien, reseaux sociaux).

---

## Verdict de gate : BLOCK

Six failles CRITIQUES partagent une cause racine systemique et directement exploitable (C1 en particulier :
une seule requete HTTP non authentifiee suffit a obtenir un compte admin ou un acces Reseauteur Plus
gratuit a vie). Ceci contredit frontalement l invariant numero un du projet (statut payant/quota/role =
serveur uniquement, jamais depuis un body de requete, CLAUDE.md paragraphe 11) et constitue un risque
business et securite majeur si deploye en l etat. Aucune mise en production tant que C1 a C6 ne sont pas
corriges (le correctif est mecanique et de faible risque de regression : ajouter access.create en miroir
d access.update sur les champs listes, ou pour audit-logs/stripe-events passer create a isAdmin).

## Top 5 des risques les plus exploitables

1. **C1 - POST /api/users avec role admin ou plusActif true** : zero prerequis, une seule requete
   HTTP non authentifiee, impact maximal (admin total ou contournement complet de la monetisation B2C).
2. **C4 - Fuite de l offre partenaire via l API generique Payload** : zero prerequis, une seule requete
   GET non authentifiee ; contourne une protection explicitement concue et documentee dans le code.
3. **C2 - Usurpation de fiche reseauteur (Reseauteurs.user arbitraire a la creation)** : necessite
   seulement un compte authentifie (n importe quel role, gratuit), cible des comptes organisateur/
   partenaire/admin sans profil reseauteur existant.
4. **C5 - Falsification du journal d audit RGPD** (audit-logs, create ouvert a tous) : zero prerequis,
   sape la valeur probante de la preuve de conformite RGPD.
5. **C3 - Abonnement reseau partenaire contournable a la creation** : prerequis plus etroit (organisateur
   delegue ou sans tete de reseau), mais impact business direct (abonnement B2B gratuit).

## Bloquants avant merge/deploiement

- Corriger C1 a C6 (ajout systematique d access.create miroir d access.update, ou create isAdmin pour
  audit-logs/stripe-events) - obligatoire avant toute mise en production, y compris en preproduction
  publiquement accessible.
- Completer M2 (suppression de compte partenaire) avant d activer plus largement l abonnement annonceur en
  self-service, pour eviter une facturation Stripe orpheline apres suppression de compte.
- Harmoniser M1 (garde CRON_SECRET absent) avant tout deploiement sur un environnement ou la variable
  pourrait manquer (preview Vercel notamment).
