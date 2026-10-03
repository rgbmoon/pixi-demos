import type { ModelColor, ModelHit, ModelPose, ToyModel } from '@pixi-demos/asset-pipes/types'

import { createKit, fabric } from './utils'

// Сидящий плюшевый слоник цвета краски в подъездах: уши с розовой изнанкой, хобот свисает на грудь. Модель
// задана в пикселях эскиза 28 px, и растянута под сечение формы
const { scale: S, part, chain, near, onSegment } = createKit(1.35)

const FUR = fabric('green', 2)

/** Детали поверхности: глаза-пуговицы с бликом, изнанка ушей, складки хобота, ногти и подошвы. */
const decal = ({ part: { name }, point: [a, b], normal }: ModelHit): ModelColor | undefined => {
  if (name === 'head') {
    if (near(a, b, -2.7, 6.6, 0.25, 0.25) || near(a, b, 3.1, 6.6, 0.25, 0.25)) return ['bone', 4]
    if (near(a, b, -2.9, 6.4, 0.7, 0.8) || near(a, b, 2.9, 6.4, 0.7, 0.8)) return ['indigo', 0]
  }
  if (name === 'trunk' && Math.round(b * 1.2) % 3 === 0) return ['green', 1]
  if (name === 'legL' || name === 'legR') {
    const toe = name === 'legL' ? -6.2 : 6.2

    if (b < -10 * S && [-1.6, 0, 1.6].some((dx) => near(a, b, toe + dx, -12.6, 0.6, 0.45))) return ['bone', 3]
  }
  if (
    (name === 'armL' || name === 'armR') &&
    onSegment(a, b, name === 'armL' ? -9.4 : 9.4, -7, name === 'armL' ? -7.6 : 7.6, -7.2, 0.6)
  )
    return ['green', 1]
  if (name === 'earL' && near(a, b, -7.4, 5, 2.4, 3.4)) return ['pink', 2]
  if (name === 'earR' && near(a, b, 7.4, 5, 2.4, 3.4)) return ['pink', 2]
  if (
    (name === 'legL' || name === 'legR') &&
    normal[2] < -0.55 &&
    near(a, b, name === 'legL' ? -6.2 : 6.2, -10.4, 2.4, 1.9)
  )
    return ['green', 3]

  return undefined
}

export const ELEPHANT: ToyModel = {
  parts: [
    part('body', 'body', [0, -5.5, 0], [8.4, 7, 7], FUR),
    part('armL', 'body', [-8.4, -3.4, -2.6], [2.8, 4.4, 2.8], FUR),
    part('armR', 'body', [8.4, -3.4, -2.6], [2.8, 4.4, 2.8], FUR),
    part('legL', 'body', [-6.2, -10, -3.5], [4.2, 3.4, 4.2], FUR),
    part('legR', 'body', [6.2, -10, -3.5], [4.2, 3.4, 4.2], FUR),
    part('earL', 'head', [-7.6, 5.2, 1], [3.6, 4.8, 1.6], FUR),
    part('earR', 'head', [7.6, 5.2, 1], [3.6, 4.8, 1.6], FUR),
    part('head', 'head', [0, 5, -0.5], [7, 6, 6], FUR),
    ...chain(
      'trunk',
      'head',
      [
        [0, 2.4, -5.6],
        [0, -0.6, -6.6],
        [0.4, -3.2, -7],
        [1.6, -4.2, -7],
      ],
      1.7,
      FUR
    ),
  ],
  seamDepth: 1.2,
  decal,
}

/** Тик: голова дёргается вбок. */
export const ELEPHANT_TWITCH: ModelPose = { head: { pivot: [0, 1 * S], angle: 10 } }
