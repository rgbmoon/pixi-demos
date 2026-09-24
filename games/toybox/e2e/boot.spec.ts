import { expect, test } from '@playwright/test'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

test.describe('загрузка игры', () => {
  test('поднимает канвас и снимает экран загрузки', async ({ page }) => {
    await page.goto('/toybox')

    // Фон Layout — тоже канвас: игровой ищется в области страницы
    await expect(page.getByRole('main').locator('canvas')).toBeVisible({ timeout: BOOT_TIMEOUT_MS })
    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden()
    // Фатальная ошибка бутстрапа заменяет индикатор загрузки оверлеем с ролью alert
    await expect(page.getByRole('alert')).toBeHidden()
  })
})
