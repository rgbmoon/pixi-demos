import { Graphics } from 'pixi.js'

import { CUBE_HEIGHT, LINE_THICKNESS } from '#src/constants'
import type { GroundPoint } from '#src/types'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Вертикальное ребро куба в углу пола. Порядок наложения выставляет слой содержимого наравне с игрушками. */
export class Pillar extends Graphics {
  constructor(corner: GroundPoint) {
    super()

    const bottom = worldToScreen({ ...corner, z: 0 })
    const top = worldToScreen({ ...corner, z: CUBE_HEIGHT })

    this.moveTo(bottom.x, bottom.y)
      .lineTo(top.x, top.y)
      .stroke({ width: LINE_THICKNESS, color: PALETTE.primary })
  }
}
