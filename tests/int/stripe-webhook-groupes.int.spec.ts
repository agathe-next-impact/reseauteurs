import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

/**
 * Tests focalises sur les flows GROUPES du webhook Stripe.
 * Le fichier stripe-webhook.int.spec.ts couvre la securite, l'idempotence et
 * les transitions de plan ; ici on verifie que les bons effets de bord
 * groupes sont declenches (recalc palier, downgradeUserAndClearFields).
 *
 *   1. subscription.updated infinite→premium → downgradeUserAndClearFields(premium) + recalc
 *   2. subscription.updated premium→infinite → recalc seulement (PAS de cleanup)
 *   3. subscription.updated status=canceled → downgradeUser (gratuit) + recalc
 *   4. subscription.deleted → downgradeUser (gratuit) + recalc
 *   5. subscription.deleted "stale" (sub differente de l'user) → no-op (anti-bug B1)
 */

const {
  mockUpdate,
  mockFind,
  mockFindByID,
  mockCreate,
  mockSendEmail,
  mockConstructEvent,
  mockRateLimit,
  mockSubsRetrieve,
  mockInvoicesRetrieve,
  mockInvoicesPreview,
  mockResolvePlan,
  mockGetPeriodEnd,
  mockRecalc,
  mockDowngrade,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockFind: vi.fn(),
  mockFindByID: vi.fn(),
  mockCreate: vi.fn(async () => ({ id: 1 })),
  mockSendEmail: vi.fn(async () => ({ sent: true })),
  mockConstructEvent: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 29 })),
  mockSubsRetrieve: vi.fn(),
  mockInvoicesRetrieve: vi.fn(async () => ({ amount_paid: 0 })),
  mockInvoicesPreview: vi.fn(async () => null),
  mockResolvePlan: vi.fn(),
  mockGetPeriodEnd: vi.fn(() => 9999999999),
  mockRecalc: vi.fn(async () => undefined),
  mockDowngrade: vi.fn(async () => undefined),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    update: mockUpdate,
    find: mockFind,
    findByID: mockFindByID,
    create: mockCreate,
    sendEmail: mockSendEmail,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubsRetrieve },
    invoices: {
      retrieve: mockInvoicesRetrieve,
      createPreview: mockInvoicesPreview,
    },
  },
  resolvePlanFromPriceId: mockResolvePlan,
  getSubscriptionPeriodEnd: mockGetPeriodEnd,
  PLANS: {
    premium: { label: 'Premium', price: 9900, priceId: 'price_premium' },
    infinite: { label: 'Infinite', price: 21900, priceId: 'price_infinite' },
  },
  planLabel: (p: string) => (p === 'infinite' ? 'Infinite' : p === 'premium' ? 'Premium' : 'Gratuit'),
}))

vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit }))
vi.mock('@/lib/email-sender', () => ({ sendEmail: mockSendEmail }))
vi.mock('@/lib/groupes', () => ({ recalculerEtAppliquerPalier: mockRecalc }))
vi.mock('@/lib/plan-downgrade', () => ({ downgradeUserAndClearFields: mockDowngrade }))

vi.mock('@/lib/audit', () => ({
  hashUserId: (id: unknown) => `hash:${String(id)}`,
  logPlanChange: vi.fn(async () => undefined),
}))

vi.mock('@/lib/emails', () => ({
  subscriptionConfirmationEmail: vi.fn(() => '<html>conf</html>'),
  paymentFailedEmail: vi.fn(() => '<html>failed</html>'),
  subscriptionCanceledEmail: vi.fn(() => '<html>canceled</html>'),
  planUpgradedEmail: vi.fn(() => '<html>upgraded</html>'),
  planDowngradedScheduledEmail: vi.fn(() => '<html>downgrade-scheduled</html>'),
  stripeMisconfigAlertEmail: vi.fn(() => '<html>misconfig</html>'),
}))

import { POST } from '@/app/api/stripe/webhook/route'

function makeRequest(body = '{}'): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'valid', 'x-forwarded-for': '1.2.3.4' },
  })
}

function stripeEvent(type: string, data: unknown): Stripe.Event {
  return { id: `evt_${Math.random().toString(36).slice(2)}`, type, data: { object: data } } as unknown as Stripe.Event
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimit.mockReturnValue({ success: true, remaining: 29 })
  mockGetPeriodEnd.mockReturnValue(9999999999)
  // markEventSeen → 'new' (premiere passe)
  mockCreate.mockResolvedValue({ id: 1 })
})

// ════════════════════════════════════════════════════════════════════════════

