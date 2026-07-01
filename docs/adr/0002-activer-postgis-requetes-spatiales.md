# ADR-0002 — Activer PostGIS et basculer la carte sur des requêtes spatiales

- **Statut :** Accepté
- **Date :** 2026-06-23 (mise à jour 2026-06-23 après arbitrages)
- **Décideurs :** `solution-architect` (sur recommandation §9.2 de l'audit)
- **Portée :** carte/géo, schéma, route `/api/geo/*`
- **Dépend de :** ADR-0001 (accès Payload)

> **Arbitrage humain (résout Q5) :** **PostGIS est confirmé supporté par Neon** (`CREATE EXTENSION postgis`). L'activation est une tâche **« à activer au déploiement »**, **non bloquante** pour la phase `data-architect` : le schéma et les migrations peuvent être écrits et testés dès maintenant (l'extension s'active sur l'instance de prod au moment du déploiement de la migration).

## Contexte

La cible est une **carte nationale** (toute la France, +600 villes, +200 réseaux visés — cf. `DESIGN.md:76`). L'existant stocke la géo en colonnes `number` (`lieuLatitude`/`lieuLongitude` sur `evenements`, `latitude`/`longitude` sur `fournisseurs`), alimentées par un hook `beforeChange` qui appelle l'API Adresse data.gouv.fr (`lib/geocode.ts`, `Evenements.ts:370-384`, `Fournisseurs.ts:209-223`).

La route `/api/geo/evenements` (`route.ts`) :

- construit un `where` Payload (`statut/visible/lat-exists/lon-exists/date`) ;
- `find()` jusqu'à **`MAX_RESULTS = 5000`** documents (`route.ts:17,128-146`) ;
- **filtre et projette en JavaScript** pour produire un GeoJSON.

Les seuls index géo sont des **B-tree composites** `(statut, visible, lieu_latitude, lieu_longitude)` (`migrations/20260426_200000_add_geo_indexes.ts`). Un B-tree sur `(lat, lon)` n'accélère **pas** une recherche par rayon ou bounding-box 2D : il ordonne sur lat puis lon, donc une requête « points dans ce rectangle/ce rayon » reste un scan partiel + filtre. L'audit note ce plafond (Performance 3/5, §5) : « OK à l'échelle actuelle, ne tiendra pas à l'échelle nationale ».

Concrètement, à l'échelle nationale, le pattern « fetch ≤5000 + filtre JS » :

- casse silencieusement au-delà de 5000 occurrences visibles (troncature arbitraire de la carte) ;
- transfère et désérialise des milliers de docs à chaque pan/zoom ;
- ne peut pas répondre efficacement à « occurrences dans la bbox visible » ni « réseaux dans un rayon de X km ».

## Décision

**Activer l'extension PostGIS et servir la carte via des requêtes spatiales indexées (GiST), pour le filtrage géographique uniquement. Le reste de l'accès données reste sur le `find()` Payload (ADR-0001).**

1. **Extension** : `CREATE EXTENSION IF NOT EXISTS postgis;` (migration, exécutée par `data-architect` ; supportée par Neon — activée au déploiement, Q5).
2. **Colonnes spatiales** : ajouter une colonne `geom geography(Point, 4326)` sur `evenements` (lieu de l'occurrence) et sur l'entité Réseau (cf. ADR-0003) — en plus des colonnes lat/lon existantes, qui restent la **source de vérité de saisie** et la rétrocompat. Ces colonnes sont hors du modèle de champs Payload (gérées par migration brute + hook).
3. **Alimentation** : étendre le hook de géocodage existant. Quand `geocodeAddress` renvoie un point, écrire lat/lon (comme aujourd'hui) **et** synchroniser `geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography`. Un trigger Postgres `BEFORE INSERT/UPDATE` est l'option robuste (couvre aussi les écritures admin/REST et les imports) ; à défaut, écriture dans le `afterChange` du hook applicatif.
4. **Index** : `CREATE INDEX ... USING GIST (geom)`, complété par un index partiel sur les lignes publiables (`statut='publie' AND visible`) pour les occurrences.
5. **Route géo** : une route dédiée (p. ex. `/api/geo/occurrences`) accepte une **bbox** (`west,south,east,north`) ou un centre+rayon, valide en **Zod**, et exécute un `ST_Intersects(geom, ST_MakeEnvelope(...))` / `ST_DWithin(geom, point, rayon)` via Drizzle/`sql` paramétré exposé par Payload (`payload.db.drizzle`). Filtres métier (date, type, catégorie) restent dans la même requête en SQL ou en pré-résolution d'IDs comme aujourd'hui.
6. **Compat carte** : la réponse reste un **GeoJSON FeatureCollection** identique au format actuel (`lib/geojson`), pour ne pas casser le client. Le client envoie désormais la bbox de la vue (debounced) au lieu de tout charger.

Le `find()` Payload reste utilisé pour : fiches SSR, sitemap, admin, dashboard, tout le non-géographique.

## Conséquences

**Positives :**

- Requêtes carte en temps quasi constant quel que soit le volume national (index GiST).
- Suppression du plafond `MAX_RESULTS=5000` et du transfert massif : on ne renvoie que ce qui est dans la vue.
- Capacité native « réseaux à proximité » (maillage SEO interne, §7 CLAUDE.md) via `ST_DWithin`.

**Négatives / coûts :**

- PostGIS est supporté par Neon ; l'extension doit être **activée sur l'instance de prod au déploiement** de la migration (tâche de mise en production, non bloquante pour la phase data — Q5).
- Colonnes/trigger spatiaux hors du modèle Payload : zone de couplage à documenter, à tester (cohérence lat/lon ↔ geom), à backfiller pour les données existantes (migration data-architect).
- Le client carte doit envoyer la bbox et re-fetcher au pan/zoom (changement assumé, aligné mobile-first).

## Alternatives écartées

1. **Garder le filtrage JS, augmenter `MAX_RESULTS`.** Écartée : ne change pas la complexité, aggrave le transfert, ne supporte ni bbox ni rayon efficaces.
2. **Index B-tree sur `(lat, lon)` seuls.** Déjà en place — insuffisant pour les requêtes 2D (cf. Contexte).
3. **Géo applicative en mémoire (quadtree/Supercluster côté serveur, sans PostGIS).** Écartée : réinvente un index spatial en JS, à recharger à chaque cold start serverless ; PostGIS le fait nativement et de façon persistante.
4. **Service géo externe (PlanetScale/Tile server dédié).** Écartée : surdimensionné, ajoute une dépendance et un coût pour un besoin que Postgres+PostGIS couvre.
