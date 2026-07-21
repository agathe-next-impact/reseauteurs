/**
 * Tests — POST /api/stripe/checkout (modèle 3-entités, ADR-0011→0016)
 *
 * Route unifiée pour les 3 produits Subscription :
 *   - reseau_partenaire    : organisateur propriétaire d'une tête de réseau
 *   - partenaire_annonceur : admin OU propriétaire de la fiche partenaire
 *   - reseauteur_plus      : réseauteur (abonnement individuel, ADR-0013)
 *
 * Le checkout ne pose AUCUN drapeau payant en DB — c'est le webhook
 * checkout.session.completed qui le fait (§11). Ici on vérifie uniquement
 * l'autorisation, la validation Zod et la construction de la session Stripe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockAuth,
  mockFindByID,
  mockUpdate,
  mockCustomersCreate,
  mockSubscriptionsRetrieve,
  mockSessionsCreate,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindByID: vi.fn(),
  mockUpdate: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSessionsCreate: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 9 })),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    auth: mockAuth,
    findByID: mockFindByID,
    update: mockUpdate,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Spread du module réel : PALIERS_NATIONAL / PRODUITS restent authentiques,
// seul le client `stripe` est mocké.
vi.mock('@/lib/stripe', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/stripe')>()),
  stripe: {
    customers: { create: mockCustomersCreate },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    checkout: { sessions: { create: mockSessionsCreate } },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
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
    mockRateLimit.mockReturnValue({ success: true, remaining: 9 })
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    delete process.env.STRIPE_PRICE_NATIONAL_STARTER
    delete process.env.STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID
    delete process.env.STRIPE_PLUS_PRICE_ID
  })

  it('returns 401 when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })

    const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Non authentifié' })
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 })

    const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

    expect(res.status).toBe(429)
  })

  it('returns 400 when body fails Zod validation (unknown type)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })

    const res = await POST(makeRequest({ type: 'licences_pack' }))

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe('Paramètres invalides')
  })

  // ── reseau_partenaire ────────────────────────────────────────────────────

  describe('type=reseau_partenaire', () => {
    it('returns 403 when the caller is not organisateur/admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockResolvedValue({ id: 1, email: 'a@b.com', role: 'reseauteur' })

      const res = await POST(makeRequest({ type: 'reseau_partenaire', reseauId: '5' }))

      expect(res.status).toBe(403)
    })

    it('returns 404 when the network does not exist', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return null
        return { id: 1, email: 'a@b.com', role: 'organisateur' }
      })

      const res = await POST(makeRequest({ type: 'reseau_partenaire', reseauId: '999' }))

      expect(res.status).toBe(404)
    })

    it('returns 400 when the network is a local group (not a tête de réseau)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'local', user: 1 }
        return { id: 1, email: 'a@b.com', role: 'organisateur' }
      })

      const res = await POST(makeRequest({ type: 'reseau_partenaire', reseauId: '5' }))

      expect(res.status).toBe(400)
    })

    it('returns 403 when the organisateur does not own the network', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'national', user: 999 }
        return { id: 1, email: 'a@b.com', role: 'organisateur' }
      })

      const res = await POST(makeRequest({ type: 'reseau_partenaire', reseauId: '5' }))

      expect(res.status).toBe(403)
    })

    it('returns 500 when the palier priceId is not configured', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'national', user: 1 }
        return { id: 1, email: 'a@b.com', role: 'organisateur' }
      })
      // STRIPE_PRICE_NATIONAL_STARTER volontairement absent (beforeEach)

      const res = await POST(
        makeRequest({ type: 'reseau_partenaire', reseauId: '5', palier: 'starter' }),
      )

      expect(res.status).toBe(500)
    })

    it('returns 409 when an active subscription already exists on the network', async () => {
      process.env.STRIPE_PRICE_NATIONAL_STARTER = 'price_starter'
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return { id: 5, niveau: 'national', user: 1, stripeSubscriptionId: 'sub_existing' }
        }
        return { id: 1, email: 'a@b.com', role: 'organisateur' }
      })
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active' })

      const res = await POST(
        makeRequest({ type: 'reseau_partenaire', reseauId: '5', palier: 'starter' }),
      )

      expect(res.status).toBe(409)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('already_active')
    })

    it('creates a checkout session with subscription metadata for the chosen palier', async () => {
      process.env.STRIPE_PRICE_NATIONAL_STARTER = 'price_starter'
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') {
          return { id: 5, niveau: 'national', user: 1, nom: 'BNI' }
        }
        return { id: 1, email: 'a@b.com', role: 'organisateur', stripeCustomerId: 'cus_1' }
      })
      mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_reseau' })

      const res = await POST(
        makeRequest({ type: 'reseau_partenaire', reseauId: '5', palier: 'starter' }),
      )

      expect(res.status).toBe(200)
      expect(mockCustomersCreate).not.toHaveBeenCalled()
      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_1',
          mode: 'subscription',
          line_items: [{ price: 'price_starter', quantity: 1 }],
          metadata: expect.objectContaining({
            type: 'reseau_partenaire',
            reseauId: '5',
            palier: 'starter',
          }),
        }),
      )
      expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/session_reseau' })
    })

    it('creates a Stripe customer when the organisateur has none yet', async () => {
      process.env.STRIPE_PRICE_NATIONAL_STARTER = 'price_starter'
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'reseaux') return { id: 5, niveau: 'national', user: 1 }
        return { id: 1, email: 'a@b.com', role: 'organisateur' }
      })
      mockCustomersCreate.mockResolvedValue({ id: 'cus_new' })
      mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_new' })

      const res = await POST(
        makeRequest({ type: 'reseau_partenaire', reseauId: '5', palier: 'starter' }),
      )

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
    })
  })

  // ── partenaire_annonceur ─────────────────────────────────────────────────

  describe('type=partenaire_annonceur', () => {
    it('returns 404 when the fiche partenaire does not exist', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'partenaires') return null
        return { id: 1, email: 'a@b.com', role: 'admin' }
      })

      const res = await POST(makeRequest({ type: 'partenaire_annonceur', partenaireId: '12' }))

      expect(res.status).toBe(404)
    })

    it('returns 403 when the caller does not own the fiche and is not admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'partenaires') return { id: 12, user: 999, nom: 'ACME' }
        return { id: 1, email: 'a@b.com', role: 'partenaire' }
      })

      const res = await POST(makeRequest({ type: 'partenaire_annonceur', partenaireId: '12' }))

      expect(res.status).toBe(403)
    })

    it('returns 500 when STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID is not configured', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'partenaires') return { id: 12, user: 1, nom: 'ACME' }
        return { id: 1, email: 'a@b.com', role: 'partenaire' }
      })

      const res = await POST(makeRequest({ type: 'partenaire_annonceur', partenaireId: '12' }))

      expect(res.status).toBe(500)
    })

    it('creates a checkout session with partenaire_annonceur metadata', async () => {
      process.env.STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID = 'price_annonceur'
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'partenaires') {
          return { id: 12, user: 1, nom: 'ACME', stripeCustomerId: 'cus_partenaire' }
        }
        return { id: 1, email: 'a@b.com', role: 'partenaire', stripeCustomerId: 'cus_partenaire' }
      })
      mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_annonceur' })

      const res = await POST(makeRequest({ type: 'partenaire_annonceur', partenaireId: '12' }))

      expect(res.status).toBe(200)
      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_partenaire',
          mode: 'subscription',
          line_items: [{ price: 'price_annonceur', quantity: 1 }],
          metadata: { type: 'partenaire_annonceur', partenaireId: '12' },
        }),
      )
    })
  })

  // ── reseauteur_plus (ADR-0013) ───────────────────────────────────────────

  describe('type=reseauteur_plus', () => {
    it('returns 403 when the caller is not a reseauteur', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockResolvedValue({ id: 1, email: 'a@b.com', role: 'organisateur' })

      const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

      expect(res.status).toBe(403)
    })

    it('returns 409 when the account is already Plus', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        role: 'reseauteur',
        plusActif: true,
      })

      const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

      expect(res.status).toBe(409)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('already_active')
    })

    it('returns 500 when STRIPE_PLUS_PRICE_ID is not configured', async () => {
      mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
      mockFindByID.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        role: 'reseauteur',
        plusActif: false,
      })

      const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

      expect(res.status).toBe(500)
    })

    it('creates a checkout session with reseauteur_plus metadata', async () => {
      process.env.STRIPE_PLUS_PRICE_ID = 'price_plus'
      mockAuth.mockResolvedValue({ user: { id: 42, email: 'membre@test.fr' } })
      mockFindByID.mockResolvedValue({
        id: 42,
        email: 'membre@test.fr',
        role: 'reseauteur',
        plusActif: false,
        stripeCustomerId: 'cus_42',
      })
      mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_plus' })

      const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

      expect(res.status).toBe(200)
      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_42',
          mode: 'subscription',
          line_items: [{ price: 'price_plus', quantity: 1 }],
          metadata: { type: 'reseauteur_plus', userId: '42' },
        }),
      )
      expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/session_plus' })
    })
  })

  it('returns 500 when Stripe throws an error', async () => {
    process.env.STRIPE_PLUS_PRICE_ID = 'price_plus'
    mockAuth.mockResolvedValue({ user: { id: 1, email: 'a@b.com' } })
    mockFindByID.mockResolvedValue({
      id: 1,
      email: 'a@b.com',
      role: 'reseauteur',
      plusActif: false,
      stripeCustomerId: 'cus_1',
    })
    mockSessionsCreate.mockRejectedValue(new Error('Stripe is down'))

    const res = await POST(makeRequest({ type: 'reseauteur_plus' }))

    expect(res.status).toBe(500)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toBeDefined()
  })
})
