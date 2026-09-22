import { expect, type Locator, type Page, test } from '@playwright/test'

import { HEAP_DB_NAME, HEAP_SNAPSHOT_KEY, HEAP_STORE_NAME } from '#src/constants'
import type { HeapSnapshot } from '#src/types'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

/** Сколько ждать полного цикла клешни: опускание, подъём, путь к лотку и возврат. */
const CYCLE_TIMEOUT_MS = 15_000

/**
 * Открывает страницу игры
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

/** Читает снимок кучи прямо из IndexedDB страницы. */
const readSnapshot = (page: Page, address: { dbName: string; storeName: string; key: string }) =>
  page.evaluate(
    ({ dbName, storeName, key }) =>
      new Promise<HeapSnapshot | undefined>((resolve, reject) => {
        const open = indexedDB.open(dbName, 1)

        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const request = open.result.transaction(storeName, 'readonly').objectStore(storeName).get(key)

          request.onsuccess = () => resolve(request.result as HeapSnapshot | undefined)
          request.onerror = () => reject(request.error)
        }
      }),
    address
  )

/** Просит страницу сохранить кучу так же, как при уходе с неё. */
const flushSnapshot = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
  await page.waitForTimeout(200)
}

const runCycle = async (drop: Locator): Promise<void> => {
  await drop.dispatchEvent('click')

  await expect(drop).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
  await expect(drop).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
}

test.describe('куча между заходами', () => {
  test('поднимает ту же кучу и тот же счёт после перезагрузки', async ({ page }) => {
    const address = { dbName: HEAP_DB_NAME, storeName: HEAP_STORE_NAME, key: HEAP_SNAPSHOT_KEY }

    const drop = await openGame(page)

    await runCycle(drop)
    await flushSnapshot(page)

    const saved = await readSnapshot(page, address)

    expect(saved?.bodies.length).toBeGreaterThan(0)

    await openGame(page)
    // Куча поднялась из снимка; сохраняем её заново и сверяем с тем, что лежало до перезагрузки
    await flushSnapshot(page)

    expect(await readSnapshot(page, address)).toEqual(saved)
  })

  test('пересыпает кучу и обнуляет счёт по кнопке сброса', async ({ page }) => {
    const address = { dbName: HEAP_DB_NAME, storeName: HEAP_STORE_NAME, key: HEAP_SNAPSHOT_KEY }

    const drop = await openGame(page)

    await flushSnapshot(page)

    const initial = await readSnapshot(page, address)

    expect(initial?.bodies.length).toBeGreaterThan(0)

    await runCycle(drop)
    await flushSnapshot(page)

    const played = await readSnapshot(page, address)

    await page.getByRole('button', { name: 'Reset the heap', exact: true }).dispatchEvent('click')
    await page.waitForTimeout(500)

    const fresh = await readSnapshot(page, address)

    expect(fresh?.collected).toBe(0)
    expect(fresh).not.toEqual(played)
    expect(fresh).not.toEqual(initial)

    // Новая куча переживает перезаход так же, как прежняя
    await openGame(page)
    await flushSnapshot(page)

    expect(await readSnapshot(page, address)).toEqual(fresh)
  })
})
