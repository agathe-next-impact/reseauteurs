import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  // >= 8 caracteres : Payload valide la longueur minimale du mot de passe a
  // la creation (sinon "Le mot de passe doit contenir au moins 8 caracteres").
  password: 'test1234',
  role: 'admin' as const,
  plan: 'gratuit' as const,
  nomSociete: 'Test Corp',
  ville: 'Paris',
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user.
  // - disableVerificationEmail : evite l'envoi de l'email de verification via
  //   l'adaptateur email natif de Payload (Resend), qui echoue en test
  //   (401 API key invalid) et fait planter le beforeAll. EMAILS_DRY_RUN ne
  //   couvre que le sendEmail applicatif, pas la verification native.
  // - _verified : le compte doit etre verifie pour pouvoir se connecter.
  await payload.create({
    collection: 'users',
    data: { ...testUser, _verified: true },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
