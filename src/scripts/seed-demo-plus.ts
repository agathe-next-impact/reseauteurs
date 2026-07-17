/**
 * seed-demo-plus.ts — Seed de démonstration des fonctionnalités ADR-0013
 * (Réseauteur Plus, événements « Organisé par », partenaires self-service +
 * offres réservées aux réseauteurs, participations).
 * ADR-0015 : les packs de licences + codes promo sont SUPPRIMÉS du seed.
 *
 * IDEMPOTENT + ADDITIF (clés : emails des comptes, noms des fiches, titres des
 * événements). N'écrit qu'avec --confirm (ou SEED_DEMO=1) ; sinon dry-run.
 *
 * Crée 3 COMPTES CONNECTABLES (mot de passe commun affiché en fin de run) :
 *   demo-reseauteur@demo.reseauteurs.fr   réseauteur GRATUIT (profil complet, participations)
 *   demo-plus@demo.reseauteurs.fr         réseauteur PLUS (abonnement) + 2 événements organisés
 *   demo-partenaire@demo.reseauteurs.fr   PARTENAIRE (fiche active + offre)
 *
 * Usage :  pnpm seed:demo-plus            (aperçu)
 *          pnpm seed:demo-plus --confirm  (exécution)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const DEMO_PASSWORD = 'Demo12345!'
const DEMO_TAG = '[démo]'

const COMPTES = [
  { email: 'demo-reseauteur@demo.reseauteurs.fr', role: 'reseauteur', nomSociete: 'Claire Fontaine', ville: 'Paris' },
  { email: 'demo-plus@demo.reseauteurs.fr', role: 'reseauteur', nomSociete: 'Marc Olivier', ville: 'Lyon' },
  { email: 'demo-partenaire@demo.reseauteurs.fr', role: 'partenaire', nomSociete: 'CoWork Central', ville: 'Paris' },
] as const

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
  console.log('=== SEED DÉMO ADR-0013 (Réseauteur Plus + partenaires) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log('  Contenu    : 3 comptes connectables · 3 partenaires actifs avec offres ·')
  console.log('               2 événements « Organisé par » · participations')
  console.log('')

  if (!confirm) {
    console.log("  Mode aperçu (dry-run) — rien n'a été écrit.")
    console.log('  Pour exécuter :  pnpm seed:demo-plus --confirm')
    console.log('')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const { inscrire } = await import('../lib/inscriptions')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config })
  const drizzle = payload.db.drizzle as unknown as {
    execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
  }
  const log = (m: string) => console.log(`-> ${m}`)

  const prevSeedDev = process.env.SEED_DEV
  const prevDryRun = process.env.EMAILS_DRY_RUN
  process.env.SEED_DEV = 'true' // hooks lourds (compteurs/géocodage) hors transaction Neon
  process.env.EMAILS_DRY_RUN = '1' // pas d'appels Resend pendant le seed

  try {
    // ── 0. Contexte : réseaux locaux + type d'événement existants (seed de base).
    //    On privilégie des locaux qui ont des ÉVÉNEMENTS À VENIR, pour que les
    //    participations démo aient de la matière.
    const { docs: evFuturs } = await payload.find({
      collection: 'evenements',
      where: {
        and: [
          { reseau: { exists: true } },
          { statut: { equals: 'publie' } },
          { dateDebut: { greater_than: new Date().toISOString() } },
        ],
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const reseauxAvecEvenements = [
      ...new Set(
        evFuturs
          .map((e) => (typeof e.reseau === 'object' && e.reseau !== null ? (e.reseau as { id: number }).id : (e.reseau as number)))
          .filter((v) => v != null),
      ),
    ]
    const { docs: locauxPrio } = reseauxAvecEvenements.length
      ? await payload.find({
          collection: 'reseaux',
          where: { and: [{ id: { in: reseauxAvecEvenements } }, { niveau: { equals: 'local' } }] },
          limit: 4,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] as Array<{ id: unknown }> }
    const { docs: locauxFallback } = await payload.find({
      collection: 'reseaux',
      where: { niveau: { equals: 'local' } },
      limit: 4,
      depth: 0,
      overrideAccess: true,
      sort: 'nom',
    })
    const locaux = locauxPrio.length > 0 ? locauxPrio : locauxFallback
    if (locaux.length === 0) {
      console.warn('⚠️  Aucun réseau local en base — lancez d\'abord `pnpm seed:demo --confirm` (affiliations/participations seront vides).')
    }
    const localIds = locaux.map((l) => l.id as number)
    const { docs: typesEv } = await payload.find({ collection: 'types-evenement', limit: 1, overrideAccess: true })
    const typeId = (typesEv[0] as { id?: number } | undefined)?.id
    if (!typeId) throw new Error('Aucun types-evenement en base — lancez d\'abord `pnpm seed:demo --confirm`.')

    // ── 1. Comptes (idempotent par email) + _verified pour la connexion
    const usersByEmail: Record<string, { id: number }> = {}
    for (const c of COMPTES) {
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: c.email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (docs[0]) {
        usersByEmail[c.email] = { id: docs[0].id as number }
        log(`compte existant : ${c.email}`)
      } else {
        const nowIso = new Date().toISOString()
        const u = await payload.create({
          collection: 'users',
          data: {
            email: c.email,
            password: DEMO_PASSWORD,
            nomSociete: c.nomSociete,
            ville: c.ville,
            role: c.role,
            cguAcceptedAt: nowIso,
            confidentialiteAcceptedAt: nowIso,
            optInMarketing: false,
          } as Record<string, unknown> as never,
          disableVerificationEmail: true,
          overrideAccess: true,
        })
        usersByEmail[c.email] = { id: u.id as number }
        log(`compte créé : ${c.email} (${c.role})`)
      }
    }
    const ids = COMPTES.map((c) => usersByEmail[c.email].id)
    await drizzle.execute(sql`UPDATE users SET _verified = true WHERE id IN ${ids}`.inlineParams())
    log('emails marqués vérifiés (connexion possible)')

    // ── 2. Statut Plus (abonnement) sur demo-plus
    const plusExpire = new Date(Date.now() + 365 * 86400e3).toISOString()
    await payload.update({
      collection: 'users',
      id: usersByEmail['demo-plus@demo.reseauteurs.fr'].id,
      data: { plusActif: true, plusSource: 'abonnement', plusExpireAt: plusExpire } as Record<string, unknown> as never,
      overrideAccess: true,
      context: { webhookTrusted: true },
    })
    log('demo-plus : Réseauteur Plus actif (source abonnement, +1 an)')

    // ── 3. Profils réseauteurs complets (auto-publiés par le hook prenom+nom)
    const PROFILS: Record<string, Record<string, unknown>> = {
      'demo-reseauteur@demo.reseauteurs.fr': {
        prenom: 'Claire', nom: 'Fontaine', fonction: 'Consultante RH', entreprise: 'Fontaine Conseil',
        ville: 'Paris', departement: 'Paris', region: 'Île-de-France',
        latitude: 48.8566, longitude: 2.3522, evenementsParMois: 3,
        description: `Consultante RH indépendante, adepte des petits-déjeuners networking. ${DEMO_TAG}`,
      },
      'demo-plus@demo.reseauteurs.fr': {
        prenom: 'Marc', nom: 'Olivier', fonction: 'Coach business', entreprise: 'MO Coaching',
        ville: 'Lyon', departement: 'Rhône', region: 'Auvergne-Rhône-Alpes',
        latitude: 45.764, longitude: 4.8357, evenementsParMois: 8,
        description: `Coach et organisateur d'afterworks — abonné Réseauteur Plus. ${DEMO_TAG}`,
      },
    }
    const profilByEmail: Record<string, { id: number }> = {}
    for (const [email, data] of Object.entries(PROFILS)) {
      const userId = usersByEmail[email].id
      const { docs } = await payload.find({
        collection: 'reseauteurs',
        where: { user: { equals: userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (!docs[0]) throw new Error(`Profil réseauteur absent pour ${email} (hook auto-création ?)`)
      const affiliations = localIds.slice(0, 2)
      await payload.update({
        collection: 'reseauteurs',
        id: docs[0].id,
        data: { ...data, ...(affiliations.length ? { reseauxFrequentes: affiliations } : {}) } as never,
        overrideAccess: true,
      })
      profilByEmail[email] = { id: docs[0].id as number }
      log(`profil complété + publié : ${data.prenom} ${data.nom}`)
    }

    // ── 4. Partenaires actifs avec offres (fiche self-service + 2 fiches admin)
    const partenaireUserId = usersByEmail['demo-partenaire@demo.reseauteurs.fr'].id
    const { docs: fichesP } = await payload.find({
      collection: 'partenaires',
      where: { user: { equals: partenaireUserId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!fichesP[0]) throw new Error('Fiche partenaire absente pour demo-partenaire (hook auto-création ?)')
    const fichePartenaireId = fichesP[0].id as number
    await payload.update({
      collection: 'partenaires',
      id: fichePartenaireId,
      data: {
        nom: 'CoWork Central',
        lien: 'https://example.com/cowork-central',
        description: `Espaces de coworking au cœur des villes — partenaire des réseauteurs. ${DEMO_TAG}`,
        statut: 'actif',
        abonnementExpireAt: plusExpire,
        offre: {
          titre: '1 journée d\'essai offerte',
          description: 'Présentez votre profil RÉSEAUTEURS à l\'accueil et testez nos espaces gratuitement pendant une journée (café inclus).',
          lien: 'https://example.com/cowork-central/essai',
        },
      } as never,
      overrideAccess: true,
    })
    log('partenaire self-service actif : CoWork Central (offre + abonnement)')

    const AUTRES_PARTENAIRES = [
      {
        nom: 'Café Grain d\'Or',
        lien: 'https://example.com/grain-dor',
        description: `Torréfacteur artisanal — le café des petits-déjeuners networking. ${DEMO_TAG}`,
        offre: {
          titre: '-15 % sur votre première commande',
          description: 'Réduction réservée aux réseauteurs sur tout le catalogue (grains, capsules, machines).',
          lien: 'https://example.com/grain-dor/reseauteurs',
        },
      },
      {
        nom: 'Imprimerie Vite Fait',
        lien: 'https://example.com/vite-fait',
        description: `Impression express pour les pros — cartes, kakémonos, flyers. ${DEMO_TAG}`,
        offre: {
          titre: '100 cartes de visite offertes',
          description: 'Pour toute première commande, 100 cartes de visite premium offertes aux réseauteurs.',
          lien: null,
        },
      },
    ]
    for (const p of AUTRES_PARTENAIRES) {
      const { totalDocs } = await payload.count({
        collection: 'partenaires',
        where: { nom: { equals: p.nom } },
        overrideAccess: true,
      })
      if (totalDocs > 0) {
        log(`partenaire existant : ${p.nom}`)
        continue
      }
      await payload.create({
        collection: 'partenaires',
        data: { ...p, statut: 'actif', abonnementExpireAt: plusExpire } as never,
        overrideAccess: true,
      })
      log(`partenaire actif créé : ${p.nom}`)
    }

    // ── 5. (ADR-0015) Les packs de licences sont supprimés — plus rien à seeder ici.

    // ── 6. Événements organisés par le réseauteur Plus (fiche « Organisé par »)
    const EVENEMENTS_PLUS = [
      {
        titre: 'Afterwork des indépendants lyonnais',
        description: `Rencontre informelle entre freelances et dirigeants, organisée par Marc Olivier. ${DEMO_TAG}`,
        joursDansLeFutur: 9,
        lieuNom: 'Le Comptoir Presqu\'île', lieuVille: 'Lyon',
        lieuLatitude: 45.764, lieuLongitude: 4.8357,
      },
      {
        titre: 'Café networking du samedi',
        description: `Un café, des rencontres, zéro slide — venez comme vous êtes. ${DEMO_TAG}`,
        joursDansLeFutur: 16,
        lieuNom: 'Grain d\'Or Bellecour', lieuVille: 'Lyon',
        lieuLatitude: 45.7578, lieuLongitude: 4.832,
      },
    ]
    const profilPlusId = profilByEmail['demo-plus@demo.reseauteurs.fr'].id
    for (const ev of EVENEMENTS_PLUS) {
      const { totalDocs } = await payload.count({
        collection: 'evenements',
        where: { and: [{ titre: { equals: ev.titre } }, { organisateurReseauteur: { equals: profilPlusId } }] },
        overrideAccess: true,
      })
      if (totalDocs > 0) {
        log(`événement existant : ${ev.titre}`)
        continue
      }
      const { joursDansLeFutur, ...rest } = ev
      await payload.create({
        collection: 'evenements',
        data: {
          ...rest,
          type: typeId,
          dateDebut: new Date(Date.now() + joursDansLeFutur * 86400e3).toISOString(),
          lienInscription: 'https://example.com/inscription',
          organisateurReseauteur: profilPlusId,
          statut: 'publie',
        } as never,
        overrideAccess: true,
      })
      log(`événement « Organisé par Marc Olivier » créé : ${ev.titre}`)
    }

    // ── 6bis. Inscriptions en ligne aux événements Plus de Marc (ADR-0013 §3bis).
    //    Quelques réseauteurs (hors Marc) s'inscrivent réellement via le flux `inscrire`.
    const { docs: evsPlus } = await payload.find({
      collection: 'evenements',
      where: { and: [{ organisateurReseauteur: { equals: profilPlusId } }, { statut: { equals: 'publie' } }] },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    const { docs: candidatsInscription } = await payload.find({
      collection: 'reseauteurs',
      where: { and: [{ statut: { equals: 'valide' } }, { user: { exists: true } }, { id: { not_equals: profilPlusId } }] },
      limit: 6,
      depth: 0,
      overrideAccess: true,
      sort: 'nom',
    })
    let nbInscriptions = 0
    for (const ev of evsPlus) {
      for (const rz of candidatsInscription) {
        const uid = typeof rz.user === 'object' && rz.user !== null ? (rz.user as { id: number }).id : (rz.user as number)
        if (uid == null) continue
        const res = await inscrire(payload, uid, ev.id as number)
        if (res.ok && !res.deja) nbInscriptions++
      }
    }
    log(`inscriptions en ligne seedées : ${nbInscriptions} (aux ${evsPlus.length} événements Plus de Marc)`)

    // ── 7. Participations (réseauteurs → événements de leurs réseaux fréquentés)
    if (localIds.length > 0) {
      const { docs: evsReseaux } = await payload.find({
        collection: 'evenements',
        where: {
          and: [
            { reseau: { in: localIds.slice(0, 2) } },
            { statut: { equals: 'publie' } },
            { dateDebut: { greater_than: new Date().toISOString() } },
          ],
        },
        limit: 3,
        depth: 0,
        overrideAccess: true,
      })
      const evIds = evsReseaux.map((e) => e.id as number)
      if (evIds.length > 0) {
        await payload.update({
          collection: 'reseauteurs',
          id: profilByEmail['demo-reseauteur@demo.reseauteurs.fr'].id,
          data: { evenementsParticipes: evIds } as never,
          overrideAccess: true,
        })
        log(`participations signalées : ${evIds.length} événement(s) pour Claire`)
      } else {
        log('aucun événement à venir des réseaux fréquentés — participations sautées')
      }
    }

    // ── 8. Recalcul des compteurs des locaux affiliés (hooks skippés par SEED_DEV)
    for (const rid of localIds.slice(0, 2)) {
      const { totalDocs } = await payload.count({
        collection: 'reseauteurs',
        where: { and: [{ reseauxFrequentes: { contains: rid } }, { statut: { equals: 'valide' } }] },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'reseaux',
        id: rid,
        data: { nbReseauteurs: totalDocs } as never,
        overrideAccess: true,
      })
    }
    log('compteurs nbReseauteurs recalculés')

    // ── Récapitulatif
    console.log('')
    console.log('OK — seed démo ADR-0013 terminé. À VISITER :')
    console.log('  ────────────────────────────────────────────────────────────')
    console.log(`  Mot de passe commun : ${DEMO_PASSWORD}`)
    console.log('  ────────────────────────────────────────────────────────────')
    console.log('  demo-plus@demo.reseauteurs.fr       → /dashboard/plus (Plus actif) · /dashboard/mes-evenements (2 événements)')
    console.log('  demo-reseauteur@demo.reseauteurs.fr → /dashboard/offres (3 offres) · /dashboard/participations')
    console.log('  demo-partenaire@demo.reseauteurs.fr → /dashboard/partenaire (fiche active + offre)')
    console.log('  Public : /partenaires · /partenaire/cowork-central · /evenements (2 événements « Organisé par Marc Olivier », carte Lyon)')
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
  console.error('[seed-demo-plus] fatal:', err)
  process.exit(1)
})
