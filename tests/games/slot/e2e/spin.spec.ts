import { expect, test } from '@playwright/test'

test.describe('раунд', () => {
  test('проводит спин от нажатия до нового покоя', async ({ page }) => {
    await page.goto('/slot?scenario=bigwin&seed=1')

    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })

    // Слой доступности PIXI поднимается по Tab; указатель его DOM-кнопки не принимают, поэтому клик диспатчим напрямую
    await page.keyboard.press('Tab')

    const spin = page.getByRole('button', { name: 'Spin' })

    await expect(spin).toBeVisible()
    await spin.dispatchEvent('click')

    // Пока раунд идёт, спин недоступен; по его закрытии кнопка возвращается
    await expect(spin).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 30_000 })
  })

  test('останавливает барабаны по Stop и доводит раунд до покоя', async ({ page }) => {
    await page.goto('/slot?scenario=bigwin&seed=1')

    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })

    await page.keyboard.press('Tab')

    const spin = page.getByRole('button', { name: 'Spin' })
    const stop = page.getByRole('button', { name: 'Stop' })

    await spin.dispatchEvent('click')

    // Пока барабаны в движении, та же кнопка работает как Stop
    await expect(stop).toBeVisible()
    await stop.dispatchEvent('click')

    await expect(stop).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 30_000 })
  })

  test('в турбо-режиме крутит серию, пока спин зажат, и возвращается в покой после отпускания', async ({ page }) => {
    await page.goto('/slot?scenario=bigwin&seed=1')

    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })

    await page.keyboard.press('Tab')

    await page.getByRole('button', { name: 'Settings' }).dispatchEvent('click')
    await page.getByRole('button', { name: 'TURBO SPIN' }).dispatchEvent('click')
    await page.getByRole('button', { name: 'Close settings' }).dispatchEvent('click')

    const spin = page.getByRole('button', { name: 'Spin', exact: true })

    await expect(spin).toBeVisible()

    const box = await spin.boundingBox()

    if (!box) throw new Error('spin button has no bounding box')

    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    // Удержание — только настоящими событиями указателя: клик слоя доступности даёт один tap.
    // DOM-кнопки слоя указатель пропускают, поэтому нажатие попадает в канвас под ними
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.waitForTimeout(1500)

    // Серия уже идёт: зажатая кнопка остаётся доступной и показывает турбо-спин. Короткое ожидание
    // не даёт проверке дотянуть до порога удержания, если тот вдруг сломан
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Turbo spin' })).toBeVisible({ timeout: 1000 })

    await page.mouse.up()

    await expect(spin).toBeVisible({ timeout: 30_000 })
  })

  test('проводит раунд с респином через все шаги до нового покоя', async ({ page }) => {
    // Каждый шаг респина — своя посадка и свой показ выигрыша: раунд длиннее обычного спина
    test.setTimeout(90_000)

    await page.goto('/slot?scenario=respin&seed=1')

    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })

    await page.keyboard.press('Tab')

    const spin = page.getByRole('button', { name: 'Spin' })

    await expect(spin).toBeVisible()
    await spin.dispatchEvent('click')

    // Спин недоступен до конца последнего шага: между шагами раунд не возвращается в покой
    await expect(spin).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 60_000 })
  })

  test('проводит раунд с бонусом Hold & Win до нового покоя', async ({ page }) => {
    // Бонус — вход, серия шагов и сбор монет: раунд длиннее респина
    test.setTimeout(120_000)

    await page.goto('/slot?scenario=holdwin&seed=1')

    await expect(page.getByRole('status', { name: 'Loading game' })).toBeHidden({ timeout: 30_000 })

    await page.keyboard.press('Tab')

    const spin = page.getByRole('button', { name: 'Spin' })

    await expect(spin).toBeVisible()
    await spin.dispatchEvent('click')

    // Спин недоступен, пока идёт бонус: между шагами раунд не возвращается в покой
    await expect(spin).toBeHidden()
    await expect(spin).toBeVisible({ timeout: 90_000 })
  })
})
