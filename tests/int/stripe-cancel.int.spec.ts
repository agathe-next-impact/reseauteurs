/**
 * Tests — POST /api/stripe/cancel (hub d'abonnement unifié, ADR-0016)
 *
 * Généralisé aux 3 produits via `resolveAbonnement` (réel, non mocké) :
 * réseauteur Plus (users), organisateur → réseau national (reseaux),
 * partenaire annonceur (partenaires). L'ownership est garanti par
 * construction : resolveAbonnement ne résout que le porteur du caller
 * (freshUser), donc on ne mocke que `payload.find` pour les branches
 * organisateur/partenaire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAuth,
  mockFindByID,
  mockFind,
  mockSubscriptionsRetrieve,
  mockSubscriptionsUpdate,
  mockRateLimit,
  mockSendEmail,
  mockLogPlanChange,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockFind: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 9 })),
  mockSendEmail: vi.fn(),
  mockLogPlanChange: vi.fn(async () => {}),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    find: mockFind,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/stripe')>()),
  stripe: {
    subscriptions: { retrieve: mockSubscriptionsRetrieve, update: mockSubscriptionsUpdate },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('@/lib/audit', () => ({
  logPlanChange: mockLogPlanChange,
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/emails', () => ({
  subscriptionCancelScheduledEmail: vi.fn(() => '<html>cancel-scheduled</html>'),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

import { POST } from '@/app/api/stripe/cancel/route'

function activeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    status: 'active',
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_unknown' } }] },
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    ...overrides,
  }
}

describe('POST /api/stripe/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 9 })
    mockFind.mockResolvedValue({ docs: [] })
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1 } })
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 })
    const res = await POST()
    expect(res.status).toBe(429)
  })

  it('returns 403 when the caller has no manageable subscription (e.g. admin)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1 } })
    mockFindByID.mockResolvedValue({ id: 1, role: 'admin' })
    const res = await POST()
    expect(res.status).toBe(403)
  })

  describe('réseauteur Plus', () => {
    it('returns 400 when the Plus access comes from a legacy licence (no Stripe subscription)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        role: 'reseauteur',
        plusActif: true,
        plusSource: 'licence',
        stripeSubscriptionId: null,
      })
      const res = await POST()
      expect(res.status).toBe(400)
    })

    it('returns 400 when there is no active subscription to cancel', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        role: 'reseauteur',
        plusActif: false,
        plusSource: null,
        stripeSubscriptionId: null,
      })
      const res = await POST()
      expect(res.status).toBe(400)
    })

    it('returns 500 when Stripe subscription retrieve fails', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        role: 'reseauteur',
        plusActif: true,
        plusSource: 'abonnement',
        stripeSubscriptionId: 'sub_123',
      })
      mockSubscriptionsRetrieve.mockRejectedValue(new Error('not found'))
      const res = await POST()
      expect(res.status).toBe(500)
    })

    it('returns 409 when the subscription is already canceled', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        role: 'reseauteur',
        plusActif: true,
        plusSource: 'abonnement',
        stripeSubscriptionId: 'sub_123',
      })
      mockSubscriptionsRetrieve.mockResolvedValue(activeSub({ status: 'canceled' }))
      const res = await POST()
      expect(res.status).toBe(409)
      expect((await res.json()).code).toBe('already_canceled')
    })

    it('returns 409 when cancellation is already scheduled', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        role: 'reseauteur',
        plusActif: true,
        plusSource: 'abonnement',
        stripeSubscriptionId: 'sub_123',
      })
      mockSubscriptionsRetrieve.mockResolvedValue(activeSub({ cancel_at_period_end: true }))
      const res = await POST()
      expect(res.status).toBe(409)
      expect((await res.json()).code).toBe('cancel_already_pending')
    })

    it('sets cancel_at_period_end=true, logs the change and emails the user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        email: 'membre@test.fr',
        nomSociete: 'ACME',
        role: 'reseauteur',
        plusActif: true,
        plusSource: 'abonnement',
        plusExpireAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        stripeSubscriptionId: 'sub_123',
      })
      mockSubscriptionsRetrieve.mockResolvedValue(activeSub())
      mockSubscriptionsUpdate.mockResolvedValue({})

      const res = await POST()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true })
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      })
      expect(mockLogPlanChange).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ reason: 'cancel_requested' }),
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'membre@test.fr',
          kind: 'subscription-cancel-scheduled',
        }),
      )
    })

    it('returns 500 when the Stripe update call fails', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1 } })
      mockFindByID.mockResolvedValue({
        id: 1,
        role: 'reseauteur',
        plusActif: true,
        plusSource: 'abonnement',
        stripeSubscriptionId: 'sub_123',
      })
      mockSubscriptionsRetrieve.mockResolvedValue(activeSub())
      mockSubscriptionsUpdate.mockRejectedValue(new Error('Stripe down'))

      const res = await POST()
      expect(res.status).toBe(500)
    })
  })

  describe('organisateur → réseau national', () => {
    it('resolves the network subscription and cancels it', async () => {
      mockAuth.mockResolvedValue({ user: { id: 7 } })
      mockFindByID.mockResolvedValue({ id: 7, role: 'organisateur' })
      mockFind.mockResolvedValue({
        docs: [
          {
            id: 5,
            nom: 'BNI',
            partenaire: true,
            stripeSubscriptionId: 'sub_reseau_1',
            palier: 'starter',
          },
        ],
      })
      mockSubscriptionsRetrieve.mockResolvedValue(activeSub({ id: 'sub_reseau_1' }))
      mockSubscriptionsUpdate.mockResolvedValue({})

      const res = await POST()

      expect(res.status).toBe(200)
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_reseau_1', {
        cancel_at_period_end: true,
      })
    })
  })
})
