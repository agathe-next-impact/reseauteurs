import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────────────

const {
  mockUpdate,
  mockFind,
  mockFindByID,
  mockSendEmail,
  mockConstructEvent,
  mockRateLimit,
  mockCount,
  mockSubscriptionsRetrieve,
  mockResolvePlan,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockFind: vi.fn(),
  mockFindByID: vi.fn(),
  mockSendEmail: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 29 })),
  mockCount: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockResolvePlan: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    update: mockUpdate,
    find: mockFind,
    findByID: mockFindByID,
    sendEmail: mockSendEmail,
    count: mockCount,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  },
  resolvePlanFromPriceId: mockResolvePlan,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('@/lib/emails', () => ({
  subscriptionConfirmationEmail: vi.fn(() => '<html>confirmation</html>'),
  paymentFailedEmail: vi.fn(() => '<html>failed</html>'),
}))

// Import after mocks
import { POST } from '@/app/api/stripe/webhook/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: string, sig: string | null = 'valid-sig'): Request {
  const headers: Record<string, string> = { 'x-forwarded-for': '1.2.3.4' }
  if (sig !== null) headers['stripe-signature'] = sig
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  })
}

function stripeEvent(type: string, data: unknown): Stripe.Event {
  return { type, data: { object: data } } as unknown as Stripe.Event
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 29 })
  })

  // ── Security ─────────────────────────────────────────────────────────────

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await POST(makeRequest('{}', null))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing signature' })
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid signature' })
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(429)
  })

  // ── checkout.session.completed ────────────────────────────────────────────

  it('updates user with plan info on checkout.session.completed', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', {
        metadata: { userId: '42', plan: 'premium' },
        customer: 'cus_123',
        subscription: 'sub_456',
      }),
    )
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_456',
      items: { data: [{ price: { id: 'price_premium' } }] },
      current_period_end: 9999999999,
    })
    mockResolvePlan.mockReturnValue('premium')
    mockUpdate.mockResolvedValue({})
    mockFindByID.mockResolvedValue({
      id: 42,
      email: 'test@example.com',
      nomSociete: 'ACME',
      plan: 'premium',
    })
    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)

    // User update with plan + Stripe IDs
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 42,
        data: expect.objectContaining({
          plan: 'premium',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_456',
          planExpiresAt: expect.any(String),
        }),
      }),
    )

    // Confirmation email sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
      }),
    )
  })

  it('does nothing when checkout.session.completed has no userId', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', {
        metadata: {},
        customer: 'cus_123',
        subscription: 'sub_456',
      }),
    )

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('skips when priceId resolves to null (unknown price)', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', {
        metadata: { userId: '42' },
        customer: 'cus_123',
        subscription: 'sub_456',
      }),
    )
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_456',
      items: { data: [{ price: { id: 'price_unknown' } }] },
      current_period_end: 9999999999,
    })
    mockResolvePlan.mockReturnValue(null)

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── customer.subscription.updated ─────────────────────────────────────────

  it('extends expiry on subscription updated with status=active', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_789',
        customer: 'cus_123',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium' }, quantity: 1 }] },
        current_period_end: 9999999999,
      }),
    )
    mockResolvePlan.mockReturnValue('premium')
    mockFind.mockResolvedValue({ docs: [{ id: 42 }] })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 42,
        data: expect.objectContaining({
          plan: 'premium',
          stripeSubscriptionId: 'sub_789',
          planExpiresAt: expect.any(String),
        }),
      }),
    )
  })

  it('downgrades to gratuit on subscription updated with status=canceled', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        customer: 'cus_123',
        status: 'canceled',
      }),
    )
    mockFind.mockResolvedValue({ docs: [{ id: 42 }] })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 42,
        data: expect.objectContaining({
          plan: 'gratuit',
          stripeSubscriptionId: '',
          planExpiresAt: '',
        }),
      }),
    )
  })

  it('downgrades to gratuit on subscription updated with status=unpaid', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        customer: 'cus_123',
        status: 'unpaid',
      }),
    )
    mockFind.mockResolvedValue({ docs: [{ id: 42 }] })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'gratuit' }),
      }),
    )
  })

  it('downgrades to gratuit on subscription updated with status=past_due', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        customer: 'cus_123',
        status: 'past_due',
      }),
    )
    mockFind.mockResolvedValue({ docs: [{ id: 42 }] })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'gratuit' }),
      }),
    )
  })

  it('does nothing when subscription.updated customer is unknown', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        customer: 'cus_unknown',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium' }, quantity: 1 }] },
        current_period_end: 9999999999,
      }),
    )
    mockFind.mockResolvedValue({ docs: [] })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── customer.subscription.deleted ─────────────────────────────────────────

  it('downgrades to gratuit on subscription deleted', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.deleted', {
        customer: 'cus_123',
      }),
    )
    mockFind.mockResolvedValue({ docs: [{ id: 42 }] })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 42,
        data: expect.objectContaining({ plan: 'gratuit' }),
      }),
    )
  })

  // ── invoice.payment_failed ────────────────────────────────────────────────

  it('sends payment failed email on invoice.payment_failed', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('invoice.payment_failed', {
        customer: 'cus_123',
      }),
    )
    mockFind.mockResolvedValue({
      docs: [{ id: 42, email: 'test@example.com', nomSociete: 'ACME' }],
    })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Echec de paiement'),
      }),
    )
  })

  // ── Unhandled event ───────────────────────────────────────────────────────

  it('returns 200 for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('payment_intent.created', { id: 'pi_123' }),
    )

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
