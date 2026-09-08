import { expect, test } from '@playwright/test'

test.describe('лендинг', () => {
  test('открывает игру по ссылке', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /slot/i }).first().click()

    await expect(page).toHaveURL(/\/slot/)
    await expect(page.locator('canvas')).toBeVisible()
  })
})
