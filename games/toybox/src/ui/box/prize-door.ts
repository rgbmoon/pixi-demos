import { Assets, type Spritesheet } from 'pixi.js'

import { HATCH_ATLAS, HATCH_SEQUENCES } from '#src/assets'
import { PRIZE_DOOR_CLOSE_MS, PRIZE_DOOR_JAM_CHANCE, PRIZE_DOOR_JAM_MS, PRIZE_DOOR_OPEN_MS } from '#src/constants'
import { Face } from '#src/ui/box/face'
import { getPrizeHatchFaces } from '#src/utils/machine-geometry'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'

/** Шторка окна выдачи: уезжает вверх внутрь корпуса, иногда заедая, и захлопывается. */
export class PrizeDoor extends FrameAnimation<Face> {
  private readonly opening: FrameSequence
  private readonly jammed: FrameSequence
  private readonly closing: FrameSequence

  constructor(ticker: GameTicker) {
    // Кадры идут от закрытой шторки к открытой
    const frames = Assets.get<Spritesheet>(HATCH_ATLAS).animations[HATCH_SEQUENCES.door]

    super(ticker, new Face(frames[0], getPrizeHatchFaces().opening))

    this.opening = { frames: frames.slice(1), durations: PRIZE_DOOR_OPEN_MS }
    this.jammed = { frames: frames.slice(1), durations: PRIZE_DOOR_JAM_MS }
    this.closing = { frames: frames.slice(0, -1).reverse(), durations: PRIZE_DOOR_CLOSE_MS }
  }

  /** Поднимает шторку; промис резолвится, когда окно открыто. */
  open(signal: AbortSignal): Promise<void> {
    // Заедание — косметика: бросок не влияет на исход раунда
    return this.playOnce(Math.random() < PRIZE_DOOR_JAM_CHANCE ? this.jammed : this.opening, signal)
  }

  /** Опускает шторку; промис резолвится, когда окно закрыто. */
  close(signal: AbortSignal): Promise<void> {
    return this.playOnce(this.closing, signal)
  }

  /** Сразу ставит закрытую шторку. */
  shut(): void {
    this.showFrame(this.closing, this.closing.frames.length - 1)
  }
}
