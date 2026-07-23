/**
 * decoupage-administratif.ts — Référentiel officiel des départements et régions.
 *
 * La Base Adresse Nationale (`lib/ban.ts`) ne référence QUE des adresses et des
 * communes : elle ne sait pas répondre à « quels départements commencent par Rhô ».
 * Ces deux listes comblent ce manque pour les champs « Département » et « Région ».
 *
 * Embarquées en dur, plutôt qu'appelées sur geo.api.gouv.fr : 101 + 18 entrées d'un
 * découpage qui bouge une fois par décennie, contre un aller-retour réseau, une
 * entrée `connect-src` supplémentaire dans la CSP et un mode dégradé à gérer.
 * Le filtrage est local, donc instantané et disponible même réseau coupé.
 *
 * Les libellés sont IDENTIQUES à ceux que renvoie le champ `context` de la BAN :
 * choisir une ville ou saisir le département à la main écrit la même valeur.
 *
 * Source : API Découpage administratif (geo.api.gouv.fr). À régénérer si le
 * découpage évolue — voir scripts/gen-decoupage (fusion de régions, etc.).
 */

export interface Departement {
  /** Code INSEE : '01' à '95', '2A'/'2B' pour la Corse, '971'+ pour l'outre-mer. */
  code: string
  nom: string
  /** Région de rattachement — permet de déduire la région d'un département. */
  region: string
}

export interface Region {
  code: string
  nom: string
}

