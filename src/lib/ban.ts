/**
 * ban.ts — Client de la Base Adresse Nationale (api-adresse.data.gouv.fr).
 *
 * Sert l'autocomplétion des champs de localisation, dont le but est la
 * NORMALISATION : une ville saisie librement (« st etienne », « Saint-Etienne »,
 * « SAINT ÉTIENNE ») produit autant de valeurs distinctes en base, ce qui casse
 * les filtres `contains` des annuaires et fait échouer le géocodage serveur
 * (`lib/geocode.ts`). En passant par la BAN, on stocke le libellé officiel.
 *
 * API publique, sans clé, plafonnée à 50 req/s/IP — appelée directement depuis le
 * navigateur (le domaine est déjà autorisé en `connect-src`, cf. next.config.ts).
 * Aucun proxy serveur : ce serait un saut réseau de plus sans bénéfice.
 */

/** Type de résultat renvoyé par la BAN, du plus précis au plus large. */
export type TypeBAN = 'housenumber' | 'street' | 'locality' | 'municipality'

export interface ResultatBAN {
  /** Libellé complet affiché dans la liste (« 12 Rue de la République 69001 Lyon »). */
  label: string
  /** Numéro + voie pour une adresse ; nom de la commune pour une municipalité. */
  nom: string
  codePostal: string
  ville: string
  /** Code INSEE de la commune — identifiant stable, contrairement au nom. */
  codeInsee: string
  departement: string
  codeDepartement: string
  region: string
  longitude: number
  latitude: number
  type: TypeBAN
}

const ENDPOINT = 'https://api-adresse.data.gouv.fr/search/'

/** En dessous, la BAN renvoie du bruit et refuse même la requête (400). */
export const LONGUEUR_MIN_REQUETE_BAN = 3

/**
 * Éclate le champ `context` de la BAN — « 69, Rhône, Auvergne-Rhône-Alpes ».
 *
 * Les noms de départements et de régions contiennent des virgules dans aucun cas
 * connu, mais on découpe en 3 au maximum pour rester tolérant si cela changeait.
 */
export function parseContexte(context: string | undefined | null): {
  codeDepartement: string
  departement: string
  region: string
} {
  const parts = (context ?? '').split(',').map((p) => p.trim())
  return {
    codeDepartement: parts[0] ?? '',
    departement: parts[1] ?? '',
    // Les DOM-TOM n'ont pas toujours de 3e segment : la région vaut alors le département.
    region: parts.slice(2).join(', ') || parts[1] || '',
  }
}

interface FeatureBAN {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    label?: string
    name?: string
    postcode?: string
    city?: string
    citycode?: string
    context?: string
    type?: string
  }
}

/**
 * Interroge la BAN. Renvoie une liste vide plutôt que de lever : l'autocomplétion
 * est une aide à la saisie, une panne réseau ne doit jamais bloquer un formulaire
 * (le champ reste librement saisissable, cf. `ChampLieuAutocomplete`).
 */
export async function rechercherBAN(
  requete: string,
  options: { type?: TypeBAN; limit?: number; signal?: AbortSignal } = {},
): Promise<ResultatBAN[]> {
  const q = requete.trim()
  if (q.length < LONGUEUR_MIN_REQUETE_BAN) return []

  const url = new URL(ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(options.limit ?? 5))
  url.searchParams.set('autocomplete', '1')
  if (options.type) url.searchParams.set('type', options.type)

  try {
    const res = await fetch(url.toString(), { signal: options.signal })
    if (!res.ok) return []
    const data = (await res.json()) as { features?: FeatureBAN[] }

    return (data.features ?? []).map((f) => {
      const p = f.properties ?? {}
      const [longitude, latitude] = f.geometry?.coordinates ?? [0, 0]
      const { codeDepartement, departement, region } = parseContexte(p.context)
      return {
        label: p.label ?? '',
        nom: p.name ?? '',
        codePostal: p.postcode ?? '',
        ville: p.city ?? '',
        codeInsee: p.citycode ?? '',
        departement,
        codeDepartement,
        region,
        longitude,
        latitude,
        type: (p.type as TypeBAN) ?? 'street',
      }
    })
  } catch {
    // AbortError inclus : une frappe plus récente a annulé celle-ci.
    return []
  }
}
