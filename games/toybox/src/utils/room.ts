import { ART_PIXEL, CABINET_BOTTOM_Z, DECAL_BLOCK_SHARE, DECAL_BLOCK_SIZE, WALL_X } from '#src/constants'
import type { DecalPlacement, FrameSize, ScreenPoint, ScreenRect, WorldPoint } from '#src/types'
import { createRandom } from '@pixi-demos/core/random'

import { worldToScreen } from './projection'

/** Высота линии плинтуса на экране в пикселях арта: основание стены за автоматом. */
export const getPlinthY = (): number =>
  Math.round(worldToScreen({ x: WALL_X, y: 0, z: CABINET_BOTTOM_Z }).y / ART_PIXEL)

/** Экранная точка мира в пикселях арта, округлённая до пикселя. */
export const toArtPoint = (point: WorldPoint): ScreenPoint => {
  const { x, y } = worldToScreen(point)

  return { x: Math.round(x / ART_PIXEL), y: Math.round(y / ART_PIXEL) }
}

/** Переводит прямоугольник сцены в пиксели арта; края расширяются до целого пикселя. */
export const toArtRect = ({ left, top, right, bottom }: ScreenRect): ScreenRect => ({
  left: Math.floor(left / ART_PIXEL),
  top: Math.floor(top / ART_PIXEL),
  right: Math.ceil(right / ART_PIXEL),
  bottom: Math.ceil(bottom / ART_PIXEL),
})

/** Сид блока раскладки декалей: смешение его координат. */
const getBlockSeed = (column: number, row: number): number =>
  (Math.imul(column, 73856093) ^ Math.imul(row, 19349663)) >>> 0

/**
 * Декали блока стены: столбцы блоков идут вправо от x = 0, ряды — вверх от верха панели, `y` декали отсчитан от
 * верха панели. Состав и место зависят только от координат блока, поэтому при ресайзе показанные декали не сдвигаются.
 * Декаль целиком лежит в своём блоке.
 */
export const getBlockDecals = (column: number, row: number, sizes: readonly FrameSize[]): DecalPlacement[] => {
  const random = createRandom(getBlockSeed(column, row))

  if (sizes.length === 0 || random() >= DECAL_BLOCK_SHARE) return []

  const variant = Math.floor(random() * sizes.length)
  const { width, height } = sizes[variant]

  return [
    {
      variant,
      x: column * DECAL_BLOCK_SIZE + Math.floor(random() * (DECAL_BLOCK_SIZE - width + 1)),
      y: -(row + 1) * DECAL_BLOCK_SIZE + Math.floor(random() * (DECAL_BLOCK_SIZE - height + 1)),
    },
  ]
}
