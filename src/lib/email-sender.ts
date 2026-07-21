import type { Payload } from 'payload'

export type EmailKind =
  | 'subscription-confirmation'
  | 'subscription-canceled'
  | 'subscription-cancel-scheduled'
  | 'subscription-reactivated'
  | 'plan-upgraded'
  | 'plan-downgrade-scheduled'
  | 'plan-downgraded'
  | 'payment-failed'
  | 'expiration-warning'
  | 'completion-reminder'
  | 'upgrade-nudge'
  | 'group-leverage'
  | 'group-invitation'
  | 'group-created'
  | 'group-joined-owner'
  | 'group-left-owner'
  | 'groupe-auto-left-downgrade'
  | 'groupe-palier-upgrade-owner'
  | 'groupe-palier-upgrade-member'
  | 'groupe-palier-downgrade-owner'
  | 'groupe-palier-downgrade-member'
  | 'welcome'
  | 'csv-invitation'
  | 'account-deleted'
  | 'fiche-rejected'
  | 'evenement-rejected'
  | 'verify-email'
  | 'forgot-password'
  | 'account-locked'
  | 'password-changed'
  | 'email-changed'
  | 'email-change-confirm'
  | 'admin-alert'
  | 'plus-active'
  | 'plus-expire'
  | 'invitation-national'

export interface SendEmailInput {
  payload: Payload
  kind: EmailKind
  to: string
  subject: string
  html: string
  userId?: number | string
  requireOptIn?: boolean
  optInMarketing?: boolean
  /** When true, bypasses the blacklist check (transactional critical paths only — use sparingly). */
  skipBlacklistCheck?: boolean
}

export interface SendEmailResult {
  sent: boolean
  skipped?: 'opt-out' | 'dry-run' | 'blacklisted'
  error?: unknown
}

// Hard cap on Resend calls. Beyond this, we prefer to fail fast rather than
// hold a serverless invocation open — bounces will be picked up by retry logic
// in callers that care (e.g. cron jobs).
const EMAIL_TIMEOUT_MS = 10_000

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, 1)
  return `${head}***@${domain}`
}

function isDryRun(): boolean {
  return process.env.EMAILS_DRY_RUN === '1' && process.env.NODE_ENV !== 'production'
}

function resolveReplyTo(): string | undefined {
  const r = process.env.RESEND_REPLY_TO_EMAIL
  return r && r.length > 0 ? r : 'contact@reseauteurs.com'
}

/**
 * Look up the blacklist flag for `to`. Returns true if we should skip the send.
 * Silently returns false on any DB error — we never want blacklist lookups to
 * block legitimate mail (and never want them to throw into the caller).
 */
async function isBlacklisted(payload: Payload, to: string): Promise<boolean> {
  try {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: to } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = docs[0] as { emailBlacklisted?: boolean } | undefined
    return user?.emailBlacklisted === true
  } catch {
    return false
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const {
    payload,
    kind,
    to,
    subject,
    html,
    userId,
    requireOptIn,
    optInMarketing,
    skipBlacklistCheck,
  } = input
  const uidPart = userId != null ? ` userId=${userId}` : ''
  const tag = `[email] kind=${kind} to=${redactEmail(to)}${uidPart}`

  if (requireOptIn && optInMarketing !== true) {
    console.log(`${tag} skipped=opt-out`)
    return { sent: false, skipped: 'opt-out' }
  }

  if (!skipBlacklistCheck && (await isBlacklisted(payload, to))) {
    console.log(`${tag} skipped=blacklisted`)
    return { sent: false, skipped: 'blacklisted' }
  }

  if (isDryRun()) {
    console.log(`${tag} DRY_RUN subject="${subject}"`)
    return { sent: true, skipped: 'dry-run' }
  }

  const replyTo = resolveReplyTo()
  const message = { to, subject, html, ...(replyTo ? { replyTo } : {}) }

  try {
    let timer: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('email timeout')), EMAIL_TIMEOUT_MS)
    })
    try {
      await Promise.race([payload.sendEmail(message), timeoutPromise])
    } finally {
      if (timer) clearTimeout(timer)
    }
    console.log(`${tag} ok`)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`${tag} err="${msg}"`)
    return { sent: false, error: err }
  }
}
