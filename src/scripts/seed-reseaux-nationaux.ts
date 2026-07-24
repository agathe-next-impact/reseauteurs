/**
 * seed-reseaux-nationaux.ts — 50 réseaux professionnels NATIONAUX curés (2026-07-24).
 *
 * Remplace l'ancienne liste « 200 noms seuls » par une liste canonique de 50 réseaux
 * de référence, chacun avec son PUBLIC CIBLE (→ champ `publicConcerne`). Crée les fiches :
 *   { nom, publicConcerne, niveau: 'national', statut: 'publiee', source: 'importe' }
 *
 * Publiées et orphelines (user null) : elles apparaissent dans l'annuaire /reseaux,
 * sont revendicables par un organisateur (claim flow), et sont SÉLECTIONNABLES comme
 * réseau d'affiliation — par les réseauteurs (réseaux fréquentés), par les réseauteurs
 * Plus (rattachement d'un réseau local — « Mes réseaux ») et par les événements.
 *
 * IDEMPOTENT + ADDITIF (clé : nom exact + niveau non-local). Enrichit au passage une
 * fiche déjà présente qui n'aurait pas encore de public cible. Dry-run par défaut.
 *
 * Usage :  pnpm seed:reseaux-nationaux            (aperçu)
 *          pnpm seed:reseaux-nationaux --confirm  (exécution)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

type ReseauSeed = { nom: string; publicCible: string }

const RESEAUX: ReseauSeed[] = [
  { nom: 'BNI France', publicCible: 'Dirigeants, entrepreneurs' },
  { nom: 'DCF - Dirigeants Commerciaux de France', publicCible: 'Directeurs commerciaux' },
  { nom: 'CJD - Centre des Jeunes Dirigeants', publicCible: 'Jeunes dirigeants' },
  { nom: 'CPME', publicCible: 'PME' },
  { nom: 'MEDEF', publicCible: 'Entreprises' },
  { nom: 'U2P', publicCible: 'Artisans, professions libérales' },
  { nom: 'Réseau Entreprendre', publicCible: 'Créateurs et repreneurs' },
  { nom: 'Initiative France', publicCible: 'Entrepreneurs' },
  { nom: 'France Active', publicCible: 'Entrepreneurs' },
  { nom: 'Femmes Chefs d\'Entreprises (FCE France)', publicCible: 'Femmes dirigeantes' },
  { nom: 'Les Premières', publicCible: 'Entrepreneuriat féminin' },
  { nom: 'Bouge ta Boîte', publicCible: 'Femmes entrepreneures' },
  { nom: 'Action\'elles', publicCible: 'Entrepreneures' },
  { nom: 'Les Clubs d\'Affaires Protéine France', publicCible: 'Dirigeants' },
  { nom: 'Dynabuy', publicCible: 'PME' },
  { nom: 'Les Cafés Business', publicCible: 'Entrepreneurs' },
  { nom: 'CCI France', publicCible: 'Entreprises' },
  { nom: 'CMA France', publicCible: 'Artisans' },
  { nom: 'French Tech', publicCible: 'Start-up' },
  { nom: 'France Digitale', publicCible: 'Tech & investisseurs' },
  { nom: 'CroissancePlus', publicCible: 'Entrepreneurs de croissance' },
  { nom: 'ETHIC', publicCible: 'Dirigeants' },
  { nom: 'Croissance Premium', publicCible: 'Dirigeants' },
  { nom: 'APM - Association Progrès du Management', publicCible: 'Dirigeants' },
  { nom: 'GERME', publicCible: 'Managers' },
  { nom: 'ANDRH', publicCible: 'Ressources humaines' },
  { nom: 'DFCG', publicCible: 'Directeurs financiers' },
  { nom: 'CJD Entrepreneurs', publicCible: 'Jeunes dirigeants' },
  { nom: 'Lions Clubs France', publicCible: 'Service & réseau' },
  { nom: 'Rotary France', publicCible: 'Service & business' },
  { nom: 'Kiwanis France', publicCible: 'Service' },
  { nom: 'Table Ronde Française', publicCible: 'Jeunes dirigeants' },
  { nom: 'Centre Français des Lions Clubs', publicCible: 'Réseau' },
  { nom: 'Club 41 France', publicCible: 'Dirigeants' },
  { nom: 'Ladies Circle France', publicCible: 'Femmes actives' },
  { nom: 'JCE - Jeune Chambre Économique Française', publicCible: 'Jeunes actifs' },
  { nom: 'Dirigeants Responsables de l\'Ouest (DRO)', publicCible: 'Dirigeants' },
  { nom: 'CCRE France', publicCible: 'Entrepreneurs' },
  { nom: 'Réseau Mampreneures', publicCible: 'Entrepreneures' },
  { nom: 'Les Entreprises s\'Engagent', publicCible: 'Entreprises' },
  { nom: 'Réseau Alumni EM Lyon', publicCible: 'Alumni' },
  { nom: 'Réseau Alumni HEC', publicCible: 'Alumni' },
  { nom: 'Réseau Alumni ESSEC', publicCible: 'Alumni' },
  { nom: 'Réseau Alumni ESCP', publicCible: 'Alumni' },
  { nom: 'Réseau Alumni EDHEC', publicCible: 'Alumni' },
  { nom: 'Club E6', publicCible: 'Dirigeants' },
  { nom: 'Open Networking France', publicCible: 'Entrepreneurs' },
  { nom: 'Fédération Française des Clubs d\'Entreprises', publicCible: 'Clubs d\'entreprises' },
  { nom: 'France Invest', publicCible: 'Finance & investisseurs' },
  { nom: 'Mouvement Impact France', publicCible: 'Entrepreneurs engagés' },
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

  // Déduplication de la liste par nom exact (garde la première occurrence).
  const seen = new Set<string>()
  const reseaux = RESEAUX.map((r) => ({ nom: r.nom.trim(), publicCible: r.publicCible.trim() }))
    .filter((r) => r.nom)
    .filter((r) => {
      if (seen.has(r.nom)) return false
      seen.add(r.nom)
      return true
    })

  console.log('')
  console.log('=== SEED RÉSEAUX NATIONAUX (annuaire curé — nom + public cible) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log(`  Contenu    : ${reseaux.length} réseaux nationaux (statut publié, source importé)`)
  if (reseaux.length !== RESEAUX.length) {
    console.log(`  ⚠️ ${RESEAUX.length - reseaux.length} doublon(s) dans la liste — dédupliqués.`)
  }
  console.log('')

  if (!confirm) {
    console.log("  Mode aperçu (dry-run) — rien n'a été écrit.")
    console.log('  Pour exécuter :  pnpm seed:reseaux-nationaux --confirm')
    console.log('')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  // Hooks lourds neutralisés le temps du seed (aucune géo/compteur à calculer : nom seul).
  const prevSeedDev = process.env.SEED_DEV
  process.env.SEED_DEV = 'true'

  let crees = 0
  let enrichis = 0
  let existants = 0
  const erreurs: string[] = []

  try {
    for (const { nom, publicCible } of reseaux) {
      try {
        // Clé d'idempotence : nom exact + niveau non-local (tête de réseau).
        const { docs } = await payload.find({
          collection: 'reseaux',
          where: {
            and: [{ nom: { equals: nom } }, { niveau: { not_equals: 'local' } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          select: { publicConcerne: true } as Record<string, boolean>,
        })

        if (docs.length > 0) {
          const existing = docs[0]
          // Enrichissement sûr : ne remplit le public cible que s'il est absent.
          if (publicCible && !existing.publicConcerne) {
            await payload.update({
              collection: 'reseaux',
              id: existing.id,
              data: { publicConcerne: publicCible } as never,
              overrideAccess: true,
            })
            enrichis++
          } else {
            existants++
          }
          continue
        }

        await payload.create({
          collection: 'reseaux',
          data: {
            nom,
            publicConcerne: publicCible || undefined,
            niveau: 'national',
            statut: 'publiee',
            source: 'importe',
          } as never,
          overrideAccess: true,
        })
        crees++
      } catch (err) {
        erreurs.push(`${nom} : ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`)
      }
    }
  } finally {
    if (prevSeedDev === undefined) delete process.env.SEED_DEV
    else process.env.SEED_DEV = prevSeedDev
  }

  console.log('OK — seed réseaux nationaux terminé.')
  console.log(`  créés                : ${crees}`)
  console.log(`  enrichis (public cible) : ${enrichis}`)
  console.log(`  existants (ignorés)  : ${existants}`)
  if (erreurs.length > 0) {
    console.log(`  erreurs              : ${erreurs.length}`)
    for (const e of erreurs.slice(0, 10)) console.log(`    - ${e}`)
  }
  console.log('')
  process.exit(erreurs.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[seed-reseaux-nationaux] fatal:', err)
  process.exit(1)
})
