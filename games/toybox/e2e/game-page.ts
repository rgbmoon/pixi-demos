import { expect, type Locator, type Page } from '@playwright/test'

import { HEAP_DB_NAME, HEAP_SNAPSHOT_KEY, HEAP_STORE_NAME } from '#src/constants'
import type { HeapSnapshot } from '#src/types'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

/**
 * Сколько ждать полного цикла клешни: опускание, подъём, путь к лотку, выдача приза и возврат.
 * Цикл длится до 9 с игрового времени; ниже 10 FPS тикер режет кадр до 100 мс, и на CI игровое
 * время отстаёт от реального в 2–3 раза.
 */
export const CYCLE_TIMEOUT_MS = 45_000

/** Пауза между чтениями снимка: запись в IndexedDB успевает лечь за это время. */
const STORAGE_POLL_MS = 250

/**
 * Открывает страницу игры и ждёт, пока она примет опускание; возвращает кнопку Drop.
 * Кнопка появляется в слое доступности PIXI только в покое после бутстрапа; Tab, поднимающий слой,
 * повторяется, пока она не появится.
 */
export const openGame = async (page: Page): Promise<Locator> => {
  await page.goto('/toybox')

  const drop = page.getByRole('button', { name: 'Drop the claw', exact: true })

  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(drop).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: BOOT_TIMEOUT_MS })

  return drop
}

/** Проводит цикл клешни кнопкой Drop: пока он идёт, управление погашено и кнопка уходит из слоя доступности. */
export const runCycle = async (drop: Locator): Promise<void> => {
  // Клик диспатчится напрямую: DOM-кнопки слоя доступности указатель не принимают
  await drop.dispatchEvent('click')

  await expect(drop).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
  await expect(drop).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
}

/** Читает снимок кучи прямо из IndexedDB страницы. */
export const readSnapshot = (page: Page): Promise<HeapSnapshot | undefined> =>
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
    { dbName: HEAP_DB_NAME, storeName: HEAP_STORE_NAME, key: HEAP_SNAPSHOT_KEY }
  )

/**
 * Читает снимок кучи, когда запись улеглась: два чтения подряд совпадают. Игра пишет снимок асинхронно по
 * завершении цикла, и первое чтение может застать прежнюю запись.
 */
export const readSavedSnapshot = async (page: Page): Promise<HeapSnapshot | undefined> => {
  let previous = await readSnapshot(page)

  await expect
    .poll(
      async () => {
        const current = await readSnapshot(page)
        const isSettled = current !== undefined && JSON.stringify(current) === JSON.stringify(previous)

        previous = current

        return isSettled
      },
      { intervals: [STORAGE_POLL_MS] }
    )
    .toBe(true)

  return previous
}