describe('Webhook Stripe × groupes — subscription.updated', () => {
  it('downgrade infinite→premium : downgradeUserAndClearFields(premium) + recalc palier', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_789',
        customer: 'cus_abc',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium' }, quantity: 1 }] },
      }),
    )
    // previous_attributes vu par la route via prevAttrs.items.data[0].price.id
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_789',
          customer: 'cus_abc',
          status: 'active',
          items: { data: [{ price: { id: 'price_premium' }, quantity: 1 }] },
        },
        previous_attributes: { items: { data: [{ price: { id: 'price_infinite' } }] } },
      },
    } as unknown as Stripe.Event)
    // 1er resolvePlan = previous (infinite), 2e = current (premium)
    mockResolvePlan.mockImplementation((priceId: string) => {
      if (priceId === 'price_infinite') return 'infinite'
      if (priceId === 'price_premium') return 'premium'
      return null
    })
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 42,
          email: 'u@x.com',
          nomSociete: 'Acme',
          plan: 'infinite',
          stripeSubscriptionId: 'sub_789',
          groupe: 7,
        },
      ],
    })

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    // downgradeUserAndClearFields appele avec targetLevel='premium' (PAS gratuit)
    expect(mockDowngrade).toHaveBeenCalledWith(expect.anything(), 42, { targetLevel: 'premium' })
    // recalc palier sur le bon groupeId
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('upgrade premium→infinite : recalc palier seulement (PAS de cleanup)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_789',
          customer: 'cus_abc',
          status: 'active',
          items: { data: [{ price: { id: 'price_infinite' }, quantity: 1 }] },
          latest_invoice: 'in_123',
        },
        previous_attributes: { items: { data: [{ price: { id: 'price_premium' } }] } },
      },
    } as unknown as Stripe.Event)
    mockResolvePlan.mockImplementation((priceId: string) => {
      if (priceId === 'price_infinite') return 'infinite'
      if (priceId === 'price_premium') return 'premium'
      return null
    })
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 42,
          email: 'u@x.com',
          nomSociete: 'Acme',
          plan: 'premium',
          stripeSubscriptionId: 'sub_789',
          groupe: 7,
        },
      ],
    })

    await POST(makeRequest())

    // PAS de downgradeUserAndClearFields (c'est un upgrade, pas un downgrade)
    expect(mockDowngrade).not.toHaveBeenCalled()
    // recalc palier appele car le user passe en infinite (compte desormais)
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('status=canceled : downgradeUser (gratuit) + recalc palier', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_789',
        customer: 'cus_abc',
        status: 'canceled',
      }),
    )
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 42,
          email: 'u@x.com',
          nomSociete: 'Acme',
          plan: 'infinite',
          stripeSubscriptionId: 'sub_789',
          groupe: 7,
        },
      ],
    })

    await POST(makeRequest())

    // downgradeUser → downgradeUserAndClearFields sans options (defaut gratuit)
    expect(mockDowngrade).toHaveBeenCalledWith(expect.anything(), 42)
    expect(mockDowngrade).toHaveBeenCalledTimes(1)
    // recalc palier sur le bon groupeId (capture AVANT downgrade)
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('user sans groupe : pas de recalc palier (skip silencieux)', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_789',
        customer: 'cus_abc',
        status: 'canceled',
      }),
    )
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 42,
          email: 'u@x.com',
          nomSociete: 'Acme',
          plan: 'premium',
          stripeSubscriptionId: 'sub_789',
          groupe: null,
        },
      ],
    })

    await POST(makeRequest())

    expect(mockDowngrade).toHaveBeenCalled()
    expect(mockRecalc).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════

describe('Webhook Stripe × groupes — subscription.deleted', () => {
  it('subscription.deleted : downgrade + recalc palier sur le bon groupeId', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.deleted', {
        id: 'sub_789',
        customer: 'cus_abc',
        metadata: {},
      }),
    )
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 42,
          email: 'u@x.com',
          nomSociete: 'Acme',
          plan: 'infinite',
          stripeSubscriptionId: 'sub_789',
          groupe: { id: 7, nom: 'Mon Groupe' }, // depth>=1 — populated object
        },
      ],
    })

    await POST(makeRequest())

    expect(mockDowngrade).toHaveBeenCalledWith(expect.anything(), 42)
    // groupeId extrait de l'objet populated
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('subscription.deleted "stale" (sub != user.stripeSubscriptionId) : no-op', async () => {
    // Bug B1 protection : pendant un upgrade premium→infinite, l'ancienne sub
    // est canceled APRES le save de la nouvelle. Cet event "stale" doit etre
    // ignore sinon il wipe le plan fraichement applique.
    mockConstructEvent.mockReturnValue(
      stripeEvent('customer.subscription.deleted', {
        id: 'sub_OLD',
        customer: 'cus_abc',
        metadata: {},
      }),
    )
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 42,
          email: 'u@x.com',
          nomSociete: 'Acme',
          plan: 'infinite',
          stripeSubscriptionId: 'sub_NEW', // sub courante differente
          groupe: 7,
        },
      ],
    })

    await POST(makeRequest())

    // Pas de downgrade ni de recalc : l'event stale doit etre ignore
    expect(mockDowngrade).not.toHaveBeenCalled()
    expect(mockRecalc).not.toHaveBeenCalled()
  })
})
