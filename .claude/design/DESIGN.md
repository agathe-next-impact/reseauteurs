# DESIGN.md — Système de design RÉSEAUTEURS

> **Réaligné le 2026-06-28 sur le modèle à TROIS ENTITÉS (ADR-0011).** Le produit est **la plateforme
> nationale du networking** : trois entités reliées (réseauteurs · événements · réseaux), **deux cartes**, et
> une **priorité absolue à la simplicité** (site compris en < 30 s).
>
> **Deux statuts distincts à ne pas confondre :**
> - **Les TOKENS visuels (typo, couleurs, rayons, composants — §1 à §4) sont la SOURCE DE VÉRITÉ conservée.**
>   Ils portent l'identité de marque et restent valides.
> - **La STRUCTURE (home, cartes — §5, §6) est décrite pour le modèle 3 entités, sous contrainte de
>   simplicité.** La maquette `.claude/design/info-reseaux-plasma.html` ne vaut que comme **référence de
>   tokens** (palette, typo, rayons, style des clusters/cartes). En cas de doute sur une **valeur de token**,
>   la maquette tranche ; sur la **structure**, c'est ce fichier (§5/§6) et le cadrage (`docs/evolution/`).
>   ⚠️ **Règle d'or design : la simplicité prime.** Toute section ou contrôle qui n'aide pas un nouvel
>   utilisateur à comprendre le site en 30 secondes est à questionner.

Esthétique : SaaS clair et rassurant (héritage Plasma re-skinné), **mode clair dominant** sur canvas
gris très clair, neutres ancrés sur le gris de marque, bleu de marque, **accent jaune** pour la
conversion, bleu médian secondaire, et quelques **bandes sombres near-black** en contraste.
Sentence case partout.

## 1. Typographie

- **Jeu typographique « institution neutre »** (décision 2026-07-22 — remplace Hanken Grotesk) :
  - **Corps / UI : Inter** → token `--font-sans`.
  - **Titres : Inter Tight** (compagnon resserré, dessiné pour le display) → token `--font-display`,
    appliqué à `h1/h2/h3` via une règle `@layer base` dans `styles.css` (aucun composant à toucher).
- Les deux sont chargées en **variable font** : `weight` est omis, donc un seul fichier par famille
  couvre 100→900 (les graisses utilisées restent 400 corps / 500-600 labels / 700-800 titres).
- Le subset `latin` de Google couvre `U+0152-0153`, donc **`œ`** (cœur, œuvre) est inclus :
  pas besoin de `latin-ext`.
- Import via `next/font/google` :
  ```ts
  import { Inter, Inter_Tight } from "next/font/google";
  const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
  const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
  ```
- Échelle de tailles observée : corps 14–16px, légende/labels 13px, titres de section 19–32px (titres marketing plus grands au hero). `line-height` confortable.
- Deux usages de graisse dominants : 400 (corps) et 500/600 (labels, sous-titres) ; 700/800 pour les titres et chiffres clés.

## 2. Couleurs (tokens)

### Palette de marque (source — palette fournie le 2026-07-22)

