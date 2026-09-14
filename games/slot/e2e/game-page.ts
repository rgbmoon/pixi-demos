import { expect, type Locator, type Page } from '@playwright/test'

import { NOTICE_EVENT } from '@pixi-demos/core/errors/constants'
import type { Notice } from '@pixi-demos/core/errors/types'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

/** Поле window, куда страница складывает все уведомления шины с первой загрузки. */
const NOTICES_KEY = '__notices'

/**
 * Открывает страницу игры и ждёт, пока игра примет спин; возвращает кнопку Spin.
 * Исчезновение экрана загрузки готовности не доказывает: пока ленивый чанк страницы не пришёл,
 * экрана ещё нет в DOM, и проверка проходит сразу. Кнопка Spin появляется в слое доступности PIXI
 * только в покое после бутстрапа; Tab, поднимающий слой, повторяется, пока она не появится.
 * Уведомления шины страница пишет в журнал с первой строки: его читает `expectNoNotices`.
 */
export const openGame = async (page: Page, query: string): Promise<Locator> => {
  await page.addInitScript(
    ({ event, key }) => {
      const notices: unknown[] = []

      Reflect.set(window, key, notices)
      window.addEventListener(event, (notice) => notices.push((notice as CustomEvent).detail))
    },
    { event: NOTICE_EVENT, key: NOTICES_KEY }
  )

  await page.goto(`/slot${query}`)

  const spin = page.getByRole('button', { name: 'Spin', exact: true })

  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(spin).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: BOOT_TIMEOUT_MS })

  return spin
}

/**
 * Проверяет, что за всё время на странице шина не объявила ни одного уведомления. Снекбар скрывается
 * по таймеру, поэтому к концу длинного раунда его уже нет в DOM — проверяется журнал `openGame`.
 */
export const expectNoNotices = async (page: Page): Promise<void> => {
  const notices = await page.evaluate((key) => Reflect.get(window, key) as Notice[] | undefined, NOTICES_KEY)

  expect(notices).toEqual([])
}
