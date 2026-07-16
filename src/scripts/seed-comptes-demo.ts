/**
 * seed-comptes-demo.ts — Garantit UN COMPTE DE DÉMO CONNECTABLE par type de fiche
 * (mot de passe commun affiché en fin de run) :
 *
 *   demo-reseauteur@demo.reseauteurs.fr    RÉSEAUTEUR   → fiche réseauteur publiée
 *   demo-organisateur@demo.reseauteurs.fr  ORGANISATEUR → fiche RÉSEAU revendiquée
 *                                          (claim d'un national [démo] orphelin — BNI en
 *                                          priorité — sinon création d'un national démo)
 *   demo-partenaire@demo.reseauteurs.fr    PARTENAIRE   → fiche partenaire active + offre
 *
 * Les emails demo-reseauteur / demo-partenaire sont VOLONTAIREMENT les mêmes que ceux
 * de seed-demo-plus : les deux scripts se complètent sans doublon (clé = email).
 * Le compte organisateur est la pièce manquante — aucun autre seed ne le crée.
 *
 * IDEMPOTENT + ADDITIF (réutilise les comptes/fiches existants). Nettoyage via
 * purge-demo (comptes *@demo.reseauteurs.fr ; le réseau revendiqué redevient orphelin).
 *
 * Usage :  pnpm seed:comptes-demo            (aperçu)
 *          pnpm seed:comptes-demo --confirm  (exécution)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const DEMO_PASSWORD = 'Demo12345!'
const DEMO_TAG = '[démo]'

const EMAILS = {
  reseauteur: 'demo-reseauteur@demo.reseauteurs.fr',
  organisateur: 'demo-organisateur@demo.reseauteurs.fr',
  partenaire: 'demo-partenaire@demo.reseauteurs.fr',
} as const

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
  console.log('=== SEED COMPTES DÉMO (1 compte connectable par type de fiche) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log(`  Comptes    : ${EMAILS.reseauteur} (réseauteur)`)
  console.log(`               ${EMAILS.organisateur} (organisateur → fiche réseau)`)
  console.log(`               ${EMAILS.partenaire} (partenaire)`)
  console.log('')

  if (!confirm) {
    console.log("  Mode aperçu (dry-run) — rien n'a été écrit.")
    console.log('  Pour exécuter :  pnpm seed:comptes-demo --confirm')
    console.log('')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
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
    const nowIso = new Date().toISOString()
    const unAn = new Date(Date.now() + 365 * 86400e3).toISOString()

    const findUser = async (email: string): Promise<{ id: number } | null> => {
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return docs[0] ? { id: docs[0].id as number } : null
    }

    /** Cherche un réseau national [démo] SANS compte à revendiquer (partenaire d'abord). */
    const trouverReseauAClaimer = async (): Promise<{ id: number; nom: string } | null> => {
      const bases = [
        { partenaire: { equals: true } } as Record<string, unknown>,
        null, // fallback : n'importe quel national démo orphelin
      ]
      for (const extra of bases) {
        const { docs } = await payload.find({
          collection: 'reseaux',
          where: {
            and: [
              { user: { exists: false } },
              { niveau: { not_equals: 'local' } },
              { description: { contains: DEMO_TAG } },
              ...(extra ? [extra] : []),
            ],
          } as never,
          limit: 1,
          depth: 0,
          overrideAccess: true,
          sort: 'id',
        })
        if (docs[0]) return { id: docs[0].id as number, nom: String(docs[0].nom) }
      }
      return null
    }

    // ── 1. RÉSEAUTEUR — compte + fiche réseauteur publiée ────────────────────
    let reseauteurUser = await findUser(EMAILS.reseauteur)
    if (reseauteurUser) {
      log(`compte réseauteur existant : ${EMAILS.reseauteur}`)
    } else {
      const u = await payload.create({
        collection: 'users',
        data: {
          email: EMAILS.reseauteur,
          password: DEMO_PASSWORD,
          nomSociete: 'Claire Fontaine',
          ville: 'Paris',
          role: 'reseauteur',
          cguAcceptedAt: nowIso,
          confidentialiteAcceptedAt: nowIso,
          optInMarketing: false,
        } as Record<string, unknown> as never,
        disableVerificationEmail: true,
        overrideAccess: true,
      })
      reseauteurUser = { id: u.id as number }
      log(`compte réseauteur créé : ${EMAILS.reseauteur}`)
    }

    const { docs: profils } = await payload.find({
      collection: 'reseauteurs',
      where: { user: { equals: reseauteurUser.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!profils[0]) throw new Error(`Profil réseauteur absent pour ${EMAILS.reseauteur} (hook auto-création ?)`)
    let ficheReseauteur = profils[0] as { id: number; prenom?: string | null; nom?: string | null; slug?: string | null }
    if (ficheReseauteur.prenom && ficheReseauteur.nom) {
      log(`fiche réseauteur déjà complète : ${ficheReseauteur.prenom} ${ficheReseauteur.nom}`)
    } else {
      await payload.update({
        collection: 'reseauteurs',
        id: ficheReseauteur.id,
        data: {
          prenom: 'Claire',
          nom: 'Fontaine',
          fonction: 'Consultante RH',
          entreprise: 'Fontaine Conseil',
          ville: 'Paris',
          departement: 'Paris',
          region: 'Île-de-France',
          latitude: 48.8566,
          longitude: 2.3522,
          evenementsParMois: 3,
          description: `Consultante RH indépendante, adepte des petits-déjeuners networking. ${DEMO_TAG}`,
        } as never,
        overrideAccess: true,
      })
      log('fiche réseauteur complétée + publiée : Claire Fontaine')
    }

    // ── 2. ORGANISATEUR — compte + fiche réseau (claim d'un national démo) ───
    let orgUser = await findUser(EMAILS.organisateur)
    if (orgUser) {
      log(`compte organisateur existant : ${EMAILS.organisateur}`)
    } else {
      const cible = await trouverReseauAClaimer()
      const u = await payload.create({
        collection: 'users',
        data: {
          email: EMAILS.organisateur,
          password: DEMO_PASSWORD,
          nomSociete: 'Réseau Démo',
          ville: 'Paris',
          role: 'organisateur',
          cguAcceptedAt: nowIso,
          confidentialiteAcceptedAt: nowIso,
          optInMarketing: false,
        } as Record<string, unknown> as never,
        disableVerificationEmail: true,
        overrideAccess: true,
        // Claim flow du hook Users afterChange : revendique un national [démo] orphelin
        // (user IS NULL, race-safe). Sans cible, le hook crée un national « Réseau Démo ».
        context: cible ? { claimReseauId: cible.id } : undefined,
      })
      orgUser = { id: u.id as number }
      log(
        cible
          ? `compte organisateur créé : ${EMAILS.organisateur} — revendique « ${cible.nom} »`
          : `compte organisateur créé : ${EMAILS.organisateur} — national « Réseau Démo » auto-créé`,
      )
    }

    const chercherReseauDe = async (userId: number) => {
      const { docs } = await payload.find({
        collection: 'reseaux',
        where: { user: { equals: userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return docs[0] as
        | { id: number; nom: string; slug?: string | null; partenaire?: boolean | null; partenaireExpireAt?: string | null }
        | undefined
    }

    let reseau = await chercherReseauDe(orgUser.id)
    if (!reseau) {
      // Re-run après purge partielle : le compte existe mais n'a plus de réseau.
      const cible = await trouverReseauAClaimer()
      if (cible) {
        await payload.update({
          collection: 'reseaux',
          id: cible.id,
          data: { user: orgUser.id, source: 'revendique' } as never,
          overrideAccess: true,
        })
        log(`réseau revendiqué (rattrapage) : ${cible.nom}`)
      } else {
        await payload.create({
          collection: 'reseaux',
          data: {
            user: orgUser.id,
            nom: 'Réseau Démo',
            niveau: 'national',
            ville: 'Paris',
            statut: 'publiee',
            source: 'revendique',
            description: `Réseau de démonstration géré par le compte organisateur de démo. ${DEMO_TAG}`,
          } as never,
          overrideAccess: true,
        })
        log('réseau national « Réseau Démo » créé (rattrapage)')
      }
      reseau = await chercherReseauDe(orgUser.id)
    }
    if (!reseau) throw new Error(`Fiche réseau absente pour ${EMAILS.organisateur}`)

    // Abonnement partenaire actif (+1 an) : débloque la publication d'événements
    // et l'espace abonnement — indispensable pour une démo organisateur complète.
    if (reseau.partenaire !== true || !reseau.partenaireExpireAt) {
      await payload.update({
        collection: 'reseaux',
        id: reseau.id,
        data: { partenaire: true, partenaireExpireAt: unAn } as never,
        overrideAccess: true,
      })
      log(`abonnement partenaire actif posé sur « ${reseau.nom} » (+1 an)`)
    } else {
      log(`abonnement partenaire déjà actif sur « ${reseau.nom} »`)
    }

    // ── 3. PARTENAIRE — compte + fiche partenaire active + offre ─────────────
    let partenaireUser = await findUser(EMAILS.partenaire)
    if (partenaireUser) {
      log(`compte partenaire existant : ${EMAILS.partenaire}`)
    } else {
      const u = await payload.create({
        collection: 'users',
        data: {
          email: EMAILS.partenaire,
          password: DEMO_PASSWORD,
          nomSociete: 'CoWork Central',
          ville: 'Paris',
          role: 'partenaire',
          cguAcceptedAt: nowIso,
          confidentialiteAcceptedAt: nowIso,
          optInMarketing: false,
        } as Record<string, unknown> as never,
        disableVerificationEmail: true,
        overrideAccess: true,
      })
      partenaireUser = { id: u.id as number }
      log(`compte partenaire créé : ${EMAILS.partenaire}`)
    }

    const { docs: fichesP } = await payload.find({
      collection: 'partenaires',
      where: { user: { equals: partenaireUser.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!fichesP[0]) throw new Error(`Fiche partenaire absente pour ${EMAILS.partenaire} (hook auto-création ?)`)
    const fichePartenaire = fichesP[0] as { id: number; statut?: string | null; slug?: string | null }
    if (fichePartenaire.statut === 'actif') {
      log('fiche partenaire déjà active : CoWork Central')
    } else {
      await payload.update({
        collection: 'partenaires',
        id: fichePartenaire.id,
        data: {
          nom: 'CoWork Central',
          lien: 'https://example.com/cowork-central',
          description: `Espaces de coworking au cœur des villes — partenaire des réseauteurs. ${DEMO_TAG}`,
          statut: 'actif',
          abonnementExpireAt: unAn,
          offre: {
            titre: "1 journée d'essai offerte",
            description:
              "Présentez votre profil RÉSEAUTEURS à l'accueil et testez nos espaces gratuitement pendant une journée.",
            lien: 'https://example.com/cowork-central/essai',
          },
        } as never,
        overrideAccess: true,
      })
      log('fiche partenaire activée : CoWork Central (offre + abonnement +1 an)')
    }

    // ── 4. Connexion possible : emails marqués vérifiés ──────────────────────
    const userIds = [reseauteurUser.id, orgUser.id, partenaireUser.id]
    await drizzle.execute(sql`UPDATE users SET _verified = true WHERE id IN ${userIds}`.inlineParams())
    log('emails marqués vérifiés (connexion possible)')

    // ── Récapitulatif (slugs relus après hooks) ───────────────────────────────
    ficheReseauteur = (await payload.findByID({
      collection: 'reseauteurs',
      id: ficheReseauteur.id,
      depth: 0,
      overrideAccess: true,
    })) as never
    reseau = await chercherReseauDe(orgUser.id)
    const fichePartFresh = (await payload.findByID({
      collection: 'partenaires',
      id: fichePartenaire.id,
      depth: 0,
      overrideAccess: true,
    })) as { slug?: string | null }

    console.log('')
    console.log('OK — comptes de démo prêts. CONNEXION :')
    console.log('  ────────────────────────────────────────────────────────────')
    console.log(`  Mot de passe commun : ${DEMO_PASSWORD}`)
    console.log('  ────────────────────────────────────────────────────────────')
    console.log(`  ${EMAILS.reseauteur}`)
    console.log(`      → /dashboard/profil · fiche publique /reseauteur/${ficheReseauteur.slug ?? '(slug en attente)'}`)
    console.log(`  ${EMAILS.organisateur}`)
    console.log(`      → /dashboard/reseau · /dashboard/evenements · fiche publique /reseau/${reseau?.slug ?? '(slug en attente)'} (« ${reseau?.nom} »)`)
    console.log(`  ${EMAILS.partenaire}`)
    console.log(`      → /dashboard/partenaire · fiche publique /partenaire/${fichePartFresh.slug ?? '(slug en attente)'}`)
    console.log('')
    console.log(`  Nettoyage : pnpm tsx src/scripts/purge-demo.ts --confirm (comptes ${'*@demo.reseauteurs.fr'})`)
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
  console.error('[seed-comptes-demo] fatal:', err)
  process.exit(1)
})
