/**
 * seed-evenements-plus.ts — Seed d'ÉVÉNEMENTS organisés par les RÉSEAUTEURS PLUS
 * de démo (ADR-0013) : chaque réseauteur Plus (`*@demo.reseauteurs.fr`, plusActif)
 * reçoit 2 événements « Organisé par <Prénom Nom> » dans sa ville, à venir,
 * publiés sur la carte des événements et ouverts à l'inscription en ligne
 * (pas de lienInscription externe — la plateforme fournit l'inscription, §3bis).
 *
 * Seed ensuite des INSCRIPTIONS EN LIGNE réelles (flux `inscrire`) : 3 réseauteurs
 * de démo par événement — les compteurs « X inscrits » et les listes d'inscrits
 * de l'espace organisateur ont ainsi de la matière.
 *
 * Prérequis : `pnpm seed:demo-plus --confirm` et/ou `pnpm seed:reseauteurs-plus --confirm`
 * (comptes Plus), et `pnpm seed:types-evenement --confirm` (référentiel des types).
 *
 * IDEMPOTENT + ADDITIF (clé : titre + organisateurReseauteur). Purgeable via
 * purge-demo.ts (tag [démo] + organisateur de démo). N'écrit qu'avec --confirm.
 *
 * Usage :  pnpm seed:evenements-plus            (aperçu)
 *          pnpm seed:evenements-plus --confirm  (exécution)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const DEMO_TAG = '[démo]'
const DEMO_EMAIL = '@demo.reseauteurs.fr'

/** Gabarits d'événements — variés par type, titre stable par ville (idempotence). */
interface Gabarit {
  typeValue: string
  titre: (ville: string) => string
  lieuNom: (ville: string) => string
  heure: number
  minutes: number
  descriptionCourte: string
  description: string
  gratuit: boolean
  tarif?: string
  nombrePlaces?: number
  publicConcerne: string
}

const GABARITS: Gabarit[] = [
  {
    typeValue: 'petit-dejeuner',
    titre: (v) => `Petit-déjeuner networking de ${v}`,
    lieuNom: (v) => `Café de la Place — ${v}`,
    heure: 8, minutes: 0,
    descriptionCourte: 'Un café, des croissants et un tour de table pour bien démarrer la journée.',
    description: 'Rencontre matinale entre professionnels locaux : chacun se présente en une minute, puis échanges libres autour d\'un petit-déjeuner. Ouvert à tous les réseauteurs, membres d\'un réseau ou non.',
    gratuit: true,
    nombrePlaces: 20,
    publicConcerne: 'Entrepreneurs, indépendants, commerciaux',
  },
  {
    typeValue: 'afterwork',
    titre: (v) => `Afterwork des entrepreneurs de ${v}`,
    lieuNom: (v) => `Le Comptoir Central — ${v}`,
    heure: 18, minutes: 30,
    descriptionCourte: 'Rencontre informelle en fin de journée — venez comme vous êtes, repartez avec des contacts.',
    description: 'Un moment convivial pour élargir son réseau local sans pression : pas de pitch imposé, pas de slides, juste des rencontres entre dirigeants, freelances et porteurs de projet.',
    gratuit: true,
    publicConcerne: 'Tous les professionnels',
  },
  {
    typeValue: 'atelier',
    titre: (v) => `Atelier pitch : se présenter en 60 secondes (${v})`,
    lieuNom: (v) => `Espace coworking Le Spot — ${v}`,
    heure: 9, minutes: 30,
    descriptionCourte: 'Travaillez votre présentation éclair en petit groupe, avec mises en situation.',
    description: 'Atelier pratique en petit groupe : structurer son pitch, capter l\'attention en une minute et conclure par un appel à l\'action. Chaque participant repart avec un pitch rodé et testé.',
    gratuit: true,
    nombrePlaces: 12,
    publicConcerne: 'Indépendants et créateurs d\'entreprise',
  },
  {
    typeValue: 'dejeuner',
    titre: (v) => `Déjeuner d'affaires de ${v}`,
    lieuNom: (v) => `Brasserie des Halles — ${v}`,
    heure: 12, minutes: 15,
    descriptionCourte: 'Un déjeuner en petit comité pour créer des mises en relation qualifiées.',
    description: 'Table de 8 à 10 professionnels aux activités complémentaires. Tour de table structuré, échanges de recommandations et mise en relation en fin de repas.',
    gratuit: false,
    tarif: '25 € (repas inclus)',
    nombrePlaces: 10,
    publicConcerne: 'Dirigeants et décideurs',
  },
  {
    typeValue: 'speed-business',
    titre: (v) => `Speed business meeting de ${v}`,
    lieuNom: (v) => `Hôtel du Parc — ${v}`,
    heure: 17, minutes: 30,
    descriptionCourte: 'Des rendez-vous express de 7 minutes pour multiplier les contacts en une soirée.',
    description: 'Format dynamique : des rendez-vous en face à face de 7 minutes, chronométrés, pour rencontrer une dizaine de professionnels en une session. Apportez vos cartes de visite !',
    gratuit: false,
    tarif: '10 €',
    nombrePlaces: 30,
    publicConcerne: 'Commerciaux, entrepreneurs, indépendants',
  },
  {
    typeValue: 'conference',
    titre: (v) => `Conférence : développer son réseau à ${v}`,
    lieuNom: (v) => `Maison des Associations — ${v}`,
    heure: 18, minutes: 0,
    descriptionCourte: 'Retour d\'expérience : comment le networking local a transformé une activité.',
    description: 'Conférence suivie d\'un temps d\'échanges : les bonnes pratiques du réseautage de proximité, les erreurs à éviter, et comment choisir les événements qui comptent vraiment.',
    gratuit: true,
    publicConcerne: 'Tous publics professionnels',
  },
]

