import { describe, expect, it } from 'vitest'

import type { ModelPose, ModelRenderOptions, ModelVector, RasterImage, ToyModel } from '#src/types'
import { isOpaque } from '#src/utils/image'
import { renderModel } from '#src/utils/model'

const OPTIONS: ModelRenderOptions = {
  ramps: { gray: ['#101010', '#404040', '#808080', '#c0c0c0', '#f0f0f0'] },
  frame: 40,
  depthShift: [1 / 8, 1 / 8],
  light: { direction: [0, 0, -1], lit: 0.6, shade: 0.1 },
}

/** Модель из одного шара радиуса 3 с центром `center`. */
const ball = (center: ModelVector, group?: string): ToyModel => ({
  parts: [{ name: 'ball', group, center, radii: [3, 3, 3], ramp: 'gray', base: 2, outline: 0 }],
  seamDepth: 1,
})

/** Центр непрозрачных пикселей кадра относительно опорной точки: x — вправо, y — вниз. */
const getCentroid = (image: RasterImage): { x: number; y: number } => {
  let sumX = 0
  let sumY = 0
  let count = 0

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!isOpaque(image, x, y)) continue

      sumX += x + 0.5
      sumY += y + 0.5
      count += 1
    }
  }

  return { x: sumX / count - image.width / 2, y: sumY / count - image.height / 2 }
}

describe('рендер модели', () => {
  it('сдвигает точку глубже на 16 px вправо и вверх на 2 px', () => {
    const near = getCentroid(renderModel(ball([0, 0, 0]), {}, 0, OPTIONS))
    const far = getCentroid(renderModel(ball([0, 0, 16]), {}, 0, OPTIONS))

    expect(far.x - near.x).toBeCloseTo(2, 6)
    expect(far.y - near.y).toBeCloseTo(-2, 6)
  })

  it('поворачивает модель и группу позы по часовой стрелке', () => {
    const rolled = getCentroid(renderModel(ball([8, 0, 0]), {}, 90, OPTIONS))
    const pose: ModelPose = { arm: { pivot: [0, 0], angle: 90 } }
    const posed = getCentroid(renderModel(ball([8, 0, 0], 'arm'), pose, 0, OPTIONS))

    // Шар справа от опорной точки уходит вниз; ось y кадра направлена вниз
    for (const { x, y } of [rolled, posed]) {
      expect(x).toBeCloseTo(0, 6)
      expect(y).toBeCloseTo(8, 6)
    }
  })
})
