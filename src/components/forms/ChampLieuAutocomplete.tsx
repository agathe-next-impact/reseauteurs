'use client'

/**
 * ChampLieuAutocomplete — champ de localisation à suggestions.
 *
 * REMPLAÇANT DIRECT de `<input>` : il rend un vrai `<input name=… defaultValue=…>`,
 * donc les formulaires non contrôlés du dépôt (lecture par `FormData`) fonctionnent
 * sans aucune modification de leur logique de soumission.
 *
 * Objectif : NORMALISER. Choisir une suggestion écrit le libellé officiel et
 * remplit d'un coup les champs liés (code postal, ville, département, région),
 * qui n'ont donc plus à être saisis à la main — c'est là que naissaient les
 * incohérences (« Lyon 1er » vs « Lyon », département tantôt « 69 » tantôt « Rhône »).
 *
 * DEUX SOURCES selon le mode, derrière une seule forme de suggestion :
 *   - `adresse` / `ville`      → Base Adresse Nationale, en réseau (`lib/ban.ts`) ;
 *   - `departement` / `region` → référentiel local, sans réseau
 *                                (`lib/decoupage-administratif.ts`) — la BAN ne
 *                                référence ni départements ni régions.
 *
 * La saisie libre reste TOUJOURS possible : la BAN ne couvre pas tout (lieux-dits,
 * adresses neuves) et une panne réseau ne doit pas empêcher d'enregistrer. Le champ
 * n'est jamais verrouillé sur une suggestion.
 *
 * Trois façons de propager la sélection, selon le formulaire appelant :
 *   - `champsLies`    — remplit les `<input name=…>` frères du même `<form>`
 *                       (formulaires NON CONTRÔLÉS : la majorité ici) ;
 *   - `onValueChange` — à chaque frappe, pour les formulaires à état React ;
 *   - `onSelect`      — à la sélection seule.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { rechercherBAN, LONGUEUR_MIN_REQUETE_BAN } from '@/lib/ban'
import { chercherDepartements, chercherRegions } from '@/lib/decoupage-administratif'

export type ModeChampLieu = 'adresse' | 'ville' | 'departement' | 'region'

/** Parties d'un résultat qu'un formulaire peut vouloir recopier ailleurs. */
export interface ChampsLies {
  /** Nom du champ recevant la voie (numéro + rue). */
  adresse?: string
  codePostal?: string
  ville?: string
  departement?: string
  region?: string
}

/** Forme commune aux deux sources — c'est tout ce que connaît l'interface. */
export interface SuggestionLieu {
  cle: string
  /** Ligne principale de la liste. */
  libelle: string
  /** Ligne secondaire facultative (département d'une commune, code INSEE…). */
  detail?: string
  /** Valeur effectivement écrite dans le champ. */
  valeur: string
  /** Ce que la sélection permet de renseigner ailleurs. */
  parties: Partial<Record<keyof ChampsLies, string>>
}

type ProprietesInput = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onSelect' | 'type' | 'role' | 'value'
>

interface ChampLieuAutocompleteProps extends ProprietesInput {
  mode: ModeChampLieu
  champsLies?: ChampsLies
  onSelect?: (suggestion: SuggestionLieu) => void
  /**
   * Notifié à CHAQUE changement de valeur, saisie libre comprise — et pas
   * seulement à la sélection. C'est ce dont un formulaire à état React contrôlé
   * a besoin : sans cela, une valeur tapée sans passer par une suggestion
   * n'atteindrait jamais le parent.
   */
  onValueChange?: (valeur: string) => void
  /**
   * Valeur imposée de l'extérieur (URL, « Effacer », retour navigateur). Quand elle
   * change HORS saisie, le champ se resynchronise. Indispensable aux filtres, dont
   * la source de vérité est l'URL : sans cela, « Effacer » viderait l'URL mais
   * laisserait le texte affiché dans le champ.
   */
  valeurExterne?: string
}

/** Antirebond réseau. Inutile pour le référentiel local, filtré instantanément. */
const DELAI_ANTIREBOND_MS = 250

/** Un code de département tient en 2 caractères (« 69 ») : pas de seuil à 3 ici. */
const LONGUEUR_MIN_LOCALE = 1

function estSourceLocale(mode: ModeChampLieu): boolean {
  return mode === 'departement' || mode === 'region'
}

