/**
 * Espace réseauteur Plus — Mes événements (/dashboard/mes-evenements) — ADR-0013 P2.B.
 * CRUD des événements organisés par le réseauteur (gate Plus vérifié serveur par les hooks).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { ArrowLeft, CalendarPlus } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { estPlus } from '@/lib/acces-plus'
import { todayParisDateString } from '@/lib/dates'
import { listerInscrits } from '@/lib/inscriptions'
import { MesEvenementsClient, type MonEvenement, type TypeEvLite } from './MesEvenementsClient'

export const metadata = {
  title: 'Mes événements — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

export default async function MesEvenementsPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
  if (freshUser.role === 'admin') redirect('/admin')
  if (freshUser.role === 'organisateur') redirect('/dashboard/evenements')
  if (freshUser.role === 'partenaire') redirect('/dashboard/partenaire')

  const u = freshUser as unknown as { plusActif?: boolean; plusExpireAt?: string | null }
  const actif = estPlus({ id: freshUser.id, plusActif: u.plusActif, plusExpireAt: u.plusExpireAt })
  if (!actif) redirect('/dashboard/plus')

  // Ses événements (via son profil réseauteur)
  const { docs: profs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const profil = profs[0]
  if (!profil) redirect('/dashboard/profil')

  const { docs: evDocs } = await payload.find({
    collection: 'evenements',
    where: { organisateurReseauteur: { equals: profil.id } },
    depth: 0,
    limit: 100,
    sort: '-dateDebut',
    overrideAccess: true,
  })

  // Borne « aujourd'hui » calculée via lib (règle de pureté — pas de Date.now() en rendu)
  const todayStartMs = new Date(`${todayParisDateString()}T00:00:00.000Z`).getTime()

  const evenements: MonEvenement[] = await Promise.all(
    evDocs.map(async (e) => ({
      past: new Date((e.dateDebut as string) ?? '').getTime() < todayStartMs,
      id: e.id as number,
      slug: (e.slug as string | null) ?? null,
      titre: (e.titre as string) ?? '',
      type: typeof e.type === 'object' && e.type !== null ? (e.type as { id: number }).id : (e.type as number),
      description: (e.description as string | null) ?? null,
      dateDebut: (e.dateDebut as string) ?? '',
      dateFin: (e.dateFin as string | null) ?? null,
      lieuNom: (e.lieuNom as string | null) ?? null,
      lieuAdresse: (e.lieuAdresse as string | null) ?? null,
      lieuCodePostal: (e.lieuCodePostal as string | null) ?? null,
      lieuVille: (e.lieuVille as string) ?? '',
      lienInscription: (e.lienInscription as string | null) ?? null,
      statut: (e.statut as string) ?? 'publie',
      // Inscrits en ligne (ADR-0013 §3bis) — la gestion se fait ici.
      inscrits: (await listerInscrits(payload, e.id as number)).map((i) => ({
        reseauteurId: i.reseauteurId,
        slug: i.slug,
        prenom: i.prenom,
        nom: i.nom,
        ville: i.ville,
        dateInscription: i.dateInscription,
      })),
    })),
  )

  const { docs: typesDocs } = await payload.find({
    collection: 'types-evenement',
    limit: 50,
    sort: 'label',
    depth: 0,
    overrideAccess: true,
  })
  const types: TypeEvLite[] = typesDocs.map((t) => ({
    id: t.id as number,
    label: ((t as { label?: string }).label as string) ?? String(t.id),
  }))

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          <Link
            href="/dashboard/plus"
            className="text-sm text-[#71717a] hover:text-[#2563EB] no-underline inline-flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden /> Réseauteur Plus
          </Link>
          <p className="rsn-eyebrow">Espace connecté</p>
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2 mb-2">
            <CalendarPlus size={20} aria-hidden />
            Mes événements
          </h1>
          <p className="text-sm text-[#71717a] mb-8">
            Vos événements sont publiés en votre nom (« Organisé par ») et apparaissent sur la carte
            et dans l&apos;agenda.
          </p>
        </Reveal>

        <MesEvenementsClient evenements={evenements} types={types} />
      </div>
    </div>
  )
}
