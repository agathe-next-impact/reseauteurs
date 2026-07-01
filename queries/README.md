# Queries GraphQL SEO

Requetes GraphQL pre-ecrites pour alimenter des integrations externes (preview, monitoring, generation de contenus) a partir de l'API Payload GraphQL auto-generee.

## Endpoint

```
POST https://panorama-pub.com/api/graphql
Content-Type: application/json
```

Playground disponible en dev : http://localhost:3000/api/graphql-playground

## Authentification

Les requetes SEO ci-dessous n'ont besoin que des champs publics. Aucun token n'est requis tant que `statut: publiee` / `statut: publie` est applique dans le filtre (les regles d'access control de chaque collection autorisent la lecture anonyme des docs publies).

Pour lire des brouillons / fiches suspendues, envoyer un header `Authorization: JWT <token>`.

## Requetes

| Operation                       | Variables                               | Retour                      |
|---------------------------------|-----------------------------------------|-----------------------------|
| `FournisseurSeoBySlug`          | `slug: String!`                         | doc unique `Fournisseur`    |
| `EvenementSeoById`              | `id: Int!`                              | doc unique `Evenement`      |
| `OrganisateurSeoBySlug`         | `slug: String!`                         | doc unique `OrganisateursEvenement` |
| `SitemapFournisseurs`           | `limit`, `page`                         | paginated `Fournisseur[]`   |
| `SitemapEvenements`             | `now: DateTime!`, `limit`, `page`       | paginated `Evenement[]`     |
| `SitemapOrganisateurs`          | `limit`, `page`                         | paginated `OrganisateursEvenement[]` |

## Exemples

### Fetch d'une fiche revendeur

```bash
curl -X POST https://panorama-pub.com/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query($slug:String!){Fournisseurs(where:{slug:{equals:$slug}},limit:1){docs{raisonSociale ville seo{title description noindex}}}}", "variables": {"slug": "mon-revendeur"}}'
```

### Enumerer les fournisseurs pour un sitemap externe

```bash
curl -X POST https://panorama-pub.com/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query($limit:Int,$page:Int){Fournisseurs(where:{statut:{equals:publiee}},limit:$limit,page:$page){totalDocs totalPages docs{slug updatedAt}}}", "variables": {"limit": 500, "page": 1}}'
```

## Rappels

- Le champ `seo.noindex` doit etre respecte cote consommateur : ne pas indexer / partager les docs flagges.
- Les champs media retournent des URLs signees par Vercel Blob (`*.public.blob.vercel-storage.com`) — pas de manipulation supplementaire necessaire.
- Les coordonnees (`latitude`, `longitude`) sont renseignees par le hook de geocodage et peuvent etre absentes pour les fiches recemment creees.
- La pagination suit les conventions Payload : `page` demarre a 1, `totalPages` est fourni.
