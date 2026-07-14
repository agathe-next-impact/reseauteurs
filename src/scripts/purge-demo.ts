/**
 * purge-demo.ts — Supprime les données de DÉMONSTRATION de la base.
 *
 * Cible (toutes marquées `[démo]` ou rattachées à un compte `*@demo.reseauteurs.fr`) :
 *   inscriptions · licences-activations · licences-packs · événements `[démo]` ·
 *   réseauteurs `[démo]` · partenaires de démo · comptes `*@demo.reseauteurs.fr`.
 *
 * NE TOUCHE PAS aux réseaux (contenu potentiellement réel) ni aux référentiels
 * (types d'événement, catégories). Les réseaux possédés par un compte de démo
 * deviennent simplement orphelins (user = null), pas supprimés.
 *
 * DRY-RUN PAR DÉFAUT (affiche ce qui serait supprimé). Suppression RÉELLE avec --confirm.
 *
 * Usage :  pnpm tsx src/scripts/purge-demo.ts            (aperçu)
 *          pnpm tsx src/scripts/purge-demo.ts --confirm  (suppression)
 *   (ou : node --import=tsx/esm src/scripts/purge-demo.ts [--confirm])
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const DEMO_EMAIL = '@demo.reseauteurs.fr'
const DEMO_TAG = '[démo]'

function dbHost(): string {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URI || ''
  try {
    return url ? new URL(url).host : '(non défini)'
  } catch {
    return '(URL illisible)'
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm')
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })
  process.env.SEED_DEV = 'true' // évite le géocodage / hooks lourds pendant les updates de compteurs
  process.env.EMAILS_DRY_RUN = '1'

  const ids = async (collection: string, where: Record<string, unknown>): Promise<Array<number | string>> => {
    const { docs } = await payload.find({
      collection: collection as never,
      where: where as never,
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      select: {} as Record<string, boolean>,
    })
    return docs.map((d) => d.id)
  }

  // ── Collecte des entités de démo
  const demoUserIds = await ids('users', { email: { contains: DEMO_EMAIL } })
  const demoReseauteurIds = [
    ...new Set([
      ...(await ids('reseauteurs', { description: { contains: DEMO_TAG } })),
      ...(demoUserIds.length ? await ids('reseauteurs', { user: { in: demoUserIds } }) : []),
    ]),
  ]
  const demoPartenaireIds = [
    ...new Set([
      ...(await ids('partenaires', { description: { contains: DEMO_TAG } })),
      ...(demoUserIds.length ? await ids('partenaires', { user: { in: demoUserIds } }) : []),
    ]),
  ]
  const demoEventIds = [
    ...new Set([
      ...(await ids('evenements', { description: { contains: DEMO_TAG } })),
      ...(demoReseauteurIds.length ? await ids('evenements', { organisateurReseauteur: { in: demoReseauteurIds } }) : []),
    ]),
  ]
  const demoPackIds = demoPartenaireIds.length ? await ids('licences-packs', { partenaire: { in: demoPartenaireIds } }) : []
  const demoActivationIds = [
    ...new Set([
      ...(demoUserIds.length ? await ids('licences-activations', { user: { in: demoUserIds } }) : []),
      ...(demoPackIds.length ? await ids('licences-activations', { pack: { in: demoPackIds } }) : []),
    ]),
  ]
  const demoInscriptionIds = [
    ...new Set([
      ...(demoEventIds.length ? await ids('inscriptions', { evenement: { in: demoEventIds } }) : []),
      ...(demoReseauteurIds.length ? await ids('inscriptions', { reseauteur: { in: demoReseauteurIds } }) : []),
    ]),
  ]

  // Ordre de suppression (dépendances → cibles)
  const plan: Array<{ collection: string; list: Array<number | string> }> = [
    { collection: 'inscriptions', list: demoInscriptionIds },
    { collection: 'licences-activations', list: demoActivationIds },
    { collection: 'licences-packs', list: demoPackIds },
    { collection: 'evenements', list: demoEventIds },
    { collection: 'reseauteurs', list: demoReseauteurIds },
    { collection: 'partenaires', list: demoPartenaireIds },
    { collection: 'users', list: demoUserIds },
  ]

  console.log('')
  console.log('=== PURGE DES DONNÉES DE DÉMO ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log('')
  for (const step of plan) console.log(`  ${step.collection.padEnd(22)} : ${step.list.length}`)
  const total = plan.reduce((n, s) => n + s.list.length, 0)
  console.log(`  ${'TOTAL'.padEnd(22)} : ${total}`)
  console.log('')

  if (!confirm) {
    console.log('  Mode aperçu (dry-run) — RIEN supprimé.')
    console.log('  Pour supprimer réellement : pnpm tsx src/scripts/purge-demo.ts --confirm')
    console.log('')
    process.exit(0)
  }

  for (const step of plan) {
    let ok = 0
    for (const id of step.list) {
      try {
        await payload.delete({ collection: step.collection as never, id, overrideAccess: true })
        ok++
      } catch (err) {
        console.error(`  ! échec ${step.collection}#${id}:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`-> ${step.collection} : ${ok}/${step.list.length} supprimé(s)`)
  }
  console.log('\nPurge terminée.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[purge-demo] fatal:', err)
  process.exit(1)
})
