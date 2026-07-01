import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

async function run() {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'fournisseurs',
    where: {
      and: [
        { statut: { equals: 'publiee' } },
        { user: { exists: true } },
      ],
    },
    select: { raisonSociale: true, ville: true, user: true, slug: true, createdAt: true },
    limit: 0,
    depth: 1,
    overrideAccess: true,
  })

  const byKey = new Map<string, typeof docs>()
  for (const d of docs) {
    const key = `${d.raisonSociale.toLowerCase().trim()}|${d.ville.toLowerCase().trim()}`
    const arr = byKey.get(key) ?? []
    arr.push(d)
    byKey.set(key, arr)
  }

  const dups = [...byKey.entries()].filter(([, v]) => v.length > 1)
  console.log(`--- ${dups.length} doublons (raisonSociale + ville) ---\n`)
  for (const [key, fiches] of dups) {
    console.log(`[${key}]`)
    for (const f of fiches) {
      const user = f.user as { id: number; email: string } | null
      console.log(`  #${f.id} slug=${f.slug} user=${user?.email ?? user?.id ?? 'null'} cree=${f.createdAt}`)
    }
    console.log()
  }

  process.exit(0)
}

run().catch((err) => {
  console.error('[diag-duplicates] fatal:', err)
  process.exit(1)
})
