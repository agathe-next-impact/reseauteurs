import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

// Ce test valide le vrai bootstrap Payload (getPayload/.init) + une lecture DB
// réelle. Il ne tourne QUE contre une base de test LOCALE dédiée (docker compose
// `postgres`), jamais contre Neon partagée prod. Gate : PAYLOAD_SECRET présent ET
// DATABASE_URI pointant sur localhost. Sans ça (ex. `pnpm test:int` par défaut),
// il skippe. Pour l'exécuter : `pnpm test:int:local` (charge .env.test).
const dbUri = process.env.DATABASE_URI || process.env.DATABASE_URL || ''
const hasLocalTestDb =
  !!process.env.PAYLOAD_SECRET && /(localhost|127\.0\.0\.1)/.test(dbUri) && !/neon/i.test(dbUri)

describe.skipIf(!hasLocalTestDb)('API', () => {
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