/** Interroge la bonne source et normalise le résultat en `SuggestionLieu`. */
async function construireSuggestions(
  mode: ModeChampLieu,
  requete: string,
  signal: AbortSignal,
): Promise<SuggestionLieu[]> {
  if (mode === 'departement') {
    return chercherDepartements(requete).map((d) => ({
      cle: `dep-${d.code}`,
      libelle: d.nom,
      detail: `${d.code} · ${d.region}`,
      valeur: d.nom,
      // Un département détermine sa région : autant la renseigner aussi.
      parties: { departement: d.nom, region: d.region },
    }))
  }

  if (mode === 'region') {
    return chercherRegions(requete).map((r) => ({
      cle: `reg-${r.code}`,
      libelle: r.nom,
      valeur: r.nom,
      parties: { region: r.nom },
    }))
  }

  const resultats = await rechercherBAN(requete, {
    type: mode === 'ville' ? 'municipality' : undefined,
    limit: 5,
    signal,
  })

  return resultats.map((r, i) => {
    // En mode adresse, une commune choisie ne renseigne pas la voie : on laisse
    // le champ adresse vide plutôt que d'y écrire le nom de la ville.
    const estVoie = r.type === 'housenumber' || r.type === 'street'
    return {
      cle: `ban-${r.codeInsee}-${i}`,
      libelle: r.label,
      detail: r.departement ? `${r.departement} (${r.codeDepartement})` : undefined,
      valeur: mode === 'ville' ? r.ville : estVoie ? r.nom : '',
      parties: {
        adresse: estVoie ? r.nom : '',
        codePostal: r.codePostal,
        ville: r.ville,
        departement: r.departement,
        region: r.region,
      },
    }
  })
}

