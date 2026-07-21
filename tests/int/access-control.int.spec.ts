import { describe, it, expect } from 'vitest'
import { getEffectiveFeatureLevel, getEffectivePlan } from '@/collections/access'

/**
 * NOTE (réalignement 2026-07-21) : le modèle « 3 paliers gratuit/premium/infinite »
 * de PanoramaPub est CADUC (ADR-0011). `getEffectiveFeatureLevel` est désormais un
 * STUB DÉPRÉCIÉ (src/collections/access.ts:107) conservé uniquement pour la
 * compatibilité de compilation du code legacy. Contrat actuel :
 *   - admin                          → 'premium'
 *   - plan 'developpement'|'premium' → ce plan
 *   - tout le reste (dont undefined) → 'acces'
 *   - planExpiresAt n'a PLUS d'effet (aucune logique d'expiration ici).
 * Ces tests valident le stub tel qu'il existe, pas l'ancien modèle 3-tiers.
 */
describe('getEffectiveFeatureLevel (stub déprécié — ADR-0011)', () => {
  it('returns premium for admin users regardless of plan', () => {
    expect(getEffectiveFeatureLevel({ role: 'admin' })).toBe('premium')
    expect(getEffectiveFeatureLevel({ role: 'admin', plan: 'gratuit' })).toBe('premium')
    expect(getEffectiveFeatureLevel({ role: 'admin', plan: 'premium' })).toBe('premium')
  })

  it("returns 'acces' when plan is undefined", () => {
    expect(getEffectiveFeatureLevel({})).toBe('acces')
  })

  it("returns 'acces' for an unknown/legacy plan value", () => {
    expect(getEffectiveFeatureLevel({ plan: 'gratuit' })).toBe('acces')
    expect(getEffectiveFeatureLevel({ plan: 'infinite' })).toBe('acces')
  })

  it("returns the stored plan when it is 'developpement' or 'premium'", () => {
    expect(getEffectiveFeatureLevel({ plan: 'developpement' })).toBe('developpement')
    expect(getEffectiveFeatureLevel({ plan: 'premium' })).toBe('premium')
  })

  it('ignores planExpiresAt entirely (no expiry logic in the stub)', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)

    // Expired or not, the stored plan is returned verbatim.
    expect(
      getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: yesterday.toISOString() }),
    ).toBe('premium')
    expect(
      getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: nextYear.toISOString() }),
    ).toBe('premium')
    expect(
      getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: null }),
    ).toBe('premium')
  })
})

describe('getEffectivePlan (deprecated alias)', () => {
  it('is identical to getEffectiveFeatureLevel', () => {
    expect(getEffectivePlan).toBe(getEffectiveFeatureLevel)
  })
})
