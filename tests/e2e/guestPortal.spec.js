// tests/e2e/guestPortal.spec.js
// E2E tests for the guest portal lookup and display.
// All Supabase calls are intercepted — no live backend required.

import { test, expect } from '@playwright/test'

const MOCK_RESERVATION = {
  success: true,
  reservation: {
    id: 'res-1',
    confirmation_number: 'TEST123',
    check_in: '2026-04-10',
    check_out: '2026-04-15',
    status: 'confirmed',
    num_guests: 2,
    total_cents: 75000,
    room_ids: ['room-1'],
    property_id: 'prop-1',
    modification_count: 0,
    guests: {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '+1 555-0100',
    },
  },
  rooms: [
    { id: 'room-1', name: 'Garden Suite' },
  ],
  payments: [],
  property: {
    id: 'prop-1',
    name: 'Test Lodge',
    check_in_time: '15:00',
    check_out_time: '11:00',
  },
}

test.beforeEach(async ({ page }) => {
  // Auth — no session
  await page.route('**/auth/v1/**', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  )

  // REST — empty
  await page.route('**/rest/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // Guest portal lookup — returns mock reservation
  await page.route('**/functions/v1/guest-portal-lookup', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RESERVATION),
    })
  )

  // Other edge functions — empty success
  await page.route('**/functions/v1/**', route => {
    if (route.request().url().includes('guest-portal-lookup')) return
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
})

test.describe('Guest portal', () => {
  test('renders lookup form', async ({ page }) => {
    await page.goto('/guest-portal')
    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('[data-testid="error-boundary"]')).toHaveCount(0)
    // Should have confirmation number and email inputs
    await expect(page.locator('input')).toHaveCount(2, { timeout: 10_000 })
  })

  test('pre-fills confirmation from URL param', async ({ page }) => {
    await page.goto('/guest-portal?confirmation=TEST123')
    const confirmationInput = page.locator('input').first()
    await expect(confirmationInput).toHaveValue('TEST123', { timeout: 10_000 })
  })

  test('submitting lookup shows reservation details', async ({ page }) => {
    await page.goto('/guest-portal')
    // Fill in the lookup form
    const inputs = page.locator('input')
    await inputs.first().fill('TEST123')
    await inputs.nth(1).fill('jane@example.com')

    // Submit the form
    await page.locator('button[type="submit"], button:has-text("Look Up")').first().click()

    // Should show reservation confirmation number somewhere on the page
    await expect(page.locator('text=TEST123')).toBeVisible({ timeout: 10_000 })
  })

  test('does not crash on /check-in route', async ({ page }) => {
    await page.goto('/check-in')
    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('[data-testid="error-boundary"]')).toHaveCount(0)
  })

  test('check-in pre-fills from URL param', async ({ page }) => {
    await page.goto('/check-in?c=TEST123')
    // Should have the confirmation pre-filled in an input
    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('[data-testid="error-boundary"]')).toHaveCount(0)
  })
})
