/**
 * Re-essaie de geocoder les fiches fournisseur sans lat/lng.
 *
 * Strategie de fallback :
 *   1) adresse + codePostal + ville (essai standard)
 *   2) ville seule (cas CEDEX, codePostal invalide)
 *
 * Usage : pnpm exec cross-env NODE_OPTIONS="--no-deprecation" \
 *         node --import=tsx/esm src/scripts/geocode-retry.ts
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

async function geocode(query: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = new URL('https://api-adresse.data.gouv.fr/search')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '1')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature?.geometry?.coordinates) return null
    const [longitude, latitude] = feature.geometry.coordinates
    return { latitude, longitude }
  } catch {
    return null
  }
}

async function run() {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'fournisseurs',
    where: {
      or: [{ latitude: { exists: false } }, { longitude: { exists: false } }],
    },
    select: { raisonSociale: true, ville: true, codePostal: true, adresse: true },
    limit: 0,
    overrideAccess: true,
  })

  console.log(`--- ${docs.length} fiche(s) sans geocodage ---`)

  let ok = 0
  let ko = 0
  for (const d of docs) {
    // Nettoie "CEDEX"/"Cedex" en fin de ville (commun en France)
    const cleanVille = (d.ville ?? '').replace(/\s+CEDEX(?:\s+\d+)?$/i, '').trim()

    const attempts = [
      [d.adresse, d.codePostal, cleanVille].filter(Boolean).join(' '),
      [d.codePostal, cleanVille].filter(Boolean).join(' '),
      cleanVille,
    ].filter(Boolean)

    let result: { latitude: number; longitude: number } | null = null
    for (const q of attempts) {
      result = await geocode(q)
      if (result) break
    }

    if (result) {
      await payload.update({
        collection: 'fournisseurs',
        id: d.id,
        data: { latitude: result.latitude, longitude: result.longitude },
        overrideAccess: true,
      })
      ok++
      console.log(`  [OK] ${d.raisonSociale} (${d.ville}) -> ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`)
    } else {
      ko++
      console.log(`  [KO] ${d.raisonSociale} (${d.codePostal ?? '?'} ${d.ville}) — aucun resultat`)
    }
    await new Promise((r) => setTimeout(r, 120))
  }

  console.log(`\n--- Termine : ${ok} OK, ${ko} KO ---`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[geocode-retry] fatal:', err)
  process.exit(1)
})
