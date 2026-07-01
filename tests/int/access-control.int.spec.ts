import { describe, it, expect } from 'vitest'
import { getEffectiveFeatureLevel, getEffectivePlan } from '@/collections/access'

describe('getEffectiveFeatureLevel (3-tier model)', () => {
  it('returns infinite for admin users regardless of plan', () => {
    expect(getEffectiveFeatureLevel({ role: 'admin' })).toBe('infinite')
    expect(getEffectiveFeatureLevel({ role: 'admin', plan: 'gratuit' })).toBe('infinite')
    expect(getEffectiveFeatureLevel({ role: 'admin', plan: 'premium' })).toBe('infinite')
  })

  it('returns gratuit when plan is gratuit', () => {
    expect(getEffectiveFeatureLevel({ plan: 'gratuit' })).toBe('gratuit')
  })

  it('returns gratuit when plan is undefined', () => {
    expect(getEffectiveFeatureLevel({})).toBe('gratuit')
  })

  it('returns premium when plan is premium and not expired', () => {
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    expect(
      getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: nextYear.toISOString() }),
    ).toBe('premium')
  })

  it('returns infinite when plan is infinite and not expired', () => {
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    expect(
      getEffectiveFeatureLevel({ plan: 'infinite', planExpiresAt: nextYear.toISOString() }),
    ).toBe('infinite')
  })

  it('returns gratuit when premium plan expired yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(
      getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: yesterday.toISOString() }),
    ).toBe('gratuit')
  })

  it('returns gratuit when infinite plan expired a month ago', () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    expect(
      getEffectiveFeatureLevel({ plan: 'infinite', planExpiresAt: lastMonth.toISOString() }),
    ).toBe('gratuit')
  })

  it('returns the stored plan when planExpiresAt is null', () => {
    expect(getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: null })).toBe('premium')
    expect(getEffectiveFeatureLevel({ plan: 'infinite', planExpiresAt: null })).toBe('infinite')
  })

  it('returns premium when plan expires tomorrow (edge: still valid)', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(
      getEffectiveFeatureLevel({ plan: 'premium', planExpiresAt: tomorrow.toISOString() }),
    ).toBe('premium')
  })
})

describe('getEffectivePlan (deprecated alias)', () => {
  it('is identical to getEffectiveFeatureLevel', () => {
    expect(getEffectivePlan).toBe(getEffectiveFeatureLevel)
  })
})
