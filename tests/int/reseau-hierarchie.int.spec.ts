/**
 * Tests — Helpers de hiérarchie réseaux national↔local (ADR-0012 E1.2)
 *
 * Source unique de vérité des gates métier (src/lib/reseau-hierarchie.ts).
 * On teste les 7 helpers + maxLocaux, sans DB : les helpers synchrones sont purs,
 * et peutCreerLocalAsync reçoit un `payload` mocké (find/count).
 *
 * Couverture exigée par le « Done » de E1.2 :
 *   - nationalDe (national / local parent populé / local parent non populé → null)
 *   - abonnementActif
 *   - peutPublierEvenement
 *   - peutGererReseau (admin / propriétaire direct / umbrella via parent.user / refus)
 *   - peutGererEvenement (réseau non populé → refus)
 *   - peutCreerLocalAsync (pas de national / national non abonné / capacité dépassée / OK)
 *   - maxLocaux (chaque palier + fallback)
 */
import { describe, it, expect } from 'vitest'
import {
  nationalDe,
  abonnementActif,
  peutPublierEvenement,
  peutGererReseau,
  peutGererEvenement,
  peutCreerLocalAsync,
  maxLocaux,
  PALIERS_CONFIG,
  type ReseauForHierarchy,
} from '@/lib/reseau-hierarchie'

// ── Fabriques de fixtures ───────────────────────────────────────────────────

function national(over: Partial<ReseauForHierarchy> = {}): ReseauForHierarchy {
  return { id: 1, niveau: 'national', partenaire: false, ...over }
}

function local(parent: ReseauForHierarchy | string | number | null, over: Partial<ReseauForHierarchy> = {}): ReseauForHierarchy {
  return { id: 2, niveau: 'local', partenaire: false, parent, ...over }
}

/** Payload minimal mocké pour peutCreerLocalAsync (find → national, count → nb locaux). */
function makePayload(opts: { national?: Record<string, unknown> | null; nbLocaux?: number }) {
  return {
    find: async () => ({
      docs: opts.national ? [opts.national] : [],
      totalDocs: opts.national ? 1 : 0,
    }),
    count: async () => ({ totalDocs: opts.nbLocaux ?? 0 }),
  } as unknown as Parameters<typeof peutCreerLocalAsync>[1]
}

// ── nationalDe ──────────────────────────────────────────────────────────────

describe('nationalDe', () => {
  it('retourne le réseau lui-même si niveau=national', () => {
    const r = national({ id: 10 })
    expect(nationalDe(r)).toBe(r)
  })

  it('traite un niveau absent (données historiques) comme national', () => {
    const r: ReseauForHierarchy = { id: 11, partenaire: true }
    expect(nationalDe(r)).toBe(r)
  })

  it('retourne le parent populé pour un réseau local', () => {
    const parent = national({ id: 1, partenaire: true })
    const l = local(parent, { id: 2 })
    expect(nationalDe(l)).toBe(parent)
  })

  it('retourne null si le parent du local n\'est pas populé (ID seul)', () => {
    expect(nationalDe(local(1))).toBeNull()
    expect(nationalDe(local('abc'))).toBeNull()
    expect(nationalDe(local(null))).toBeNull()
  })
})

// ── abonnementActif ─────────────────────────────────────────────────────────

describe('abonnementActif', () => {
  it('vrai si le national est partenaire', () => {
    expect(abonnementActif(national({ partenaire: true }))).toBe(true)
  })

  it('faux si le national n\'est pas partenaire', () => {
    expect(abonnementActif(national({ partenaire: false }))).toBe(false)
    expect(abonnementActif(national({ partenaire: null }))).toBe(false)
  })

  it('hérite du statut du parent national pour un local (umbrella)', () => {
    expect(abonnementActif(local(national({ partenaire: true })))).toBe(true)
    expect(abonnementActif(local(national({ partenaire: false })))).toBe(false)
  })

  it('faux si le parent du local n\'est pas populé (impossible à résoudre)', () => {
    expect(abonnementActif(local(1, { partenaire: true }))).toBe(false)
  })
})

// ── peutPublierEvenement ────────────────────────────────────────────────────

describe('peutPublierEvenement', () => {
  it('autorise si le national effectif est abonné', () => {
    expect(peutPublierEvenement(national({ partenaire: true }))).toBe(true)
    expect(peutPublierEvenement(local(national({ partenaire: true })))).toBe(true)
  })

  it('refuse si le national effectif n\'est pas abonné', () => {
    expect(peutPublierEvenement(national({ partenaire: false }))).toBe(false)
    expect(peutPublierEvenement(local(national({ partenaire: false })))).toBe(false)
  })
})

// ── peutGererReseau ─────────────────────────────────────────────────────────

