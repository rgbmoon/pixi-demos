import { expect, type Locator, type Page } from '@playwright/test'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

/**
 * Открывает страницу игры и ждёт, пока игра примет спин; возвращает кнопку Spin.
 * Исчезновение экрана загрузки готовности не доказывает: пока ленивый чанк страницы не пришёл,
 * экрана ещё нет в DOM, и проверка проходит сразу. Кнопка Spin появляется в слое доступности PIXI
 * только в покое после бутстрапа; Tab, поднимающий слой, повторяется, пока она не появится.
 */
export const openGame = async (page: Page, query: string): Promise<Locator> => {
  await page.goto(`/slot${query}`)

  const spin = page.getByRole('button', { name: 'Spin', exact: true })

  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(spin).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: BOOT_TIMEOUT_MS })

  return spin
}
