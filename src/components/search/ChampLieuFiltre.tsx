'use client'

/**
 * ChampLieuFiltre — champ de localisation des filtres publics, à suggestions.
 *
 * Pendant `ChampLieuAutocomplete` (formulaires de saisie) côté RECHERCHE, pour
 * les quatre modes : ville, département, région, adresse. Deux régimes
 * d'écriture dans l'URL, volontairement différents :
 *   - saisie libre  → écriture DIFFÉRÉE (400 ms), comme DebouncedFilterInput :
 *     une seule navigation par recherche, sinon chaque frappe annule la précédente ;
 *   - suggestion choisie → écriture IMMÉDIATE : l'intention est sans ambiguïté,
 *     attendre 400 ms de plus ne ferait que retarder les résultats.
 *
 * L'intérêt dépasse le confort : les filtres interrogent la base en `contains`.
 * Une ville tapée « st etienne » ou un département tapé « puy de dome » ne
 * remontent rien alors que « Saint-Étienne » et « Puy-de-Dôme » sont bien en base.
 * Passer par les référentiels aligne la requête sur la valeur stockée.
 *
 * Cette enveloppe ne détient AUCUN état de valeur : la valeur affichée appartient
 * au champ, la valeur de référence à l'URL (`urlValue` → `valeurExterne`). Deux
 * états suivant la même donnée finiraient par diverger.
 */

import { useCallback, useEffect, useRef } from 'react'
import ChampLieuAutocomplete, {
  type ModeChampLieu,
  type SuggestionLieu,
} from '@/components/forms/ChampLieuAutocomplete'

interface ChampLieuFiltreProps {
  mode: ModeChampLieu
  /** Valeur portée par l'URL — source de vérité entre deux saisies. */
  urlValue: string
  /** Écrit la valeur dans l'URL. */
  onCommit: (valeur: string) => void
  /** Notifié en plus de `onCommit` quand l'utilisateur choisit une suggestion. */
  onSelectSuggestion?: (s: SuggestionLieu) => void
  id?: string
  placeholder?: string
  className?: string
  'aria-label'?: string
}

const DELAI_COMMIT_MS = 400

export default function ChampLieuFiltre({
  mode,
  urlValue,
  onCommit,
  onSelectSuggestion,
  ...props
}: ChampLieuFiltreProps) {
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref sur le callback : sa référence change à chaque rendu du parent, la garder
  // hors des deps évite de réarmer le minuteur en boucle (cf. DebouncedFilterInput).
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
  })

  // Un minuteur encore armé au démontage écrirait dans l'URL d'une page quittée.
  useEffect(
    () => () => {
      if (minuteurRef.current) clearTimeout(minuteurRef.current)
    },
    [],
  )

  const surSaisie = useCallback((valeur: string) => {
    if (minuteurRef.current) clearTimeout(minuteurRef.current)
    minuteurRef.current = setTimeout(() => commitRef.current(valeur), DELAI_COMMIT_MS)
  }, [])

  const surSelection = useCallback(
    (s: SuggestionLieu) => {
      // Annule l'écriture différée déjà armée par la frappe qui précède la sélection.
      if (minuteurRef.current) clearTimeout(minuteurRef.current)
      commitRef.current(s.valeur)
      onSelectSuggestion?.(s)
    },
    [onSelectSuggestion],
  )

  return (
    <ChampLieuAutocomplete
      {...props}
      mode={mode}
      valeurExterne={urlValue}
      onValueChange={surSaisie}
      onSelect={surSelection}
    />
  )
}
