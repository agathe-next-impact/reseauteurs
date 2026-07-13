/**
 * seed-types-evenement.ts — Référentiel des 10 types d'événement (spec 2026-07-13).
 * Idempotent (clé : `value`). Met à jour label/couleur/ordre si le type existe déjà.
 *
 * Usage :  pnpm seed:types-evenement --confirm
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const TYPES = [
  { label: 'Petit-déjeuner', value: 'petit-dejeuner', couleur: '#f5851f', ordre: 1 },
  { label: 'Déjeuner', value: 'dejeuner', couleur: '#f59e0b', ordre: 2 },
  { label: 'Afterwork', value: 'afterwork', couleur: '#2563EB', ordre: 3 },
  { label: 'Conférence', value: 'conference', couleur: '#7c3aed', ordre: 4 },
  { label: 'Atelier', value: 'atelier', couleur: '#0ea5e9', ordre: 5 },
  { label: 'Formation', value: 'formation', couleur: '#059669', ordre: 6 },
  { label: "Visite d'entreprise", value: 'visite-entreprise', couleur: '#0d9488', ordre: 7 },
  { label: 'Speed Business', value: 'speed-business', couleur: '#e11d48', ordre: 8 },
  { label: 'Salon', value: 'salon', couleur: '#a855f7', ordre: 9 },
  { label: 'Autre', value: 'autre', couleur: '#71717a', ordre: 10 },
]

async function main() {
  const confirm = process.argv.includes('--confirm') || process.env.SEED_DEMO === '1'
  console.log('\n=== SEED TYPES D\'ÉVÉNEMENT (10 valeurs) ===')
  if (!confirm) {
    console.log(`  ${TYPES.length} types : ${TYPES.map((t) => t.label).join(', ')}`)
    console.log('  Aperçu — exécuter : pnpm seed:types-evenement --confirm\n')
    process.exit(0)
  }
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })
  process.env.SEED_DEV = 'true'

  let crees = 0
  let maj = 0
  for (const t of TYPES) {
    const { docs } = await payload.find({
      collection: 'types-evenement',
      where: { value: { equals: t.value } },
      limit: 1,
      overrideAccess: true,
    })
    if (docs[0]) {
      await payload.update({ collection: 'types-evenement', id: docs[0].id, data: t as never, overrideAccess: true })
      maj++
      console.log(`-> mis à jour : ${t.label}`)
    } else {
      await payload.create({ collection: 'types-evenement', data: t as never, overrideAccess: true })
      crees++
      console.log(`-> créé : ${t.label}`)
    }
  }
  console.log(`\nOK — ${crees} créés · ${maj} mis à jour.\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-types-evenement] fatal:', err)
  process.exit(1)
})