export const DEPARTEMENTS: readonly Departement[] = [
  { code: '01', nom: 'Ain', region: 'Auvergne-Rhône-Alpes' },
  { code: '02', nom: 'Aisne', region: 'Hauts-de-France' },
  { code: '03', nom: 'Allier', region: 'Auvergne-Rhône-Alpes' },
  { code: '04', nom: 'Alpes-de-Haute-Provence', region: 'Provence-Alpes-Côte d\'Azur' },
  { code: '05', nom: 'Hautes-Alpes', region: 'Provence-Alpes-Côte d\'Azur' },
  { code: '06', nom: 'Alpes-Maritimes', region: 'Provence-Alpes-Côte d\'Azur' },
  { code: '07', nom: 'Ardèche', region: 'Auvergne-Rhône-Alpes' },
  { code: '08', nom: 'Ardennes', region: 'Grand Est' },
  { code: '09', nom: 'Ariège', region: 'Occitanie' },
  { code: '10', nom: 'Aube', region: 'Grand Est' },
  { code: '11', nom: 'Aude', region: 'Occitanie' },
  { code: '12', nom: 'Aveyron', region: 'Occitanie' },
  { code: '13', nom: 'Bouches-du-Rhône', region: 'Provence-Alpes-Côte d\'Azur' },
  { code: '14', nom: 'Calvados', region: 'Normandie' },
  { code: '15', nom: 'Cantal', region: 'Auvergne-Rhône-Alpes' },
  { code: '16', nom: 'Charente', region: 'Nouvelle-Aquitaine' },
  { code: '17', nom: 'Charente-Maritime', region: 'Nouvelle-Aquitaine' },
  { code: '18', nom: 'Cher', region: 'Centre-Val de Loire' },
  { code: '19', nom: 'Corrèze', region: 'Nouvelle-Aquitaine' },
  { code: '21', nom: 'Côte-d\'Or', region: 'Bourgogne-Franche-Comté' },
  { code: '22', nom: 'Côtes-d\'Armor', region: 'Bretagne' },
  { code: '23', nom: 'Creuse', region: 'Nouvelle-Aquitaine' },
  { code: '24', nom: 'Dordogne', region: 'Nouvelle-Aquitaine' },
  { code: '25', nom: 'Doubs', region: 'Bourgogne-Franche-Comté' },
  { code: '26', nom: 'Drôme', region: 'Auvergne-Rhône-Alpes' },
  { code: '27', nom: 'Eure', region: 'Normandie' },
  { code: '28', nom: 'Eure-et-Loir', region: 'Centre-Val de Loire' },
  { code: '29', nom: 'Finistère', region: 'Bretagne' },
  { code: '2A', nom: 'Corse-du-Sud', region: 'Corse' },
  { code: '2B', nom: 'Haute-Corse', region: 'Corse' },
  { code: '30', nom: 'Gard', region: 'Occitanie' },
  { code: '31', nom: 'Haute-Garonne', region: 'Occitanie' },
  { code: '32', nom: 'Gers', region: 'Occitanie' },
  { code: '33', nom: 'Gironde', region: 'Nouvelle-Aquitaine' },
  { code: '34', nom: 'Hérault', region: 'Occitanie' },
  { code: '35', nom: 'Ille-et-Vilaine', region: 'Bretagne' },
  { code: '36', nom: 'Indre', region: 'Centre-Val de Loire' },
  { code: '37', nom: 'Indre-et-Loire', region: 'Centre-Val de Loire' },
  { code: '38', nom: 'Isère', region: 'Auvergne-Rhône-Alpes' },
  { code: '39', nom: 'Jura', region: 'Bourgogne-Franche-Comté' },
  { code: '40', nom: 'Landes', region: 'Nouvelle-Aquitaine' },
  { code: '41', nom: 'Loir-et-Cher', region: 'Centre-Val de Loire' },
  { code: '42', nom: 'Loire', region: 'Auvergne-Rhône-Alpes' },
  { code: '43', nom: 'Haute-Loire', region: 'Auvergne-Rhône-Alpes' },
  { code: '44', nom: 'Loire-Atlantique', region: 'Pays de la Loire' },
  { code: '45', nom: 'Loiret', region: 'Centre-Val de Loire' },
  { code: '46', nom: 'Lot', region: 'Occitanie' },
  { code: '47', nom: 'Lot-et-Garonne', region: 'Nouvelle-Aquitaine' },
  { code: '48', nom: 'Lozère', region: 'Occitanie' },
  { code: '49', nom: 'Maine-et-Loire', region: 'Pays de la Loire' },
  { code: '50', nom: 'Manche', region: 'Normandie' },
  { code: '51', nom: 'Marne', region: 'Grand Est' },
  { code: '52', nom: 'Haute-Marne', region: 'Grand Est' },
  { code: '53', nom: 'Mayenne', region: 'Pays de la Loire' },
  { code: '54', nom: 'Meurthe-et-Moselle', region: 'Grand Est' },
  { code: '55', nom: 'Meuse', region: 'Grand Est' },
  { code: '56', nom: 'Morbihan', region: 'Bretagne' },
  { code: '57', nom: 'Moselle', region: 'Grand Est' },
  { code: '58', nom: 'Nièvre', region: 'Bourgogne-Franche-Comté' },
  { code: '59', nom: 'Nord', region: 'Hauts-de-France' },
  { code: '60', nom: 'Oise', region: 'Hauts-de-France' },
  { code: '61', nom: 'Orne', region: 'Normandie' },
  { code: '62', nom: 'Pas-de-Calais', region: 'Hauts-de-France' },
  { code: '63', nom: 'Puy-de-Dôme', region: 'Auvergne-Rhône-Alpes' },
  { code: '64', nom: 'Pyrénées-Atlantiques', region: 'Nouvelle-Aquitaine' },
  { code: '65', nom: 'Hautes-Pyrénées', region: 'Occitanie' },
  { code: '66', nom: 'Pyrénées-Orientales', region: 'Occitanie' },
  { code: '67', nom: 'Bas-Rhin', region: 'Grand Est' },
  { code: '68', nom: 'Haut-Rhin', region: 'Grand Est' },
  { code: '69', nom: 'Rhône', region: 'Auvergne-Rhône-Alpes' },
  { code: '70', nom: 'Haute-Saône', region: 'Bourgogne-Franche-Comté' },
  { code: '71', nom: 'Saône-et-Loire', region: 'Bourgogne-Franche-Comté' },
  { code: '72', nom: 'Sarthe', region: 'Pays de la Loire' },
  { code: '73', nom: 'Savoie', region: 'Auvergne-Rhône-Alpes' },
  { code: '74', nom: 'Haute-Savoie', region: 'Auvergne-Rhône-Alpes' },
  { code: '75', nom: 'Paris', region: 'Île-de-France' },
  { code: '76', nom: 'Seine-Maritime', region: 'Normandie' },
  { code: '77', nom: 'Seine-et-Marne', region: 'Île-de-France' },
  { code: '78', nom: 'Yvelines', region: 'Île-de-France' },
  { code: '79', nom: 'Deux-Sèvres', region: 'Nouvelle-Aquitaine' },
  { code: '80', nom: 'Somme', region: 'Hauts-de-France' },
  { code: '81', nom: 'Tarn', region: 'Occitanie' },
  { code: '82', nom: 'Tarn-et-Garonne', region: 'Occitanie' },
  { code: '83', nom: 'Var', region: 'Provence-Alpes-Côte d\'Azur' },
  { code: '84', nom: 'Vaucluse', region: 'Provence-Alpes-Côte d\'Azur' },
  { code: '85', nom: 'Vendée', region: 'Pays de la Loire' },
  { code: '86', nom: 'Vienne', region: 'Nouvelle-Aquitaine' },
  { code: '87', nom: 'Haute-Vienne', region: 'Nouvelle-Aquitaine' },
  { code: '88', nom: 'Vosges', region: 'Grand Est' },
  { code: '89', nom: 'Yonne', region: 'Bourgogne-Franche-Comté' },
  { code: '90', nom: 'Territoire de Belfort', region: 'Bourgogne-Franche-Comté' },
  { code: '91', nom: 'Essonne', region: 'Île-de-France' },
  { code: '92', nom: 'Hauts-de-Seine', region: 'Île-de-France' },
  { code: '93', nom: 'Seine-Saint-Denis', region: 'Île-de-France' },
  { code: '94', nom: 'Val-de-Marne', region: 'Île-de-France' },
  { code: '95', nom: 'Val-d\'Oise', region: 'Île-de-France' },
  { code: '971', nom: 'Guadeloupe', region: 'Guadeloupe' },
  { code: '972', nom: 'Martinique', region: 'Martinique' },
  { code: '973', nom: 'Guyane', region: 'Guyane' },
  { code: '974', nom: 'La Réunion', region: 'La Réunion' },
  { code: '976', nom: 'Mayotte', region: 'Mayotte' },
]

