/**
 * seed-reseaux-nationaux.ts — Annuaire de 200 réseaux d'affaires NATIONAUX (2026-07-17).
 *
 * Crée les fiches avec UNIQUEMENT leur nom (aucune ville, description, contact…) :
 *   { nom, niveau: 'national', statut: 'publiee', source: 'importe' }
 *
 * Publiées et orphelines (user null) : elles apparaissent dans l'annuaire /reseaux,
 * sont revendicables par un organisateur (claim flow), et sont SÉLECTIONNABLES comme
 * réseau d'affiliation — par les réseauteurs (réseaux fréquentés), par les réseauteurs
 * Plus (rattachement d'un réseau local — « Mes réseaux ») et par les événements.
 *
 * IDEMPOTENT + ADDITIF (clé : nom exact + niveau non-local). Dry-run par défaut.
 *
 * Usage :  pnpm seed:reseaux-nationaux            (aperçu)
 *          pnpm seed:reseaux-nationaux --confirm  (exécution)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const NOMS: string[] = [
  'BNI France',
  'Dynabuy',
  'Les Cafés Business',
  'Club ACE',
  'WinOrWin',
  'Protéine France',
  'Réso',
  'Club Business France',
  'Business Time Club',
  'Open Business Club',
  'CJD',
  'APM',
  'DCF',
  'GERME',
  'CRA',
  'Réseau Entreprendre',
  'Initiative France',
  'France Active',
  'BGE',
  'France Angels',
  'ADIE',
  'France Digitale',
  'French Tech',
  'Village by CA',
  'Réseau Mentorat France',
  'EGEE',
  'ECTI',
  'Les Premières',
  'Moovjee',
  '60 000 Rebonds',
  'CPME',
  'MEDEF',
  'U2P',
  'CCI France',
  'CMA France',
  'Chambres d\'Agriculture France',
  'CNCC',
  'ANDRH',
  'DFCG',
  'CERCLECIUM',
  'Bouge ta Boîte',
  'FCE France',
  'Force Femmes',
  'Femmes des Territoires',
  'Action\'elles',
  'Mampreneures',
  'Les Pionnières',
  'Women in Tech France',
  'Financi\'Elles',
  'Elles bougent',
  'Rotary France',
  'Lions Clubs France',
  'Kiwanis France',
  'Table Ronde Française',
  'Ladies Circle France',
  'Agora Club France',
  'Round Table International France',
  'Old Tablers France',
  'Tangent Club France',
  'Rotaract France',
  'Interact France',
  'Digital League',
  'Cap Digital',
  'Systematic Paris-Région',
  'Aerospace Valley',
  'Cosmetic Valley',
  'Minalogic',
  'Images & Réseaux',
  'Finance Innovation',
  'NextMove',
  'Polymeris',
  'BioValley France',
  'Axelera',
  'SCS',
  'Eurobiomed',
  'Aquiti',
  'Atlanpole',
  'Paris&Co',
  'Euratechnologies',
  'Normandy French Tech',
  'French Tech Bordeaux',
  'French Tech Lille',
  'French Tech Méditerranée',
  'French Tech Est',
  'French Tech Rennes Saint-Malo',
  'French Tech Toulouse',
  'French Tech Côte d\'Azur',
  'French Tech Alpes',
  'French Tech Brest Bretagne Ouest',
  'French Tech One Lyon Saint-Étienne',
  'Réseau Com\'Expert',
  'Club des Entrepreneurs',
  'Club E6',
  'CroissancePlus',
  'Ethic',
  'Centre des Jeunes Patrons',
  'Cercle des Dirigeants',
  'Cercle du Leadership',
  'Club ETI France',
  'Pacte PME',
  'CIGALES',
  'Réseau Plato',
  'Entreprendre pour Apprendre',
  'Fondation Entreprendre',
  'Réseau Alliances',
  'Produit en Bretagne',
  'Dirigeants Responsables',
  'Entreprises & Progrès',
  'Réseau Gesat',
  'Réseau Vrac',
  'Réseau APIA',
  'Réseau Commande Publique',
  'Club Export',
  'OSCI',
  'CCEF',
  'Conseillers du Commerce Extérieur',
  'Club Décision DSI',
  'DCF Jeunes',
  'Réseau RH',
  'Réseau QVT',
  'Réseau Entreprendre au Féminin',
  'Club Innovation',
  'Club RSE France',
  'Club Green Business',
  'Réseau ESS France',
  'Mouves',
  'Le Coq Vert',
  'France Invest',
  'France Biotech',
  'Numeum',
  'Syntec Numérique',
  'Syntec Conseil',
  'Syntec Ingénierie',
  'CINOV',
  'Fédération Cinov',
  'France Industrie',
  'Club Medef International',
  'Club Export BPI',
  'Business France',
  'Team France Export',
  'Club VIE',
  'Club Achats',
  'CNA',
  'CNAFAL Entreprises',
  'Réseau HEC',
  'Réseau ESSEC Alumni',
  'EM Lyon Forever',
  'EDHEC Alumni',
  'Audencia Alumni',
  'NEOMA Alumni',
  'SKEMA Alumni',
  'KEDGE Alumni',
  'TBS Alumni',
  'Grenoble EM Alumni',
  'ESSCA Alumni',
  'ICN Alumni',
  'INSEAD Alumni France',
  'Arts et Métiers Alumni',
  'CentraleSupélec Alumni',
  'Mines Alumni',
  'Polytechnique Alumni',
  'Club Business Angels',
  'Femmes Business Angels',
  'Investessor',
  'Arts & Métiers Business Angels',
  'BADGE',
  'Femmes Business Club',
  'Réseau Initiative Outre-Mer',
  'Club PME International',
  'Réseau Commerce France',
  'Club Entrepreneurs France',
  'Club Performance',
  'Club des Décideurs',
  'Club Excellence',
  'Club Horizon',
  'Club Affaires France',
  'Cercle Business',
  'Cercle des Entrepreneurs',
  'Club Premium',
  'Club Entreprendre',
  'Club Réussir',
  'Club Performance PME',
  'Club Croissance',
  'Club Business Network',
  'Business Network International France',
  'Business Club Entreprises',
  'Entrepreneurs & Dirigeants',
  'Club Pro France',
  'Club des Indépendants',
  'Club des Managers',
  'Club des Créateurs',
  'Club des Repreneurs',
  'Club des Startups',
  'Club Innovation France',
  'Club des PME',
  'Club des TPE',
  'Club des Professionnels',
  'Club Entreprises France',
  'Club des Affaires',
  'Club Réseau France',
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
  const noms = [...new Set(NOMS.map((n) => n.trim()).filter(Boolean))]

  console.log('')
  console.log('=== SEED RÉSEAUX NATIONAUX (annuaire — nom seul) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log(`  Contenu    : ${noms.length} réseaux nationaux (statut publié, source importé)`)
  if (noms.length !== NOMS.length) {
    console.log(`  ⚠️ ${NOMS.length - noms.length} doublon(s) dans la liste — dédupliqués.`)
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
  let existants = 0
  const erreurs: string[] = []

  try {
    for (const nom of noms) {
      try {
        const { totalDocs } = await payload.count({
          collection: 'reseaux',
          where: {
            and: [{ nom: { equals: nom } }, { niveau: { not_equals: 'local' } }],
          },
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          existants++
          continue
        }
        await payload.create({
          collection: 'reseaux',
          data: {
            nom,
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
  console.log(`  créés               : ${crees}`)
  console.log(`  existants (ignorés) : ${existants}`)
  if (erreurs.length > 0) {
    console.log(`  erreurs             : ${erreurs.length}`)
    for (const e of erreurs.slice(0, 10)) console.log(`    - ${e}`)
  }
  console.log('')
  process.exit(erreurs.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[seed-reseaux-nationaux] fatal:', err)
  process.exit(1)
})
