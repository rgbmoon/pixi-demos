import { Floor } from '#src/ui/box/floor'
import { Frame } from '#src/ui/box/frame'
import { LiveContainer } from '@pixi-demos/engine/live-container'

import type { ContentsController } from './contents'

/**
 * Куб автомата: пол, рёбра каркаса и содержимое. Пол и рёбра лежат под содержимым и в его
 * сортировку не входят — точки мира у них нет.
 */
export class BoxController extends LiveContainer {
  constructor(contents: ContentsController) {
    super()

    this.addChild(new Floor(), new Frame(), contents)
  }
}
