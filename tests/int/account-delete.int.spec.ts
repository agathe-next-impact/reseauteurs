import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
//
// RÉALIGNEMENT 2026-07-21 : la route /api/account/delete est recalibrée (ADR-0011).
// Elle gère les rôles reseauteur / organisateur / partenaire (plus 'fournisseur') :
//   - reseauteur  → supprime son profil `reseauteurs` lié (pas d'événements) ;
//   - organisateur → ORPHELINE le `reseaux` (user:null, partenaire:false, source:importe) ;
//   - tout rôle avec stripeSubscriptionId → stripe.subscriptions.update puis .cancel.
// Elle passe aussi par rateLimit, @/lib/email-sender, @/lib/audit.
// Cf. src/app/api/account/delete/route.ts. Anciennes fixtures 'fournisseurs' +
// suppression d'événements = caduques.

const {
  mockAuth,
  mockFindByID,
  mockFind,
  mockDelete,
  mockUpdate,
  mockSubscriptionsCancel,
  mockSubscriptionsUpdate,
  mockRateLimit,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockFind: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  mockSubscriptionsCancel: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true })),
  mockSendEmail: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    find: mockFind,
    delete: mockDelete,
    update: mockUpdate,
    // Journal d'audit RGPD (payload.create sur audit-logs) — non bloquant côté route.
    create: vi.fn(),
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      cancel: mockSubscriptionsCancel,
      update: mockSubscriptionsUpdate,
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

import { POST } from '@/app/api/account/delete/route'

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true })
    mockSendEmail.mockResolvedValue({ sent: true })
    mockSubscriptionsUpdate.mockResolvedValue({})
    mockSubscriptionsCancel.mockResolvedValue({})
    mockDelete.mockResolvedValue({})
    mockUpdate.mockResolvedValue({})
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'reseauteur' } })
    mockRateLimit.mockReturnValue({ success: false })
    const res = await POST()
    expect(res.status).toBe(429)
  })

  it('returns 403 for admin accounts', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, role: 'admin' } })
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('deletes a réseauteur with no subscription and no profile', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'reseauteur' } })
    mockFindByID.mockResolvedValue({ id: 42, role: 'reseauteur', stripeSubscriptionId: '' })
    mockFind.mockResolvedValueOnce({ docs: [] }) // no reseauteur profile

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled()
  })

  it('cancels Stripe subscription and deletes the réseauteur profile + user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'reseauteur' } })
    mockFindByID.mockResolvedValue({
      id: 42,
      role: 'reseauteur',
      stripeSubscriptionId: 'sub_999',
    })
    mockFind.mockResolvedValueOnce({ docs: [{ id: 100 }] }) // reseauteur profile

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_999',
      expect.objectContaining({ metadata: expect.objectContaining({ account_deletion: 'true' }) }),
    )
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_999')
    // Profil reseauteur supprimé
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'reseauteurs', id: 100 }),
    )
    // User supprimé
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
  })

  it('orphans the réseau (does not delete it) for an organisateur', async () => {
    mockAuth.mockResolvedValue({ user: { id: 55, role: 'organisateur' } })
    mockFindByID.mockResolvedValue({
      id: 55,
      role: 'organisateur',
      stripeSubscriptionId: 'sub_1',
    })
    mockFind.mockResolvedValueOnce({ docs: [{ id: 300 }] }) // reseau possédé

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_1')
    // Le réseau est orphelin, PAS supprimé
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'reseaux',
        id: 300,
        data: expect.objectContaining({ user: null, partenaire: false }),
      }),
    )
    expect(mockDelete).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'reseaux' }),
    )
    // User supprimé
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 55 }),
    )
  })

  it('continues deletion even if Stripe cancel fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 42, role: 'reseauteur' } })
    mockFindByID.mockResolvedValue({
      id: 42,
      role: 'reseauteur',
      stripeSubscriptionId: 'sub_dead',
    })
    mockSubscriptionsCancel.mockRejectedValue(new Error('Already canceled'))
    mockFind.mockResolvedValueOnce({ docs: [] })

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
  })
})
