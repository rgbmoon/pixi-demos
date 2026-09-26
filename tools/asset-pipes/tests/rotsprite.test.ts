import { describe, expect, it } from 'vitest'

import { rotateSprite, upscaleForRotation } from '#src/utils/rotsprite'

import { fromRows, getVisibleColors, toRows } from './setup/raster'

const LEGEND = { r: '#872c2f', g: '#6e7c40', b: '#44647d', w: '#efe8d2' }

/**
 * Несимметричный кадр 6 × 4: по нему видно направление поворота. У пикселя `w` во второй строке соседи сверху и
 * слева одного цвета, справа и снизу — другого: Scale2x перекрашивает углы этого пикселя в увеличенном растре.
 */
const SPRITE = ['rrgg..', 'rwbgb.', 'wbgbbb', '..w..b']

describe('пайп rotsprite', () => {
  it('на 0° отдаёт исходный кадр с той же опорной точкой', () => {
    const image = fromRows(SPRITE, LEGEND)
    const rotated = rotateSprite(image, upscaleForRotation(image), 0, { x: 3, y: 2 })

    expect(toRows(rotated.image, LEGEND)).toEqual(SPRITE)
    expect(rotated.pivot).toEqual({ x: 3, y: 2 })
  })

  it('на 90° поворачивает кадр точно по часовой стрелке', () => {
    const image = fromRows(SPRITE, LEGEND)
    const rotated = rotateSprite(image, upscaleForRotation(image), 90, { x: 3, y: 2 })
    // Столбец исходника снизу вверх становится строкой результата слева направо
    const expected = Array.from({ length: 6 }, (_, x) =>
      Array.from({ length: 4 }, (_, column) => SPRITE[3 - column][x]).join('')
    )

    expect(toRows(rotated.image, LEGEND)).toEqual(expected)
  })

  it('на любом угле не создаёт новых цветов', () => {
    const image = fromRows(SPRITE, LEGEND)
    const upscaled = upscaleForRotation(image)
    const palette = new Set(getVisibleColors(image))

    for (let degrees = 0; degrees < 360; degrees += 5) {
      for (const color of getVisibleColors(rotateSprite(image, upscaled, degrees, { x: 3, y: 2 }).image)) {
        expect(palette.has(color)).toBe(true)
      }
    }
  })
})
