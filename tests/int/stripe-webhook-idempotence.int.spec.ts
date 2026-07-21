import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockCreate,
  mockUpdate,
  mockFind,
  mockFindByID,
  mockCount,
  mockConstructEvent,
  mockRateLimit,
  mockSubscriptionsRetrieve,
  mockResolvePlan,
  mockSendEmail,
  mockRecalcPalier,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFind: vi.fn(),
  mockFindByID: vi.fn(),
  mockCount: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 29 })),
  mockSubscriptionsRetrieve: vi.fn(),
  mockResolvePlan: vi.fn(),
  mockSendEmail: vi.fn(),
  mockRecalcPalier: vi.fn(async () => {}),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    create: mockCreate,
    update: mockUpdate,
    find: mockFind,
    findByID: mockFindByID,
    count: mockCount,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/stripe')>()),
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  },
  resolvePlanFromPriceId: mockResolvePlan,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/groupes', () => ({
  recalculerEtAppliquerPalier: mockRecalcPalier,
}))

vi.mock('@/lib/emails', () => ({
  subscriptionConfirmationEmail: vi.fn(() => '<html/>'),
  paymentFailedEmail: vi.fn(() => '<html/>'),
  subscriptionCanceledEmail: vi.fn(() => '<html/>'),
  stripeMisconfigAlertEmail: vi.fn(() => '<html/>'),
}))

vi.mock('@/lib/audit', () => ({
  hashUserId: vi.fn(() => 'hash'),
  logPlanChange: vi.fn(async () => {}),
}))

vi.mock('@/lib/plan-downgrade', () => ({
  downgradeUserAndClearFields: vi.fn(async () => {}),
}))

import { POST } from '@/app/api/stripe/webhook/route'

function makeRequest(): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: '{}',
    headers: {
      'stripe-signature': 'valid',
      'x-forwarded-for': '1.2.3.4',
    },
  })
}

// ── Tests B1 — idempotence markEventSeen ────────────────────────────────────

describe('POST /api/stripe/webhook — idempotence markEventSeen (B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 29 })
    mockConstructEvent.mockReturnValue({
      id: 'evt_123',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'past_due',
        },
      },
    } as unknown as Stripe.Event)
    mockFind.mockResolvedValue({ docs: [{ id: 42, email: 'u@x.fr', nomSociete: 'X', plan: 'premium' }] })
  })

  it('repond 200 duplicate en cas de violation UNIQUE (event deja traite)', async () => {
    // Simule une erreur Postgres 23505 (violation UNIQUE sur eventId)
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ received: true, duplicate: true })
    // Aucune mutation effectuee puisque l'event est deja traite
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('repond 500 en cas d\'erreur DB non-UNIQUE pour que Stripe retente', async () => {
    // Timeout Neon simule — code Postgres 57014 (query_canceled), pas UNIQUE
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('canceling statement due to timeout'), { code: '57014' }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    // Stripe retentera ; on NE veut PAS avoir persiste l'event ni mute l'user
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('traite l\'event normalement quand markEventSeen reussit', async () => {
    mockCreate.mockResolvedValueOnce({ id: 1, eventId: 'evt_123' })
    // past_due : pas d'update user.plan mais email payment-failed envoye
    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ received: true })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'stripe-events',
        data: expect.objectContaining({ eventId: 'evt_123' }),
      }),
    )
  })

  it('detecte la violation UNIQUE remontee via la cause (drizzle wrapper)', async () => {
    // Payload/drizzle peuvent wrapper l'erreur Postgres dans err.cause.code
    const wrapped = new Error('Database error')
    Object.assign(wrapped, {
      cause: Object.assign(new Error('duplicate key value'), { code: '23505' }),
    })
    mockCreate.mockRejectedValueOnce(wrapped)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: true })
  })
})
