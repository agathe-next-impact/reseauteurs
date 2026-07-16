// Vérification éphémère — dates des occurrences créées par le test e2e, puis nettoyage.
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const TITRE = 'E2E récurrence hebdo — à supprimer'

;(async () => {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'evenements',
    where: { titre: { equals: TITRE } },
    limit: 30,
    depth: 0,
    sort: 'dateDebut',
    overrideAccess: true,
  })

  console.log(`EVENEMENTS EN BASE : ${docs.length}`)
  for (const d of docs) {
    console.log(
      `  id=${d.id} slug=${d.slug} dateDebut=${d.dateDebut} statut=${d.statut} reseau=${JSON.stringify(d.reseau)}`,
    )
  }

  // Nettoyage
  for (const d of docs) {
    await payload.delete({ collection: 'evenements', id: d.id, overrideAccess: true })
  }
  console.log(`NETTOYAGE : ${docs.length} événement(s) supprimé(s)`)
  process.exit(0)
})()
