import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAuth,
  mockFindByID,
  mockSubscriptionsUpdate,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { update: mockSubscriptionsUpdate },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

import { POST } from '@/app/api/stripe/reactivate/route'

describe('POST /api/stripe/reactivate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 400 when user has no subscription', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1 } })
    mockFindByID.mockResolvedValue({ id: 1, stripeSubscriptionId: '' })
    const res = await POST()
    expect(res.status).toBe(400)
  })

  it('sets cancel_at_period_end=false to reactivate', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1 } })
    mockFindByID.mockResolvedValue({ id: 1, stripeSubscriptionId: 'sub_123' })
    mockSubscriptionsUpdate.mockResolvedValue({})

    const res = await POST()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: false,
    })
  })

  it('returns 500 when Stripe fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1 } })
    mockFindByID.mockResolvedValue({ id: 1, stripeSubscriptionId: 'sub_123' })
    mockSubscriptionsUpdate.mockRejectedValue(new Error('Stripe error'))

    const res = await POST()
    expect(res.status).toBe(500)
  })
})
