import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

async function run() {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const { totalDocs: total } = await payload.count({
    collection: 'fournisseurs',
    overrideAccess: true,
  })
  const { totalDocs: publiee } = await payload.count({
    collection: 'fournisseurs',
    where: { statut: { equals: 'publiee' } },
    overrideAccess: true,
  })
  const { totalDocs: withGeo } = await payload.count({
    collection: 'fournisseurs',
    where: {
      and: [
        { statut: { equals: 'publiee' } },
        { latitude: { exists: true } },
        { longitude: { exists: true } },
      ],
    },
    overrideAccess: true,
  })
  const { totalDocs: orphelines } = await payload.count({
    collection: 'fournisseurs',
    where: { user: { exists: false } },
    overrideAccess: true,
  })
  const { totalDocs: sansGeo } = await payload.count({
    collection: 'fournisseurs',
    where: {
      and: [
        { statut: { equals: 'publiee' } },
        { or: [{ latitude: { exists: false } }, { longitude: { exists: false } }] },
      ],
    },
    overrideAccess: true,
  })

  console.log('--- Diag fournisseurs ---')
  console.log(`  total            : ${total}`)
  console.log(`  statut=publiee   : ${publiee}`)
  console.log(`  avec lat/lng     : ${withGeo}`)
  console.log(`  sans lat/lng     : ${sansGeo} (publiee mais non geocodees)`)
  console.log(`  orphelines       : ${orphelines}`)

  // Top 10 coords dupliquees
  const { docs: all } = await payload.find({
    collection: 'fournisseurs',
    where: {
      and: [
        { statut: { equals: 'publiee' } },
        { latitude: { exists: true } },
      ],
    },
    select: { raisonSociale: true, ville: true, latitude: true, longitude: true, user: true, slug: true },
    limit: 0,
    overrideAccess: true,
  })
  const byCoords = new Map<string, { noms: string[]; count: number }>()
  for (const d of all) {
    if (d.latitude == null || d.longitude == null) continue
    const key = `${d.latitude.toFixed(5)},${d.longitude.toFixed(5)}`
    const entry = byCoords.get(key) ?? { noms: [], count: 0 }
    entry.count += 1
    const userId = typeof d.user === 'object' && d.user ? (d.user as { id: number }).id : d.user
    entry.noms.push(`#${d.id} "${d.raisonSociale}" (${d.ville}) slug=${d.slug} user=${userId ?? 'null'}`)
    byCoords.set(key, entry)
  }
  const dups = [...byCoords.entries()]
    .filter(([, v]) => v.count > 1)
    .sort((a, b) => b[1].count - a[1].count)

  console.log('\n--- Coords partagees (avec user_id) ---')
  for (const [coord, { count, noms }] of dups) {
    console.log(`  [${coord}] x${count}`)
    for (const n of noms) console.log(`      ${n}`)
  }

  // Echantillon de fiches sans geo
  const { docs: noGeo } = await payload.find({
    collection: 'fournisseurs',
    where: {
      and: [
        { statut: { equals: 'publiee' } },
        { or: [{ latitude: { exists: false } }, { longitude: { exists: false } }] },
      ],
    },
    select: { raisonSociale: true, ville: true, codePostal: true },
    limit: 10,
    overrideAccess: true,
  })
  if (noGeo.length > 0) {
    console.log('\n--- Echantillon sans geocodage (10 premieres) ---')
    for (const d of noGeo) {
      console.log(`  ${d.raisonSociale} — ${d.codePostal ?? '?'} ${d.ville}`)
    }
  }

  process.exit(0)
}

run().catch((err) => {
  console.error('[diag] fatal:', err)
  process.exit(1)
})
