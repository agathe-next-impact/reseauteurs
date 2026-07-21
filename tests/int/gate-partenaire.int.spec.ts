/**
 * Tests — Gate serveur partenaire (ADR-0011)
 *
 * Vérifie que la publication d'événements est réservée aux réseaux partenaires.
 * Les assertions sont sur les Server Actions (createEvenement, updateEvenement)
 * qui appliquent la logique serveur.
 *
 * Chemins critiques :
 * 1. Réseau partenaire actif → création d'événement autorisée
 * 2. Réseau non partenaire → création d'événement refusée avec message d'erreur métier
 * 3. Organisateur tente de modifier un événement qui n'est pas le sien → 403
 * 4. Tentative de bypass côté client → refus (autorisation toujours serveur)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockFind, mockCreate, mockUpdate, mockFindByID, mockAuth } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindByID: vi.fn(),
  mockAuth: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(() => ({
    find: mockFind,
    create: mockCreate,
    update: mockUpdate,
    findByID: mockFindByID,
    auth: mockAuth,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Import après les mocks
import { createEvenement, updateEvenement, deleteEvenement } from '@/app/(frontend)/dashboard/(organisateur)/reseau/actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

const validEvenementData = {
  titre: 'Petit-déjeuner networking',
  // Catégorie requise (types-evenement) — la route rejette sans ce champ
  // avec "La catégorie est requise" (cf. EvenementSchema, actions.ts).
  type: 1,
  dateDebut: '2026-09-01T08:30',
  description: 'Un événement test',
  dateFin: '',
  lieuVille: 'Paris',
  lieuNom: 'Hôtel Lutetia',
  lieuAdresse: '45 bd Raspail',
  lienInscription: '',
}

function setupOrganisateur(opts: {
  userId: number
  reseauId: number
  partenaire: boolean
}) {
  mockAuth.mockResolvedValue({ user: { id: opts.userId } })
  mockFindByID.mockResolvedValue({ id: opts.userId, role: 'organisateur' })
  mockFind.mockImplementation(async (args: { collection?: string }) => {
    if (args.collection === 'reseaux') {
      return {
        docs: [{
          id: opts.reseauId,
          nom: 'Mon Réseau Test',
          partenaire: opts.partenaire,
          partenaireExpireAt: opts.partenaire
            ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
            : null,
        }],
      }
    }
    return { docs: [] }
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Gate partenaire — publication d\'événements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: 100, titre: 'Petit-déjeuner networking' })
    mockUpdate.mockResolvedValue({})
  })

  // ── Réseau partenaire actif ───────────────────────────────────────────────

  describe('Réseau partenaire actif (partenaire=true)', () => {
    beforeEach(() => {
      setupOrganisateur({ userId: 1, reseauId: 10, partenaire: true })
    })

    it('permet la création d\'un événement', async () => {
      const result = await createEvenement(validEvenementData)
      expect(result).toEqual(expect.objectContaining({ success: true }))
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'evenements',
          data: expect.objectContaining({
            titre: 'Petit-déjeuner networking',
            statut: 'publie',
            reseau: 10,
          }),
        })
      )
    })

    it('refuse la création si le titre est manquant', async () => {
      const result = await createEvenement({ ...validEvenementData, titre: '' })
      expect(result).toMatchObject({ error: expect.stringContaining('titre') })
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('refuse la création si la date de début est manquante', async () => {
      const result = await createEvenement({ ...validEvenementData, dateDebut: '' })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  // ── Réseau non partenaire ─────────────────────────────────────────────────

  describe('Réseau non partenaire (partenaire=false)', () => {
    beforeEach(() => {
      setupOrganisateur({ userId: 2, reseauId: 20, partenaire: false })
    })

    it('refuse la création d\'un événement avec le message métier', async () => {
      const result = await createEvenement(validEvenementData)
      expect(result).toMatchObject({ error: expect.stringContaining('partenaire') })
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('refuse la mise à jour d\'un événement', async () => {
      const result = await updateEvenement(100, validEvenementData)
      // La gate partenaire doit rejeter avant même la vérification d'ownership
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Non authentifié ───────────────────────────────────────────────────────

  describe('Utilisateur non authentifié', () => {
    it('refuse avec erreur auth', async () => {
      mockAuth.mockResolvedValue({ user: null })
      const result = await createEvenement(validEvenementData)
      expect(result).toMatchObject({ error: expect.stringContaining('authentifi') })
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  // ── Mauvais rôle ──────────────────────────────────────────────────────────

  describe('Réseauteur tente de publier un événement', () => {
    it('refuse avec erreur de rôle', async () => {
      mockAuth.mockResolvedValue({ user: { id: 99 } })
      mockFindByID.mockResolvedValue({ id: 99, role: 'reseauteur' })
      mockFind.mockResolvedValue({ docs: [] })

      const result = await createEvenement(validEvenementData)
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  // ── Vérification ownership événement ─────────────────────────────────────

  describe('Ownership événement', () => {
    it('refuse de modifier un événement appartenant à un autre réseau', async () => {
      setupOrganisateur({ userId: 3, reseauId: 30, partenaire: true })

      // L'événement 200 appartient au réseau 99 (pas au réseau 30)
      mockFindByID.mockImplementation(async (args: { collection?: string; id?: number }) => {
        if (args.collection === 'evenements') {
          return { id: 200, reseau: 99, titre: 'Événement d\'un autre réseau' }
        }
        return { id: args.id, role: 'organisateur' }
      })

      const result = await updateEvenement(200, validEvenementData)
      expect(result).toMatchObject({ error: expect.stringContaining('autorisé') })
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('refuse de supprimer un événement appartenant à un autre réseau', async () => {
      setupOrganisateur({ userId: 3, reseauId: 30, partenaire: true })

      mockFindByID.mockImplementation(async (args: { collection?: string }) => {
        if (args.collection === 'evenements') {
          return { id: 200, reseau: 99 }
        }
        return { id: 3, role: 'organisateur' }
      })

      const result = await deleteEvenement(200)
      expect(result).toMatchObject({ error: expect.stringContaining('autorisé') })
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Hiérarchie national↔local (ADR-0012 §4) ───────────────────────────────
  // La gate de publication s'appuie sur l'abonnement du réseau NATIONAL effectif :
  // un réseau LOCAL hérite du statut de son parent national (umbrella). Le champ
  // `partenaire` du local lui-même est inerte — seul celui du national compte.

  function setupOrganisateurLocal(opts: {
    userId: number
    localId: number
    nationalId: number
    parentPartenaire: boolean
  }) {
    mockAuth.mockResolvedValue({ user: { id: opts.userId } })
    mockFindByID.mockResolvedValue({ id: opts.userId, role: 'organisateur' })
    mockFind.mockImplementation(async (args: { collection?: string }) => {
      if (args.collection === 'reseaux') {
        return {
          docs: [{
            id: opts.localId,
            nom: 'Antenne locale',
            niveau: 'local',
            // Le local n'est jamais "partenaire" lui-même : le statut vit sur le national.
            partenaire: false,
            // depth:1 → le parent national est populé (objet, pas un simple ID).
            parent: {
              id: opts.nationalId,
              niveau: 'national',
              partenaire: opts.parentPartenaire,
              partenaireExpireAt: opts.parentPartenaire
                ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
                : null,
            },
          }],
        }
      }
      return { docs: [] }
    })
  }

  describe('Hiérarchie national↔local (ADR-0012 §4)', () => {
    it('autorise la création quand le parent national est partenaire (umbrella)', async () => {
      setupOrganisateurLocal({ userId: 4, localId: 40, nationalId: 1, parentPartenaire: true })

      const result = await createEvenement(validEvenementData)
      expect(result).toEqual(expect.objectContaining({ success: true }))
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'evenements',
          data: expect.objectContaining({ reseau: 40, statut: 'publie' }),
        })
      )
    })

    it('refuse la création quand le parent national n\'est pas partenaire (message FR)', async () => {
      setupOrganisateurLocal({ userId: 5, localId: 50, nationalId: 2, parentPartenaire: false })

      const result = await createEvenement(validEvenementData)
      expect(result).toMatchObject({ error: expect.stringContaining('partenaire') })
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })
})
