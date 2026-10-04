import { Assets, Container, Polygon, Sprite, type Texture } from 'pixi.js'

import { ART_PIXEL, CONTROL_HIT_PADDING, DISABLED_TINT } from '#src/constants'
import type { ButtonFrames, ButtonOptions, WorldPlane } from '#src/types'
import { getProjectedPlaneCircle } from '#src/utils/projection'

/** Круглая кнопка на грани корпуса: кадры обычной и нажатой кнопки, затемнение погашенной, нажатие и доступность. */
export class ControlButton extends Container {
  private readonly face: Sprite
  private readonly frames: ButtonFrames
  private isEnabled = true

  constructor(options: ButtonOptions, plane: WorldPlane, size: number, frames: ButtonFrames) {
    super()

    this.face = new Sprite(Assets.get<Texture>(frames.normal))
    this.frames = frames
    this.face.scale.set(ART_PIXEL)
    this.addChild(this.face)

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Polygon(getProjectedPlaneCircle(plane, size / 2 + CONTROL_HIT_PADDING))
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label
    this.accessiblePointerEvents = 'none'

    this.on('pointerdown', this.handleDown)
    this.on('pointerup', this.handleUp)
    this.on('pointerupoutside', this.handleUp)
    this.on('pointertap', options.onTap)
  }

  /** Включает или гасит кнопку: интерактивность, курсор, затемнение и доступность. */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.accessible = enabled
    this.face.tint = enabled ? 0xffffff : DISABLED_TINT
    this.setFrame(this.frames.normal)
  }

  private handleDown = (): void => {
    this.setFrame(this.frames.pressed)
  }

  private handleUp = (): void => {
    if (this.isEnabled) this.setFrame(this.frames.normal)
  }

  private setFrame(frame: string): void {
    this.face.texture = Assets.get<Texture>(frame)
  }
}
