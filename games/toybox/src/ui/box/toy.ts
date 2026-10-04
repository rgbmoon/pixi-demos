import { Assets, type DestroyOptions, Sprite, type Texture } from 'pixi.js'

import { getToySequences } from '#src/assets'
import {
  ART_PIXEL,
  TOY_ANGLE_STEPS,
  TOY_TWITCH_FRAME_MS,
  TOY_TWITCH_MAX_PAUSE_MS,
  TOY_TWITCH_MIN_PAUSE_MS,
} from '#src/constants'
import type { ToyKey, WorldPoint } from '#src/types'
import { lerp } from '#src/utils/math'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import { createAbortError, isAbortError, notifyError } from '@pixi-demos/core/errors/utils'
import type { Random } from '@pixi-demos/core/types'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'
import { setSpriteFrame } from '@pixi-demos/engine/utils'

/**
 * Игрушка в куче, в клешне, в окне выдачи и на полу: спрайт кадра крена из атласа игрушек, подсветка — обводка той же
 * позы. Крен выбирает кадр ближайшего шага угла. Игрушки с нарисованным тиком на полу время от времени дёргаются.
 *
 * Методы не меняют PIXI-объекты при повторе прежних значений.
 */
export class Toy extends FrameAnimation {
  private readonly outline = new Sprite()
  private toy: ToyKey
  /** Кадры крена, обводка подсветки и тики тех же поз; у игрушки без тика кадров тика нет. */
  private frames: readonly Texture[] = []
  private outlineFrames: readonly Texture[] = []
  private twitchFrames: readonly Texture[] | undefined
  private step = 0
  private highlighted = false
  /** Тики на полу: отмена их останавливает. */
  private twitching: AbortController | undefined

  constructor(ticker: GameTicker, toy: ToyKey) {
    super(ticker, new Sprite())

    this.toy = toy
    this.carrier.scale.set(ART_PIXEL)
    this.outline.scale.set(ART_PIXEL)

    this.addChildAt(this.outline, 0)
    this.loadFrames()
    this.refresh()
  }

  /** Переиспользует экземпляр для другой игрушки, без крена. */
  setAppearance(toy: ToyKey): void {
    this.toy = toy
    this.step = 0
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
    const { frames, outlineFrames, step, highlighted } = this

    // Тик нарисован для прежней позы: смена позы его прерывает, и пауза до следующего тика начинается заново
    this.stop()
    this.applyFrame(frames[step])
    this.outline.visible = highlighted
    if (highlighted) setSpriteFrame(this.outline, outlineFrames[step])
  }

  private async twitch(random: Random, signal: AbortSignal): Promise<void> {
    try {
      while (!signal.aborted && !this.destroyed) {
        const { frames, twitchFrames, step } = this

        if (!twitchFrames) return

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

  /** Берёт из атласа игрушек кадры игрушки. */
  private loadFrames(): void {
    const { body, outline, twitch } = getToySequences(this.toy)

    this.frames = Toy.loadSequence(body)
    this.outlineFrames = Toy.loadSequence(outline)
    this.twitchFrames = twitch === undefined ? undefined : Toy.loadSequence(twitch)
  }

  /** Кадры крена последовательности по именам кадров: последовательность может лежать на нескольких страницах атласа. */
  private static loadSequence(name: string): Texture[] {
    return Array.from({ length: TOY_ANGLE_STEPS }, (_, step) => Assets.get<Texture>(`${name}-${step}.png`))
  }
}
