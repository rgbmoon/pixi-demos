import { Assets, Matrix, Sprite, type Texture } from 'pixi.js'

import type { FaceCorners } from '#src/types'
import { getFaceMatrix } from '#src/utils/projection'

/** Грань корпуса: плоский кадр атласа, наклон её плоскости задаёт матрица при рендере. */
export class Face extends Sprite {
  constructor(frame: string, corners: FaceCorners) {
    super(Assets.get<Texture>(frame))

    const { a, b, c, d, tx, ty } = getFaceMatrix(corners, { width: this.texture.width, height: this.texture.height })

    this.setFromMatrix(new Matrix(a, b, c, d, tx, ty))
  }
}
