import { expect, test } from '@playwright/test'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

test.describe('лендинг', () => {
  test('открывает слот по ссылке', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /slot/i }).first().click()

    await expect(page).toHaveURL(/\/slot/)
    // Фон Layout — тоже канвас: игровой ищется в области страницы
    await expect(page.getByRole('main').locator('canvas')).toBeVisible({ timeout: BOOT_TIMEOUT_MS })
  })

  test('открывает toybox по ссылке', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /toy box/i }).first().click()

    await expect(page).toHaveURL(/\/toybox/)
    await expect(page.getByRole('main').locator('canvas')).toBeVisible({ timeout: BOOT_TIMEOUT_MS })
  })
})
