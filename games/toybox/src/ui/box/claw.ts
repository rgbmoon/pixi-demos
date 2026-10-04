import { Assets, Container, Sprite, type Spritesheet, type Texture } from 'pixi.js'

import { CLAW_ATLAS, CLAW_FRAMES, CLAW_SEQUENCES } from '#src/assets'
import {
  ART_PIXEL,
  CLAW_GRIP_DEPTH,
  CLAW_GRIP_FRAME_MS,
  CLAW_RELEASE_FRAME_MS,
  CLAW_ROPE_OVERLAP,
  CLAW_TILT_STEP,
} from '#src/constants'
import type { ScreenPoint, WorldPoint } from '#src/types'
import { Rope } from '#src/ui/box/rope'
import { clamp } from '#src/utils/math'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'
import { setSpriteFrame } from '@pixi-demos/engine/utils'

/**
 * Клешня в сборе: трос от каретки, задний палец, игрушка в захвате и сама клешня — в этом порядке снизу вверх. Клешня
 * висит на конце троса и при качании поворачивается вместе с ним: кадр поворота раскрытой или сжатой клешни
 * выбирается по наклону троса, якорь кадра — точка крепления троса. Захват и разжатие проигрываются отвесными кадрами.
 */
export class Claw extends FrameAnimation {
  private readonly rope = new Rope()
  private readonly back = new Sprite()
  private readonly holder = new Container()
  /** Кадр заднего пальца к кадру клешни: тот же наклон, у отвесных поз — без наклона. */
  private readonly backFrames: Map<Texture, Texture>
  private readonly backUpright: Texture
  /** Кадры поворота раскрытой и сжатой клешни, кадр без наклона посередине. */
  private readonly openTilts: FrameSequence
  private readonly closedTilts: FrameSequence
  private readonly gripping: FrameSequence
  private readonly releasing: FrameSequence
  /** Кадры поворота текущего состояния клешни. */
  private tilts: FrameSequence
  /** Кадр поворота по наклону троса и кадр, показанный на экране. */
  private tilt: number
  private shownTilt = -1
  /** Номер последней запущенной анимации: прерванная анимация не возвращает кадры поворота. */
  private animation = 0
  private isAnimating = false
  /** Точка крепления в последней позе. */
  private attach?: ScreenPoint

  constructor(ticker: GameTicker) {
    const { animations } = Assets.get<Spritesheet>(CLAW_ATLAS)
    const openFrames = animations[CLAW_SEQUENCES.open]
    const closedFrames = animations[CLAW_SEQUENCES.closed]
    const backFrames = animations[CLAW_SEQUENCES.back]
    const middle = (openFrames.length - 1) / 2
    const pose = (frame: string) => Assets.get<Texture>(frame)

    super(ticker, new Sprite(openFrames[middle]))

    this.openTilts = { frames: openFrames, durations: openFrames.map(() => 0) }
    this.closedTilts = { frames: closedFrames, durations: closedFrames.map(() => 0) }
    this.gripping = {
      frames: [
        pose(CLAW_FRAMES.wide),
        pose(CLAW_FRAMES.third),
        closedFrames[middle],
        pose(CLAW_FRAMES.twoThirds),
        closedFrames[middle],
      ],
      durations: CLAW_GRIP_FRAME_MS,
    }
    this.releasing = {
      frames: [pose(CLAW_FRAMES.twoThirds), pose(CLAW_FRAMES.third), openFrames[middle]],
      durations: CLAW_RELEASE_FRAME_MS,
    }
    this.backFrames = new Map(
      [openFrames, closedFrames].flatMap((frames) => frames.map((frame, index) => [frame, backFrames[index]] as const))
    )
    this.backUpright = backFrames[middle]
    this.tilts = this.openTilts
    this.tilt = middle
    this.carrier.scale.set(ART_PIXEL)
    this.back.scale.set(ART_PIXEL)
    this.addChildAt(this.rope, 0)
    this.addChildAt(this.back, 1)
    this.addChildAt(this.holder, 2)
    this.applyFrame(this.carrier.texture)
  }

