import { test, expect, Page } from '@playwright/test'
import { loginAdmin } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const SERVER_URL = 'http://localhost:3000'

test.describe('Admin Panel', () => {
  // La 1re compilation du bundle admin Payload en mode dev (next dev, a la
  // demande) depasse largement les 30s par defaut -> beforeAll/1er test en
  // timeout a froid. On elargit pour absorber ce cout unique.
  test.describe.configure({ timeout: 120_000 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    // Login via la page CUSTOM /login (pas le /admin/login Payload par defaut),
    // avec redirect vers /admin. testUser a role:'admin'.
    await loginAdmin({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  // ── Dashboard ──────────────────────────────────────────────────────────────

  test('can navigate to dashboard', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin`)
    const dashboardArtifact = page.locator('span[title="Dashboard"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  // DashboardWidgets (composant custom, modele 3 entites) — remplace l'ancien
  // tableau PanoramaPub (« Statistiques fournisseurs », « Import CSV »,
  // « Fiches/Evenements en attente », « Abonnements ») aujourd'hui supprime.
  test('dashboard displays DashboardWidgets overview section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const heading = page.locator('h3', { hasText: "Vue d’ensemble" })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays moderation section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const heading = page.locator('h3', { hasText: 'Modération des réseauteurs' })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays comptes par role section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const heading = page.locator('h3', { hasText: 'Comptes par rôle' })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays badges section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const heading = page.locator('h3', { hasText: 'Badges déclarés' })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  // ── Sidebar collections (modele 3 entites) ──────────────────────────────────

  test('sidebar shows the 3-entity collections', async () => {
    await page.goto(`${SERVER_URL}/admin`)

    // Collections reelles du modele ADR-0011 (Fournisseurs / CategoriesActivite /
    // TypesEvenement PanoramaPub retires du config Payload).
    const collections = [
      'Users',
      'Reseauteurs',
      'Reseaux',
      'Evenements',
      'Partenaires',
      'Media',
    ]

    for (const col of collections) {
      const link = page.locator(`nav a`, { hasText: col }).first()
      await expect(link).toBeVisible({ timeout: 5_000 })
    }
  })

  // ── List views ─────────────────────────────────────────────────────────────

  test('can navigate to Users list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/users`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin/collections/users`)
    const heading = page.locator('h1', { hasText: 'Users' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Reseauteurs list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/reseauteurs`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin/collections/reseauteurs`)
    const heading = page.locator('h1', { hasText: 'Reseauteurs' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Reseaux list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/reseaux`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin/collections/reseaux`)
    const heading = page.locator('h1', { hasText: 'Reseaux' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Evenements list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/evenements`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin/collections/evenements`)
    const heading = page.locator('h1', { hasText: 'Evenements' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Partenaires list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/partenaires`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin/collections/partenaires`)
    const heading = page.locator('h1', { hasText: 'Partenaires' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Media list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/media`)
    await expect(page).toHaveURL(`${SERVER_URL}/admin/collections/media`)
    const heading = page.locator('h1', { hasText: 'Media' }).first()
    await expect(heading).toBeVisible()
  })

  // ── Create views ───────────────────────────────────────────────────────────

  test('can navigate to User create view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/users/create`)
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const emailField = page.locator('input[name="email"]')
    await expect(emailField).toBeVisible()
  })

  test('can navigate to Reseauteur create view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/reseauteurs/create`)
    await expect(page).toHaveURL(/\/admin\/collections\/reseauteurs\/[a-zA-Z0-9-_]+/)
    // useAsTitle: 'nom' -> le champ #field-nom existe sur le formulaire.
    const nomField = page.locator('#field-nom')
    await expect(nomField).toBeVisible({ timeout: 5_000 })
  })

  // ── AdminNavLinks ──────────────────────────────────────────────────────────

  test('AdminNavLinks shows "Voir le site" link', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const link = page.locator('a', { hasText: 'Voir le site' })
    await expect(link).toBeVisible({ timeout: 5_000 })
    const href = await link.getAttribute('href')
    expect(href).toBe('/')
  })

  test('AdminNavLinks shows "Déconnexion" button', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const button = page.locator('button', { hasText: 'Déconnexion' })
    await expect(button).toBeVisible({ timeout: 5_000 })
  })
})
