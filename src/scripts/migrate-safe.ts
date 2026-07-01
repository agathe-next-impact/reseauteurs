/**
 * CI-safe migration runner.
 *
 * Payload's built-in `payload migrate` shows an interactive prompt when it
 * detects a dev-push marker (batch = -1) in the migrations table, which
 * hangs CI/Vercel builds.
 *
 * This script:
 * 1. Removes dev-push markers (batch = -1)
 * 2. Registers all migration files whose schema was already applied via dev
 *    push, so Payload won't attempt to replay them
 * 3. Runs any genuinely new migrations
 */

import dotenv from 'dotenv'
import path from 'path'

// Load .env.local then .env (Next.js convention) — required when running
// outside of Next.js (node --import=tsx/esm). On Vercel, env vars are injected
// and dotenv silently no-ops when vars already exist.
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

async function run() {
  // Dynamic imports so env vars are available when payload.config.ts evaluates
  const { getPayload, readMigrationFiles } = await import('payload')
  const config = (await import('../payload.config')).default

  process.env.PAYLOAD_MIGRATING = 'true'

  const payload = await getPayload({ config })

  // 1. Remove dev-push markers (batch = -1) to prevent the interactive prompt.
  //    Track their names so we can re-register only those as already applied.
  const devPushedNames = new Set<string>()
  try {
    const { docs } = await payload.find({
      collection: 'payload-migrations',
      limit: 0,
      where: { batch: { equals: -1 } },
    })
    if (docs.length > 0) {
      console.log(`[migrate-safe] Removing ${docs.length} dev-push marker(s)…`)
      for (const doc of docs) {
        if (doc.name) devPushedNames.add(doc.name)
        await payload.delete({ collection: 'payload-migrations', id: doc.id })
      }
    }
  } catch {
    // Table may not exist yet — migrate will create it below
  }

  // 2. Read migration files
  const migrationFiles = await readMigrationFiles({ payload })
  if (!migrationFiles.length) {
    console.log('[migrate-safe] No migration files found.')
    process.exit(0)
  }

  // 3. Re-register only the dev-pushed migrations (their schema already exists
  //    in the DB, they just lost their tracking row when we deleted batch=-1).
  if (devPushedNames.size > 0) {
    console.log(`[migrate-safe] Re-registering ${devPushedNames.size} dev-pushed migration(s)…`)
    for (const name of devPushedNames) {
      await payload.create({
        collection: 'payload-migrations',
        data: { name, batch: 1 } as any,
      })
      console.log(`  ✓ ${name}`)
    }
  }

  // 4. Run any genuinely pending migrations the normal way
  await payload.db.migrate({ migrations: migrationFiles })
  console.log('[migrate-safe] Done.')
  process.exit(0)
}

run().catch((err) => {
  console.error('[migrate-safe] Fatal:', err)
  process.exit(1)
})
