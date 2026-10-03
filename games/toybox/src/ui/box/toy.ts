import { Assets, type DestroyOptions, Graphics, Sprite, type Spritesheet, type Texture } from 'pixi.js'

import { TOY_SEQUENCES, TOYS_ATLAS } from '#src/assets'
import { ART_PIXEL, TOY_TWITCH_FRAME_MS, TOY_TWITCH_MAX_PAUSE_MS, TOY_TWITCH_MIN_PAUSE_MS } from '#src/constants'
import type { ShapeKey, WorldPoint } from '#src/types'
import type { ToyShapes } from '#src/ui/box/toy-shapes'
import { lerp } from '#src/utils/math'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import { createAbortError, isAbortError, notifyError } from '@pixi-demos/core/errors/utils'
import type { Random } from '@pixi-demos/core/types'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'

/**
 * Игрушка в куче, в клешне, в окне выдачи и на полу. Форма с кадрами в атласе игрушек рисуется спрайтом кадра крена,
 * подсветка — обводкой той же позы; остальные формы — силуэтом из общих кэшированных контекстов геометрии. Крен
 * выбирает кадр или контекст ближайшего шага угла. Игрушка в клешне показывает кадры сжатия, на полу — тики.
 *
 * Силуэт повторяет коллайдер формы из каталога.
 * TODO Когда форма получит спрайт, коллайдер можно строить по
 * выпуклой оболочке непрозрачных пикселей спрайта: силуэт и физика совпадут без ручной подгонки.
 *
 * Методы не меняют PIXI-объекты при повторе прежних значений.
 */
export class Toy extends FrameAnimation {
  private readonly shapes: ToyShapes
  private readonly body = new Graphics()
  private readonly outline = new Sprite()
  private shape: ShapeKey
  private variant: number
  /** Кадры крена формы, обводка подсветки и тики тех же поз, сжатие без крена; у формы без арта — `undefined`. */
  private frames: readonly Texture[] | undefined
  private outlineFrames: readonly Texture[] | undefined
  private squeezeFrames: readonly Texture[] | undefined
  private twitchFrames: readonly Texture[] | undefined
  private step = 0
  private highlighted = false
  private squeeze = 0
  /** Тики на полу: отмена их останавливает. */
  private twitching: AbortController | undefined

  constructor(ticker: GameTicker, shapes: ToyShapes, shape: ShapeKey, variant: number, color: number) {
    super(ticker, new Sprite())

    this.shapes = shapes
    this.shape = shape
    this.variant = variant
    this.body.tint = color
    this.carrier.scale.set(ART_PIXEL)
    this.outline.scale.set(ART_PIXEL)

    this.addChildAt(this.body, 0)
    this.addChildAt(this.outline, 1)
    this.loadFrames()
    this.refresh()
  }

  /** Переиспользует экземпляр для другой формы и цвета, без крена. Цвет получает только силуэт. */
  setAppearance(shape: ShapeKey, variant: number, color: number): void {
    this.shape = shape
    this.variant = variant
    this.step = 0
    this.body.tint = color
    this.loadFrames()
    this.refresh()
  }

  /** Ставит центр в мировую точку и поворачивает игрушку на крен. */
  setPose(point: WorldPoint, angle: number): void {
    const screen = snapToArtPixel(worldToScreen(point))
    const step = getAngleStep(angle)

    this.position.set(screen.x, screen.y)
    if (step !== this.step) {
      this.step = step
      this.refresh()
    }
  }

  /** Помечает игрушку как цель клешни. */
  setHighlighted(highlighted: boolean): void {
    if (highlighted === this.highlighted) return

    this.highlighted = highlighted
    this.refresh()
  }

  /** Показывает сжатие пальцами клешни: 0 — без сжатия, 1 — слабое, 2 — сильное. Кадры сжатия — только без крена. */
  setSqueeze(squeeze: number): void {
    if (squeeze === this.squeeze) return

    this.squeeze = squeeze
    this.refresh()
  }

  /** Запускает тики в среднем раз в минуту. При уменьшенном движении тиков нет. */
  startTwitching(random: Random): void {
    if (this.twitching || isReducedMotion()) return

    this.twitching = new AbortController()
    void this.twitch(random, this.twitching.signal)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.twitching?.abort(createAbortError('Toy destroyed'))
    super.destroy(options)
  }

  private refresh(): void {
    const { frames, outlineFrames, squeezeFrames, step, highlighted, squeeze } = this

    // Тик нарисован для прежней позы: смена позы его прерывает, и пауза до следующего тика начинается заново
    this.stop()
    this.body.visible = !frames
    this.carrier.visible = frames !== undefined
    this.outline.visible = frames !== undefined && highlighted

    if (!frames) {
      this.body.context = this.shapes.get(this.shape, this.variant, step, highlighted)

      return
    }

    const squeezed = squeeze > 0 && step === 0 ? squeezeFrames?.[squeeze - 1] : undefined

    this.applyFrame(squeezed ?? frames[step])
    if (highlighted && outlineFrames) Toy.showFrame(this.outline, outlineFrames[step])
  }

  private async twitch(random: Random, signal: AbortSignal): Promise<void> {
    try {
      while (!signal.aborted && !this.destroyed) {
        const { frames, twitchFrames, step } = this

        if (!frames || !twitchFrames) return

        const rest = frames[step]
        const twitch = twitchFrames[step]
        const sequence: FrameSequence = {
          frames: [rest, twitch, rest, twitch, rest],
          durations: [lerp(TOY_TWITCH_MIN_PAUSE_MS, TOY_TWITCH_MAX_PAUSE_MS, random()), ...TOY_TWITCH_FRAME_MS],
        }

        await this.playOnce(sequence, signal)
      }
    } catch (error) {
      if (!isAbortError(error)) notifyError(error)
    }
  }

  /** Берёт из атласа игрушек кадры текущей формы в её положении. */
  private loadFrames(): void {
    const sequences = TOY_SEQUENCES[this.shape]?.[this.variant]

    if (!sequences) {
      this.frames = undefined
      this.outlineFrames = undefined
      this.squeezeFrames = undefined
      this.twitchFrames = undefined

      return
    }

    const { animations } = Assets.get<Spritesheet>(TOYS_ATLAS)

    this.frames = animations[sequences.body]
    this.outlineFrames = animations[sequences.outline]
    this.squeezeFrames = sequences.squeeze === undefined ? undefined : animations[sequences.squeeze]
    this.twitchFrames = sequences.twitch === undefined ? undefined : animations[sequences.twitch]
  }

  /** Ставит спрайту кадр и якорь кадра: у кадров одной последовательности якоря разные. */
  private static showFrame(sprite: Sprite, texture: Texture): void {
    sprite.texture = texture
    if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor)
  }
}