export default function ChampLieuAutocomplete({
  mode,
  champsLies,
  onSelect,
  onValueChange,
  valeurExterne,
  defaultValue,
  className,
  ...propsInput
}: ChampLieuAutocompleteProps) {
  const [valeur, setValeur] = useState(String(valeurExterne ?? defaultValue ?? ''))
  const [suggestions, setSuggestions] = useState<SuggestionLieu[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [indexActif, setIndexActif] = useState(-1)
  const [chargement, setChargement] = useState(false)

  const idListe = useId()
  const conteneurRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const local = estSourceLocale(mode)
  const longueurMin = local ? LONGUEUR_MIN_LOCALE : LONGUEUR_MIN_REQUETE_BAN

  /**
   * La recherche ne se déclenche QUE sur une frappe de l'utilisateur. Sans ce
   * drapeau, réécrire la valeur (sélection d'une suggestion, resynchronisation
   * externe, valeur initiale au montage) relancerait une recherche et rouvrirait
   * la liste que l'on vient de fermer.
   *
   * Un état, pas une ref : le rendu le met à jour, et muter une ref pendant le
   * rendu est proscrit (règle react-hooks/refs).
   */
  const [rechercheActive, setRechercheActive] = useState(false)

  // Resynchronisation sur la valeur externe — « ajuster l'état lors d'un changement
  // de prop » (react.dev), le même pattern que DebouncedFilterInput, sans useEffect.
  const [valeurSync, setValeurSync] = useState(valeurExterne)
  if (valeurExterne !== undefined && valeurExterne !== valeurSync) {
    setValeurSync(valeurExterne)
    // Ne neutraliser la recherche QUE s'il s'agit d'une vraie reprise en main
    // externe (« Effacer », retour navigateur). Un parent contrôlé nous renvoie
    // la valeur que l'utilisateur vient de taper : la traiter comme externe
    // couperait l'autocomplétion à chaque frappe.
    if (valeurExterne !== valeur) {
      setValeur(valeurExterne)
      setRechercheActive(false)
    }
  }

  // ── Recherche ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rechercheActive) return
    const q = valeur.trim()
    // Requête trop courte : la liste a déjà été vidée par le gestionnaire de
    // saisie. Rien à faire ici — vider l'état depuis le corps de l'effet
    // provoquerait un rendu en cascade (règle react-hooks/set-state-in-effect).
    if (q.length < longueurMin) return

    const timer = setTimeout(
      async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        // Pas d'indicateur de chargement pour une source locale : le résultat
        // est synchrone, le spinner ne ferait que clignoter.
        if (!local) setChargement(true)

        const resultats = await construireSuggestions(mode, q, controller.signal)

        if (controller.signal.aborted) return
        setChargement(false)
        setSuggestions(resultats)
        setIndexActif(-1)
        setOuvert(resultats.length > 0)
      },
      local ? 0 : DELAI_ANTIREBOND_MS,
    )

    return () => clearTimeout(timer)
  }, [valeur, mode, rechercheActive, local, longueurMin])

  // Abandonne toute requête en vol au démontage.
  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Fermeture au clic extérieur ───────────────────────────────────────────
  useEffect(() => {
    if (!ouvert) return
    const surClic = (e: MouseEvent) => {
      if (!conteneurRef.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', surClic)
    return () => document.removeEventListener('mousedown', surClic)
  }, [ouvert])

  // ── Sélection ─────────────────────────────────────────────────────────────
  const selectionner = useCallback(
    (s: SuggestionLieu) => {
      setRechercheActive(false)
      setValeur(s.valeur)
      onValueChange?.(s.valeur)
      setOuvert(false)
      setSuggestions([])
      setIndexActif(-1)

      // Remplissage des champs frères (formulaires non contrôlés).
      const form = inputRef.current?.form
      if (form && champsLies) {
        const ecrire = (nomChamp: string | undefined, val: string | undefined) => {
          if (!nomChamp || !val) return
          const cible = form.elements.namedItem(nomChamp)
          if (cible instanceof HTMLInputElement || cible instanceof HTMLSelectElement) {
            cible.value = val
          }
        }
        ecrire(champsLies.adresse, s.parties.adresse)
        ecrire(champsLies.codePostal, s.parties.codePostal)
        ecrire(champsLies.ville, s.parties.ville)
        ecrire(champsLies.departement, s.parties.departement)
        ecrire(champsLies.region, s.parties.region)
      }

      onSelect?.(s)
      inputRef.current?.focus()
    },
    [champsLies, onSelect, onValueChange],
  )

  // ── Clavier ───────────────────────────────────────────────────────────────
  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!ouvert || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOuvert(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexActif((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexActif((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      // N'intercepte Entrée que si une suggestion est réellement survolée au
      // clavier — sinon la touche doit continuer à soumettre le formulaire.
      if (indexActif >= 0) {
        e.preventDefault()
        selectionner(suggestions[indexActif])
      }
    } else if (e.key === 'Escape') {
      setOuvert(false)
      setIndexActif(-1)
    } else if (e.key === 'Tab') {
      setOuvert(false)
    }
  }

  return (
    <div ref={conteneurRef} className="relative">
      <input
        {...propsInput}
        ref={inputRef}
        type="text"
        value={valeur}
        onChange={(e) => {
          const saisie = e.target.value
          setValeur(saisie)
          // Seule voie qui autorise une recherche : une frappe utilisateur.
          setRechercheActive(true)
          // Le repli de la liste sous le seuil se fait ICI, dans un gestionnaire
          // d'événement, et non dans l'effet de recherche (cf. commentaire là-bas).
          if (saisie.trim().length < longueurMin) {
            setSuggestions([])
            setOuvert(false)
          }
          onValueChange?.(saisie)
        }}
        onKeyDown={surTouche}
        onFocus={() => suggestions.length > 0 && setOuvert(true)}
        className={className}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={indexActif >= 0 ? `${idListe}-${indexActif}` : undefined}
        // Les suggestions remplacent l'autocomplétion du navigateur : les deux
        // listes superposées seraient illisibles.
        autoComplete="off"
      />

      {chargement && (
        <Loader2
          size={14}
          aria-hidden
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#999A9D]"
        />
      )}

      {ouvert && suggestions.length > 0 && (
        <ul
          id={idListe}
          role="listbox"
          aria-label="Suggestions"
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#DFE0E1] bg-white shadow-lg py-1"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.cle}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === indexActif}
              // mousedown, pas click : le blur du champ fermerait la liste avant
              // que le click ne se produise.
              onMouseDown={(e) => {
                e.preventDefault()
                selectionner(s)
              }}
              onMouseEnter={() => setIndexActif(i)}
              className={`flex items-start gap-2 px-3 py-2 text-sm cursor-pointer ${
                i === indexActif ? 'bg-[#F2F2F2] text-[#1D1E21]' : 'text-[#4E5155]'
              }`}
            >
              <MapPin size={13} aria-hidden className="mt-0.5 shrink-0 text-[#999A9D]" />
              <span className="min-w-0">
                <span className="block truncate">{s.libelle}</span>
                {s.detail && <span className="block text-xs text-[#6E7175]">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
