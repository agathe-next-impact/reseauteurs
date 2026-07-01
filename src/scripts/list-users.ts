import { getPayload } from 'payload'
import config from '@payload-config'

;(async () => {
  const p = await getPayload({ config })
  const r = await p.find({ collection: 'users', limit: 200, overrideAccess: true })
  for (const d of r.docs) console.log(`${d.role}\t${d.email}`)
  process.exit(0)
})()
