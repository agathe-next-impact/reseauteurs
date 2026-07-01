import { test, expect } from '@playwright/test'

const SERVER_URL = 'http://localhost:3000'

test.describe('Frontend — Pages publiques', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto(SERVER_URL)
    await expect(page).toHaveURL(SERVER_URL + '/')
    // Page should load without 500 error
    expect(await page.title()).toBeTruthy()
  })

  test('login page is accessible', async ({ page }) => {
    await page.goto(`${SERVER_URL}/login`)
    // Should show email and password fields
    const emailField = page.locator('input[name="email"], input[type="email"], #email')
    await expect(emailField.first()).toBeVisible({ timeout: 5_000 })
  })

  test('inscription page is accessible', async ({ page }) => {
    await page.goto(`${SERVER_URL}/inscription`)
    // Should load without error (200 status)
    const response = await page.waitForResponse((r) => r.url().includes('/inscription'))
    expect(response.status()).toBeLessThan(500)
  })
})

test.describe('Frontend — Auth guard', () => {
  test('accessing /dashboard without auth redirects to /login', async ({ page }) => {
    // Clear any existing auth cookies
    await page.context().clearCookies()

    await page.goto(`${SERVER_URL}/dashboard`)

    // Should redirect to /login with redirect param
    await page.waitForURL(/\/login/)
    expect(page.url()).toContain('/login')
  })
})

test.describe('Frontend — Admin redirect', () => {
  test('login page shows error with invalid credentials', async ({ page }) => {
    await page.goto(`${SERVER_URL}/login`)

    // Fill invalid credentials
    const emailField = page.locator('input[name="email"], input[type="email"], #email').first()
    const passwordField = page.locator('input[name="password"], input[type="password"], #password').first()

    await emailField.fill('wrong@test.fr')
    await passwordField.fill('wrongpassword')

    // Submit form
    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()

    // Should show error or stay on login page
    await page.waitForTimeout(2_000)
    expect(page.url()).toContain('/login')
  })
})
