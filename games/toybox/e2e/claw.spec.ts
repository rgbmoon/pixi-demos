import { expect, type Locator, type Page, test } from '@playwright/test'

import { CUBE_HEIGHT, FIELD_CENTER, JOYSTICK_CENTER } from '#src/constants'
import { getMachineLayout } from '#src/utils/layout'
import { worldToScreen } from '#src/utils/projection'

/** Сколько ждать бутстрапа игры: на CI канвас рисует программный SwiftShader. */
const BOOT_TIMEOUT_MS = 30_000

/**
 * Сколько ждать полного цикла клешни: опускание, подъём, путь к лотку, выдача приза и возврат.
 * Цикл длится до 9 с игрового времени; ниже 10 FPS тикер режет кадр до 100 мс, и на CI игровое
 * время отстаёт от реального в 2–3 раза.
 */
const CYCLE_TIMEOUT_MS = 45_000

/**
 * Открывает страницу игры и ждёт, пока она примет опускание; возвращает кнопку Drop.
 * Кнопка появляется в слое доступности PIXI только в покое после бутстрапа; Tab, поднимающий слой,
 * повторяется, пока она не появится.
 */
const openGame = async (page: Page): Promise<Locator> => {
  await page.goto('/toybox')

  const drop = page.getByRole('button', { name: 'Drop the claw', exact: true })

  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(drop).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: BOOT_TIMEOUT_MS })

  return drop
}

test.describe('цикл клешни', () => {
  // Бутстрап и цикл клешни вместе не помещаются в общие 60 с
  test.describe.configure({ timeout: 120_000 })

  test('двигает клешню перетаскиванием джойстика мышью', async ({ page }) => {
    await openGame(page)
    await page.waitForTimeout(2_000)

    const canvas = page.getByRole('main').locator('canvas')
    const box = await canvas.boundingBox()

    expect(box).not.toBeNull()

    const layout = getMachineLayout(box?.width ?? 0, box?.height ?? 0)
    const joystick = worldToScreen(JOYSTICK_CENTER)
    const pointerX = (box?.x ?? 0) + layout.x + joystick.x * layout.scale
    const pointerY = (box?.y ?? 0) + layout.y + joystick.y * layout.scale
    const cart = worldToScreen({ ...FIELD_CENTER, z: CUBE_HEIGHT })
    const cartX = (box?.x ?? 0) + layout.x + cart.x * layout.scale
    const cartY = (box?.y ?? 0) + layout.y + cart.y * layout.scale
    const cartArea = { x: cartX - 80, y: cartY - 40, width: 160, height: 200 }
    const before = await page.screenshot({ clip: cartArea })

    await page.mouse.move(pointerX, pointerY)
    await page.mouse.down()
    await page.mouse.move(pointerX + 72, pointerY, { steps: 6 })
    await page.waitForTimeout(500)
    await page.mouse.up()
    await page.waitForTimeout(1_000)

    const after = await page.screenshot({ clip: cartArea })

    expect(after.equals(before)).toBe(false)
  })

  test('проводит клешню по циклу и возвращает игру в покой', async ({ page }) => {
    const drop = await openGame(page)

    // Клик диспатчится напрямую: DOM-кнопки слоя доступности указатель не принимают
    await drop.dispatchEvent('click')

    // Пока идёт цикл, управление погашено: кнопки уходят из слоя доступности
    await expect(drop).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
    await expect(drop).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
  })

  for (const code of ['Enter', 'Space']) {
    test(`запускает цикл клавишей ${code} и блокирует Reset`, async ({ page }) => {
      const drop = await openGame(page)
      const reset = page.getByRole('button', { name: 'Reset the heap', exact: true })

      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.keyboard.press(code)

      await expect(drop).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
      await expect(reset).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
      await expect(drop).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
      await expect(reset).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
    })
  }
})
