/**
 * seed-demo.ts — CLI du seed de démonstration RÉSEAUTEURS (local / staging).
 *
 * La logique et les données vivent dans src/lib/demo-seed.ts (partagées avec
 * la route HTTP src/app/api/dev/seed-demo/route.ts pour la prod sans shell).
 *
 * IDEMPOTENT + ADDITIF. N'écrit qu'avec --confirm (ou SEED_DEMO=1) ; sinon
 * affiche le plan + la base cible et sort (dry-run).
 *
 * Usage :
 *   1) Renseigner DATABASE_URL (Neon prod/staging) dans .env / .env.local
 *      (DATABASE_URI est aussi accepté — même fallback que payload.config)
 *   2) Aperçu :   node --import=tsx/esm src/scripts/seed-demo.ts
 *   3) Exécuter : node --import=tsx/esm src/scripts/seed-demo.ts --confirm
 *      (ou : pnpm seed:demo --confirm)
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

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
  const { DEMO_COUNTS, DEMO_TAG } = await import('../lib/demo-seed')
  const confirm = process.argv.includes('--confirm') || process.env.SEED_DEMO === '1'

  console.log('')
  console.log('=== SEED DÉMO RÉSEAUTEURS (modèle 3 entités) ===')
  console.log(`  Base cible : ${dbHost()}`)
  console.log(
    `  Contenu    : ${DEMO_COUNTS.secteurs} secteurs · ${DEMO_COUNTS.types} types · ` +
      `${DEMO_COUNTS.nationaux} réseaux nationaux · ${DEMO_COUNTS.locaux} locaux · ` +
      `${DEMO_COUNTS.reseauteurs} réseauteurs · ${DEMO_COUNTS.evenements} événements · ` +
      `${DEMO_COUNTS.partenaires} partenaires`,
  )
  console.log('')

  if (!confirm) {
    console.log("  Mode aperçu (dry-run) — rien n'a été écrit.")
    console.log('  Pour exécuter réellement sur la base ci-dessus :')
    console.log('    node --import=tsx/esm src/scripts/seed-demo.ts --confirm')
    console.log('    (ou : pnpm seed:demo --confirm)')
    console.log('')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const { runDemoSeed } = await import('../lib/demo-seed')
  const payload = await getPayload({ config })

  const result = await runDemoSeed(payload, (m) => console.log(`-> ${m}…`))

  console.log('')
  console.log('OK — seed démo terminé.')
  console.log(`  créés               : ${result.created}`)
  console.log(`  existants (ignorés) : ${result.skipped}`)
  console.log(`  partenaires         : ${result.partenaires === 'seeded' ? 'créés' : 'ignorés (BLOB_READ_WRITE_TOKEN absent)'}`)
  console.log(`  Nettoyage : entités marquées "${DEMO_TAG}" dans leurs descriptions.`)
  console.log('')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-demo] fatal:', err)
  process.exit(1)
})
