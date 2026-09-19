import { Floor } from '#src/ui/box/floor'
import { Frame } from '#src/ui/box/frame'
import { LiveContainer } from '@pixi-demos/engine/live-container'

import type { ClawController } from './claw'

/**
 * Куб автомата: дно с сеткой, клешня и рёбра каркаса. Порядок детей задаёт наложение —
 * содержимое куба лежит между полом и рёбрами, туда же встанут будущие игрушки.
 */
export class BoxController extends LiveContainer {
  constructor(claw: ClawController) {
    super()

    this.addChild(new Floor(), claw, new Frame())
  }
}
