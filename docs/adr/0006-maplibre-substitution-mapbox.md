# ADR-0006 — Substituer MapLibre GL à Mapbox GL (couche UI uniquement)

- **Statut :** Accepté
- **Date :** 2026-06-23 (mise à jour 2026-06-23 après arbitrages)
- **Décideurs :** `solution-architect` + `map-engineer`
- **Portée :** carte (UI client), CSP, dépendances
- **Dépend de :** ADR-0002 (la couche données GeoJSON est agnostique du moteur de rendu)

> **Arbitrage (résout Q6) :** **tuiles raster OSM/Carto sans clé** (déjà whitelistées en CSP : `*.tile.openstreetmap.org`, `*.basemaps.cartocdn.com`, `next.config.ts:26,29`). Pas de provider de tuiles vectorielles à clé au MVP → aucune nouvelle variable d'env, aucun coût, aucune entrée CSP supplémentaire. Un passage ultérieur à des vector tiles à clé reste possible (jalon ultérieur) si le besoin esthétique l'exige.

## Contexte

CLAUDE.md §4 cible **MapLibre GL JS + tuiles OpenStreetMap**. L'existant utilise **Mapbox GL** (`mapbox-gl`, `react-map-gl`, `lib/mapbox/*`, `package.json`). La CSP whiteliste explicitement `api.mapbox.com`, `*.tiles.mapbox.com`, `events.mapbox.com` (`next.config.ts:22-29`). La maquette de design (`DESIGN.md:81-83`) montre une carte type Leaflet/OSM avec clusters en pastilles comptées — la **parité visuelle prime sur le moteur**.

L'audit (§5, aptitude carte 3/5) note que la **couche données est déjà agnostique** : la route géo renvoie un **GeoJSON FeatureCollection** standard (`lib/geojson`), consommable par MapLibre comme par Mapbox. Le risque de substitution est donc **faible** (§9.5).

Mapbox GL JS ≥ v2 est sous licence propriétaire et nécessite un token + facturation à l'usage. MapLibre GL JS est un fork open-source (BSD), sans token ni quota de tuiles propriétaire, et expose une **API quasi identique** (`react-map-gl` supporte un backend MapLibre). Pour une carte nationale grand public à fort trafic visiteur (zéro friction), supprimer la dépendance commerciale et le compteur d'usage Mapbox est un gain direct.

## Décision

**Remplacer Mapbox GL par MapLibre GL JS pour le rendu carte, en conservant `react-map-gl` (backend `maplibre`) et des tuiles raster OSM/Carto sans clé.**

1. **Dépendances** : retirer `mapbox-gl`, ajouter `maplibre-gl` ; conserver `react-map-gl` en important depuis son entrée MapLibre. Refactor de `lib/mapbox/*` → `lib/map/*` (config style, directions, styles) en code agnostique.
2. **Tuiles (Q6 — tranché)** : **fond raster OSM/Carto sans clé**, déjà whitelisté en CSP (`*.tile.openstreetmap.org`, `*.basemaps.cartocdn.com`, `next.config.ts:26,29`). Pas de provider à clé au MVP. (Option ultérieure : vector tiles via MapTiler/Stadia/Protomaps si un besoin esthétique le justifie — hors MVP, impliquerait une variable d'env + une entrée CSP.)
3. **CSP** : retirer les directives `api.mapbox.com` / `*.tiles.mapbox.com` / `events.mapbox.com` (`next.config.ts:22-29`) une fois Mapbox supprimé. **Aucun nouveau domaine à ajouter** (les domaines de tuiles raster OSM/Carto sont déjà présents). `worker-src 'self' blob:` et `'wasm-unsafe-eval'` (déjà présents, requis par MapLibre/Mapbox GL) sont conservés.
4. **Géocodage / directions** : le géocodage reste sur l'API Adresse data.gouv.fr (`lib/geocode.ts`, déjà non-Mapbox). Si l'itinéraire utilisait l'API Directions Mapbox (`lib/mapbox/directions.ts`, route `/api/directions`), le remplacer par un provider OSRM/OpenRouteService ou un simple lien externe — **à vérifier par `map-engineer`** (périmètre directions = nice-to-have, pas bloquant).
5. **Parité visuelle** : reproduire la maquette (`DESIGN.md:81-83`) — clusters en pastilles colorées comptées, contrôles zoom, recherche + filtre date, **carte preview d'occurrence avec CTA orange**. Clustering via `cluster: true` sur la source GeoJSON MapLibre (ou Supercluster côté client).
6. **Mobile-first** (CLAUDE.md §9) : carte plein écran + bottom-sheet, pas une carte rétrécie au-dessus d'une liste.

## Conséquences

**Positives :**

- Suppression de la dépendance commerciale Mapbox (token, facturation à l'usage) — pertinent pour un trafic visiteur volumineux et gratuit.
- Alignement CLAUDE.md §4 ; CSP simplifiée (Mapbox retiré, rien à ajouter pour les tuiles raster OSM/Carto).
- API quasi identique → coût de migration faible (la couche données ne bouge pas).
- Aucune clé/coût de tuiles au MVP (Q6).

**Négatives / risques :**

- Différences fines de style/sprites entre Mapbox et MapLibre (icônes, polices de carte) à re-régler pour la parité maquette.
- Les tuiles raster OSM/Carto publiques ont des conditions d'usage (limites de débit / attribution) à respecter — vérifier l'adéquation au trafic visé ; un passage ultérieur à un provider dédié reste l'échappatoire si nécessaire.
- Les directions Mapbox (si utilisées) nécessitent un remplacement — périmètre à confirmer.

## Alternatives écartées

1. **Garder Mapbox.** Écartée : contraire au CLAUDE.md §4, conserve la dépendance commerciale et la facturation à l'usage.
2. **Passer à Leaflet** (le moteur de la maquette). Écartée : MapLibre GL offre un meilleur rendu WebGL/vector, du clustering performant et reste la cible du CLAUDE.md ; la maquette n'impose que la **parité visuelle**, pas le moteur.
3. **Vector tiles à clé dès le MVP.** Écartée (Q6) : ajoute une dépendance, une clé et un coût pour un gain esthétique non requis au démarrage ; reportable.
4. **Carte SVG/Canvas maison.** Écartée : réinvente le clustering, le pan/zoom, la gestion des tuiles — coût disproportionné.
