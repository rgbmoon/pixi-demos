import type { ModelColor, ModelHit, ModelPart, ModelPose, ModelVector, ToyModel } from '@pixi-demos/asset-pipes/types'
import { isInEllipse, isOnSegment } from '@pixi-demos/asset-pipes/utils/model'

// Сидящий медведь `cube8`: глаза-крестики, вместо правой руки торчит набивка, на животе заплатка. Модель задана в
// пикселях эскиза 28 px и растянута на `SCALE` под сечение формы
const SCALE = 1.2

const scaled = ([a, b, d]: ModelVector): ModelVector => [a * SCALE, b * SCALE, d * SCALE]

const part = (
  name: string,
  group: string,
  center: ModelVector,
  radii: ModelVector,
  material: Pick<ModelPart, 'ramp' | 'base' | 'outline' | 'seam'> = { ramp: 'brown', base: 2, outline: 0, seam: 1 }
): ModelPart => ({ name, group, center: scaled(center), radii: scaled(radii), ...material })

const BONE = { ramp: 'bone', base: 2, outline: 0 }
const STUFFING = { ramp: 'bone', base: 4, outline: 2 }

const near = (a: number, b: number, ca: number, cb: number, ra: number, rb: number): boolean =>
  isInEllipse(a, b, [ca * SCALE, cb * SCALE], [ra * SCALE, rb * SCALE])

const onSegment = (a: number, b: number, a1: number, b1: number, a2: number, b2: number, width: number): boolean =>
  isOnSegment(a, b, [a1 * SCALE, b1 * SCALE], [a2 * SCALE, b2 * SCALE], width)

const cross = (a: number, b: number, ca: number, cb: number): boolean =>
  onSegment(a, b, ca - 1.4, cb - 1.4, ca + 1.4, cb + 1.4, 1.05) ||
  onSegment(a, b, ca - 1.4, cb + 1.4, ca + 1.4, cb - 1.4, 1.05)

/** Детали поверхности: глаза-крестики и шов на голове, нос и рот, подкладка ушей и стоп, заплатка, дыра от руки. */
const decal = ({ part: { name }, point: [a, b], normal }: ModelHit): ModelColor | undefined => {
  if (name === 'head') {
    if (cross(a, b, -3.6, 6.6) || cross(a, b, 3.6, 6.6)) return ['brown', 0]
    if (onSegment(a, b, 2.2, 10.6, 3.6, 9.4, 0.9) || onSegment(a, b, 3.6, 9.4, 5, 10.4, 0.9)) return ['brown', 1]
  }
  if (name === 'muzzle') {
    if (near(a, b, 0, 4.1, 1.5, 0.9)) return ['brown', 0]
    if (onSegment(a, b, 0, 3.6, 0, 2.2, 0.9) || onSegment(a, b, -1.3, 1.9, 1.3, 1.9, 0.9)) return ['brown', 0]
  }
  if ((name === 'earL' || name === 'earR') && near(a, b, name === 'earL' ? -7.3 : 7.3, 9.8, 1.6, 1.6))
    return ['bone', 1]
  if (
    (name === 'legL' || name === 'legR') &&
    normal[2] < -0.55 &&
    near(a, b, name === 'legL' ? -6.5 : 6.5, -10.3, 2.6, 2)
  )
    return ['bone', 1]
  if (name === 'body') {
    // Заплатка другой ткани со стежками тёмной ниткой поперёк края
    if (Math.abs(a - -0.5 * SCALE) <= 2.6 * SCALE && b >= -9 * SCALE && b <= -4 * SCALE)
      return b >= -4.9 * SCALE ? ['red', 2] : ['red', 1]
    if (
      Math.abs(a - -0.5 * SCALE) <= 3.4 * SCALE &&
      b >= -9.8 * SCALE &&
      b <= -3.2 * SCALE &&
      Math.abs(Math.round(a) + Math.round(b)) % 2 === 0
    )
      return ['brown', 0]
    // Дыра на месте руки
    if (near(a, b, 8.2, -1.6, 1.4, 2.2)) return ['brown', 0]
  }

  return undefined
}

export const BEAR: ToyModel = {
  parts: [
    part('body', 'body', [0, -5.5, 0], [8.6, 7, 7]),
    part('head', 'head', [0, 5.5, -0.5], [8.4, 6.6, 6.4]),
    part('earL', 'head', [-7.5, 10, 0], [3.2, 3.2, 1.8]),
    part('earR', 'head', [7.5, 10, 0], [3.2, 3.2, 1.8]),
    part('muzzle', 'head', [0, 3, -6], [4, 2.4, 2.2], BONE),
    part('armL', 'arm', [-9, -3.5, -2.5], [3, 4.6, 3]),
    part('legL', 'legs', [-6.5, -9.8, -3.5], [4.6, 3.6, 4.6]),
    part('legR', 'legs', [6.5, -9.8, -3.5], [4.6, 3.6, 4.6]),
    // Набивка из оторванного плеча
    part('tuft1', 'stuffing', [7.9, -1.6, -2.5], [2.4, 2.1, 2.4], STUFFING),
    part('tuft2', 'stuffing', [9.5, 0.1, -2], [1.6, 1.6, 1.6], STUFFING),
    part('tuft3', 'stuffing', [9.3, -3.2, -2], [1.5, 1.4, 1.5], STUFFING),
  ],
  seamDepth: 1.2 * SCALE,
  decal,
}

/** Сжатие клешнёй, слабое и сильное: пальцы сходятся на шее, голова и тело сужаются и вытягиваются вверх. */
const squeeze = (strength: number): ModelPose => ({
  head: { pivot: [0, 5.5 * SCALE], scale: [1 - 0.14 * strength, 1 + 0.07 * strength] },
  body: { pivot: [0, -5.5 * SCALE], scale: [1 - 0.1 * strength, 1 + 0.05 * strength] },
  arm: { offset: [strength, 0] },
  stuffing: { offset: [-strength, 0] },
})

export const BEAR_POSES = {
  squeeze: [squeeze(0.5), squeeze(1)],
  // Тик: голова дёргается к оторванному плечу
  twitch: { head: { pivot: [0, 0], angle: 10 } },
} as const satisfies Readonly<Record<string, ModelPose | readonly ModelPose[]>>
