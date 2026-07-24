/**
 * Dashboard réseauteur — Mes participations aux événements.
 *
 * Le réseauteur coche les événements (des réseaux qu'il fréquente) auxquels il sera
 * présent. L'info apparaît ensuite sur sa fiche publique et sur la fiche de chaque
 * événement. Route : /dashboard/participations (route group (reseauteur) — le chemin
 * /dashboard/evenements est réservé aux organisateurs).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'
import Reveal from '@/components/home/Reveal'
import { todayParisDateString } from '@/lib/dates'
import { ParticipationForm, type ParticipationEventItem } from './ParticipationForm'

export const metadata = {
  title: 'Mes adhésions — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

function toIds(rel: unknown): Array<number | string> {
  if (!Array.isArray(rel)) return []
  return rel
    .map((r) => (typeof r === 'object' && r !== null ? (r as { id?: unknown }).id : r))
    .filter((v): v is number | string => v != null)
}

export default async function ParticipationsPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
  if (freshUser.role === 'organisateur') redirect('/dashboard/reseau')
  if (freshUser.role === 'admin') redirect('/admin')

  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const reseauteur = docs[0]
  if (!reseauteur) redirect('/dashboard/profil')

  const reseauIds = toIds(reseauteur.reseauxFrequentes)
  const currentIds = toIds(reseauteur.evenementsParticipes).map(String)

  // Événements PUBLIÉS À VENIR des réseaux fréquentés.
  let events: ParticipationEventItem[] = []
  if (reseauIds.length > 0) {
    const todayISO = new Date(`${todayParisDateString()}T00:00:00.000Z`).toISOString()
    const { docs: evDocs } = await payload.find({
      collection: 'evenements',
      where: {
        and: [
          { statut: { equals: 'publie' } },
          { reseau: { in: reseauIds } },
          {
            or: [
              { dateFin: { greater_than_equal: todayISO } },
              {
                and: [
                  { dateFin: { exists: false } },
                  { dateDebut: { greater_than_equal: todayISO } },
                ],
              },
            ],
          },
        ],
      },
      depth: 1,
      limit: 200,
      sort: 'dateDebut',
      overrideAccess: true,
      select: { titre: true, dateDebut: true, lieuVille: true, reseau: true } as Record<
        string,
        boolean
      >,
    })
    events = evDocs.map((e) => {
      const r = e.reseau as { nom?: string | null } | null | undefined
      return {
        id: e.id,
        titre: (e.titre as string) ?? '',
        dateDebut: (e.dateDebut as string) ?? '',
        lieuVille: (e.lieuVille as string | null | undefined) ?? null,
        reseauNom: r?.nom ?? null,
      }
    })
  }

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Reveal>
          <Link
            href="/dashboard/profil"
            className="text-sm text-[#6E7175] hover:text-[#035AA6] no-underline inline-flex items-center gap-1 mb-4 transition-colors"
          >
             Mon profil
          </Link>
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2 mb-2">
            <CalendarCheck size={20} aria-hidden />
            Mes adhésions
          </h1>
          <p className="text-sm text-[#6E7175] mb-8">
            Signalez votre présence aux événements des réseaux que vous fréquentez. Cette
            information apparaît sur votre fiche publique et sur la fiche de chaque événement.
          </p>
        </Reveal>

        {reseauIds.length === 0 ? (
          <div className="rsn-card rounded-2xl border-dashed p-10 text-center">
            <p className="text-sm font-medium text-[#4E5155] mb-2">
              Vous ne fréquentez aucun réseau pour l&apos;instant.
            </p>
            <p className="text-sm text-[#6E7175] mb-4">
              Ajoutez vos réseaux dans votre profil pour voir leurs événements ici.
            </p>
            <Link
              href="/dashboard/profil"
              className="text-sm text-[#035AA6] font-medium no-underline"
            >
              Compléter mon profil →
            </Link>
          </div>
        ) : events.length === 0 ? (
          <div className="rsn-card rounded-2xl border-dashed p-10 text-center">
            <p className="text-sm font-medium text-[#4E5155] mb-1">Aucun événement à venir</p>
            <p className="text-sm text-[#6E7175]">
              Les réseaux que vous fréquentez n&apos;ont pas encore publié d&apos;événement à venir.
            </p>
          </div>
        ) : (
          <ParticipationForm events={events} initialSelected={currentIds} />
        )}
      </div>
    </div>
  )
}
