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
chaud, neutres zinc, bleu de marque, accent orange pour la conversion, accent violet secondaire, et
quelques **bandes sombres near-black** en contraste. Sentence case partout.

## 1. Typographie

- **Police : Hanken Grotesk** (Google Fonts), graisses **400 / 500 / 600 / 700 / 800**.
- Import recommandé via `next/font/google` :
  ```ts
  import { Hanken_Grotesk } from "next/font/google";
  export const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-sans" });
  ```
- Échelle de tailles observée : corps 14–16px, légende/labels 13px, titres de section 19–32px (titres marketing plus grands au hero). `line-height` confortable.
- Deux usages de graisse dominants : 400 (corps) et 500/600 (labels, sous-titres) ; 700/800 pour les titres et chiffres clés.

## 2. Couleurs (tokens)

### Marque
| Rôle | Hex | Usage |
|---|---|---|
| Bleu primaire | `#2563EB` | logo, primaire/CTA principal, liens |
| Bleu navy | `#16284f` / `#1a3d8f` | titres, texte de marque, fonds bleus profonds |
| Bleu medium | `#0b63b6` | variantes, hovers |
| Bleu tint | `#bfdbfe` / `#93c5fd` | fonds doux, badges, états |
| **Orange accent** | `#f5851f` (clair `#f0855c`) | **conversion** : CTA secondaires, bloc organisateur, surlignage |
| Violet secondaire | `#a855f7` (`#b07cff`, `#c9a8ff`, `#7b4dd8`) | accent décoratif / catégories / dégradés ponctuels |
| Rouge | `#e2231a` | réservé aux logos partenaires (ex. BNI), pas un token système |

### Neutres (échelle zinc shadcn)
`#ffffff` · `#fafafa` · `#f4f4f4` · `#e4e4e7` · `#d4d4d8` · `#a1a1aa` · `#71717a` · `#52525b` · `#26262b` · `#18181b` · `#09090b`

### Surfaces
| Rôle | Hex |
|---|---|
| Canvas (page) | `#faf9f5` (warm off-white) |
| Surface / carte | `#ffffff` |
| Bordure | `#e4e4e7` |
| Texte principal | `#18181b` (titres : navy `#16284f`) |
| Texte secondaire | `#71717a` |
| **Sections sombres** (fond) | `#0d0d10` / `#111114` / `#141417` |
| Texte sur sombre | `#fafafa` (secondaire `#a1a1aa`) |

### Mapping shadcn / CSS variables (à poser dans `globals.css`)
Définir `:root` (clair) et `.dark`/`.section-dark` (bandes sombres). Convertir les hex en HSL/oklch selon la convention shadcn. Correspondances :
`--background:#faf9f5` · `--foreground:#18181b` · `--card:#ffffff` · `--border:#e4e4e7` · `--muted:#f4f4f4` · `--muted-foreground:#71717a` · `--primary:#2563EB` (foreground `#ffffff`).
Tokens de marque additionnels (hors shadcn) : `--brand-navy:#16284f` · `--brand-orange:#f5851f` · `--brand-purple:#a855f7`. Les bandes sombres utilisent `--background:#0d0d10` / `--foreground:#fafafa`.

## 3. Rayons (border-radius)

Généreux. Échelle observée : `sm 9–10px` · **`md 11–13px` (cartes, inputs, boutons)** · `lg 16px` (grands conteneurs) · `xl 18–20px` (panneaux hero) · `full 999px` (badges, pills, puces de carte).
Tailwind : mapper `--radius` ≈ `12px` et dériver `sm/md/lg/xl` en conséquence.

## 4. Composants (conventions)

