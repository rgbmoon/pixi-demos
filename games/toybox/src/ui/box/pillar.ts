import { Graphics } from 'pixi.js'

import { CUBE_HEIGHT, LINE_THICKNESS, MAX_LAYERS } from '#src/constants'
import type { GroundPoint } from '#src/types'
import { getDepthOrder, worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Вертикальное ребро куба в углу пола. Наложение считается наравне с содержимым: место в глубине
 * задаёт точка ребра на верхнем слое кучи — высота, на которой ребро с ней и встречается.
 * Поэтому ребро ближнего угла проходит перед кучей, а дальнего — за ней.
 */
export class Pillar extends Graphics {
  constructor(corner: GroundPoint) {
    super()

    const bottom = worldToScreen({ ...corner, z: 0 })
    const top = worldToScreen({ ...corner, z: CUBE_HEIGHT })

    this.zIndex = getDepthOrder({ ...corner, z: MAX_LAYERS })

    this.moveTo(bottom.x, bottom.y)
      .lineTo(top.x, top.y)
      .stroke({ width: LINE_THICKNESS, color: PALETTE.primary })
  }
}
