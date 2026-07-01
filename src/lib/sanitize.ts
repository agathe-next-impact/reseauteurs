/**
 * Supprime tous les emojis d'une chaine.
 *
 * Couvre :
 * - Extended_Pictographic (la grande majorite des emojis Unicode)
 * - Emoji_Modifier (modificateurs de teinte U+1F3FB-U+1F3FF)
 * - Regional_Indicator (U+1F1E6-U+1F1FF) — paires composant les drapeaux nationaux,
 *   non couvertes par Extended_Pictographic
 * - ZWJ (U+200D), Variation Selector-16 (U+FE0F), Combining Enclosing Keycap (U+20E3)
 *   utilises dans les sequences composees (keycaps, familles, etc.)
 *
 * Attention : Unicode classe (c) (r) (tm) (U+00A9, U+00AE, U+2122) comme
 * Extended_Pictographic ; ces caracteres seront donc supprimes. Remplacer par
 * "(c)" / "(r)" / "(tm)" si besoin.
 */
export function stripEmojis(value: string): string {
  if (!value) return value
  return value.replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣/gu, '')
}
