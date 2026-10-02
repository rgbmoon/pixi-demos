import { Assets, type DestroyOptions, Sprite, type Texture } from 'pixi.js'

import { LAMP_FRAMES } from '#src/assets'
import {
  ART_PIXEL,
  LAMP_DIPS,
  LAMP_HALO_ALPHA,
  LAMP_IGNITION,
  LAMP_MAX_PAUSE_MS,
  LAMP_MIN_PAUSE_MS,
} from '#src/constants'
import { LampColor, LampLight, type LightStep } from '#src/types'
import { pickFlicker } from '#src/utils/light'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import { createAbortError, isAbortError, notifyError } from '@pixi-demos/core/errors/utils'
import type { Random } from '@pixi-demos/core/types'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'

/** Лампа табло с ореолом: загорается заданным цветом с перебоями, горящая изредка мерцает. */
export class Lamp extends FrameAnimation {
  private readonly halo = new Sprite()
  /** Кадры света по цвету лампы; погашенная лампа у всех цветов общая. */
  private readonly lights: Readonly<Record<LampColor, Readonly<Record<LampLight, Texture>>>>
  /** Ореол и его прозрачность по кадру света; у погашенной лампы ореола нет. */
  private readonly halos: ReadonlyMap<Texture, { texture: Texture; alpha: number }>
  private readonly random: Random
  /** Горение лампы: отмена гасит её. */
  private burning: AbortController | undefined
  private color: LampColor | undefined

  constructor(ticker: GameTicker, random: Random) {
    const off = Assets.get<Texture>(LAMP_FRAMES.off)
    const getLights = (color: LampColor): Record<LampLight, Texture> => {
      const { dim, on } = LAMP_FRAMES.colors[color]

      return { off, dim: Assets.get<Texture>(dim), on: Assets.get<Texture>(on) }
    }
    const lights = { yellow: getLights('yellow'), magenta: getLights('magenta'), red: getLights('red') }

    super(ticker, new Sprite(off))

    this.lights = lights
    this.halos = new Map(
      Object.values(LampColor).flatMap((color) => {
        const texture = Assets.get<Texture>(LAMP_FRAMES.colors[color].halo)
        const { dim, on } = lights[color]

        return [
          [dim, { texture, alpha: LAMP_HALO_ALPHA.dim }],
          [on, { texture, alpha: LAMP_HALO_ALPHA.on }],
        ] as const
      })
    )
    this.random = random
    this.scale.set(ART_PIXEL)
    // Свет складывается с табло под лампой; само стекло лампы ореол не засвечивает
    this.halo.blendMode = 'add'
    this.halo.visible = false
    this.addChildAt(this.halo, 0)
  }

  /** Зажигает лампу цветом `color`; горящая тем же цветом лампа не перезажигается. */
  turnOn(color: LampColor): void {
    if (this.burning && this.color === color) return

    this.burning?.abort(createAbortError('Lamp color changed'))
    this.burning = new AbortController()
    this.color = color
    void this.burn(color, this.burning.signal)
  }

  /** Гасит лампу. */
  turnOff(): void {
    this.burning?.abort(createAbortError('Lamp turned off'))
    this.burning = undefined
    this.color = undefined
    this.showFrame(this.toSequence(LampColor.yellow, [[LampLight.off, 0]]), 0)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.burning?.abort(createAbortError('Lamp destroyed'))
    super.destroy(options)
  }

  protected override applyFrame(texture: Texture | undefined): void {
    super.applyFrame(texture)

    if (!texture || this.destroyed) return

    const halo = this.halos.get(texture)

    this.halo.visible = halo !== undefined

    if (!halo) return

    this.halo.texture = halo.texture
    this.halo.alpha = halo.alpha

    // Sprite читает якорь текстуры только в конструкторе
    if (halo.texture.defaultAnchor) this.halo.anchor.copyFrom(halo.texture.defaultAnchor)
  }

  private async burn(color: LampColor, signal: AbortSignal): Promise<void> {
    try {
      await this.playOnce(this.toSequence(color, LAMP_IGNITION), signal)

      // Мерцание — декоративное движение: при уменьшенном движении лампа горит ровно
      if (isReducedMotion()) return

      while (!signal.aborted && !this.destroyed) {
        const flicker = pickFlicker(this.random, LAMP_MIN_PAUSE_MS, LAMP_MAX_PAUSE_MS, LAMP_DIPS)

        await this.playOnce(this.toSequence(color, flicker), signal)
      }
    } catch (error) {
      if (!isAbortError(error)) notifyError(error)
    }
  }

  private toSequence(color: LampColor, steps: readonly LightStep[]): FrameSequence {
    return {
      frames: steps.map(([light]) => this.lights[color][light]),
      durations: steps.map(([, ms]) => ms),
    }
  }
}
