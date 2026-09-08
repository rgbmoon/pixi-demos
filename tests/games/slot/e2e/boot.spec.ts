import { expect, test } from '@playwright/test'

test.describe('загрузка игры', () => {
  test('поднимает канвас и снимает экран загрузки', async ({ page }) => {
    await page.goto('/slot?scenario=nowin&seed=1')

    await expect(page.locator('canvas')).toBeVisible()

    // Спиннер снимается, только когда игра сообщила о готовности: канвас появляется раньше неё
    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })
    await expect(page.getByRole('alert')).toBeHidden()
  })
})
