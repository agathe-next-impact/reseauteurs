/**
 * seed-reseauteurs-plus.ts — Seed d'une cohorte de RÉSEAUTEURS PLUS affiliés à un
 * partenaire (ADR-0013), pour visualiser :
 *   - fiche partenaire  → section « Réseauteurs affiliés » (ses licenciés) ;
 *   - fiche réseauteur  → section « Partenaire » (lien retour) ;
 *   - carte des réseauteurs → 12 marqueurs répartis en France.
 *
 * Mécanique : un partenaire (CoWork Central, réutilisé ou créé) possède un grand
 * pack de licences ; chaque réseauteur active RÉELLEMENT une licence via le flux
 * `activerLicence` (transaction, décrément de quota, passage Plus source=licence).
 *
 * IDEMPOTENT + ADDITIF (clé : email des comptes). N'écrit qu'avec --confirm.
 *
 * Usage :  pnpm seed:reseauteurs-plus            (aperçu)
 *          pnpm seed:reseauteurs-plus --confirm  (exécution)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const DEMO_PASSWORD = 'Demo12345!'
const DEMO_TAG = '[démo]'
const PARTENAIRE_EMAIL = 'demo-partenaire@demo.reseauteurs.fr'
const PACK_QUOTA = 50

interface Personne {
  prenom: string
  nom: string
  fonction: string
  entreprise: string
  ville: string
  departement: string
  region: string
  lat: number
  lon: number
  evenementsParMois: number
}

const RESEAUTEURS: Personne[] = [
  { prenom: 'Julien', nom: 'Moreau', fonction: 'Expert-comptable', entreprise: 'Moreau & Associés', ville: 'Nantes', departement: 'Loire-Atlantique', region: 'Pays de la Loire', lat: 47.2184, lon: -1.5536, evenementsParMois: 3 },
  { prenom: 'Amélie', nom: 'Girard', fonction: "Avocate d'affaires", entreprise: 'Girard Legal', ville: 'Rennes', departement: 'Ille-et-Vilaine', region: 'Bretagne', lat: 48.1173, lon: -1.6778, evenementsParMois: 7 },
  { prenom: 'Thomas', nom: 'Lefebvre', fonction: 'Agent immobilier', entreprise: 'Lefebvre Immo', ville: 'Lille', departement: 'Nord', region: 'Hauts-de-France', lat: 50.6292, lon: 3.0573, evenementsParMois: 12 },
  { prenom: 'Nadia', nom: 'Cherif', fonction: "Architecte d'intérieur", entreprise: 'Studio Cherif', ville: 'Marseille', departement: 'Bouches-du-Rhône', region: "Provence-Alpes-Côte d'Azur", lat: 43.2965, lon: 5.3698, evenementsParMois: 2 },
  { prenom: 'Pierre', nom: 'Dubois', fonction: 'Consultant IT', entreprise: 'Dubois Digital', ville: 'Toulouse', departement: 'Haute-Garonne', region: 'Occitanie', lat: 43.6047, lon: 1.4442, evenementsParMois: 5 },
  { prenom: 'Camille', nom: 'Roux', fonction: 'Coach professionnelle', entreprise: 'Roux Coaching', ville: 'Nice', departement: 'Alpes-Maritimes', region: "Provence-Alpes-Côte d'Azur", lat: 43.7102, lon: 7.262, evenementsParMois: 9 },
  { prenom: 'Karim', nom: 'Benkacem', fonction: 'Restaurateur', entreprise: 'Le Comptoir', ville: 'Montpellier', departement: 'Hérault', region: 'Occitanie', lat: 43.6108, lon: 3.8767, evenementsParMois: 1 },
  { prenom: 'Élodie', nom: 'Faure', fonction: 'Graphiste freelance', entreprise: 'Faure Studio', ville: 'Strasbourg', departement: 'Bas-Rhin', region: 'Grand Est', lat: 48.5734, lon: 7.7521, evenementsParMois: 4 },
  { prenom: 'Antoine', nom: 'Mercier', fonction: 'Assureur', entreprise: 'Mercier Assurances', ville: 'Grenoble', departement: 'Isère', region: 'Auvergne-Rhône-Alpes', lat: 45.1885, lon: 5.7245, evenementsParMois: 6 },
  { prenom: 'Sarah', nom: 'Lemoine', fonction: 'Photographe', entreprise: 'Lemoine Photo', ville: 'Dijon', departement: "Côte-d'Or", region: 'Bourgogne-Franche-Comté', lat: 47.322, lon: 5.0415, evenementsParMois: 11 },
  { prenom: 'Hugo', nom: 'Petit', fonction: 'Développeur mobile', entreprise: 'Petit Apps', ville: 'Angers', departement: 'Maine-et-Loire', region: 'Pays de la Loire', lat: 47.4784, lon: -0.5632, evenementsParMois: 0 },
  { prenom: 'Léa', nom: 'Blanchard', fonction: 'Naturopathe', entreprise: 'Cabinet Blanchard', ville: 'Reims', departement: 'Marne', region: 'Grand Est', lat: 49.2583, lon: 4.0317, evenementsParMois: 8 },
]

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const slugEmail = (p: Personne) => `plus-${slugify(`${p.prenom}-${p.nom}`)}@demo.reseauteurs.fr`
/** Slug public visé : /reseauteur/<prenom-nom> (aligné au contrat SEO ADR-0005). */
const slugFiche = (p: Personne) => slugify(`${p.prenom}-${p.nom}`)

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
  console.log('=== SEED RÉSEAUTEURS PLUS (affiliés partenaire — ADR-0013) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log(`  Contenu    : 1 partenaire + 1 pack de ${PACK_QUOTA} licences · ${RESEAUTEURS.length} réseauteurs Plus (via licence) répartis en France`)
  console.log('')

  if (!confirm) {
    console.log("  Mode aperçu (dry-run) — rien n'a été écrit.")
    console.log('  Pour exécuter :  pnpm seed:reseauteurs-plus --confirm')
    console.log('')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const { activerLicence } = await import('../lib/licences')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config })
  const drizzle = payload.db.drizzle as unknown as {
    execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
  }
  const log = (m: string) => console.log(`-> ${m}`)

  const prevSeedDev = process.env.SEED_DEV
  const prevDryRun = process.env.EMAILS_DRY_RUN
  process.env.SEED_DEV = 'true'
  process.env.EMAILS_DRY_RUN = '1'

  try {
    const alignExpire = new Date(Date.now() + 365 * 86400e3).toISOString()

    // ── 1. Partenaire (réutilise CoWork Central via son compte, sinon le crée)
    let partenaireUserId: number
    const { docs: pUsers } = await payload.find({
      collection: 'users',
      where: { email: { equals: PARTENAIRE_EMAIL } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (pUsers[0]) {
      partenaireUserId = pUsers[0].id as number
      log(`compte partenaire existant : ${PARTENAIRE_EMAIL}`)
    } else {
      const nowIso = new Date().toISOString()
      const u = await payload.create({
        collection: 'users',
        data: {
          email: PARTENAIRE_EMAIL,
          password: DEMO_PASSWORD,
          nomSociete: 'CoWork Central',
          ville: 'Paris',
          role: 'partenaire',
          cguAcceptedAt: nowIso,
          confidentialiteAcceptedAt: nowIso,
        } as Record<string, unknown> as never,
        disableVerificationEmail: true,
        overrideAccess: true,
      })
      partenaireUserId = u.id as number
      log(`compte partenaire créé : ${PARTENAIRE_EMAIL}`)
    }
    await drizzle.execute(sql`UPDATE users SET _verified = true WHERE id = ${partenaireUserId}`.inlineParams())

    const { docs: fichesP } = await payload.find({
      collection: 'partenaires',
      where: { user: { equals: partenaireUserId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!fichesP[0]) throw new Error('Fiche partenaire absente (hook auto-création ?)')
    const partenaireId = fichesP[0].id as number
    await payload.update({
      collection: 'partenaires',
      id: partenaireId,
      data: {
        nom: 'CoWork Central',
        lien: 'https://example.com/cowork-central',
        description: `Espaces de coworking au cœur des villes — partenaire des réseauteurs. ${DEMO_TAG}`,
        statut: 'actif',
        abonnementExpireAt: alignExpire,
        offre: {
          titre: "1 journée d'essai offerte",
          description: "Présentez votre profil RÉSEAUTEURS à l'accueil et testez nos espaces gratuitement pendant une journée.",
          lien: 'https://example.com/cowork-central/essai',
        },
      } as never,
      overrideAccess: true,
    })
    const fresh = await payload.findByID({ collection: 'partenaires', id: partenaireId, depth: 0, overrideAccess: true })
    const partenaireSlug = (fresh as { slug?: string | null }).slug ?? '(slug en attente)'
    log(`partenaire actif : CoWork Central (/partenaire/${partenaireSlug})`)

    // ── 2. Grand pack de licences (réutilise un pack actif à quota suffisant, sinon crée)
    const { docs: packs } = await payload.find({
      collection: 'licences-packs',
      where: { and: [{ partenaire: { equals: partenaireId } }, { statut: { equals: 'actif' } }] },
      limit: 10,
      depth: 0,
      overrideAccess: true,
      sort: '-quota',
    })
    let pack = packs.find((p) => Number(p.quota) - Number(p.quotaUtilise ?? 0) >= RESEAUTEURS.length) as
      | { id: number; code?: string | null }
      | undefined
    if (!pack) {
      pack = (await payload.create({
        collection: 'licences-packs',
        data: { partenaire: partenaireId, quota: PACK_QUOTA, expireAt: alignExpire } as never,
        overrideAccess: true,
      })) as { id: number; code?: string | null }
      log(`pack de ${PACK_QUOTA} licences créé — code : ${pack.code}`)
    } else {
      log(`pack existant réutilisé — code : ${pack.code}`)
    }

    // ── 3. Secteurs (round-robin, optionnel) pour un maillage réaliste
    const { docs: secteurs } = await payload.find({
      collection: 'categories',
      limit: 20,
      depth: 0,
      overrideAccess: true,
      sort: 'label',
    })
    const secteurIds = secteurs.map((s) => s.id as number)

    // ── 4. Réseauteurs Plus (compte → profil publié → activation réelle de licence)
    let crees = 0
    let dejaPlus = 0
    for (let i = 0; i < RESEAUTEURS.length; i++) {
      const p = RESEAUTEURS[i]
      const email = slugEmail(p)

      let userId: number
      const { docs: existing } = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing[0]) {
        userId = existing[0].id as number
      } else {
        const nowIso = new Date().toISOString()
        const u = await payload.create({
          collection: 'users',
          data: {
            email,
            password: DEMO_PASSWORD,
            // nomSociete devient le nom du squelette → base du slug figé (cf. Users afterChange).
            // On y met « Prénom Nom » pour obtenir /reseauteur/<prenom-nom> (contrat SEO).
            nomSociete: `${p.prenom} ${p.nom}`,
            ville: p.ville,
            role: 'reseauteur',
            cguAcceptedAt: nowIso,
            confidentialiteAcceptedAt: nowIso,
            optInMarketing: false,
          } as Record<string, unknown> as never,
          disableVerificationEmail: true,
          overrideAccess: true,
        })
        userId = u.id as number
        crees++
      }
      await drizzle.execute(sql`UPDATE users SET _verified = true WHERE id = ${userId}`.inlineParams())

      // Profil (auto-créé par le hook Users) — complété + publié (prenom+nom)
      const { docs: profs } = await payload.find({
        collection: 'reseauteurs',
        where: { user: { equals: userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (!profs[0]) throw new Error(`Profil réseauteur absent pour ${email}`)

      // Slug visé /reseauteur/<prenom-nom> : posé UNIQUEMENT s'il est libre (le hook
      // ne régénère qu'à la création). En cas de collision (homonyme du seed de base),
      // on conserve le slug existant — pas de crash d'unicité.
      const targetSlug = slugFiche(p)
      const { totalDocs: slugPris } = await payload.count({
        collection: 'reseauteurs',
        where: { and: [{ slug: { equals: targetSlug } }, { id: { not_equals: profs[0].id } }] },
        overrideAccess: true,
      })
      const slugData = slugPris === 0 ? { slug: targetSlug } : {}

      await payload.update({
        collection: 'reseauteurs',
        id: profs[0].id,
        data: {
          ...slugData,
          prenom: p.prenom,
          nom: p.nom,
          fonction: p.fonction,
          entreprise: p.entreprise,
          ville: p.ville,
          departement: p.departement,
          region: p.region,
          latitude: p.lat,
          longitude: p.lon,
          evenementsParMois: p.evenementsParMois,
          description: `${p.fonction} à ${p.ville}. Réseauteur Plus affilié à CoWork Central. ${DEMO_TAG}`,
          ...(secteurIds.length ? { secteur: secteurIds[i % secteurIds.length] } : {}),
        } as never,
        overrideAccess: true,
      })

      // Activation RÉELLE de la licence (idempotent : refus propre si déjà Plus)
      const res = await activerLicence(payload, userId, pack.code ?? '')
      if (res.ok) log(`Plus activé : ${p.prenom} ${p.nom} (${p.ville})`)
      else {
        dejaPlus++
        log(`déjà Plus (ignoré) : ${p.prenom} ${p.nom} — ${res.raison}`)
      }
    }

    // ── Récapitulatif
    const packFinal = await payload.findByID({ collection: 'licences-packs', id: pack.id, depth: 0, overrideAccess: true })
    console.log('')
    console.log('OK — seed réseauteurs Plus terminé. À VISITER :')
    console.log('  ────────────────────────────────────────────────────────────')
    console.log(`  Comptes créés : ${crees} · déjà Plus (ignorés) : ${dejaPlus}`)
    console.log(`  Pack : ${(packFinal as { code?: string }).code} — quota ${(packFinal as { quotaUtilise?: number }).quotaUtilise}/${(packFinal as { quota?: number }).quota}`)
    console.log('  ────────────────────────────────────────────────────────────')
    console.log(`  Fiche partenaire  → /partenaire/${partenaireSlug}  (section « Réseauteurs affiliés »)`)
    console.log('  Fiche réseauteur  → /reseauteur/amelie-girard  (section « Partenaire » → lien retour)')
    console.log('                      (ou n\'importe quel affilié listé sur la fiche partenaire)')
    console.log('  Carte             → /carte/reseauteurs  (12 marqueurs : Nantes, Rennes, Lille, Marseille…)')
    console.log(`  Connexion         → n\'importe quel compte plus-<prenom>-<nom>@demo.reseauteurs.fr / ${DEMO_PASSWORD}`)
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
  console.error('[seed-reseauteurs-plus] fatal:', err)
  process.exit(1)
})
