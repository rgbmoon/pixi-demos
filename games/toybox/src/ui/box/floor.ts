import { Container } from 'pixi.js'

import { BOX_FRAMES } from '#src/assets'
import { Face } from '#src/ui/box/face'
import { getCubeFaces } from '#src/utils/machine-geometry'

/** Дно куба с проёмом лотка, через который игрушка уходит к окну выдачи. */
export class Floor extends Container {
  constructor() {
    super()

    const faces = getCubeFaces()

    this.addChild(new Face(BOX_FRAMES.floor, faces.floor), new Face(BOX_FRAMES.chute, faces.chute))
  }
}
