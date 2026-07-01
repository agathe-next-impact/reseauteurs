/**
 * Tests — Webhook Stripe B2B (ADR-0011)
 *
 * Chemins critiques :
 * 1. checkout.session.completed reseau_partenaire → partenaire=true sur le réseau
 * 2. checkout.session.completed evenement_premium → IGNORÉ (Premium supprimé — ADR-0012 §3)
 * 3. checkout.session.completed partenaire_annonceur → statut=actif sur partenaire
 * 4. subscription.updated (active) → renouvelle partenaire
 * 5. subscription.updated (canceled) → désactive partenaire
 * 6. subscription.deleted → désactive partenaire/annonceur
 * 7. Idempotence : même eventId rejeté silencieusement (UNIQUE constraint)
 * 8. Signature manquante → 400
 * 9. Signature invalide → 400
 * 10. Rate limit → 429
 *
 * Note : les tests B2B couvrent le nouveau flux ; stripe-webhook.int.spec.ts
 * (modèle PanoramaPub) peut être supprimé en V2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockUpdate,
  mockFind,
  mockFindByID,
  mockCreate,
  mockSendEmail,
  mockConstructEvent,
  mockRateLimit,
  mockSubscriptionsRetrieve,
  mockCustomersRetrieve,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockFind: vi.fn(),
  mockFindByID: vi.fn(),
  mockCreate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 29 })),
  mockSubscriptionsRetrieve: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
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
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    customers: { retrieve: mockCustomersRetrieve },
  },
  getSubscriptionPeriodEnd: vi.fn((sub: { current_period_end?: number }) => sub?.current_period_end ?? null),
  // Le webhook dérive le palier depuis le priceId de la subscription (ADR-0012 §3 — Q5)
  // via resolvePalierFromSubscription → getPalierFromPriceId. En test, on neutralise (null) :
  // le palier exact n'est pas requis pour les assertions d'activation ci-dessous.
  getPalierFromPriceId: vi.fn(() => null),
  // ADR-0012 §3 : 'evenement_premium' n'est plus un produit B2B → retourne null (flux ignoré).
  resolveProduitFromMetadata: vi.fn((metadata: Record<string, string | null | undefined> | null | undefined) => {
    const t = metadata?.type
    if (t === 'reseau_partenaire') return 'reseauPartenaire'
    if (t === 'partenaire_annonceur') return 'partenaireAnnonceur'
    return null
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('@/lib/emails', () => ({
  subscriptionConfirmationEmail: vi.fn(() => '<html>ok</html>'),
  subscriptionCanceledEmail: vi.fn(() => '<html>canceled</html>'),
  paymentFailedEmail: vi.fn(() => '<html>fail</html>'),
  stripeMisconfigAlertEmail: vi.fn(() => '<html>misconfig</html>'),
}))

vi.mock('@/lib/email-sender', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  hashUserId: vi.fn((id) => `hash-${id}`),
  logPlanChange: vi.fn(),
}))

vi.mock('@/lib/site', () => ({
  CONTACT_EMAIL: 'contact@reseauteurs.fr',
  SITE_NAME: 'RÉSEAUTEURS',
  SITE_URL: 'https://reseauteurs.fr',
}))

// Import après les mocks
import { POST } from '@/app/api/stripe/webhook/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

let eventCounter = 0

function makeRequest(body = '{}', sig: string | null = 'valid-sig'): Request {
  const hdrs: Record<string, string> = { 'x-forwarded-for': '1.2.3.4' }
  if (sig !== null) hdrs['stripe-signature'] = sig
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: hdrs,
  })
}

function stripeEvent(
  type: string,
  data: unknown,
  eventId?: string,
): Stripe.Event {
  return {
    id: eventId ?? `evt_${++eventCounter}`,
    type,
    data: { object: data },
  } as unknown as Stripe.Event
}

// Simule subscription Stripe minimale
function mockSubscription(id: string, periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600): Stripe.Subscription {
  return {
    id,
    status: 'active',
    metadata: {},
    items: { data: [{ price: { id: 'price_partenaire' } }] },
    current_period_end: periodEnd,
  } as unknown as Stripe.Subscription
}

// Simule une contrainte UNIQUE (idempotence Postgres)
class UniqueConstraintError extends Error {
  constructor() {
    super('duplicate key value violates unique constraint')
    this.name = 'UniqueConstraintError'
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook — B2B ADR-0011', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 29 })
    // Par défaut, markEventSeen réussit (pas encore vu)
    mockCreate.mockResolvedValue({ id: 1 })
    mockFind.mockResolvedValue({ docs: [] })
    mockUpdate.mockResolvedValue({})
    mockFindByID.mockResolvedValue({ id: 1, email: 'test@test.fr', nomSociete: 'Test' })
    mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription('sub_test'))
  })

  // ── Sécurité ─────────────────────────────────────────────────────────────

  describe('Sécurité', () => {
    it('retourne 400 si stripe-signature manquante', async () => {
      const res = await POST(makeRequest('{}', null))
      expect(res.status).toBe(400)
      const body = await res.json() as { error?: string }
      // Le message contient "Signature" ou "signature" ou "manquante"
      expect(body.error?.toLowerCase()).toMatch(/signature|manquante/)
    })

    it('retourne 400 si la signature est invalide', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Signature invalide')
      })
      const res = await POST(makeRequest())
      expect(res.status).toBe(400)
    })

    it('retourne 429 si rate limit dépassé', async () => {
      mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 })
      mockConstructEvent.mockReturnValue(stripeEvent('checkout.session.completed', {}))
      const res = await POST(makeRequest())
      expect(res.status).toBe(429)
    })
  })

  // ── Idempotence ───────────────────────────────────────────────────────────

  describe('Idempotence', () => {
    it('retourne 200 silencieux si l\'event a déjà été traité (UNIQUE constraint)', async () => {
      // markEventSeen simule une erreur de contrainte UNIQUE → event déjà vu
      mockCreate.mockRejectedValueOnce(new UniqueConstraintError())

      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          id: 'cs_test_dup',
          metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
          customer: 'cus_123',
          mode: 'subscription',
          subscription: 'sub_456',
        })
      )

      const res = await POST(makeRequest())

      expect(res.status).toBe(200)
      const body = await res.json() as { duplicate?: boolean }
      expect(body.duplicate).toBe(true)
      // L'update ne doit PAS avoir été appelé (event idempotent → skip)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // ── checkout.session.completed : réseau partenaire ─────────────────────────

  describe('checkout.session.completed — reseau_partenaire', () => {
    it('pose partenaire=true sur le réseau avec partenaireExpireAt', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600

      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          id: 'cs_test_reseau',
          metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
          customer: 'cus_123',
          mode: 'subscription',
          subscription: 'sub_456',
          customer_details: { address: null, name: null, tax_ids: [] },
        })
      )

      mockSubscriptionsRetrieve.mockResolvedValue({
        ...mockSubscription('sub_456', periodEnd),
        metadata: { type: 'reseau_partenaire', reseauId: '5', userId: '99' },
      })

      mockFindByID.mockResolvedValue({
        id: 99,
        email: 'orga@test.fr',
        nomSociete: 'Mon Réseau',
      })

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      // Le réseau doit être mis à jour avec partenaire=true
      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeDefined()
      expect((reseauUpdate![0] as { id?: string | number }).id).toBe('5')
      expect((reseauUpdate![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(true)
      expect((reseauUpdate![0] as { data: { stripeSubscriptionId?: string } }).data.stripeSubscriptionId).toBe('sub_456')
      expect((reseauUpdate![0] as { data: { partenaireExpireAt?: string } }).data.partenaireExpireAt).toBeDefined()
    })

    it('ne fait rien si reseauId est absent de la metadata', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'reseau_partenaire' }, // reseauId manquant
          customer: 'cus_123',
          mode: 'subscription',
          subscription: 'sub_456',
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)
      // Aucun update sur reseaux
      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeUndefined()
    })
  })

  // ── checkout.session.completed : événement premium SUPPRIMÉ (ADR-0012 §3) ──
  // Le flux Premium ponctuel est retiré : resolveProduitFromMetadata('evenement_premium')
  // retourne null, le webhook ignore le checkout (200) et ne touche AUCUN événement.

  describe('checkout.session.completed — evenement_premium (SUPPRIMÉ ADR-0012)', () => {
    it('ignore le checkout evenement_premium — 200 sans toucher aux événements', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          id: 'cs_test_premium_abc',
          metadata: { type: 'evenement_premium', evenementId: '77' },
          customer: 'cus_123',
          mode: 'payment',
          payment_status: 'paid',
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      // ADR-0012 §3 : Premium supprimé → aucun update d'événement (champ `premium` droppé).
      const eventUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'evenements'
      )
      expect(eventUpdate).toBeUndefined()
      // Le produit n'est pas résolu → flux entièrement ignoré, aucun update.
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // ── checkout.session.completed : partenaire annonceur ─────────────────────

  describe('checkout.session.completed — partenaire_annonceur', () => {
    it('pose statut=actif sur le partenaire annonceur', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600

      mockConstructEvent.mockReturnValue(
        stripeEvent('checkout.session.completed', {
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
          customer: 'cus_ann_123',
          mode: 'subscription',
          subscription: 'sub_ann_456',
        })
      )

      mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription('sub_ann_456', periodEnd))

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const partenaireUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'partenaires'
      )
      expect(partenaireUpdate).toBeDefined()
      expect((partenaireUpdate![0] as { id?: string | number }).id).toBe('12')
      expect((partenaireUpdate![0] as { data: { statut?: string } }).data.statut).toBe('actif')
      expect((partenaireUpdate![0] as { data: { stripeSubscriptionId?: string } }).data.stripeSubscriptionId).toBe('sub_ann_456')
    })
  })

  // ── customer.subscription.updated ─────────────────────────────────────────

  describe('customer.subscription.updated', () => {
    it('renouvelle le partenariat réseau sur status=active (via subscriptionId lookup)', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600

      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'active',
          metadata: { type: 'reseau_partenaire' }, // pas de reseauId → fallback lookup
          items: { data: [{ price: { id: 'price_partenaire' } }] },
          current_period_end: periodEnd,
        })
      )

      // findReseauBySubscriptionId retourne le réseau
      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return { docs: [{ id: 5, stripeSubscriptionId: 'sub_456', partenaire: false }] }
        }
        return { docs: [] }
      })

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeDefined()
      expect((reseauUpdate![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(true)
    })

    it('désactive le partenariat réseau sur status=canceled', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'canceled',
          metadata: { type: 'reseau_partenaire', reseauId: '5' },
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeDefined()
      expect((reseauUpdate![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(false)
    })

    it('désactive le partenariat réseau sur status=unpaid', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'unpaid',
          metadata: { type: 'reseau_partenaire', reseauId: '5' },
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeDefined()
      expect((reseauUpdate![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(false)
    })

    it('renouvelle le statut partenaire annonceur sur status=active', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 365 * 24 * 3600

      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.updated', {
          id: 'sub_ann_456',
          customer: 'cus_ann_123',
          status: 'active',
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
          items: { data: [{ price: { id: 'price_annonceur' } }] },
          current_period_end: periodEnd,
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const partenaireUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'partenaires'
      )
      expect(partenaireUpdate).toBeDefined()
      expect((partenaireUpdate![0] as { data: { statut?: string } }).data.statut).toBe('actif')
    })
  })

  // ── customer.subscription.deleted ─────────────────────────────────────────

  describe('customer.subscription.deleted', () => {
    it('désactive le partenariat réseau sur subscription.deleted', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_456',
          customer: 'cus_123',
          metadata: { type: 'reseau_partenaire', reseauId: '5' },
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeDefined()
      expect((reseauUpdate![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(false)
    })

    it('désactive le partenaire annonceur sur subscription.deleted', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_ann_456',
          customer: 'cus_ann_123',
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
        })
      )

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const partenaireUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'partenaires'
      )
      expect(partenaireUpdate).toBeDefined()
      expect((partenaireUpdate![0] as { data: { statut?: string } }).data.statut).toBe('expire')
    })

    it('désactive via subscriptionId lookup si metadata.reseauId absent', async () => {
      mockConstructEvent.mockReturnValue(
        stripeEvent('customer.subscription.deleted', {
          id: 'sub_456',
          customer: 'cus_123',
          metadata: { type: 'reseau_partenaire' }, // reseauId manquant → lookup
        })
      )

      mockFind.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return { docs: [{ id: 5, stripeSubscriptionId: 'sub_456' }] }
        }
        return { docs: [] }
      })

      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const reseauUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { collection?: string }).collection === 'reseaux'
      )
      expect(reseauUpdate).toBeDefined()
      expect((reseauUpdate![0] as { data: { partenaire?: boolean } }).data.partenaire).toBe(false)
    })
  })

  // ── Événement inconnu / non géré ──────────────────────────────────────────

  it('retourne 200 pour les events non gérés', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('payment_intent.created', { id: 'pi_123' })
    )
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const reseauUpdate = mockUpdate.mock.calls.find(
      (c) => (c[0] as { collection?: string }).collection === 'reseaux'
    )
    expect(reseauUpdate).toBeUndefined()
  })

  it('retourne 200 pour checkout avec type inconnu dans metadata', async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', {
        metadata: { type: 'premium_membre_39' }, // Ancien type caduc
        customer: 'cus_123',
        mode: 'subscription',
        subscription: 'sub_456',
      })
    )
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // Aucun update sur les collections B2B
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
