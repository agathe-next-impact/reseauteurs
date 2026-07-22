/**
 * Espace réseauteur — Offres partenaires (/dashboard/offres)
 *
 * Liste les offres promotionnelles des partenaires ACTIFS, réservées aux réseauteurs.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { Tag, ExternalLink, Building2, ArrowLeft } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import type { Partenaire, Media } from '@/types/reseauteurs-domain'

export const metadata = {
  title: 'Offres entreprises — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

export default async function OffresPartenairesPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
  if (freshUser.role === 'admin') redirect('/admin')
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role === 'partenaire') redirect('/dashboard/partenaire')

  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { statut: { equals: 'actif' } },
    depth: 1,
    limit: 100,
    sort: 'nom',
    overrideAccess: true,
  })

  const offres = (docs as Partenaire[])
    .map((p) => {
      const offre = p.offre as
        | { titre?: string | null; description?: string | null; lien?: string | null }
        | null
        | undefined
      return { p, offre }
    })
    .filter((x) => !!(x.offre?.titre && x.offre.titre.trim()))

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          <Link
            href="/dashboard/profil"
            className="text-sm text-[#6E7175] hover:text-[#035AA6] no-underline inline-flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden /> Mon profil
          </Link>
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2 mb-2">
            <Tag size={20} className="text-[#8A6D0B]" aria-hidden />
            Offres entreprises
          </h1>
          <p className="text-sm text-[#6E7175] mb-8">
            Des avantages exclusifs proposés par les entreprises partenaires de RÉSEAUTEURS,
            réservés aux réseauteurs.
          </p>
        </Reveal>

        {offres.length === 0 ? (
          <div className="rsn-card rounded-2xl border-dashed p-10 text-center">
            <Tag size={32} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
            <p className="text-sm font-medium text-[#4E5155] mb-1">
              Aucune offre pour l&apos;instant
            </p>
            <p className="text-sm text-[#6E7175]">
              Revenez bientôt : nos partenaires ajoutent régulièrement des avantages.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offres.map(({ p, offre }) => {
              const logoMedia = p.logo as Media | null | undefined
              const logoUrl = logoMedia?.sizes?.thumbnail?.url ?? logoMedia?.url ?? null
              const offreLien = safeHttpUrl(offre?.lien)
              return (
                <Reveal key={p.id}>
                  <article className="rsn-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={`Logo ${p.nom}`}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-contain bg-[#F2F2F2] p-1 border border-[#DFE0E1]"
                        />
                      ) : (
                        <span
                          className="text-[#8A6D0B] flex items-center justify-center shrink-0"
                          aria-hidden
                        >
                          <Building2 size={18} />
                        </span>
                      )}
                      <div className="min-w-0">
                        {p.slug ? (
                          <Link
                            href={`/partenaire/${p.slug}`}
                            className="text-sm font-semibold text-[#012A4A] hover:text-[#8A6D0B] no-underline transition-colors truncate block"
                          >
                            {p.nom}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-[#012A4A] truncate">{p.nom}</p>
                        )}
                        <p className="text-xs text-[#999A9D]">Partenaire</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#EFE08F] bg-[#FEFBE6] p-4">
                      <p className="text-sm font-bold text-[#8A6D0B] flex items-center gap-1.5">
                        <Tag size={13} aria-hidden />
                        {offre!.titre}
                      </p>
                      {offre!.description && (
                        <p className="text-sm text-[#6E5608] mt-1.5 whitespace-pre-line">
                          {offre!.description}
                        </p>
                      )}
                      {offreLien && (
                        <a
                          href={offreLien}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 bg-[#F5E050] text-[#012A4A] font-semibold p-2.5 rounded-xl hover:bg-[#E3CB2E] transition-colors text-sm no-underline"
                        >
                          En profiter <ExternalLink size={13} aria-hidden />
                        </a>
                      )}
                    </div>
                  </article>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
