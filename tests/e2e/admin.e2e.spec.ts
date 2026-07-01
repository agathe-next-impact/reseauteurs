import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const SERVER_URL = 'http://localhost:3000'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
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

  test('dashboard displays DashboardWidgets (stats section)', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    // DashboardWidgets renders stats with "Statistiques fournisseurs" heading
    const statsHeading = page.locator('h3', { hasText: 'Statistiques fournisseurs' })
    await expect(statsHeading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays fiches en attente section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const pendingHeading = page.locator('h3', { hasText: 'Fiches en attente' })
    await expect(pendingHeading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays evenements en attente section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const evtHeading = page.locator('h3', { hasText: 'Evenements en attente' })
    await expect(evtHeading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays abonnements section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const subHeading = page.locator('h3', { hasText: 'Abonnements' })
    await expect(subHeading).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard displays CSV Import section', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const csvHeading = page.locator('h3', { hasText: 'Import CSV' })
    await expect(csvHeading).toBeVisible({ timeout: 10_000 })
  })

  // ── Sidebar collections ────────────────────────────────────────────────────

  test('sidebar shows all 7 collections', async () => {
    await page.goto(`${SERVER_URL}/admin`)

    const collections = [
      'Users',
      'Fournisseurs',
      'Evenements',
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

  test('can navigate to Fournisseurs list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/fournisseurs`)
    const heading = page.locator('h1', { hasText: 'Fournisseurs' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Evenements list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/evenements`)
    const heading = page.locator('h1', { hasText: 'Evenements' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to CategoriesActivite list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/categories-activite`)
    const heading = page.locator('h1', { hasText: 'Categories Activite' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to TypesEvenement list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/types-evenement`)
    const heading = page.locator('h1', { hasText: 'Types Evenement' }).first()
    await expect(heading).toBeVisible()
  })

  test('can navigate to Media list view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/media`)
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

  test('can navigate to CategorieActivite create view', async () => {
    await page.goto(`${SERVER_URL}/admin/collections/categories-activite/create`)
    const labelField = page.locator('#field-label')
    await expect(labelField).toBeVisible({ timeout: 5_000 })
  })

  // ── AdminNavLinks ──────────────────────────────────────────────────────────

  test('AdminNavLinks shows "Voir le site" link', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const link = page.locator('a', { hasText: 'Voir le site' })
    await expect(link).toBeVisible({ timeout: 5_000 })
    const href = await link.getAttribute('href')
    expect(href).toBe('/')
  })

  test('AdminNavLinks shows "Deconnexion" button', async () => {
    await page.goto(`${SERVER_URL}/admin`)
    const button = page.locator('button', { hasText: 'Deconnexion' })
    await expect(button).toBeVisible({ timeout: 5_000 })
  })
})
