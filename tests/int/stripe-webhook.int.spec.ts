/**
 * Tests — POST /api/stripe/webhook (modèle 3-entités, ADR-0011→0016)
 *
 * Recalibré sur les 3 produits Subscription :
 *   - reseau_partenaire    : reseaux.partenaire / palier / partenaireExpireAt / statut='publiee'
 *   - partenaire_annonceur : partenaires.statut='actif'/'expire'
 *   - reseauteur_plus      : users.plusActif / plusSource='abonnement' / plusExpireAt (ADR-0013)
 *
 * Chemins couverts : sécurité (signature/rate-limit), idempotence markEventSeen,
 * checkout.session.completed × 3 produits, subscription.updated (active/canceled/
 * unpaid/past_due) × 3 produits, subscription.deleted × 3 produits,
 * invoice.payment_failed, event non géré.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── Hoisted mocks (accessible dans les factories vi.mock) ───────────────────

const {
  mockUpdate,
  mockFind,
  mockFindByID,
  mockCreate,
  mockSendEmail,
  mockConstructEvent,
  mockRateLimit,
  mockSubscriptionsRetrieve,
  mockLogPlanChange,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockFind: vi.fn(),
  mockFindByID: vi.fn(),
  mockCreate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 29 })),
  mockSubscriptionsRetrieve: vi.fn(),
  mockLogPlanChange: vi.fn(async () => {}),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    update: mockUpdate,
    find: mockFind,
    findByID: mockFindByID,
    // markEventSeen (idempotence) insère dans `stripe-events` via payload.create.
    create: mockCreate,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Spread du module réel : les fonctions pures (resolveProduitFromMetadata,
// getPalierFromPriceId, getSubscriptionPeriodEnd, PALIERS_NATIONAL…) restent
// authentiques et le mock ne surcharge que le client `stripe`.
vi.mock('@/lib/stripe', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/stripe')>()),
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('@/lib/audit', () => ({
  logPlanChange: mockLogPlanChange,
}))

// sendEmail est importé de @/lib/email-sender (PAS payload.sendEmail).
vi.mock('@/lib/email-sender', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/emails', () => ({
  subscriptionConfirmationEmail: vi.fn(() => '<html>confirmation</html>'),
  subscriptionCanceledEmail: vi.fn(() => '<html>canceled</html>'),
  paymentFailedEmail: vi.fn(() => '<html>failed</html>'),
  plusActiveEmail: vi.fn(() => '<html>plus-active</html>'),
  plusExpireEmail: vi.fn(() => '<html>plus-expire</html>'),
}))

// Import after mocks
import { POST } from '@/app/api/stripe/webhook/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

let eventCounter = 0

function makeRequest(body: string, sig: string | null = 'valid-sig'): Request {
  const headers: Record<string, string> = { 'x-forwarded-for': '1.2.3.4' }
  if (sig !== null) headers['stripe-signature'] = sig
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  })
}

function stripeEvent(type: string, data: unknown, eventId?: string): Stripe.Event {
  return { id: eventId ?? `evt_${++eventCounter}`, type, data: { object: data } } as unknown as Stripe.Event
}

function mockSubscription(
  id: string,
  overrides: Partial<Stripe.Subscription> & { current_period_end?: number } = {},
): Stripe.Subscription {
  const periodEnd = overrides.current_period_end ?? Math.floor(Date.now() / 1000) + 365 * 24 * 3600
  return {
    id,
    status: 'active',
    metadata: {},
    items: { data: [{ price: { id: 'price_unknown' } }] },
    current_period_end: periodEnd,
    ...overrides,
  } as unknown as Stripe.Subscription
}

function findUpdateFor(collection: string) {
  return mockUpdate.mock.calls.find(
    (c) => (c[0] as { collection?: string }).collection === collection,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 29 })
    // markEventSeen réussit par défaut (event pas encore vu)
    mockCreate.mockResolvedValue({ id: 1 })
    mockFind.mockResolvedValue({ docs: [] })
    mockUpdate.mockResolvedValue({})
    mockFindByID.mockResolvedValue({ id: 1, email: 'test@test.fr', nomSociete: 'Test' })
    mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription('sub_test'))
  })

  // ── Sécurité ────────────────────────────────────────────────────────────

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await POST(makeRequest('{}', null))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Signature manquante' })
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Signature invalide' })
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 })
    mockConstructEvent.mockReturnValue(stripeEvent('checkout.session.completed', {}))
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(429)
  })

  // ── Idempotence ─────────────────────────────────────────────────────────

  it('returns 200 duplicate=true when the event was already processed (UNIQUE violation)', async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    )
    mockConstructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', {
        metadata: { type: 'reseauteur_plus', userId: '42' },
        subscription: 'sub_456',
      }),
    )

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 500 on non-unique DB error so Stripe retries', async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error('canceling statement due to timeout'), { code: '57014' }),
    )
    mockConstructEvent.mockReturnValue(stripeEvent('checkout.session.completed', {}))

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(500)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── checkout.session.completed — reseau_partenaire ───────────────────────

  describe('checkout.session.completed — reseau_partenaire', () => {
    it('activates the network with partenaire=true, palier and statut=publiee', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
          customer: 'cus_123',
          subscription: 'sub_456',
          customer_details: { address: null, name: null, tax_ids: [] },
        }),
      )
      // findByID called both for the ownership check (niveau) and for the owner email
      mockFindByID.mockImplementation(async (args: { collection?: string; id?: unknown }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'national' }
        return { id: 99, email: 'orga@test.fr', nomSociete: 'Mon Réseau' }
      })
      mockSubscriptionsRetrieve.mockResolvedValue(
        mockSubscription('sub_456', { current_period_end: periodEnd }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const reseauUpdate = findUpdateFor('reseaux')
      expect(reseauUpdate).toBeDefined()
      expect(reseauUpdate![0]).toMatchObject({
        id: '5',
        data: expect.objectContaining({
          partenaire: true,
          stripeSubscriptionId: 'sub_456',
          statut: 'publiee',
          partenaireExpireAt: expect.any(String),
        }),
      })

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'orga@test.fr', kind: 'subscription-confirmation' }),
      )
    })

    it('ignores the checkout when reseauId is missing from metadata', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'reseau_partenaire' },
          customer: 'cus_123',
          subscription: 'sub_456',
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(findUpdateFor('reseaux')).toBeUndefined()
    })

    it('does not publish the network when it is a local group (ADR-0012 safety check)', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
          customer: 'cus_123',
          subscription: 'sub_456',
        }),
      )
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'local' }
        return { id: 99, email: 'orga@test.fr' }
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(findUpdateFor('reseaux')).toBeUndefined()
    })
  })

  // ── checkout.session.completed — partenaire_annonceur ────────────────────

  describe('checkout.session.completed — partenaire_annonceur', () => {
    it('sets statut=actif on the partenaire with stripeSubscriptionId', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
          customer: 'cus_ann_123',
          subscription: 'sub_ann_456',
        }),
      )
      mockSubscriptionsRetrieve.mockResolvedValue(
        mockSubscription('sub_ann_456', { current_period_end: periodEnd }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const partenaireUpdate = findUpdateFor('partenaires')
      expect(partenaireUpdate).toBeDefined()
      expect(partenaireUpdate![0]).toMatchObject({
        id: '12',
        data: expect.objectContaining({
          statut: 'actif',
          stripeSubscriptionId: 'sub_ann_456',
        }),
      })
    })
  })

  // ── checkout.session.completed — reseauteur_plus (ADR-0013) ──────────────

  describe('checkout.session.completed — reseauteur_plus', () => {
    it('activates plusActif/plusSource/plusExpireAt on the user and sends plus-active email', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'reseauteur_plus', userId: '42' },
          customer: 'cus_123',
          subscription: 'sub_plus_1',
        }),
      )
      mockSubscriptionsRetrieve.mockResolvedValue(
        mockSubscription('sub_plus_1', { current_period_end: periodEnd }),
      )
      mockFindByID.mockResolvedValue({ id: 42, email: 'membre@test.fr', nomSociete: 'ACME' })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const userUpdate = findUpdateFor('users')
      expect(userUpdate).toBeDefined()
      expect(userUpdate![0]).toMatchObject({
        id: 42,
        data: expect.objectContaining({
          plusActif: true,
          plusSource: 'abonnement',
          stripeSubscriptionId: 'sub_plus_1',
          plusExpireAt: expect.any(String),
        }),
      })

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'membre@test.fr', kind: 'plus-active' }),
      )
    })

    it('does nothing when userId/subscriptionId is missing from metadata', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'reseauteur_plus' },
          customer: 'cus_123',
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(findUpdateFor('users')).toBeUndefined()
    })
  })

  it('ignores checkout.session.completed when metadata.type is unknown', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', {
        metadata: { type: 'evenement_premium' }, // ADR-0012 : supprimé
        customer: 'cus_123',
        subscription: 'sub_456',
      }),
    )

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── customer.subscription.updated ─────────────────────────────────────────

  describe('customer.subscription.updated', () => {
    it('reseau_partenaire: activates on status=active (metadata reseauId present)', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'active',
          metadata: { type: 'reseau_partenaire', reseauId: '5' },
          items: { data: [{ price: { id: 'price_unknown' } }] },
          current_period_end: periodEnd,
        }),
      )
      mockFindByID.mockResolvedValue({ id: 5, niveau: 'national' })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const reseauUpdate = findUpdateFor('reseaux')
      expect(reseauUpdate).toBeDefined()
      expect(reseauUpdate![0]).toMatchObject({ data: expect.objectContaining({ partenaire: true }) })
    })

    it('reseau_partenaire: deactivates + suspends + emails on status=canceled', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'canceled',
          metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
        }),
      )
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'national', source: 'revendique' }
        return { id: 99, email: 'orga@test.fr', nomSociete: 'Mon Réseau' }
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const reseauUpdate = findUpdateFor('reseaux')
      expect(reseauUpdate![0]).toMatchObject({
        data: expect.objectContaining({ partenaire: false, statut: 'suspendue' }),
      })
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'orga@test.fr', kind: 'subscription-canceled' }),
      )
    })

    it('reseau_partenaire: sends payment-failed email on status=past_due (no deactivation)', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'past_due',
          metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
        }),
      )
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'national' }
        return { id: 99, email: 'orga@test.fr' }
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      expect(findUpdateFor('reseaux')).toBeUndefined()
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'orga@test.fr', kind: 'payment-failed' }),
      )
    })

    it('reseau_partenaire: looks up the network by subscriptionId when reseauId is absent', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_789',
          customer: 'cus_123',
          status: 'active',
          metadata: { type: 'reseau_partenaire' },
          items: { data: [{ price: { id: 'price_unknown' } }] },
          current_period_end: periodEnd,
        }),
      )
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { docs: [{ id: 5, stripeSubscriptionId: 'sub_789' }] }
        return { docs: [] }
      })
      mockFindByID.mockResolvedValue({ id: 5, niveau: 'national' })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(findUpdateFor('reseaux')).toBeDefined()
    })

    it('partenaire_annonceur: activates statut=actif on status=active', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_ann_456',
          customer: 'cus_ann_123',
          status: 'active',
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
          items: { data: [{ price: { id: 'price_unknown' } }] },
          current_period_end: periodEnd,
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const partenaireUpdate = findUpdateFor('partenaires')
      expect(partenaireUpdate![0]).toMatchObject({ data: expect.objectContaining({ statut: 'actif' }) })
    })

    it('partenaire_annonceur: sets statut=expire on status=canceled', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_ann_456',
          customer: 'cus_ann_123',
          status: 'canceled',
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const partenaireUpdate = findUpdateFor('partenaires')
      expect(partenaireUpdate![0]).toMatchObject({ data: expect.objectContaining({ statut: 'expire' }) })
    })

    it('reseauteur_plus: activates plusActif=true on status=active (metadata userId)', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_plus_1',
          customer: 'cus_123',
          status: 'active',
          metadata: { type: 'reseauteur_plus', userId: '42' },
          items: { data: [{ price: { id: 'price_unknown' } }] },
          current_period_end: periodEnd,
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const userUpdate = findUpdateFor('users')
      expect(userUpdate![0]).toMatchObject({
        id: '42',
        data: expect.objectContaining({ plusActif: true, plusSource: 'abonnement' }),
      })
    })

    it('reseauteur_plus: resolves the user via stripeCustomerId when metadata.userId is absent', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_plus_2',
          customer: 'cus_plus_2',
          status: 'active',
          metadata: { type: 'reseauteur_plus' },
          items: { data: [{ price: { id: 'price_unknown' } }] },
          current_period_end: periodEnd,
        }),
      )
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'users') return { docs: [{ id: 42, email: 'membre@test.fr' }] }
        return { docs: [] }
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const userUpdate = findUpdateFor('users')
      expect(userUpdate![0]).toMatchObject({ id: 42, data: expect.objectContaining({ plusActif: true }) })
    })

    it('reseauteur_plus: deactivates plusActif and sends plus-expire email on status=canceled', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_plus_1',
          customer: 'cus_123',
          status: 'canceled',
          metadata: { type: 'reseauteur_plus', userId: '42' },
        }),
      )
      mockFindByID.mockResolvedValue({ id: 42, email: 'membre@test.fr', nomSociete: 'ACME' })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const userUpdate = findUpdateFor('users')
      expect(userUpdate![0]).toMatchObject({ id: '42', data: { plusActif: false } })
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'membre@test.fr', kind: 'plus-expire' }),
      )
    })

    it('ignores subscription.updated when the product type is unresolved', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_x',
          customer: 'cus_x',
          status: 'active',
          metadata: {},
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // ── customer.subscription.deleted ─────────────────────────────────────────

  describe('customer.subscription.deleted', () => {
    it('reseau_partenaire: deactivates via metadata.reseauId', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_456',
          customer: 'cus_123',
          metadata: { type: 'reseau_partenaire', reseauId: '5' },
        }),
      )
      mockFindByID.mockResolvedValue({ id: 5, niveau: 'national', source: 'revendique' })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const reseauUpdate = findUpdateFor('reseaux')
      expect(reseauUpdate![0]).toMatchObject({
        data: expect.objectContaining({ partenaire: false, statut: 'suspendue' }),
      })
      expect(mockLogPlanChange).toHaveBeenCalled()
    })

    it('partenaire_annonceur: sets statut=expire', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_ann_456',
          customer: 'cus_ann_123',
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const partenaireUpdate = findUpdateFor('partenaires')
      expect(partenaireUpdate![0]).toMatchObject({ data: expect.objectContaining({ statut: 'expire' }) })
    })

    it('reseauteur_plus: deactivates plusActif via metadata.userId', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_plus_1',
          customer: 'cus_123',
          metadata: { type: 'reseauteur_plus', userId: '42' },
        }),
      )

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const userUpdate = findUpdateFor('users')
      expect(userUpdate![0]).toMatchObject({ id: '42', data: { plusActif: false } })
    })

    it('reseauteur_plus: resolves via stripeCustomerId when metadata.userId is absent', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_plus_3',
          customer: 'cus_plus_3',
          metadata: { type: 'reseauteur_plus' },
        }),
      )
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'users') return { docs: [{ id: 77 }] }
        return { docs: [] }
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)

      const userUpdate = findUpdateFor('users')
      expect(userUpdate![0]).toMatchObject({ id: 77, data: { plusActif: false } })
    })
  })

  // ── invoice.payment_failed ────────────────────────────────────────────────

  it('sends payment-failed email on invoice.payment_failed', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('invoice.payment_failed', { customer: 'cus_123' }),
    )
    mockFind.mockResolvedValue({
      docs: [{ id: 42, email: 'test@example.com', nomSociete: 'ACME' }],
    })

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com', kind: 'payment-failed' }),
    )
  })

  // ── Unhandled event ───────────────────────────────────────────────────────

  it('returns 200 for unhandled event types without side effects', async () => {
    mockConstructEvent.mockReturnValue(stripeEvent('payment_intent.created', { id: 'pi_123' }))

    const res = await POST(makeRequest('{}'))

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
