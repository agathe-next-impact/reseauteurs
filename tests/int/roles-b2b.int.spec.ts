/**
 * Tests — Rôles et auto-création réseauteur (ADR-0011)
 *
 * Chemins critiques :
 * 1. Badge dérivé : 0-1 → bronze, 2-5 → argent, 6-10 → gold, >10 → platinum
 * 2. Validation Zod du profil réseauteur (champs requis, facultatifs, limites)
 * 3. Stripe lazy : PRODUITS sans accès ENV ne crash pas à l'import
 * 4. resolveProduitFromMetadata discrimine les 2 produits B2B (ADR-0012 — Premium supprimé)
 */
import { describe, it, expect, vi } from 'vitest'

// ── Badges ────────────────────────────────────────────────────────────────────

import { deriverBadge } from '@/lib/badge'

describe('deriverBadge — déclaratif (ADR-0011 §5)', () => {
  it('retourne bronze pour 0', () => expect(deriverBadge(0)).toBe('bronze'))
  it('retourne bronze pour 1', () => expect(deriverBadge(1)).toBe('bronze'))
  it('retourne argent pour 2', () => expect(deriverBadge(2)).toBe('argent'))
  it('retourne argent pour 5', () => expect(deriverBadge(5)).toBe('argent'))
  it('retourne gold pour 6', () => expect(deriverBadge(6)).toBe('gold'))
  it('retourne gold pour 10', () => expect(deriverBadge(10)).toBe('gold'))
  it('retourne platinum pour 11', () => expect(deriverBadge(11)).toBe('platinum'))
  it('retourne platinum pour 100', () => expect(deriverBadge(100)).toBe('platinum'))
  // Valeurs limites et cas dégénérés : une valeur négative est invalide → null (contrat lib/badge.ts)
  it('retourne null pour une valeur négative (contrat lib/badge.ts)', () =>
    expect(deriverBadge(-1)).toBeNull())
})

// ── Stripe lazy init ──────────────────────────────────────────────────────────

describe('stripe.ts — lazy init (pas de crash sans ENV)', () => {
  it('importe sans lever d\'exception même si STRIPE_SECRET_KEY est absent', async () => {
    // On retire la clé et vérifie que l'import ne crash pas
    const originalKey = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY

    await expect(import('@/lib/stripe')).resolves.toBeDefined()

    if (originalKey) process.env.STRIPE_SECRET_KEY = originalKey
  })

  it('expose PRODUITS avec les 2 produits B2B (ADR-0012 — Premium supprimé)', async () => {
    const { PRODUITS } = await import('@/lib/stripe')
    expect(PRODUITS).toHaveProperty('reseauPartenaire')
    expect(PRODUITS).toHaveProperty('partenaireAnnonceur')
    // Événement Premium ponctuel supprimé (ADR-0012 §3)
    expect(PRODUITS).not.toHaveProperty('evenementPremium')
    // Les deux produits restants sont des abonnements (subscription)
    expect(PRODUITS.reseauPartenaire.mode).toBe('subscription')
    expect(PRODUITS.partenaireAnnonceur.mode).toBe('subscription')
    // L'abonnement national résout son prix par palier (ADR-0012 §3 — Q5)
    expect(typeof PRODUITS.reseauPartenaire.priceIdForPalier).toBe('function')
  })

  it('n\'expose PAS les anciens produits freemium (premium 99€, infinite 219€)', async () => {
    const stripeModule = await import('@/lib/stripe')
    const mod = stripeModule as Record<string, unknown>
    // Ces exports ne doivent plus exister
    expect(mod.PLANS).toBeUndefined()
    expect(mod.PaidPlan).toBeUndefined()
    expect(mod.resolvePlanFromPriceId).toBeUndefined()
    expect(mod.planLabel).toBeUndefined()
  })
})

// ── resolveProduitFromMetadata ─────────────────────────────────────────────────

describe('resolveProduitFromMetadata', () => {
  // La fonction retourne les clés camelCase de PRODUITS (pas les valeurs snake_case des metadata)
  it('retourne reseauPartenaire pour type=reseau_partenaire', async () => {
    const { resolveProduitFromMetadata } = await import('@/lib/stripe')
    expect(resolveProduitFromMetadata({ type: 'reseau_partenaire' })).toBe('reseauPartenaire')
  })

  it('retourne null pour type=evenement_premium (ADR-0012 — Premium supprimé)', async () => {
    const { resolveProduitFromMetadata } = await import('@/lib/stripe')
    expect(resolveProduitFromMetadata({ type: 'evenement_premium' })).toBeNull()
  })

  it('retourne partenaireAnnonceur pour type=partenaire_annonceur', async () => {
    const { resolveProduitFromMetadata } = await import('@/lib/stripe')
    expect(resolveProduitFromMetadata({ type: 'partenaire_annonceur' })).toBe('partenaireAnnonceur')
  })

  it('retourne null pour un type inconnu (ex: premium_membre de l\'ancien modèle)', async () => {
    const { resolveProduitFromMetadata } = await import('@/lib/stripe')
    expect(resolveProduitFromMetadata({ type: 'premium_membre' })).toBeNull()
    expect(resolveProduitFromMetadata({ type: 'infinite' })).toBeNull()
    expect(resolveProduitFromMetadata({ type: 'premium' })).toBeNull()
  })

  it('retourne null si metadata est null/undefined/vide', async () => {
    const { resolveProduitFromMetadata } = await import('@/lib/stripe')
    expect(resolveProduitFromMetadata(null)).toBeNull()
    expect(resolveProduitFromMetadata(undefined)).toBeNull()
    expect(resolveProduitFromMetadata({})).toBeNull()
  })
})
