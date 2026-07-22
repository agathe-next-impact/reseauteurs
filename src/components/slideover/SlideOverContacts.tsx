'use client'

/**
 * SlideOverContacts — bloc « Contact » compact des panneaux latéraux.
 *
 * Mêmes canaux que le ContactCTA des fiches publiques (email / téléphone / site),
 * au format liste dense adapté au panneau. Rien à afficher si aucun canal n'est
 * renseigné → retourne null (les contacts sont facultatifs — ADR-0011 §7).
 *
 * `nom` permet d'afficher l'interlocuteur quand l'entité en déclare un
 * (contactNom d'un événement, par exemple).
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

export default function SlideOverContacts({
  nom,
  email,
  telephone,
  site,
  siteLabel,
  titre = 'Contact',
}: {
  nom?: string | null
  email?: string | null
  telephone?: string | null
  site?: string | null
  /** Libellé du lien site ; par défaut le domaine est affiché. */
  siteLabel?: string
  titre?: string
}) {
  const emailSafe = email?.trim() || null
  const telSafe = telephone?.trim() || null
  const siteUrl = safeHttpUrl(site)

  if (!emailSafe && !telSafe && !siteUrl) return null

  return (
    <div className="py-4 border-b border-[#DFE0E1] space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6E7175] mb-2">
        {titre}
      </h3>

      {nom && <p className="text-sm text-[#4E5155]">{nom}</p>}

      {telSafe && (
        <a
          href={`tel:${telSafe.replace(/\s+/g, '')}`}
          className="block text-sm text-[#035AA6] hover:text-[#02467F] transition-colors"
        >
          {telSafe}
        </a>
      )}

      {emailSafe && (
        <a
          href={`mailto:${emailSafe}`}
          className="block text-sm text-[#035AA6] hover:text-[#02467F] transition-colors break-all"
        >
          {emailSafe}
        </a>
      )}

      {siteUrl && (
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-[#035AA6] hover:text-[#02467F] transition-colors"
        >
          {siteLabel ?? siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
      )}
    </div>
  )
}
