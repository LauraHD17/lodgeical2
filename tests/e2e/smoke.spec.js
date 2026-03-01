// tests/e2e/smoke.spec.js
// Smoke tests — verify that public routes render without crashing
// and that admin routes redirect unauthenticated users to /login.
//
// These tests do NOT require a live Supabase connection because they only
// check static shell rendering and redirect behaviour.

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Public routes — accessible without login
// ---------------------------------------------------------------------------

test.describe('Public routes', () => {
  test('Login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Lodge/i)
    // The login page should show an email field
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
  })

  test('Widget page renders without crashing', async ({ page }) => {
    await page.goto('/widget')
    // The page must not show a blank white screen — expect at least one element
    await expect(page.locator('body')).not.toBeEmpty()
    // No unhandled JS error banner
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
    // Wait for navigation — must end up at /login
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
    // Either ends up at login (auth guard catches it) or shows a 404 page —
    // the important thing is no unhandled crash.
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
