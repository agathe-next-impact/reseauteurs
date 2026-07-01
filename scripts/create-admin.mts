import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

const EMAIL = process.env.ADMIN_EMAIL || 'admin@panorama-pub.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345!'

const p = await getPayload({ config })

const existing = await p.find({
  collection: 'users',
  where: { email: { equals: EMAIL } },
  limit: 1,
  overrideAccess: true,
})

if (existing.docs.length > 0) {
  console.log(`Utilisateur ${EMAIL} existe deja (id=${existing.docs[0].id})`)
  process.exit(0)
}

const user = await p.create({
  collection: 'users',
  data: {
    email: EMAIL,
    password: PASSWORD,
    role: 'admin',
    nomSociete: 'Admin',
    ville: 'Paris',
    packType: 'gratuit',
    featureLevel: 'standard',
    ficheQuota: 1,
    _verified: true,
  } as any,
  overrideAccess: true,
  disableVerificationEmail: true,
})

console.log(`Admin cree : ${user.email} (id=${user.id})`)
console.log(`Mot de passe : ${PASSWORD}`)
process.exit(0)
