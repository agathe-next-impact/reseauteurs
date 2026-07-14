# TEST PERFORMANCE — 2026-07-14 — RÉSEAUTEURS (branche master)

> Audit produit par l'agent `test-performance` (lecture seule). Rapport persisté par l'orchestrateur
> (l'agent n'a pas l'outil Write). Verdict : **PASS_WITH_FIXES** (aucun BLOCK).

## Correctifs du précédent audit — vérifiés
| Point | Statut |
|---|---|
| Fiche partenaire : offre via `OffreReservee` + API | ✅ en place (mais ISR neutralisé par le layout — voir P1) |
| `/reseaux` annuaire : agrégat SQL `GROUP BY` borné à la page | ✅ confirmé |
| Carte **événements** : bbox au 1ᵉʳ idle + caps SSR (800) | ✅ confirmé |
| `React.cache()` sur les 4 loaders de fiche | ✅ confirmé |
| Index `users(plus_expire_at) WHERE plus_actif` + `evenements(date_fin)` | ✅ confirmé, bien ciblés |
| Index colonnes récentes (lieu_departement, gratuit, secteur, type, dept/région réseau, inscriptions, GiST géo) | ✅ tous présents |

## Findings
### 🔴 Haute
1. **`(frontend)/layout.tsx:35-37` — `headers()` + `payload.auth()` dans le layout racine** → bascule **toute** route `(frontend)` en rendu dynamique, quel que soit `revalidate`. Neutralise tout l'ISR par page (y compris le correctif partenaire). Coût ∝ trafic. **Correctif** : déporter l'état auth de la nav dans un Client Component hydraté par API (`/api/auth/me`), patron `OffreReservee`. Vérifier avec `next build` (○/● vs λ).
2. **Cartes réseauteurs/réseaux : pas de reload bbox au 1ᵉʳ idle** (`MapReseauteurs.tsx`, `MapReseaux.tsx`) — `mapReady` ne sert qu'au skeleton. Affichent le snapshot SSR (`limit:1500`) figé tant que l'utilisateur ne déplace pas la carte. **Correctif** : copier le `useEffect` `didInitialFetch` de `MapEvenementsReseauteurs.tsx`.
3. **N+1 — `mes-evenements/page.tsx:60-104` : `listerInscrits` par événement** (`Promise.all` = N requêtes, page non cachée). **Correctif** : 1 requête `inscriptions WHERE evenement IN (...)` + regroupement JS.

### 🟡 Moyenne
4. **`/evenements` agenda : filtre `reseau` post-filtré en JS** (`page.tsx` buildAgendaWhere ignore `sp.reseau`, filtrage après pagination l.229-234) → `totalDocs`/pages faux, liste incomplète. **Correctif** : résoudre slug→id + `{ reseau: { equals: id } }` dans le where.
5. **`depth:2` en cascade** sur `reseauteur/[slug]` et `evenement/[slug]` → peuple des relations inutilisées. Amorti par ISR (OK V1). **Correctif** : `select` imbriqué ciblé.

### 🟢 Basse (OK en V1, à surveiller)
- Géocodage synchrone dans `beforeChange` (Reseauteurs.ts) — HTTP externe bloquant l'écriture.
- `updateReseauxCompteurs` boucle séquentielle (parallélisable).
- Filtre réseau annuaire : 2 requêtes séquentielles indexées (constant, pas un N+1).
- `<img>` brut dans MapResultsList.tsx:99 (délibéré, miniatures).
- `getReseauteursAffilies` limit:1000 (cohérent paliers packs).

## Top 5
1. layout racine dynamique (annule tout l'ISR) — 🔴
2. cartes réseauteurs/réseaux sans reload bbox — 🔴
3. N+1 `listerInscrits` mes-evenements — 🔴
4. filtre `reseau` agenda post-filtré (pagination faussée) — 🟡
5. `depth:2` cascade fiches — 🟡

## Verdict : PASS_WITH_FIXES
Socle solide. Le finding #1 a un effet multiplicateur : à traiter en priorité avant montée en charge du trafic.
