import { describe, expect, it } from 'vitest'

import { ART_PIXEL, CABINET_FRONT_PLANE, CABINET_SIDE_PLANE, CONTROL_PANEL_PLANE } from '#src/constants'
import type { WorldPlane } from '#src/types'
import { getPlaneShear, worldToScreen } from '#src/utils/projection'
import { createImage, getOffset } from '@pixi-demos/asset-pipes/utils/image'
import { shearImage } from '@pixi-demos/asset-pipes/utils/shear'

/** Ширина пробного рисунка грани в пикселях арта: несколько ячеек фасада и два десятка ячеек бока. */
const FACE_WIDTH = 48

/** Экранный сдвиг по вертикали точки, ушедшей вдоль горизонтали плоскости на `cells` ячеек, в пикселях арта. */
const getScreenDrop = (plane: WorldPlane, cells: number): number =>
  worldToScreen({
    x: plane.horizontal.x * cells,
    y: plane.horizontal.y * cells,
    z: plane.horizontal.z * cells,
  }).y / ART_PIXEL

describe('рисунок грани в проекции игры', () => {
  it('сдвигает столбец рисунка фасада, бока и панели вслед за проекцией центра столбца, округлённой до пикселя', () => {
    for (const plane of [CABINET_FRONT_PLANE, CABINET_SIDE_PLANE, CONTROL_PANEL_PLANE]) {
      const face = createImage(FACE_WIDTH, 3)

      // Верхняя строка рисунка: у каждого столбца свой цвет
      for (let x = 0; x < FACE_WIDTH; x++) face.data.set([x, 0, 0, 255], getOffset(face, x, 0))

      const { image, origin } = shearImage(face, getPlaneShear(plane))
      const pixelsPerCell = worldToScreen(plane.horizontal).x / ART_PIXEL
      const getExpectedShift = (column: number): number =>
        Math.round(getScreenDrop(plane, (column + 0.5) / pixelsPerCell)) -
        Math.round(getScreenDrop(plane, 0.5 / pixelsPerCell))

      for (let x = 0; x < FACE_WIDTH; x++) {
        const rows = Array.from({ length: image.height }, (_, y) => getOffset(image, x + origin.x, y))
        const row = rows.findIndex((offset) => image.data[offset + 3] === 255 && image.data[offset] === x)

        expect(row - origin.y).toBe(getExpectedShift(x))
      }
    }
  })
})
