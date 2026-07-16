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
import { listerInscritsParEvenements } from '@/lib/inscriptions'
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

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })
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

  // Ses événements : en son nom (organisateurReseauteur) ET ceux qu'il a créés pour
  // un groupe local dont il est admin déclaré (creeParUser — décision 2026-07-16).
  const { docs: evDocs } = await payload.find({
    collection: 'evenements',
    where: {
      or: [
        { organisateurReseauteur: { equals: profil.id } },
        { creeParUser: { equals: user.id } },
      ],
    },
    depth: 0,
    limit: 100,
    sort: '-dateDebut',
    overrideAccess: true,
  })

  // Groupes locaux qu'il administre (sélecteur d'organisateur du formulaire)
  const adminReseauxIds = (Array.isArray(profil.adminReseaux) ? profil.adminReseaux : [])
    .map((r) => Number(typeof r === 'object' && r !== null ? (r as { id?: unknown }).id : r))
    .filter(Number.isFinite)
  // Noms des groupes référencés (sélecteur + étiquette « Pour <groupe> » de la liste)
  const reseauIdsAffiches = [
    ...new Set([
      ...adminReseauxIds,
      ...evDocs
        .map((e) => Number(typeof e.reseau === 'object' && e.reseau !== null ? (e.reseau as { id?: unknown }).id : e.reseau))
        .filter(Number.isFinite),
    ]),
  ]
  const { docs: reseauxDocs } = reseauIdsAffiches.length
    ? await payload.find({
        collection: 'reseaux',
        where: { id: { in: reseauIdsAffiches } },
        depth: 0,
        limit: 100,
        overrideAccess: true,
        select: { nom: true } as Record<string, boolean>,
      })
    : { docs: [] as Array<{ id: unknown; nom?: string }> }
  const nomParReseau = new Map(reseauxDocs.map((r) => [Number(r.id), ((r as { nom?: string }).nom as string) ?? String(r.id)]))
  const groupesAdmin = adminReseauxIds
    .map((id) => ({ id, nom: nomParReseau.get(id) ?? String(id) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  // Borne « aujourd'hui » calculée via lib (règle de pureté — pas de Date.now() en rendu)
  const todayStartMs = new Date(`${todayParisDateString()}T00:00:00.000Z`).getTime()

  // Inscrits de TOUS ses événements en UNE requête (évite le N+1 — audit perf P3).
  const inscritsParEv = await listerInscritsParEvenements(
    payload,
    evDocs.map((e) => e.id as number),
  )

  const evenements: MonEvenement[] = evDocs.map((e) => {
    const reseauId = Number(
      typeof e.reseau === 'object' && e.reseau !== null ? (e.reseau as { id?: unknown }).id : e.reseau,
    )
    return {
    past: new Date((e.dateDebut as string) ?? '').getTime() < todayStartMs,
    id: e.id as number,
    slug: (e.slug as string | null) ?? null,
    reseauId: Number.isFinite(reseauId) ? reseauId : null,
    reseauNom: Number.isFinite(reseauId) ? (nomParReseau.get(reseauId) ?? null) : null,
    titre: (e.titre as string) ?? '',
    type:
      typeof e.type === 'object' && e.type !== null
        ? (e.type as { id: number }).id
        : (e.type as number),
    descriptionCourte: (e.descriptionCourte as string | null) ?? null,
    description: (e.description as string | null) ?? null,
    intervenants: (e.intervenants as string | null) ?? null,
    dateDebut: (e.dateDebut as string) ?? '',
    dateFin: (e.dateFin as string | null) ?? null,
    lieuNom: (e.lieuNom as string | null) ?? null,
    lieuAdresse: (e.lieuAdresse as string | null) ?? null,
    lieuCodePostal: (e.lieuCodePostal as string | null) ?? null,
    lieuVille: (e.lieuVille as string) ?? '',
    lieuDepartement: (e.lieuDepartement as string | null) ?? null,
    lienInscription: (e.lienInscription as string | null) ?? null,
    gratuit: (e.gratuit as boolean | null) ?? true,
    tarif: (e.tarif as string | null) ?? null,
    nombrePlaces: (e.nombrePlaces as number | null) ?? null,
    dateLimiteInscription: (e.dateLimiteInscription as string | null) ?? null,
    ouvertATous: (e.ouvertATous as string | null) ?? null,
    reserveMembres: (e.reserveMembres as string | null) ?? null,
    participationInvite: (e.participationInvite as string | null) ?? null,
    niveauPublic: (e.niveauPublic as string | null) ?? null,
    publicConcerne: (e.publicConcerne as string | null) ?? null,
    contactNom: (e.contactNom as string | null) ?? null,
    contactEmail: (e.contactEmail as string | null) ?? null,
    contactTelephone: (e.contactTelephone as string | null) ?? null,
    parking: (e.parking as boolean | null) ?? false,
    accesPmr: (e.accesPmr as boolean | null) ?? false,
    infosPratiques: (e.infosPratiques as string | null) ?? null,
    statut: (e.statut as string) ?? 'publie',
    // Inscrits en ligne (ADR-0013 §3bis) — la gestion se fait ici.
    inscrits: (inscritsParEv.get(e.id as number) ?? []).map((i) => ({
      reseauteurId: i.reseauteurId,
      slug: i.slug,
      prenom: i.prenom,
      nom: i.nom,
      ville: i.ville,
      dateInscription: i.dateInscription,
    })),
    }
  })

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
          <h1 className="text-2xl font-extrabold text-[#16284f] flex items-center gap-2 mb-2">
            <CalendarPlus size={20} aria-hidden />
            Mes événements
          </h1>
          <p className="text-sm text-[#71717a] mb-8">
            Vos événements sont publiés en votre nom (« Organisé par ») ou au nom d&apos;un groupe
            local dont vous êtes admin, et apparaissent sur la carte et dans l&apos;agenda.
          </p>
        </Reveal>

        <MesEvenementsClient evenements={evenements} types={types} groupesAdmin={groupesAdmin} />
      </div>
    </div>
  )
}
