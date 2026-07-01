import { getPayload } from 'payload'
import config from '@payload-config'

const EMAILS = [
  'am.agathe.martin@gmail.com',
  'demo-organisateur@panorama-pub.com',
  'demo-groupe3@panorama-pub.com',
  'demo-groupe2@panorama-pub.com',
  'demo-groupe1@panorama-pub.com',
  'demo-expire@panorama-pub.com',
  'demo-suspendu@panorama-pub.com',
  'demo-infinite2@panorama-pub.com',
  'demo-infinite@panorama-pub.com',
  'demo-premium@panorama-pub.com',
  'demo-gratuit2@panorama-pub.com',
  'demo-gratuit@panorama-pub.com',
  'agathe@next-impact.digital',
  'agathe.karinthi.martin@gmail.com',
]

;(async () => {
  const p = await getPayload({ config })

  for (const email of EMAILS) {
    const u = await p.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    const user = u.docs[0]
    if (!user) {
      console.log(`\n[${email}] -> AUCUN COMPTE`)
      continue
    }

    const fournisseurs = await p.find({
      collection: 'fournisseurs',
      where: { user: { equals: user.id } },
      limit: 10,
      overrideAccess: true,
    })

    const organisateurs = await p.find({
      collection: 'organisateurs-evenements',
      where: { user: { equals: user.id } },
      limit: 10,
      overrideAccess: true,
    })

    console.log(`\n[${email}] role=${user.role} plan=${user.plan}`)
    if (fournisseurs.docs.length === 0 && organisateurs.docs.length === 0) {
      console.log('  -> AUCUNE FICHE')
    }
    for (const f of fournisseurs.docs) {
      console.log(`  - fournisseur id=${f.id} slug=${f.slug} raisonSociale="${f.raisonSociale}" statut=${f.statut}`)
    }
    for (const o of organisateurs.docs) {
      console.log(`  - organisateur id=${o.id} slug=${o.slug} nom="${o.nom}" statut=${o.statut}`)
    }
  }

  process.exit(0)
})()