function dbHost(): string {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URI || ''
  if (!url) return '(DATABASE_URL non défini)'
  try {
    return new URL(url).host
  } catch {
    return '(URL illisible)'
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm') || process.env.SEED_DEMO === '1'

  console.log('')
  console.log('=== SEED ÉVÉNEMENTS DES RÉSEAUTEURS PLUS (ADR-0013 §3bis) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log('  Contenu    : 2 événements à venir par réseauteur Plus de démo (dans sa ville),')
  console.log('               inscription en ligne sur la plateforme (pas de lien externe)')
  console.log('               + 3 réseauteurs de démo inscrits en ligne à chaque événement')
  console.log('')

  if (!confirm) {
    console.log("  Mode aperçu (dry-run) — rien n'a été écrit.")
    console.log('  Pour exécuter :  pnpm seed:evenements-plus --confirm')
    console.log('')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const { inscrire } = await import('../lib/inscriptions')
  const payload = await getPayload({ config })
  const log = (m: string) => console.log(`-> ${m}`)

  const prevSeedDev = process.env.SEED_DEV
  const prevDryRun = process.env.EMAILS_DRY_RUN
  process.env.SEED_DEV = 'true' // hooks lourds (compteurs/géocodage) hors transaction Neon
  process.env.EMAILS_DRY_RUN = '1'

  try {
    // ── 1. Référentiel des types (par value, avec repli sur le premier)
    const { docs: typesEv } = await payload.find({
      collection: 'types-evenement',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    if (typesEv.length === 0) {
      throw new Error('Aucun types-evenement en base — lancez d\'abord `pnpm seed:types-evenement --confirm`.')
    }
    const typeByValue = new Map(typesEv.map((t) => [(t as { value: string }).value, t.id as number]))
    const typeFallback = typesEv[0].id as number

    // ── 2. Réseauteurs Plus de démo (comptes *@demo.reseauteurs.fr, Plus actif)
    const { docs: plusUsers } = await payload.find({
      collection: 'users',
      where: {
        and: [
          { email: { contains: DEMO_EMAIL } },
          { role: { equals: 'reseauteur' } },
          { plusActif: { equals: true } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })
    if (plusUsers.length === 0) {
      throw new Error(
        'Aucun réseauteur Plus de démo en base — lancez d\'abord `pnpm seed:demo-plus --confirm` ' +
        'et/ou `pnpm seed:reseauteurs-plus --confirm`.',
      )
    }
    const { docs: profils } = await payload.find({
      collection: 'reseauteurs',
      where: { user: { in: plusUsers.map((u) => u.id) } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })
    log(`${profils.length} réseauteur(s) Plus de démo trouvés`)

    // ── 3. 2 événements par organisateur (idempotent : titre + organisateurReseauteur)
    let crees = 0
    let existants = 0
    let sansGeo = 0
    const exemples: string[] = []

    for (let i = 0; i < profils.length; i++) {
      const p = profils[i] as {
        id: number
        prenom?: string | null
        nom?: string | null
        ville?: string | null
        departement?: string | null
        latitude?: number | null
        longitude?: number | null
      }
      if (!p.ville || p.latitude == null || p.longitude == null) {
        sansGeo++
        log(`profil incomplet (ville/géo manquante) — ignoré : #${p.id}`)
        continue
      }
      const organisateur = `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || `Réseauteur #${p.id}`

      // 2 gabarits différents par organisateur, décalés pour varier les types entre villes
      const indices = [i % GABARITS.length, (i + 3) % GABARITS.length]
      for (let j = 0; j < indices.length; j++) {
        const g = GABARITS[indices[j]]
        const titre = g.titre(p.ville)

        const { totalDocs } = await payload.count({
          collection: 'evenements',
          where: { and: [{ titre: { equals: titre } }, { organisateurReseauteur: { equals: p.id } }] },
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          existants++
          continue
        }

        // Dates étalées (déterministe par organisateur) : J+4 à J+40 environ
        const joursDansLeFutur = j === 0 ? 4 + ((i * 5) % 28) : 11 + ((i * 7) % 30)
        const dateDebut = new Date()
        dateDebut.setDate(dateDebut.getDate() + joursDansLeFutur)
        dateDebut.setHours(g.heure, g.minutes, 0, 0)
        const dateFin = new Date(dateDebut.getTime() + 2 * 3600e3)
        const dateLimite = g.nombrePlaces
          ? new Date(dateDebut.getTime() - 2 * 86400e3).toISOString()
          : undefined

        // Léger décalage du lieu vs le marqueur du réseauteur (les 2 cartes ne se superposent pas)
        const lieuLatitude = p.latitude + 0.002 * (((i + j) % 5) - 2)
        const lieuLongitude = p.longitude + 0.002 * (((i + 2 * j) % 5) - 2)

        await payload.create({
          collection: 'evenements',
          data: {
            titre,
            type: typeByValue.get(g.typeValue) ?? typeFallback,
            organisateurReseauteur: p.id,
            dateDebut: dateDebut.toISOString(),
            dateFin: dateFin.toISOString(),
            lieuNom: g.lieuNom(p.ville),
            lieuVille: p.ville,
            lieuDepartement: p.departement ?? undefined,
            lieuLatitude,
            lieuLongitude,
            descriptionCourte: g.descriptionCourte,
            description: `${g.description}\n\nÉvénement organisé par ${organisateur}, réseauteur Plus. ${DEMO_TAG}`,
            publicConcerne: g.publicConcerne,
            niveauPublic: 'tous',
            ouvertATous: 'oui',
            participationInvite: 'oui',
            gratuit: g.gratuit,
            ...(g.tarif ? { tarif: g.tarif } : {}),
            ...(g.nombrePlaces ? { nombrePlaces: g.nombrePlaces } : {}),
            ...(dateLimite ? { dateLimiteInscription: dateLimite } : {}),
            parking: (i + j) % 2 === 0,
            accesPmr: (i + j) % 3 !== 0,
            contactNom: organisateur,
            creePar: organisateur,
            statut: 'publie',
            // Pas de lienInscription : événement Plus → inscription EN LIGNE sur la
            // plateforme (ADR-0013 §3bis) ; le lien externe est réservé aux réseaux.
          } as never,
          overrideAccess: true,
        })
        crees++
        if (exemples.length < 4) exemples.push(`${titre} (${organisateur}, J+${joursDansLeFutur})`)
        log(`événement créé : ${titre} — ${organisateur}`)
      }
    }

    // ── 4. Inscriptions en ligne de réseauteurs de démo (flux RÉEL `inscrire` — §3bis).
    //    Pool : tous les réseauteurs de démo (gratuits inclus — l'inscription ne requiert
    //    pas le Plus). Sélection déterministe, l'organisateur exclu de ses propres événements.
    const { docs: demoUsers } = await payload.find({
      collection: 'users',
      where: { and: [{ email: { contains: DEMO_EMAIL } }, { role: { equals: 'reseauteur' } }] },
      limit: 100,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })
    const { docs: demoProfils } = await payload.find({
      collection: 'reseauteurs',
      where: { user: { in: demoUsers.map((u) => u.id) } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })
    const relId = (v: unknown): number | null => {
      if (v == null) return null
      return typeof v === 'object' ? (((v as { id?: number }).id as number) ?? null) : Number(v)
    }
    const pool = demoProfils
      .map((r) => ({ profilId: r.id as number, userId: relId((r as { user?: unknown }).user) }))
      .filter((p): p is { profilId: number; userId: number } => p.userId != null)

    const { docs: evsPlus } = await payload.find({
      collection: 'evenements',
      where: {
        and: [
          { organisateurReseauteur: { in: pool.map((p) => p.profilId) } },
          { statut: { equals: 'publie' } },
          { dateDebut: { greater_than: new Date().toISOString() } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })

    let inscriptionsCreees = 0
    let inscriptionsDeja = 0
    for (let k = 0; k < evsPlus.length; k++) {
      const ev = evsPlus[k]
      const orgId = relId((ev as { organisateurReseauteur?: unknown }).organisateurReseauteur)
      let poses = 0
      for (let m = 0; poses < 3 && m < pool.length; m++) {
        const cand = pool[(k + m) % pool.length]
        if (cand.profilId === orgId) continue
        const res = await inscrire(payload, cand.userId, ev.id as number)
        if (!res.ok) {
          log(`inscription refusée (événement #${ev.id}, user #${cand.userId}) : ${res.raison}`)
          continue
        }
        if (res.deja) inscriptionsDeja++
        else inscriptionsCreees++
        poses++
      }
    }
    log(`inscriptions en ligne : ${inscriptionsCreees} créée(s) · ${inscriptionsDeja} déjà en base (${evsPlus.length} événements Plus à venir)`)

    // ── Récapitulatif
    console.log('')
    console.log('OK — seed événements Plus terminé.')
    console.log('  ────────────────────────────────────────────────────────────')
    console.log(`  Créés : ${crees} · déjà en base (ignorés) : ${existants}` + (sansGeo ? ` · profils ignorés (géo manquante) : ${sansGeo}` : ''))
    for (const ex of exemples) console.log(`    · ${ex}`)
    console.log(`  Inscriptions en ligne : ${inscriptionsCreees} créée(s) · ${inscriptionsDeja} existante(s)`)
    console.log('  ────────────────────────────────────────────────────────────')
    console.log('  À VISITER :')
    console.log('    /evenements                → liste + carte (marqueurs dans toute la France)')
    console.log('    /evenement/<slug>          → fiche « Organisé par <réseauteur> » + « Je m\'inscris » + compteur d\'inscrits')
    console.log('    /dashboard/mes-evenements  → connecté avec un compte plus-<prenom>-<nom>@demo.reseauteurs.fr')
    console.log('                                 (liste des inscrits de chaque événement)')
    console.log('')
  } finally {
    if (prevSeedDev === undefined) delete process.env.SEED_DEV
    else process.env.SEED_DEV = prevSeedDev
    if (prevDryRun === undefined) delete process.env.EMAILS_DRY_RUN
    else process.env.EMAILS_DRY_RUN = prevDryRun
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-evenements-plus] fatal:', err)
  process.exit(1)
})
