'use client'

/**
 * DebouncedFilterInput — champ texte de filtre synchronisé avec l'URL, en différé.
 *
 * Pourquoi : un input dont `value` vient directement de l'URL et qui déclenche un
 * `router.push()` à chaque frappe est **inutilisable** — React réaffiche la valeur
 * (encore) issue de l'URL avant que la navigation ne soit committée, ce qui efface
 * le caractère saisi et annule la navigation précédente. Résultat : champ qui reste
 * vide et URL jamais mise à jour.
 *
 * Solution : la saisie vit dans un état LOCAL (réactif immédiatement), et l'URL n'est
 * écrite qu'après une pause de frappe (`delay`). Une seule navigation par recherche.
 */

import { useEffect, useRef, useState } from 'react'

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>

interface DebouncedFilterInputProps extends InputProps {
  /** Valeur actuellement portée par l'URL (source de vérité entre deux saisies). */
  urlValue: string
  /** Appelé après la pause de frappe, pour écrire la valeur dans l'URL. */
  onCommit: (value: string) => void
  /** Délai avant écriture dans l'URL (ms). */
  delay?: number
}

export function DebouncedFilterInput({
  urlValue,
  onCommit,
  delay = 400,
  ...inputProps
}: DebouncedFilterInputProps) {
  const [value, setValue] = useState(urlValue)
  /** Dernière valeur d'URL prise en compte — sert à détecter un changement externe. */
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue)

  /** Ref sur le callback : sa référence change à chaque rendu du parent — la garder
   *  hors des deps évite de réarmer le timer en boucle. */
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
  })

  // Resynchronisation quand l'URL change hors saisie (« Effacer », retour navigateur,
  // lien profond) — pattern React « ajuster l'état lors d'un changement de prop ».
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue)
    setValue(urlValue)
  }

  // Écriture différée dans l'URL : une seule navigation, à la pause de frappe.
  useEffect(() => {
    if (value === urlValue) return
    const timer = setTimeout(() => commitRef.current(value), delay)
    return () => clearTimeout(timer)
  }, [value, urlValue, delay])

  return <input {...inputProps} value={value} onChange={(e) => setValue(e.target.value)} />
}
