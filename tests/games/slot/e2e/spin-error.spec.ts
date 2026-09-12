import { expect, test } from '@playwright/test'

import { openGame } from '../../../setup/game-page'

test.describe('ошибка раунда', () => {
  test('доводит отказ сервера до игрока', async ({ page }) => {
    const spin = await openGame(page, '?scenario=error&seed=1')

    await spin.dispatchEvent('click')

    // Весь путь ошибки: мок → транспорт → фаза → шина уведомлений → React
    const snackbar = page.getByText('Spin failed, the bet has been refunded')

    await expect(snackbar).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(snackbar).toBeHidden()
  })
})
