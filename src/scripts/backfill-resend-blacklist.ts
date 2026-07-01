/**
 * Script one-shot : rattrapage des bounces/complaints Resend non-propages a
 * la DB panorama-pub. A utiliser une fois le webhook /api/resend/webhook
 * repare, pour rattraper la periode pendant laquelle les 401 ont empeche
 * l'alimentation de `users.emailBlacklisted`.
 *
 * Input : fichier JSON exporte depuis Resend Dashboard > Logs (tableau d'events
 * au format Resend avec au minimum `to`, `last_event`, `created_at`).
 *
 * Usage :
 *   pnpm tsx src/scripts/backfill-resend-blacklist.ts path/to/resend-export.json
 *
 * Comportement :
 *   - Filtre sur `last_event in [bounced, complained]`.
 *   - Dedup par email (le plus recent gagne).
 *   - Pour chaque email, resout le user et set emailBlacklisted=true + reason
 *     + emailBlacklistedAt = timestamp de l'event Resend.
 *   - Laisse intact les users deja blacklistes (on n'ecrase pas un flag existant).
 *   - Sortie : counts et liste des emails inconnus (non-members de la DB).
 *
 * Idempotent : reexecuter le script avec le meme fichier est un no-op sur les
 * users deja flagges.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getPayload } from 'payload'
import config from '../payload.config'

interface ResendEvent {
  id?: string
  created_at?: string
  sent_at?: string
  subject?: string
  to?: string | string[]
  last_event?: string
}

function extractRecipient(event: ResendEvent): string | null {
  const to = event.to
  if (Array.isArray(to)) return to[0] ?? null
  if (typeof to === 'string') return to
  return null
}

async function main() {
  const [, , filePath] = process.argv
  if (!filePath) {
    console.error('Usage: pnpm tsx src/scripts/backfill-resend-blacklist.ts <export.json>')
    process.exit(1)
  }

  const absolute = resolve(filePath)
  const raw = readFileSync(absolute, 'utf-8')
  const events = JSON.parse(raw) as ResendEvent[]
  if (!Array.isArray(events)) {
    console.error('Fichier d\'entree : tableau JSON attendu.')
    process.exit(1)
  }

  // Collecte : par email, garde le plus recent event bounced/complained.
  const latestByEmail = new Map<
    string,
    { reason: 'hard-bounce' | 'complaint'; at: string }
  >()
  for (const event of events) {
    const type = event.last_event
    if (type !== 'bounced' && type !== 'complained') continue
    const email = extractRecipient(event)
    if (!email) continue
    const reason = type === 'complained' ? 'complaint' : 'hard-bounce'
    const at = event.sent_at ?? event.created_at ?? new Date().toISOString()
    const existing = latestByEmail.get(email)
    if (!existing || existing.at < at) {
      latestByEmail.set(email, { reason, at })
    }
  }

  console.log(`[backfill] ${latestByEmail.size} emails uniques a traiter`)

  const payload = await getPayload({ config })

  let blacklisted = 0
  let alreadyFlagged = 0
  const unknown: string[] = []

  for (const [email, entry] of latestByEmail) {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = docs[0] as
      | { id: number | string; emailBlacklisted?: boolean }
      | undefined
    if (!user) {
      unknown.push(email)
      continue
    }
    if (user.emailBlacklisted === true) {
      alreadyFlagged++
      continue
    }
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        emailBlacklisted: true,
        emailBlacklistedReason: entry.reason,
        emailBlacklistedAt: new Date(entry.at).toISOString(),
      },
      overrideAccess: true,
    })
    blacklisted++
    console.log(`[backfill] ${email} → blacklisted (${entry.reason})`)
  }

  console.log('--- resume ---')
  console.log(`blacklisted      : ${blacklisted}`)
  console.log(`deja flagges     : ${alreadyFlagged}`)
  console.log(`inconnus         : ${unknown.length}`)
  if (unknown.length > 0) {
    console.log('emails inconnus  :', unknown.join(', '))
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill] erreur fatale :', err)
  process.exit(1)
})
