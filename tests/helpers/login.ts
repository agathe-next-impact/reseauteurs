import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  /**
   * Same-origin path to land on after login. The custom login page reads the
   * `redirect` query param and does a hard navigation there. Defaults to
   * `/dashboard` (the app's default), but admin e2e passes `/admin`.
   */
  redirectTo?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user in via the app's CUSTOM login page (`/login`), not the default
 * Payload `/admin/login` form.
 *
 * The app replaced Payload's built-in login UI with a branded RÉSEAUTEURS page
 * that POSTs to `/api/users/login` and then hard-navigates to the `redirect`
 * query param (default `/dashboard`). The form fields carry `name="email"` /
 * `name="password"` (no `#field-email` ids) and the submit button reads
 * « Se connecter ». The `/api/users/login` call sets the same `payload-token`
 * cookie the Payload admin relies on, so an `admin` user reaches `/admin`.
 */
export async function login({
  page,
  serverURL = 'http://localhost:3000',
  redirectTo = '/dashboard',
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/login?redirect=${encodeURIComponent(redirectTo)}`)

  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`${serverURL}${redirectTo}`)
}

/**
 * Logs an admin user in and lands on the Payload admin dashboard (`/admin`),
 * asserting the admin nav has rendered.
 */
export async function loginAdmin(options: Omit<LoginOptions, 'redirectTo'>): Promise<void> {
  await login({ ...options, redirectTo: '/admin' })

  const dashboardArtifact = options.page.locator('span[title="Dashboard"]').first()
  await expect(dashboardArtifact).toBeVisible({ timeout: 30_000 })
}
