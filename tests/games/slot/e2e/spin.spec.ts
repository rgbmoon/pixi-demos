import { expect, test } from '@playwright/test'

test.describe('раунд', () => {
  test('проводит спин от нажатия до нового покоя', async ({ page }) => {
    await page.goto('/slot?scenario=bigwin&seed=1')

    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })

    // Слой доступности PIXI поднимается по Tab и снимается движением мыши, поэтому клик диспатчим напрямую
    await page.keyboard.press('Tab')

    const spin = page.getByRole('button', { name: 'Spin' })

    await expect(spin).toBeVisible()
    await spin.dispatchEvent('click')

    // Пока раунд идёт, спин недоступен; по его закрытии кнопка возвращается
    await expect(spin).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 30_000 })
  })
})
