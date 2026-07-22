/**
 * ContactCTA — bloc d'appel à l'action « Prendre contact », partagé par les fiches
 * publiques réseauteur / réseau / partenaire.
 *
 * Regroupe jusqu'à 3 canaux : email (mailto), téléphone (tel), site web (lien externe).
 * Rien à afficher si aucun canal n'est renseigné → retourne null.
 *
 * Server Component (liens purs) — RGPD : ne rend que les canaux effectivement fournis
 * par l'entité (contacts facultatifs côté réseauteur, ADR-0011 §7).
 */
import { Mail, Phone, Globe } from 'lucide-react'

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

export function ContactCTA({
  email,
  telephone,
  site,
  entityName,
  siteLabel = 'Site web',
}: {
  email?: string | null
  telephone?: string | null
  site?: string | null
  /** Nom de l'entité — utilisé dans les aria-label. */
  entityName: string
  siteLabel?: string
}) {
  const emailSafe = email?.trim() || null
  const telSafe = telephone?.trim() || null
  const siteUrl = safeHttpUrl(site)

  if (!emailSafe && !telSafe && !siteUrl) return null

  return (
    <section
      aria-labelledby="contact-cta-titre"
      className="rounded-2xl border border-[#DFE0E1] bg-[#F2F2F2] p-5"
    >
      <h2 id="contact-cta-titre" className="text-sm font-semibold text-[#1D1E21] mb-1">
        Prendre contact
      </h2>
      <p className="text-xs text-[#6E7175] mb-3">Entrez en relation avec {entityName}.</p>

      <div className="flex flex-wrap gap-2">
        {emailSafe && (
          <a
            href={`mailto:${emailSafe}`}
            className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-[#035AA6] text-white text-sm font-semibold hover:bg-[#02467F] transition-colors no-underline"
            aria-label={`Envoyer un email à ${entityName}`}
          >
            <Mail size={15} aria-hidden />
            Envoyer un email
          </a>
        )}
        {telSafe && (
          <a
            href={`tel:${telSafe.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-2 p-2.5 rounded-xl border border-[#DFE0E1] bg-white text-sm font-medium text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] transition-colors no-underline"
            aria-label={`Appeler ${entityName}`}
          >
            <Phone size={15} aria-hidden />
            {telSafe}
          </a>
        )}
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 p-2.5 rounded-xl border border-[#DFE0E1] bg-white text-sm font-medium text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] transition-colors no-underline"
            aria-label={`Site web de ${entityName}`}
          >
            <Globe size={15} aria-hidden />
            {siteLabel}
          </a>
        )}
      </div>
    </section>
  )
}
