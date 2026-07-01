import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendEmail } from '@/lib/email-sender'
import type { Payload } from 'payload'

function makePayload(
  sendImpl?: (args: unknown) => Promise<unknown>,
  blacklistedEmails: string[] = [],
): Payload {
  return {
    sendEmail: vi.fn(sendImpl ?? (async () => ({}))),
    find: vi.fn(async ({ where }: { where: { email: { equals: string } } }) => {
      const email = where?.email?.equals
      const isBlacklisted = blacklistedEmails.includes(email)
      return { docs: isBlacklisted ? [{ id: 1, emailBlacklisted: true }] : [] }
    }),
  } as unknown as Payload
}

describe('sendEmail helper', () => {
  const origEnv = { DRY: process.env.EMAILS_DRY_RUN, NODE: process.env.NODE_ENV }
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    delete process.env.EMAILS_DRY_RUN
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.EMAILS_DRY_RUN = origEnv.DRY
    ;(process.env as Record<string, string | undefined>).NODE_ENV = origEnv.NODE
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('sends through payload.sendEmail and returns { sent: true }', async () => {
    const payload = makePayload()
    const result = await sendEmail({
      payload,
      kind: 'welcome',
      to: 'jane@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      userId: 42,
    })
    expect(result).toEqual({ sent: true })
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
        replyTo: expect.any(String),
      }),
    )
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[email\] kind=welcome to=j\*\*\*@example\.com userId=42 ok/),
    )
  })

  it('forwards RESEND_REPLY_TO_EMAIL to payload.sendEmail', async () => {
    process.env.RESEND_REPLY_TO_EMAIL = 'support@example.com'
    const payload = makePayload()
    await sendEmail({
      payload,
      kind: 'welcome',
      to: 'jane@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    })
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'support@example.com' }),
    )
    delete process.env.RESEND_REPLY_TO_EMAIL
  })

  it('skips when the recipient is blacklisted', async () => {
    const payload = makePayload(undefined, ['bounced@example.com'])
    const result = await sendEmail({
      payload,
      kind: 'upgrade-nudge',
      to: 'bounced@example.com',
      subject: 's',
      html: 'h',
    })
    expect(result).toEqual({ sent: false, skipped: 'blacklisted' })
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })

  it('skipBlacklistCheck bypasses the blacklist lookup', async () => {
    const payload = makePayload(undefined, ['bounced@example.com'])
    const result = await sendEmail({
      payload,
      kind: 'password-changed',
      to: 'bounced@example.com',
      subject: 's',
      html: 'h',
      skipBlacklistCheck: true,
    })
    expect(result.sent).toBe(true)
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('returns { sent: false, error } when payload.sendEmail times out', async () => {
    // Never resolves — the 10s timeout in the helper should win.
    const payload = makePayload(() => new Promise(() => {}))
    vi.useFakeTimers()
    try {
      const promise = sendEmail({
        payload,
        kind: 'welcome',
        to: 'slow@example.com',
        subject: 's',
        html: 'h',
      })
      await vi.advanceTimersByTimeAsync(10_001)
      const result = await promise
      expect(result.sent).toBe(false)
      expect((result.error as Error)?.message).toMatch(/timeout/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips when requireOptIn is true and optInMarketing is not true', async () => {
    const payload = makePayload()
    const result = await sendEmail({
      payload,
      kind: 'upgrade-nudge',
      to: 'opt@out.fr',
      subject: 's',
      html: 'h',
      requireOptIn: true,
      optInMarketing: false,
    })
    expect(result).toEqual({ sent: false, skipped: 'opt-out' })
    expect(payload.sendEmail).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[email\] kind=upgrade-nudge .* skipped=opt-out/),
    )
  })

  it('sends when requireOptIn and optInMarketing are both true', async () => {
    const payload = makePayload()
    const result = await sendEmail({
      payload,
      kind: 'upgrade-nudge',
      to: 'yes@ok.fr',
      subject: 's',
      html: 'h',
      requireOptIn: true,
      optInMarketing: true,
    })
    expect(result.sent).toBe(true)
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('dry-run skips payload.sendEmail but reports { sent: true, skipped: "dry-run" }', async () => {
    process.env.EMAILS_DRY_RUN = '1'
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    const payload = makePayload()
    const result = await sendEmail({
      payload,
      kind: 'account-deleted',
      to: 'dry@run.fr',
      subject: 'Test',
      html: 'body',
    })
    expect(result).toEqual({ sent: true, skipped: 'dry-run' })
    expect(payload.sendEmail).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/DRY_RUN subject="Test"/),
    )
  })

  it('dry-run flag is IGNORED in production', async () => {
    process.env.EMAILS_DRY_RUN = '1'
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    const payload = makePayload()
    const result = await sendEmail({
      payload,
      kind: 'welcome',
      to: 'prod@panorama-pub.com',
      subject: 's',
      html: 'h',
    })
    expect(result).toEqual({ sent: true })
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('catches errors, returns { sent: false, error }, and logs', async () => {
    const boom = new Error('SMTP down')
    const payload = makePayload(async () => {
      throw boom
    })
    const result = await sendEmail({
      payload,
      kind: 'payment-failed',
      to: 'fail@oops.fr',
      subject: 's',
      html: 'h',
    })
    expect(result.sent).toBe(false)
    expect(result.error).toBe(boom)
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[email\] kind=payment-failed .* err="SMTP down"/),
    )
  })

  it('redacts the recipient address in logs (first char only)', async () => {
    const payload = makePayload()
    await sendEmail({
      payload,
      kind: 'welcome',
      to: 'sensitive.person@acme.co.uk',
      subject: 's',
      html: 'h',
    })
    const loggedLines = logSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('\n')
    expect(loggedLines).toContain('s***@acme.co.uk')
    expect(loggedLines).not.toContain('sensitive.person')
  })
})
