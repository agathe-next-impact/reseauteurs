import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

// SKIP: nécessite PAYLOAD_SECRET + base de test dédiée — cf. TEST-SANTE P3.
// getPayload()/.init() exige un `secret` non-vide (absent de .env.local) et
// ouvre une vraie connexion à la base Neon PARTAGÉE AVEC LA PROD. Non mockable
// sans dénaturer le test (il valide justement le vrai bootstrap Payload).
describe.skip('API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
  })
})
