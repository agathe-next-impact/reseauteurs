import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockAuth,
  mockFindByID,
  mockUpdate,
  mockCustomersCreate,
  mockSubscriptionsList,
  mockSubscriptionsCancel,
  mockSessionsCreate,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockUpdate: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockSubscriptionsList: vi.fn(),
  mockSubscriptionsCancel: vi.fn(),
  mockSessionsCreate: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    update: mockUpdate,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: mockCustomersCreate },
    subscriptions: { list: mockSubscriptionsList, cancel: mockSubscriptionsCancel },
    checkout: { sessions: { create: mockSessionsCreate } },
  },
  PLANS: {
    premium: { label: 'Premium', price: 9900, priceId: 'price_premium' },
    infinite: { label: 'Infinite', price: 21900, priceId: 'price_infinite' },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers({ authorization: 'Bearer token' })),
}))

// Import after mocks
import { POST } from '@/app/api/stripe/checkout/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('returns 401 when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })

    const res = await POST(makeRequest({ plan: 'premium' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Non authentifie' })
  })

  it('returns 400 when plan parameter is invalid', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })

    const res = await POST(makeRequest({ plan: 'gold' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Parametres invalides' })
  })

  it('creates Stripe customer when user has no stripeCustomerId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
    mockFindByID.mockResolvedValue({ id: 1, email: 'a@b.com', stripeCustomerId: undefined })
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new' })
    mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_new' })

    const res = await POST(makeRequest({ plan: 'premium' }))

    expect(res.status).toBe(200)
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com' }),
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 1,
        data: { stripeCustomerId: 'cus_new' },
      }),
    )
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/session_new' })
  })

  it('cancels existing active subscriptions before creating session', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
    mockFindByID.mockResolvedValue({
      id: 1,
      email: 'a@b.com',
      stripeCustomerId: 'cus_existing',
    })
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_old_1' }, { id: 'sub_old_2' }],
    })
    mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_x' })

    const res = await POST(makeRequest({ plan: 'infinite' }))

    expect(res.status).toBe(200)
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_old_1')
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_old_2')
    expect(mockCustomersCreate).not.toHaveBeenCalled()
  })

  it('creates checkout session with the premium priceId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 5, email: 'std@test.com' } })
    mockFindByID.mockResolvedValue({
      id: 5,
      email: 'std@test.com',
      stripeCustomerId: 'cus_5',
    })
    mockSubscriptionsList.mockResolvedValue({ data: [] })
    mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/s' })

    await POST(makeRequest({ plan: 'premium' }))

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_5',
        mode: 'subscription',
        line_items: [{ price: 'price_premium', quantity: 1 }],
        metadata: { userId: '5', plan: 'premium' },
        success_url: 'http://localhost:3000/dashboard?checkout=success',
        cancel_url: 'http://localhost:3000/dashboard?checkout=cancel',
      }),
    )
  })

  it('creates checkout session with the infinite priceId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 5, email: 'inf@test.com' } })
    mockFindByID.mockResolvedValue({
      id: 5,
      email: 'inf@test.com',
      stripeCustomerId: 'cus_5',
    })
    mockSubscriptionsList.mockResolvedValue({ data: [] })
    mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/p' })

    await POST(makeRequest({ plan: 'infinite' }))

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_infinite', quantity: 1 }],
        metadata: { userId: '5', plan: 'infinite' },
      }),
    )
  })

  it('returns 500 when Stripe throws an error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
    mockFindByID.mockResolvedValue({ id: 1, email: 'a@b.com', stripeCustomerId: 'cus_1' })
    mockSubscriptionsList.mockResolvedValue({ data: [] })
    mockSessionsCreate.mockRejectedValue(new Error('Stripe is down'))

    const res = await POST(makeRequest({ plan: 'premium' }))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })
})
