import { Assets, type BLEND_MODES, Sprite } from 'pixi.js'

/** Пятно света или тени фона; точку привязки задаёт кадр атласа. */
export class Glow extends Sprite {
  constructor(frame: string, blendMode: BLEND_MODES) {
    super(Assets.get(frame))

    this.blendMode = blendMode
  }
}