Cinq couleurs, et **rien d'autre** comme point de départ. Tout le reste en est dérivé
(même teinte, luminosité recalée pour l'accessibilité).

| Palette | Hex | Rôle |
|---|---|---|
| Bleu profond | **`#035AA6`** | primaire — réseauteurs, liens, boutons, clusters de carte |
| Bleu clair | **`#8BB4D9`** | tints, bordures de badge, dégradés (surtout en thème sombre) |
| Jaune | **`#F5E050`** | accent vif — CTA de conversion, partenaires, événements Plus |
| Gris | **`#999A9D`** | texte secondaire, icônes discrètes, marqueurs neutres |
| Gris très clair | **`#F2F2F2`** | canvas de page |

### Tons dérivés
| Rôle | Hex | Usage |
|---|---|---|
| Navy | `#012A4A` | titres, bandeaux sombres bleus, **texte posé sur un aplat jaune** |
| Bleu hover / lien | `#02467F` | états survolés du primaire, liens de prose |
| Bleu pressé | `#01365F` | état actif |
| Bleu médian | `#3E7CA6` | **entité Réseaux** (ex-violet), 2ᵉ arrêt des dégradés |
| Bleu tints | `#A9C9E4` · `#DCEAF5` · `#EFF5FA` | fonds doux, encarts, badges |
| Jaune hover | `#E3CB2E` | survol des aplats jaunes |
| **Or foncé** | `#8A6D0B` | **le jaune quand il sert de TEXTE ou d'icône** (4,9:1 sur blanc) |
| Jaune tints | `#FBF4D3` · `#FEFBE6` · bordure `#EFE08F` | encarts partenaires / événements |
| Rouge | `#e2231a` | réservé aux logos partenaires (ex. BNI), pas un token système |

> **Règle de contraste, non négociable :** `#F5E050` ne sert **jamais** de couleur de texte.
> En aplat il porte du navy `#012A4A` ; en texte/icône il devient `#8A6D0B`.
> Les anneaux de focus restent **bleus** (`#035AA6`) — un anneau jaune est invisible sur blanc.

### Neutres (rampe ancrée sur `#999A9D` / `#F2F2F2` — noms `zinc-*` conservés)
`#ffffff` · `#fafafa` · `#E9E9EA` · `#DFE0E1` · `#CFD0D2` · `#999A9D` · `#6E7175` · `#4E5155` · `#3F4247` · `#2A2C30` · `#1D1E21` · `#0C1219`

### Surfaces
| Rôle | Hex |
|---|---|
| Canvas (page) | `#F2F2F2` |
| Surface / carte | `#ffffff` |
| Bordure | `#DFE0E1` |
| Texte principal | `#1D1E21` (titres : navy `#012A4A`) |
| Texte secondaire | `#6E7175` (discret : `#999A9D`) |
| **Sections sombres** (fond) | `#0C1219` / `#101720` |
| Texte sur sombre | `#fafafa` (secondaire `#999A9D`) |

### Couleur par entité (cartes, badges, charts)
| Entité | Aplat / marqueur | En texte |
|---|---|---|
| Réseauteurs | `#035AA6` | `#035AA6` |
| Événements (réseau) | `#012A4A` | `#012A4A` |
| Événements (réseauteur Plus) | `#F5E050` | `#8A6D0B` |
| Réseaux | `#3E7CA6` | `#3E7CA6` |
| Partenaires / conversion | `#F5E050` (texte navy) | `#8A6D0B` |

### Mapping shadcn / CSS variables (`src/app/(frontend)/styles.css`)
`--background:#F2F2F2` · `--foreground:#1D1E21` · `--card:#ffffff` · `--border:#DFE0E1` · `--muted:#E9E9EA` · `--muted-foreground:#6E7175` · `--primary:#035AA6` (foreground `#ffffff`).
Tokens de marque additionnels (hors shadcn) : `--color-brand-navy:#012A4A` · `--color-brand-orange:#F5E050` *(nom historique = l'accent jaune)* · `--color-brand-accent-text:#8A6D0B` · `--color-brand-accent-on:#012A4A` · `--color-brand-reseau:#3E7CA6`. Les bandes sombres utilisent `--background:#0C1219` / `--foreground:#fafafa`.

### Règles de traitement (décision 2026-07-22)

**Zéro dégradé.** Aucun `linear-gradient` / `radial-gradient` décoratif : fonds, boutons,
badges, panneaux et courbes sont des **aplats unis**. Seules exceptions, qui ne produisent
aucun dégradé perçu : les **trames de lignes 1 px** (fonds quadrillés), les **mask-image**
(fondu de bord d'un marquee ou d'une trame) et le **balayage de chargement** des squelettes.

**Titres — surlignement partiel.** Le mot mis en avant d'un titre est placé dans un `<span>` ;
la bande de surlignage est posée en CSS via `text-decoration` (donc indépendante du
`line-height` et compatible avec les retours à la ligne) :

| Contexte | Couleur | Traitement |
|---|---|---|
| Fond clair (texte foncé) | `#F5E050` | bande épaisse `0.3em`, décalage `-0.055em` → **recouvre le bas des lettres** |
| Fond sombre / navy (texte clair) | `#F5E050` | filet `0.13em`, décalage `0.1em` → **passe sous les lettres** (lisibilité) |

Sélecteurs concernés : `.ir-atlas-title span`, `.rsn-pagehead-title span`, `.rsn-h2 span`,
et la classe utilitaire `.rsn-mark`. Variables : `--ir-mark`, `--ir-mark-size`, `--ir-mark-offset`.
Le texte en dégradé (`background-clip: text`) est **supprimé**.

**Icônes — jeu light, sans pastille.** `lucide-react`, épaisseur de trait **1,25** posée
globalement en CSS (`.lucide { stroke-width: 1.25 }`) plutôt que prop par prop.
**Aucun arrière-plan d'icône** : ni pastille colorée, ni cercle, ni carré — l'icône est posée
nue, sa couleur portant le sens. *(Restent des conteneurs à fond : les pastilles d'initiales,
les cadres d'image et les boutons — ce ne sont pas des icônes.)*

## 3. Rayons (border-radius)

Généreux. Échelle observée : `sm 9–10px` · **`md 11–13px` (cartes, inputs, boutons)** · `lg 16px` (grands conteneurs) · `xl 18–20px` (panneaux hero) · `full 999px` (badges, pills, puces de carte).
Tailwind : mapper `--radius` ≈ `12px` et dériver `sm/md/lg/xl` en conséquence.

## 4. Composants (conventions)

- **Boutons / CTA** : **aplat uni obligatoire** (aucun dégradé), radius ~12px, deux graisses ;
  primaire bleu `#035AA6` plein, secondaire **jaune `#F5E050` avec texte navy `#012A4A`**
  (conversion) ou outline neutre. Pills 999px pour les badges/tags.
- **Cartes** : fond blanc, bordure `#DFE0E1`, radius 12–16px, ombre douce et discrète (pas d'effets lourds).
- **Badges / puces de carte** : pills en **aplat uni** (bleu / jaune / bleu médian / vert) avec compteur — voir la carte.
- **Icônes** : trait fin (1,25), taille 13–26px, **jamais de fond** derrière l'icône.
- **Sections** : alternance canvas `#F2F2F2` ↔ blanc ↔ **une bande sombre** (`#0C1219`) pour « Le réflexe des professionnels ». Espacements verticaux généreux.
- **Compteurs animés** (chiffres clés) en 700/800, gros.
- Pas de sur-formatage : ombres/effets discrets, conformes à la sobriété de la maquette.

## 5. Structure de la page d'accueil (MODÈLE 3 ENTITÉS — comprise en < 30 s, voir cadrage §6)

> Réutilise le **rythme visuel** et les composants de la maquette (hero, bandeau logos, bandes alternées,
> bande sombre, compteurs, bloc jaune de conversion). **Objectif n°1 : qu'un nouvel arrivant comprenne en
> moins de 30 secondes que RÉSEAUTEURS rassemble les pros, les événements et les réseaux.** Pas de section
> superflue.

1. **En-tête** — logo **RÉSEAUTEURS** + tagline (« la plateforme nationale du networking »), nav
   (**Réseauteurs**, **Événements**, **Réseaux**, **Partenaires**), boutons **Connexion** + **Créer mon
   profil** (jaune, gratuit).
2. **Hero** — titre marketing (« Tous les pros, tous les événements, tous les réseaux. Au même endroit. »),
   sous-texte (« le site ne remplace aucun réseau, il les rassemble »), double CTA (bleu **« Explorer la
   carte des réseauteurs »** + secondaire **« Voir les événements »**), réassurance (gratuit pour les
   réseauteurs).
3. **Bandeau logos** — « Tous les réseaux réunis » (BNI, DCF, CJD, Dynabuy, CPME, Rotary, Initiative…) —
   positionnement « on les rassemble ».
4. **Trois piliers** — trois cartes côte à côte, **le cœur du message** :
   - **Réseauteurs** — « Trouvez les pros qui réseautent près de chez vous » → carte des réseauteurs.
   - **Événements** — « Tous les événements business sur une carte » → carte des événements.
   - **Réseaux** — « Découvrez les réseaux et leurs membres » → annuaire des réseaux.
5. **Comment ça fonctionne** — 3 étapes simples (**Créez votre profil gratuit → Apparaissez sur la carte →
   Trouvez & soyez trouvé**).
6. **Chiffres clés** — compteurs (**+N réseauteurs, +N événements, +N réseaux, +N villes**), carte de France.
7. **Bandeau Partenaires** *(accent jaune en filigrane)* — logos des **partenaires annonceurs** + lien vers
   la page Partenaires ; encart discret « Réseau ? Devenez partenaire ».
8. **Newsletter** — « Restez informé des nouveaux pros et événements près de chez vous ».
9. **Pied de page** — liens (À propos, FAQ, Partenaires, Mentions légales, CGU, **Confidentialité/RGPD**,
   Contact), réseaux sociaux, copyright.

> **Note conversion :** la monétisation est **mixte** — réseauteur **Plus** (39 € HT/an, B2C), réseau
> partenaire par paliers et partenaire annonceur (B2B). Le réseauteur reste **gratuit par défaut** ; le bloc
> jaune « conversion » de la maquette sert les CTA d'abonnement (Plus / partenaires). Le paiement se fait
> dans le **hub `/dashboard/abonnement`** (ADR-0016), pas sur les écrans publics.

## 6. Cartes (référence visuelle pour `map-engineer` — DEUX cartes)

Réutiliser le **style** de la maquette : **clusters en pastilles colorées avec compteur**
(bleu / jaune / bleu médian / vert), zoom +/−, barre de recherche + bouton Filtres, plein écran + bottom-sheet mobile.

- **Carte des réseauteurs** — marqueur = **une personne** ; preview = **carte de profil** (photo, nom,
  entreprise, ville, **badge** Bronze/Argent/Gold/Platinum, réseaux fréquentés en pills, CTA bleu « Voir le
  profil »). Filtres de premier rang : **métier / secteur / réseau / ville / badge**. **Pas d'axe date** (un
  réseauteur est persistant).
- **Carte des événements** — marqueur = **un événement** ; preview = image, titre, **date**, ville,
  description courte, CTA d'inscription — **lien externe** (événement de réseau) ou **inscription en ligne**
  (événement de réseauteur Plus, ADR-0013). Filtres : **réseau / ville / département / type / gratuit-payant /
  date**. **Pas de marqueur Premium** (drapeau supprimé, ADR-0012) — aucun événement n'est mis en avant contre paiement.
- **Géolocalisation réseauteur** : niveau **ville/commune** par défaut (pas d'adresse personnelle exacte) —
  confidentialité simple, sans double `geom`.

Lib : **MapLibre** (ADR-0006) — la **parité visuelle** prime sur la lib.

## 7. Checklist de portage (pour `frontend-builder`)

- [x] Polices Inter (`--font-sans`) + Inter Tight (`--font-display`) via `next/font`, en variable font.
- [ ] Tokens couleurs dans `globals.css` (`:root` clair + bande sombre) et `tailwind.config`.
- [ ] `components.json` shadcn aligné sur ces variables.
- [ ] Primitives (Button, Card, Badge/Pill, Input, Section, StatCounter) conformes radius/graisses.
- [ ] **Badge réseauteur** (Bronze/Argent/Gold/Platinum) stylé en pill (4 variantes de couleur).
- [ ] Home reconstruite **section par section selon §5** — **test des 30 secondes** : un inconnu comprend les
      3 entités et le principe « on rassemble » ; comparée à ~380px et desktop.
- [ ] **Deux previews carte distinctes** : carte de profil (réseauteur) vs carte d'événement (date ; pas de marqueur Premium).
- [ ] Accent **jaune `#F5E050` = conversion (CTA abonnement Plus / partenaires)**, **bleu `#035AA6` = primaire**,
      **bleu médian `#3E7CA6` = accent secondaire (Réseaux)**, **bande sombre** pour le contraste.
- [ ] a11y : contrastes — **jamais de texte jaune** (utiliser l'or foncé `#8A6D0B`), texte navy sur les aplats
      jaunes, texte clair sur les bandes sombres, **focus visibles en bleu**.
- [ ] Copie **RÉSEAUTEURS** partout (aucun « Info-Réseaux » ni « Panorama Pub » résiduel).