- **Boutons** : radius ~12px, deux graisses ; primaire bleu plein, secondaire orange (conversion) ou outline neutre. Pills 999px pour les badges/tags.
- **Cartes** : fond blanc, bordure `#e4e4e7`, radius 12–16px, ombre douce et discrète (pas d'effets lourds).
- **Badges / puces de carte** : pills colorées (bleu/orange/violet/vert) avec compteur — voir la carte.
- **Sections** : alternance canvas `#faf9f5` ↔ blanc ↔ **une bande sombre** (`#0d0d10`) pour « Le réflexe des professionnels ». Espacements verticaux généreux.
- **Compteurs animés** (chiffres clés) en 700/800, gros.
- Pas de sur-formatage : ombres/effets discrets, conformes à la sobriété de la maquette.

## 5. Structure de la page d'accueil (MODÈLE 3 ENTITÉS — comprise en < 30 s, voir cadrage §6)

> Réutilise le **rythme visuel** et les composants de la maquette (hero, bandeau logos, bandes alternées,
> bande sombre, compteurs, bloc orange de conversion). **Objectif n°1 : qu'un nouvel arrivant comprenne en
> moins de 30 secondes que RÉSEAUTEURS rassemble les pros, les événements et les réseaux.** Pas de section
> superflue.

1. **En-tête** — logo **RÉSEAUTEURS** + tagline (« la plateforme nationale du networking »), nav
   (**Réseauteurs**, **Événements**, **Réseaux**, **Partenaires**), boutons **Connexion** + **Créer mon
   profil** (orange, gratuit).
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
7. **Bandeau Partenaires** *(accent orange en filigrane)* — logos des **partenaires annonceurs** + lien vers
   la page Partenaires ; encart discret « Réseau ? Devenez partenaire » (renvoi B2B, **pas** un freemium
   réseauteur).
8. **Newsletter** — « Restez informé des nouveaux pros et événements près de chez vous ».
9. **Pied de page** — liens (À propos, FAQ, Partenaires, Mentions légales, CGU, **Confidentialité/RGPD**,
   Contact), réseaux sociaux, copyright.

> **Note conversion :** la monétisation est **B2B** (réseaux & annonceurs), pas un Premium réseauteur. Le
> bloc orange « conversion » de la maquette est réaffecté au **renvoi partenaires/réseau partenaire**, jamais
> à un paiement réseauteur.

## 6. Cartes (référence visuelle pour `map-engineer` — DEUX cartes)

Réutiliser le **style** de la maquette : **clusters en pastilles colorées avec compteur**
(bleu/orange/violet/vert), zoom +/−, barre de recherche + bouton Filtres, plein écran + bottom-sheet mobile.

- **Carte des réseauteurs** — marqueur = **une personne** ; preview = **carte de profil** (photo, nom,
  entreprise, ville, **badge** Bronze/Argent/Gold/Platinum, réseaux fréquentés en pills, CTA bleu « Voir le
  profil »). Filtres de premier rang : **métier / secteur / réseau / ville / badge**. **Pas d'axe date** (un
  réseauteur est persistant).
- **Carte des événements** — marqueur = **un événement** ; preview = image, titre, **date**, ville,
  description courte, CTA « S'inscrire » (**lien externe** vers le réseau). Filtres : **réseau / ville /
  date**. Les **événements Premium ont un marqueur spécifique** (couleur différente, badge Premium) et
  passent **devant** dans le tri/regroupement.
- **Géolocalisation réseauteur** : niveau **ville/commune** par défaut (pas d'adresse personnelle exacte) —
  confidentialité simple, sans double `geom`.

Lib : **MapLibre** (ADR-0006) — la **parité visuelle** prime sur la lib.

## 7. Checklist de portage (pour `frontend-builder`)

- [ ] Police Hanken Grotesk via `next/font` (variable `--font-sans`).
- [ ] Tokens couleurs dans `globals.css` (`:root` clair + bande sombre) et `tailwind.config`.
- [ ] `components.json` shadcn aligné sur ces variables.
- [ ] Primitives (Button, Card, Badge/Pill, Input, Section, StatCounter) conformes radius/graisses.
- [ ] **Badge réseauteur** (Bronze/Argent/Gold/Platinum) stylé en pill (4 variantes de couleur).
- [ ] Home reconstruite **section par section selon §5** — **test des 30 secondes** : un inconnu comprend les
      3 entités et le principe « on rassemble » ; comparée à ~380px et desktop.
- [ ] **Deux previews carte distinctes** : carte de profil (réseauteur) vs carte d'événement (date + Premium).
- [ ] Accent **orange = renvoi B2B/partenaires** (pas un paiement réseauteur), **bleu = primaire**,
      **violet = accent secondaire**, **bande sombre** pour le contraste.
- [ ] a11y : contrastes (orange sur clair, texte sur bandes sombres), focus visibles.
- [ ] Copie **RÉSEAUTEURS** partout (aucun « Info-Réseaux » ni « Panorama Pub » résiduel).
