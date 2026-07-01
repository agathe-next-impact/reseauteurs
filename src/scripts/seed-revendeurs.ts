/**
 * Seed des 213 revendeurs (fiches orphelines sans compte utilisateur).
 *
 * Les fiches servent de "teaser" pour inciter les revendeurs a s'inscrire
 * et revendiquer leur fiche (plans gratuit / premium / infinite).
 *
 * - Aucun user associe (`user: null`) : la fiche est orpheline
 * - Aucune categorie d'activite : masquee sur le front pour ces fiches
 * - Geocodage automatique via le hook beforeChange de Fournisseurs
 *   (API Adresse gouv.fr, base codePostal + ville)
 * - Idempotent : skip si le slug existe deja
 *
 * Usage : pnpm seed:revendeurs
 */

import dotenv from 'dotenv'
import path from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

interface RawRevendeur {
  id: number
  slug: string
  nom: string
  code_postal: string
  ville: string
  departement: string
}

function canonicalSlug(raisonSociale: string): string {
  return raisonSociale
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const jsonPath = path.join(process.cwd(), 'src/data/revendeurs-seed.json')
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8')) as RawRevendeur[]

  // Dedup par slug canonique calcule depuis le nom (le hook beforeValidate
  // utilise la meme logique — garantit l'unicite cote DB).
  const seen = new Set<string>()
  const entries = raw.filter((r) => {
    const slug = canonicalSlug(r.nom)
    if (seen.has(slug)) {
      console.log(`  [dedup] doublon ignore : ${r.nom}`)
      return false
    }
    seen.add(slug)
    return true
  })

  console.log(`--- Seed revendeurs : ${entries.length} fiches (sur ${raw.length} dans le JSON) ---`)

  let created = 0
  let skipped = 0
  let geocodeFailed = 0

  for (const r of entries) {
    const slug = canonicalSlug(r.nom)

    const existing = await payload.find({
      collection: 'fournisseurs',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      skipped++
      continue
    }

    try {
      const doc = await payload.create({
        collection: 'fournisseurs',
        data: {
          raisonSociale: r.nom,
          ville: r.ville,
          codePostal: r.code_postal,
          statut: 'publiee',
        },
        overrideAccess: true,
      })
      created++
      if (doc.latitude == null || doc.longitude == null) {
        geocodeFailed++
        console.log(`  [geocode KO] ${r.nom} (${r.code_postal} ${r.ville})`)
      } else if (created % 20 === 0) {
        console.log(`  [progress] ${created} fiches creees`)
      }
    } catch (err) {
      console.error(`  [error] ${r.nom} : ${(err as Error).message}`)
    }

    // Respecter l'API Adresse gouv.fr (50 req/s officielles ; on reste large)
    await sleep(120)
  }

  console.log('--- Seed revendeurs : termine ---')
  console.log(`  crees        : ${created}`)
  console.log(`  skipped      : ${skipped}`)
  console.log(`  geocode KO   : ${geocodeFailed}`)

  process.exit(0)
}

run().catch((err) => {
  console.error('[seed-revendeurs] fatal:', err)
  process.exit(1)
})
