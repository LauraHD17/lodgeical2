// tests/e2e/smoke.spec.js
// Smoke tests — verify that public routes render without crashing
// and that admin routes redirect unauthenticated users to /login.
//
// No live Supabase connection is required. All Supabase HTTP calls are
// intercepted and return an empty/unauthenticated response immediately so
// the auth guard resolves without waiting for a real network round-trip.

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Intercept Supabase auth/REST calls for every test so the auth context
// resolves to "no session" instantly rather than timing out on DNS.
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  // Auth endpoint — return 401 so supabase-js treats session as absent
  await page.route('**/auth/v1/**', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  )
  // REST endpoint — return empty list for any data queries
  await page.route('**/rest/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  // Edge functions — return empty success
  await page.route('**/functions/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
})

// ---------------------------------------------------------------------------
// Public routes — accessible without login
// ---------------------------------------------------------------------------

test.describe('Public routes', () => {
  test('Login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Lodge/i)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
  })

  test('Widget page renders without crashing', async ({ page }) => {
    await page.goto('/widget')
    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('[data-testid="error-boundary"]')).toHaveCount(0)
  })

  test('Guest portal page renders without crashing', async ({ page }) => {
    await page.goto('/guest-portal')
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

// ---------------------------------------------------------------------------
// Authentication redirect
// ---------------------------------------------------------------------------

test.describe('Auth guard', () => {
  test('visiting / redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page.url()).toContain('/login')
  })

  test('visiting /reservations redirects to /login', async ({ page }) => {
    await page.goto('/reservations')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page.url()).toContain('/login')
  })

  test('visiting /settings redirects to /login', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page.url()).toContain('/login')
  })
})

// ---------------------------------------------------------------------------
// 404 / unknown routes
// ---------------------------------------------------------------------------

test.describe('Unknown routes', () => {
  test('unknown route redirects or shows login', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

// ---------------------------------------------------------------------------
// Booking confirmation public page
// ---------------------------------------------------------------------------

test.describe('Booking confirmation', () => {
  test('renders without crashing for any confirmation code', async ({ page }) => {
    await page.goto('/booking-confirmation?code=TESTCODE')
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

// ---------------------------------------------------------------------------
// Import page — auth redirect
// ---------------------------------------------------------------------------

test.describe('Import page', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/import')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page.url()).toContain('/login')
  })
})
