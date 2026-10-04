import { ART_PIXEL, CABINET_BOTTOM_Z, WALL_X } from '#src/constants'
import type { ScreenPoint, ScreenRect, WorldPoint } from '#src/types'

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

/**
 * Пиксели арта ломаной через точки мира: отрезки между соседними точками проходят алгоритмом Брезенхэма, общий
 * пиксель соседних отрезков не повторяется.
 */
export const getArtPolyline = (points: readonly WorldPoint[]): ScreenPoint[] => {
  const pixels: ScreenPoint[] = []
  const corners = points.map(toArtPoint)

  corners.slice(1).forEach((to, index) => {
    const from = corners[index]
    const dx = Math.abs(to.x - from.x)
    const dy = -Math.abs(to.y - from.y)
    const stepX = Math.sign(to.x - from.x)
    const stepY = Math.sign(to.y - from.y)
    let { x, y } = from
    let error = dx + dy

    if (index > 0) pixels.pop()
    for (;;) {
      pixels.push({ x, y })
      if (x === to.x && y === to.y) break

      const doubled = 2 * error

      if (doubled >= dy) {
        error += dy
        x += stepX
      }
      if (doubled <= dx) {
        error += dx
        y += stepY
      }
    }
  })

  return pixels
}