describe('peutGererReseau', () => {
  it('autorise un admin sur n\'importe quel réseau', () => {
    expect(peutGererReseau({ id: 99, role: 'admin' }, national({ user: 1 }))).toBe(true)
  })

  it('autorise le propriétaire direct (user relationnel objet ou ID)', () => {
    expect(peutGererReseau({ id: 7 }, national({ user: { id: 7 } }))).toBe(true)
    expect(peutGererReseau({ id: 7 }, national({ user: 7 }))).toBe(true)
    expect(peutGererReseau({ id: '7' }, national({ user: 7 }))).toBe(true) // comparaison souple String()
  })

  it('autorise le national parent (umbrella) sur un local délégué', () => {
    const parent = national({ id: 1, user: { id: 7 } })
    const l = local(parent, { id: 2, user: { id: 999 } }) // local délégué à un autre user
    expect(peutGererReseau({ id: 7 }, l)).toBe(true)
  })

  it('refuse un user non propriétaire et non umbrella', () => {
    expect(peutGererReseau({ id: 7 }, national({ user: 1 }))).toBe(false)
    // local dont ni lui ni le parent ne lui appartiennent
    expect(peutGererReseau({ id: 7 }, local(national({ user: 1 }), { user: 2 }))).toBe(false)
    // umbrella impossible si parent non populé
    expect(peutGererReseau({ id: 7 }, local(1, { user: 2 }))).toBe(false)
  })
})

// ── peutGererEvenement ──────────────────────────────────────────────────────

describe('peutGererEvenement', () => {
  it('refuse si le réseau de l\'événement n\'est pas populé', () => {
    expect(peutGererEvenement({ id: 7 }, { reseau: 5 })).toBe(false)
    expect(peutGererEvenement({ id: 7 }, { reseau: 'abc' })).toBe(false)
    expect(peutGererEvenement({ id: 7 }, { reseau: null })).toBe(false)
  })

  it('autorise un admin même sans réseau populé', () => {
    expect(peutGererEvenement({ id: 7, role: 'admin' }, { reseau: 5 })).toBe(true)
  })

  it('délègue à peutGererReseau sur le réseau populé', () => {
    expect(peutGererEvenement({ id: 7 }, { reseau: national({ user: { id: 7 } }) })).toBe(true)
    expect(peutGererEvenement({ id: 7 }, { reseau: national({ user: { id: 1 } }) })).toBe(false)
  })
})

// ── peutCreerLocalAsync ─────────────────────────────────────────────────────

describe('peutCreerLocalAsync', () => {
  it('refuse si l\'utilisateur ne possède pas de réseau national', async () => {
    const res = await peutCreerLocalAsync(7, makePayload({ national: null }))
    expect(res.autorise).toBe(false)
    expect(res.raison).toMatch(/national/i)
  })

  it('refuse si le national n\'est pas abonné', async () => {
    const res = await peutCreerLocalAsync(
      7,
      makePayload({ national: { id: 1, partenaire: false, palier: 'starter' } }),
    )
    expect(res.autorise).toBe(false)
    expect(res.raison).toMatch(/abonnement/i)
  })

  it('refuse si la capacité du palier est dépassée', async () => {
    // starter = 5 locaux max ; on en a déjà 5
    const res = await peutCreerLocalAsync(
      7,
      makePayload({ national: { id: 1, partenaire: true, palier: 'starter' }, nbLocaux: 5 }),
    )
    expect(res.autorise).toBe(false)
    expect(res.raison).toMatch(/maximum|palier/i)
  })

  it('autorise si national abonné et capacité disponible', async () => {
    const res = await peutCreerLocalAsync(
      7,
      makePayload({ national: { id: 1, partenaire: true, palier: 'growth' }, nbLocaux: 2 }),
    )
    expect(res.autorise).toBe(true)
    expect(res.raison).toBeUndefined()
  })
})

// ── maxLocaux ───────────────────────────────────────────────────────────────

describe('maxLocaux', () => {
  it('retourne le plafond de chaque palier connu', () => {
    expect(maxLocaux('starter')).toBe(PALIERS_CONFIG.starter.maxLocaux)
    expect(maxLocaux('growth')).toBe(PALIERS_CONFIG.growth.maxLocaux)
    expect(maxLocaux('enterprise')).toBe(PALIERS_CONFIG.enterprise.maxLocaux)
  })

  it('retombe sur le palier par défaut (starter) si palier inconnu ou absent', () => {
    const fallback = PALIERS_CONFIG.starter.maxLocaux
    expect(maxLocaux('inconnu')).toBe(fallback)
    expect(maxLocaux(null)).toBe(fallback)
    expect(maxLocaux(undefined)).toBe(fallback)
    expect(maxLocaux('')).toBe(fallback)
  })
})