  /** Сжимает клешню: замах, резкое смыкание и отскок с приоткрытием. */
  grip(): void {
    void this.animate(this.gripping, this.closedTilts)
  }

  /** Разжимает клешню. */
  release(): void {
    void this.animate(this.releasing, this.openTilts)
  }

  /**
   * Кладёт игрушку в сборку между задним пальцем и клешней. Игрушка уходит из сборки, когда её добавляют в другой
   * контейнер; координаты сборки и слоя куба совпадают, поэтому поза игрушки не меняется.
   */
  hold(toy: Container): void {
    if (toy.parent !== this.holder) this.holder.addChild(toy)
  }

  /**
   * Вешает клешню на трос от каретки `cart` так, что точка захвата лежит в `grip` на продолжении троса, и выбирает
   * кадр поворота по наклону троса.
   */
  setPose(cart: WorldPoint, grip: WorldPoint): void {
    const top = snapToArtPixel(worldToScreen(cart))
    const end = worldToScreen(grip)
    const length = Math.hypot(end.x - top.x, end.y - top.y)
    const direction = length > 0 ? { x: (end.x - top.x) / length, y: (end.y - top.y) / length } : { x: 0, y: 1 }
    const attach = snapToArtPixel({
      x: end.x - direction.x * CLAW_GRIP_DEPTH * ART_PIXEL,
      y: end.y - direction.y * CLAW_GRIP_DEPTH * ART_PIXEL,
    })
    // Кадры повёрнуты по часовой стрелке: клешня, отошедшая вправо, поворачивается против неё
    const degrees = (Math.atan2(direction.x, direction.y) * 180) / Math.PI
    const middle = (this.tilts.frames.length - 1) / 2

    this.tilt = clamp(middle - Math.round(degrees / CLAW_TILT_STEP), 0, this.tilts.frames.length - 1)
    this.showTilt()

    if (this.attach?.x === attach.x && this.attach.y === attach.y) return

    this.attach = attach
    this.carrier.position.set(attach.x, attach.y)
    this.back.position.set(attach.x, attach.y)

    const rows = (attach.y - top.y) / ART_PIXEL

    this.rope.setSpan(top, rows + CLAW_ROPE_OVERLAP, rows > 0 ? (attach.x - top.x) / (rows * ART_PIXEL) : 0)
  }

  /** Углы рисунка клешни на экране в последней позе: силуэт для сортировки наложения. */
  getOutline(): ScreenPoint[] {
    const { minX, minY, maxX, maxY } = this.carrier.getLocalBounds()
    const { x, y } = this.carrier.position
    const corner = (cornerX: number, cornerY: number): ScreenPoint => ({
      x: x + cornerX * ART_PIXEL,
      y: y + cornerY * ART_PIXEL,
    })

    return [corner(minX, minY), corner(maxX, minY), corner(maxX, maxY), corner(minX, maxY)]
  }

  /** Ставит кадр клешни и кадр заднего пальца того же наклона. */
  protected override applyFrame(texture: Texture | undefined): void {
    super.applyFrame(texture)
    if (!texture || this.destroyed) return

    setSpriteFrame(this.back, this.backFrames.get(texture) ?? this.backUpright)
  }

  /** Проигрывает смену состояния и после неё возвращает кадры поворота нового состояния. */
  private async animate(sequence: FrameSequence, tilts: FrameSequence): Promise<void> {
    this.animation += 1

    const { animation } = this

    this.tilts = tilts
    this.isAnimating = true
    await this.playOnce(sequence)

    if (animation !== this.animation) return

    this.isAnimating = false
    this.shownTilt = -1
    this.showTilt()
  }

  /** Показывает кадр поворота по наклону троса, если анимация смены состояния не идёт. */
  private showTilt(): void {
    if (this.isAnimating || this.shownTilt === this.tilt) return

    this.shownTilt = this.tilt
    this.showFrame(this.tilts, this.tilt)
  }
}
