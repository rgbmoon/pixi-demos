import { expect, type Locator, type Page, test } from '@playwright/test'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

/** Сколько ждать полного цикла клешни: опускание, подъём, путь к лотку и возврат. */
const CYCLE_TIMEOUT_MS = 15_000

/**
 * Открывает страницу игры и ждёт, пока она примет опускание; возвращает кнопку Drop.
 * Кнопка появляется в слое доступности PIXI только в покое после бутстрапа; Tab, поднимающий слой,
 * повторяется, пока она не появится.
 */
const openGame = async (page: Page): Promise<Locator> => {
  await page.goto('/toybox?play')

  const drop = page.getByRole('button', { name: 'Drop the claw', exact: true })

  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(drop).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: BOOT_TIMEOUT_MS })

  return drop
}

test.describe('цикл клешни', () => {
  test('проводит клешню по циклу и возвращает игру в покой', async ({ page }) => {
    const drop = await openGame(page)

    // Клик диспатчится напрямую: DOM-кнопки слоя доступности указатель не принимают
    await drop.dispatchEvent('click')

    // Пока идёт цикл, управление погашено: кнопки уходят из слоя доступности
    await expect(drop).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
    await expect(drop).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
  })
})