export const REGIONS: readonly Region[] = [
  { code: '84', nom: 'Auvergne-Rhône-Alpes' },
  { code: '27', nom: 'Bourgogne-Franche-Comté' },
  { code: '53', nom: 'Bretagne' },
  { code: '24', nom: 'Centre-Val de Loire' },
  { code: '94', nom: 'Corse' },
  { code: '44', nom: 'Grand Est' },
  { code: '01', nom: 'Guadeloupe' },
  { code: '03', nom: 'Guyane' },
  { code: '32', nom: 'Hauts-de-France' },
  { code: '11', nom: 'Île-de-France' },
  { code: '04', nom: 'La Réunion' },
  { code: '02', nom: 'Martinique' },
  { code: '06', nom: 'Mayotte' },
  { code: '28', nom: 'Normandie' },
  { code: '75', nom: 'Nouvelle-Aquitaine' },
  { code: '76', nom: 'Occitanie' },
  { code: '52', nom: 'Pays de la Loire' },
  { code: '93', nom: 'Provence-Alpes-Côte d\'Azur' },
]

/**
 * Forme comparable d'un libellé : sans accents, sans casse, sans séparateurs.
 * « Puy-de-Dôme », « puy de dome » et « puydedome » donnent la même chaîne, ce qui
 * rend la recherche tolérante à la façon dont l'utilisateur tape réellement.
 */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Filtre par nom — et par code pour les départements : taper « 69 » doit proposer
 * le Rhône. Les correspondances en DÉBUT de libellé passent devant : sur « loire »,
 * « Loire » doit précéder « Haute-Loire » et « Maine-et-Loire ».
 */
function filtrer<T extends { nom: string; code: string }>(
  liste: readonly T[],
  requete: string,
  limite: number,
  avecCode: boolean,
): T[] {
  const q = normaliserTexte(requete)
  if (!q) return []

  const exacts: T[] = []
  const debuts: T[] = []
  const contenus: T[] = []
  for (const item of liste) {
    const nom = normaliserTexte(item.nom)
    // L'égalité stricte passe devant : la suppression des séparateurs fait que
    // « loire » préfixe aussi « Loir-et-Cher » (→ « loiretcher »), et la Loire
    // doit rester en tête de sa propre recherche.
    if (nom === q || (avecCode && item.code.toLowerCase() === q)) {
      exacts.push(item)
    } else if (nom.startsWith(q) || (avecCode && item.code.toLowerCase().startsWith(q))) {
      debuts.push(item)
    } else if (nom.includes(q)) {
      contenus.push(item)
    }
  }
  return [...exacts, ...debuts, ...contenus].slice(0, limite)
}

export function chercherDepartements(requete: string, limite = 6): Departement[] {
  return filtrer(DEPARTEMENTS, requete, limite, true)
}

export function chercherRegions(requete: string, limite = 6): Region[] {
  return filtrer(REGIONS, requete, limite, false)
}
