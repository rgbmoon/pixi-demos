import { expect, test } from '@playwright/test'

import { CANVAS_MAX_RESOLUTION, CUBE_HEIGHT, FIELD_CENTER, JOYSTICK_CENTER } from '#src/constants'
import { getMachineLayout } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'

import { CYCLE_TIMEOUT_MS, openGame, runCycle } from './game-page'

test.describe('цикл клешни', () => {
  // Бутстрап и цикл клешни вместе не помещаются в общие 60 с
  test.describe.configure({ timeout: 120_000 })

  test('двигает клешню перетаскиванием джойстика мышью', async ({ page }) => {
    await openGame(page)
    await page.waitForTimeout(2_000)

    const canvas = page.getByRole('main').locator('canvas')
    const box = await canvas.boundingBox()

    expect(box).not.toBeNull()

    // Плотность рендера та же, что хост передаёт в app.init
    const resolution = Math.min(await page.evaluate(() => window.devicePixelRatio), CANVAS_MAX_RESOLUTION)
    const layout = getMachineLayout(box?.width ?? 0, box?.height ?? 0, resolution)
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
    await runCycle(await openGame(page))
  })

  // Enter запускает цикл так же, как Space: равенство клавиш проверяет тест управления
  test('запускает цикл клавишей Space и гасит Reset на время цикла', async ({ page }) => {
    const drop = await openGame(page)
    const reset = page.getByRole('button', { name: 'Reset the heap', exact: true })

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Space')

    await expect(drop).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
    await expect(reset).toBeHidden({ timeout: CYCLE_TIMEOUT_MS })
    await expect(drop).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
    await expect(reset).toBeVisible({ timeout: CYCLE_TIMEOUT_MS })
  })
})
