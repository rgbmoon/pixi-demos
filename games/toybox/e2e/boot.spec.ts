import { expect, test } from '@playwright/test'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

test.describe('загрузка игры', () => {
  test('показывает заглушку без флага play', async ({ page }) => {
    await page.goto('/toybox')

    await expect(page.getByText('The game is under development')).toBeVisible()
    // Игра приходит динамическим import() из boot: без флага канвас не поднимается
    await expect(page.getByRole('main').locator('canvas')).toHaveCount(0)
  })

  test('поднимает канвас по флагу play и снимает экран загрузки', async ({ page }) => {
    await page.goto('/toybox?play')

    // Фон Layout — тоже канвас: игровой ищется в области страницы
    await expect(page.getByRole('main').locator('canvas')).toBeVisible({ timeout: BOOT_TIMEOUT_MS })
    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden()
    // Фатальная ошибка бутстрапа заменяет индикатор загрузки оверлеем с ролью alert
    await expect(page.getByRole('alert')).toBeHidden()
  })
})
