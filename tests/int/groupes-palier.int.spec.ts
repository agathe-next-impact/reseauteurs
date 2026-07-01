import { describe, it, expect, vi, beforeEach } from 'vitest'

// On mocke le module '@/lib/stripe' AVANT d'importer lib/groupes (qui importe
// stripe) pour eviter qu'un appel a stripe.subscriptions.update ne parte pour
// de vrai pendant les tests.

const { mockSubsUpdate } = vi.hoisted(() => ({
  mockSubsUpdate: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { update: mockSubsUpdate },
  },
}))

import {
  calculerPalierGroupe,
  couponIdForPalier,
  palierProjeteAvecUtilisateurPayant,
} from '@/lib/groupes'
import type { Payload } from 'payload'

type CountArgs = { collection: string; where: unknown }
type CountFn = (args: CountArgs) => Promise<{ totalDocs: number }>

function makePayloadMockWithCounter(
  counter: (args: CountArgs) => number,
): { payload: Payload; calls: CountArgs[] } {
  const calls: CountArgs[] = []
  const count: CountFn = async (args) => {
    calls.push(args)
    return { totalDocs: counter(args) }
  }
  return {
    payload: { count } as unknown as Payload,
    calls,
  }
}

// Helper pour fixer un compteur d'Infinite par groupe.
function makePayloadMock(infiniteCount: number): Payload {
  const { payload } = makePayloadMockWithCounter(() => infiniteCount)
  return payload
}

// ── calculerPalierGroupe — seuils de palier ─────────────────────────────────
describe('calculerPalierGroupe — seuils de palier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    { count: 0, expected: '0' },
    { count: 1, expected: '0' },
    { count: 2, expected: '0' },
    // Bascule 0 → 5 % a 3 membres Infinite
    { count: 3, expected: '5' },
    { count: 4, expected: '5' },
    // Bascule 5 → 10 % a 5 membres Infinite (regression B2)
    { count: 5, expected: '10' },
    { count: 6, expected: '10' },
    { count: 9, expected: '10' },
    // Bascule 10 → 15 % a 10 membres Infinite
    { count: 10, expected: '15' },
    { count: 42, expected: '15' },
  ])('$count membre(s) Infinite → palier $expected', async ({ count, expected }) => {
    const payload = makePayloadMock(count)
    const { palier, membresPayants } = await calculerPalierGroupe(payload, 'grp-1')
    expect(palier).toBe(expected)
    expect(membresPayants).toBe(count)
  })
})

// ── calculerPalierGroupe — filtrage Infinite uniquement ─────────────────────
describe('calculerPalierGroupe — filtre `plan: infinite`', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emet une requete payload.count avec where { groupe AND plan=infinite }', async () => {
    const { payload, calls } = makePayloadMockWithCounter(() => 4)
    await calculerPalierGroupe(payload, 'grp-42')
    expect(calls).toHaveLength(1)
    expect(calls[0].collection).toBe('users')
    expect(calls[0].where).toEqual({
      and: [
        { groupe: { equals: 'grp-42' } },
        { plan: { equals: 'infinite' } },
      ],
    })
  })

  it('exclut explicitement les membres premium et gratuit (regle business)', async () => {
    // Si le filtre etait `not_equals: gratuit` (ancienne regle), il y aurait eu
    // un autre operateur dans la clause. On verrouille ici la regle "infinite
    // uniquement" pour qu'un retour en arriere casse le test.
    const { payload, calls } = makePayloadMockWithCounter(() => 0)
    await calculerPalierGroupe(payload, 'grp-1')
    const where = calls[0].where as { and: Array<Record<string, unknown>> }
    const planClause = where.and.find((c) => 'plan' in c) as
      | { plan: Record<string, unknown> }
      | undefined
    expect(planClause).toBeDefined()
    expect(planClause!.plan).toEqual({ equals: 'infinite' })
    // Verrou explicite : aucun usage de not_equals (ancienne regle).
    expect(JSON.stringify(planClause)).not.toContain('not_equals')
  })
})

// ── palierProjeteAvecUtilisateurPayant — projection au checkout ─────────────
describe('palierProjeteAvecUtilisateurPayant — projection palier au checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_COUPON_5_ID = 'coupon_5'
    process.env.STRIPE_COUPON_10_ID = 'coupon_10'
    process.env.STRIPE_COUPON_15_ID = 'coupon_15'
  })

  it('projette +1 si l\'utilisateur n\'est pas encore Infinite dans le groupe', async () => {
    // Simule : groupe a 2 Infinite, user n'est pas dans la liste.
    // La 1ere call (calculerPalierGroupe) compte 2.
    // La 2eme call (alreadyCounted) renvoie 0.
    let n = 0
    const { payload } = makePayloadMockWithCounter(() => {
      n += 1
      return n === 1 ? 2 : 0
    })
    const { palier, couponId } = await palierProjeteAvecUtilisateurPayant(
      payload,
      'grp-1',
      'usr-1',
    )
    // 2 + 1 = 3 → palier 5
    expect(palier).toBe('5')
    expect(couponId).toBe('coupon_5')
  })

  it('ne projette pas +1 si l\'utilisateur est deja Infinite (alreadyCounted=1)', async () => {
    // Simule : groupe a 5 Infinite (le user inclus). alreadyCounted=1 → pas de +1.
    let n = 0
    const { payload } = makePayloadMockWithCounter(() => {
      n += 1
      return n === 1 ? 5 : 1
    })
    const { palier, couponId } = await palierProjeteAvecUtilisateurPayant(
      payload,
      'grp-1',
      'usr-1',
    )
    // 5 sans bump → palier 10
    expect(palier).toBe('10')
    expect(couponId).toBe('coupon_10')
  })

  it('la 2e call (alreadyCounted) verifie aussi plan=infinite', async () => {
    let n = 0
    const { payload, calls } = makePayloadMockWithCounter(() => {
      n += 1
      return n === 1 ? 9 : 0
    })
    await palierProjeteAvecUtilisateurPayant(payload, 'grp-1', 'usr-7')
    expect(calls).toHaveLength(2)
    const secondWhere = calls[1].where as { and: Array<Record<string, unknown>> }
    const planClause = secondWhere.and.find((c) => 'plan' in c)
    expect(planClause).toEqual({ plan: { equals: 'infinite' } })
  })
})

// ── couponIdForPalier — mapping palier → env coupon ─────────────────────────
describe('couponIdForPalier — mapping palier → env coupon', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_COUPON_5_ID: 'coupon_5',
      STRIPE_COUPON_10_ID: 'coupon_10',
      STRIPE_COUPON_15_ID: 'coupon_15',
    }
  })

  it('renvoie null pour palier 0', () => {
    expect(couponIdForPalier('0')).toBeNull()
  })

  it('renvoie le bon coupon pour chaque palier paye', () => {
    expect(couponIdForPalier('5')).toBe('coupon_5')
    expect(couponIdForPalier('10')).toBe('coupon_10')
    expect(couponIdForPalier('15')).toBe('coupon_15')
  })

  it('renvoie null si l\'env var du palier paye n\'est pas definie', () => {
    process.env.STRIPE_COUPON_10_ID = ''
    expect(couponIdForPalier('10')).toBeNull()
  })
})
