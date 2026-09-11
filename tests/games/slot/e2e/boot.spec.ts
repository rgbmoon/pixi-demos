import { expect, test } from '@playwright/test'

test.describe('загрузка игры', () => {
  test('поднимает канвас и снимает экран загрузки', async ({ page }) => {
    await page.goto('/slot?scenario=nowin&seed=1')

    await expect(page.locator('canvas')).toBeVisible()

    // Спиннер снимается, только когда игра сообщила о готовности: канвас появляется раньше неё
    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })
    await expect(page.getByRole('alert')).toBeHidden()
  })

  test('проводит спин в браузере без Service Worker', async ({ page }) => {
    // Встроенные браузеры на WKWebView (Telegram, Instagram) не дают Service Worker обычным доменам
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, 'serviceWorker')
    })

    await page.goto('/slot?scenario=bigwin&seed=1')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })
    await expect(page.getByRole('alert')).toBeHidden()

    await page.keyboard.press('Tab')

    const spin = page.getByRole('button', { name: 'Spin' })

    await spin.dispatchEvent('click')

    await expect(spin).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 30_000 })
  })
})
