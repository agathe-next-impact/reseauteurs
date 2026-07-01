/**
 * Supprime les anciens utilisateurs demo sur le domaine legacy
 * @fournisseurpub.fr (avant renommage). Les nouveaux comptes
 * @panorama-pub.com sont conserves.
 *
 * Supprime en cascade : evenements -> fournisseur -> user.
 *
 * Usage : pnpm exec cross-env NODE_OPTIONS="--no-deprecation" \
 *         node --import=tsx/esm src/scripts/cleanup-legacy-demo.ts
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const LEGACY_DOMAIN = '@fournisseurpub.fr'

async function run() {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const { docs: legacyUsers } = await payload.find({
    collection: 'users',
    where: { email: { like: `%${LEGACY_DOMAIN}` } },
    limit: 0,
    overrideAccess: true,
  })

  console.log(`--- Cleanup : ${legacyUsers.length} utilisateur(s) legacy trouve(s) ---\n`)
  if (legacyUsers.length === 0) {
    console.log('Rien a faire.')
    process.exit(0)
  }

  for (const u of legacyUsers) {
    console.log(`${u.email} (#${u.id}, role=${u.role}, plan=${u.plan})`)

    // 1) Delete fournisseur fiche(s) + their evenements
    const { docs: fiches } = await payload.find({
      collection: 'fournisseurs',
      where: { user: { equals: u.id } },
      limit: 10,
      overrideAccess: true,
    })
    for (const f of fiches) {
      const { totalDocs: evCount } = await payload.count({
        collection: 'evenements',
        where: {
          or: [
            { fournisseur: { equals: f.id } },
            { fournisseursAssocies: { contains: f.id } },
          ],
        },
        overrideAccess: true,
      })
      if (evCount > 0) {
        await payload.delete({
          collection: 'evenements',
          where: {
            or: [
              { fournisseur: { equals: f.id } },
              { fournisseursAssocies: { contains: f.id } },
            ],
          },
          overrideAccess: true,
        })
        console.log(`  - ${evCount} evenement(s) supprime(s)`)
      }
      await payload.delete({ collection: 'fournisseurs', id: f.id, overrideAccess: true })
      console.log(`  - fiche fournisseur #${f.id} "${f.raisonSociale}" supprimee`)
    }

    // 2) Delete organisateur fiche (if any)
    const { docs: orgFiches } = await payload.find({
      collection: 'organisateurs-evenements',
      where: { user: { equals: u.id } },
      limit: 10,
      overrideAccess: true,
    })
    for (const o of orgFiches) {
      await payload.delete({
        collection: 'evenements',
        where: { organisateurExterne: { equals: o.id } },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'organisateurs-evenements', id: o.id, overrideAccess: true })
      console.log(`  - fiche organisateur #${o.id} supprimee`)
    }

    // 3) Unlink from groupe (in case owner)
    const { docs: ownedGroupes } = await payload.find({
      collection: 'groupes',
      where: { owner: { equals: u.id } },
      limit: 10,
      overrideAccess: true,
    })
    for (const g of ownedGroupes) {
      const { docs: members } = await payload.find({
        collection: 'users',
        where: { groupe: { equals: g.id } },
        limit: 100,
        overrideAccess: true,
      })
      for (const m of members) {
        await payload.update({
          collection: 'users',
          id: m.id,
          data: { groupe: null as unknown as number },
          overrideAccess: true,
        })
      }
      await payload.delete({ collection: 'groupes', id: g.id, overrideAccess: true })
      console.log(`  - groupe #${g.id} "${g.nom}" supprime (owner)`)
    }

    // 4) Delete the user
    await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
    console.log(`  - user supprime\n`)
  }

  console.log(`--- Cleanup termine : ${legacyUsers.length} user(s) supprimes ---`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[cleanup-legacy-demo] fatal:', err)
  process.exit(1)
})
