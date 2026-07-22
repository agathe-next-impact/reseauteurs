/**
 * ContactChips — coordonnées de contact au format compact, pour les cartes d'annuaire.
 *
 * Variante dense du ContactCTA des fiches : email / téléphone / site web en puces.
 * Rien à afficher si aucun canal n'est renseigné → retourne null (contacts facultatifs,
 * ADR-0011 §7).
 *
 * ⚠️ À rendre en FRÈRE du <Link> de la carte, jamais à l'intérieur : un <a> imbriqué
 * dans un <a> est invalide en HTML et casse la navigation clavier.
 *
 * Server Component (liens purs).
 */

/** N'accepte qu'une URL http(s) — évite les schémas dangereux (javascript:, data:…). */
function safeHttpUrl(raw?: string | null): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' || u.protocol === 'http:' ? raw : null
  } catch {
    return null
  }
}

const CHIP =
  'inline-flex items-center px-2.5 py-1 rounded-full border border-[#DFE0E1] bg-white text-[11px] font-medium text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] no-underline transition-colors max-w-full truncate'

export function ContactChips({
  email,
  telephone,
  site,
  entityName,
  className = '',
}: {
  email?: string | null
  telephone?: string | null
  site?: string | null
  /** Nom de l'entité — utilisé dans les aria-label (les puces sont très courtes). */
  entityName: string
  className?: string
}) {
  const emailSafe = email?.trim() || null
  const telSafe = telephone?.trim() || null
  const siteUrl = safeHttpUrl(site)

  if (!emailSafe && !telSafe && !siteUrl) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {telSafe && (
        <a href={`tel:${telSafe.replace(/\s+/g, '')}`} className={CHIP} aria-label={`Appeler ${entityName}`}>
          {telSafe}
        </a>
      )}
      {emailSafe && (
        <a href={`mailto:${emailSafe}`} className={CHIP} aria-label={`Envoyer un email à ${entityName}`}>
          Email
        </a>
      )}
      {siteUrl && (
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={CHIP}
          aria-label={`Site web de ${entityName}`}
        >
          Site web
        </a>
      )}
    </div>
  )
}
