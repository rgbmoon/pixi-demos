import { expect, test } from '@playwright/test'

import { openGame, readSavedSnapshot, readSnapshot, runCycle } from './game-page'

test.describe('куча между заходами', () => {
  // Два бутстрапа и цикл клешни вместе не помещаются в общие 60 с
  test.describe.configure({ timeout: 120_000 })

  test('поднимает ту же кучу и тот же счёт после перезагрузки', async ({ page }) => {
    const drop = await openGame(page)

    await runCycle(drop)

    const saved = await readSavedSnapshot(page)

    expect(saved?.bodies.length).toBeGreaterThan(0)

    // Куча поднялась из снимка и сохранилась заново: в хранилище то же, что лежало до перезагрузки
    await openGame(page)
    await expect.poll(() => readSnapshot(page)).toEqual(saved)
  })

  test('пересыпает кучу и обнуляет счёт по кнопке сброса', async ({ page }) => {
    const drop = await openGame(page)
    const initial = await readSavedSnapshot(page)

    expect(initial?.bodies.length).toBeGreaterThan(0)

    await runCycle(drop)

    const played = await readSavedSnapshot(page)

    await page.getByRole('button', { name: 'Reset the heap', exact: true }).dispatchEvent('click')
    await expect.poll(() => readSnapshot(page)).not.toEqual(played)

    const fresh = await readSavedSnapshot(page)

    expect(fresh?.collected).toBe(0)
    expect(fresh).not.toEqual(initial)

    // Новая куча переживает перезаход так же, как прежняя
    await openGame(page)
    await expect.poll(() => readSnapshot(page)).toEqual(fresh)
  })
})
