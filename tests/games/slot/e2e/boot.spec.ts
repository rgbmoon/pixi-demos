import { expect, test } from '@playwright/test'

import { openGame } from '../../../setup/game-page'

test.describe('загрузка игры', () => {
  test('поднимает канвас и снимает экран загрузки', async ({ page }) => {
    // Экран загрузки проверяется после готовности игры: до прихода ленивого чанка страницы его ещё
    // нет в DOM, и проверка на исчезновение прошла бы до его появления
    await openGame(page, '?scenario=nowin&seed=1')

    // Фон Layout — тоже канвас: игровой ищется в области страницы
    await expect(page.getByRole('main').locator('canvas')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden()
    await expect(page.getByRole('alert')).toBeHidden()
  })

  test('проводит спин в браузере без Service Worker', async ({ page }) => {
    // Встроенные браузеры на WKWebView (Telegram, Instagram) не дают Service Worker обычным доменам
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, 'serviceWorker')
    })

    const spin = await openGame(page, '?scenario=bigwin&seed=1')

    await expect(page.getByRole('alert')).toBeHidden()

    await spin.dispatchEvent('click')

    await expect(spin).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 30_000 })
  })
})
