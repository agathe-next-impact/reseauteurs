import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAuth,
  mockFindByID,
  mockFind,
  mockDelete,
  mockSubscriptionsCancel,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockFind: vi.fn(),
  mockDelete: vi.fn(),
  mockSubscriptionsCancel: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    find: mockFind,
    delete: mockDelete,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { cancel: mockSubscriptionsCancel },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

import { POST } from '@/app/api/account/delete/route'

describe('POST /api/account/delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 403 for admin accounts', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, role: 'admin' } })
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('deletes user with no subscription and no fiche', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'fournisseur' } })
    mockFindByID.mockResolvedValue({ id: 42, stripeSubscriptionId: '' })
    mockFind.mockResolvedValueOnce({ docs: [] }) // no fiche

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled()
  })

  it('cancels Stripe subscription and deletes fiche + evenements + user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'fournisseur' } })
    mockFindByID.mockResolvedValue({ id: 42, stripeSubscriptionId: 'sub_999' })
    // Find fiche
    mockFind
      .mockResolvedValueOnce({ docs: [{ id: 100 }] })
      // Find evenements
      .mockResolvedValueOnce({ docs: [{ id: 200 }, { id: 201 }] })

    mockDelete.mockResolvedValue({})
    mockSubscriptionsCancel.mockResolvedValue({})

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_999')
    // Evenements deleted
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'evenements', id: 200 }),
    )
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'evenements', id: 201 }),
    )
    // Fiche deleted
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'fournisseurs', id: 100 }),
    )
    // User deleted
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
  })

  it('continues deletion even if Stripe cancel fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'fournisseur' } })
    mockFindByID.mockResolvedValue({ id: 42, stripeSubscriptionId: 'sub_dead' })
    mockSubscriptionsCancel.mockRejectedValue(new Error('Already canceled'))
    mockFind.mockResolvedValueOnce({ docs: [] })
    mockDelete.mockResolvedValue({})

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
  })
})
