import { Assets, type Spritesheet } from 'pixi.js'

import { ROOM_ATLAS, ROOM_SEQUENCES } from '#src/assets'
import { WALLPAPER_PULSE_MS } from '#src/constants'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'

import { TiledBand } from './tiled-band'

/** Обои стены зала: тайл повторяется по обеим осям; `pulse` запускает медленный пульс узора. */
export class Wallpaper extends TiledBand {
  private readonly sequence: FrameSequence

  constructor(ticker: GameTicker) {
    const frames = Assets.get<Spritesheet>(ROOM_ATLAS).animations[ROOM_SEQUENCES.wallpaper]

    super(ticker, frames[0])

    this.sequence = { frames, durations: WALLPAPER_PULSE_MS }
  }

  /** Запускает пульс узора по кругу; при уменьшенном движении узор неподвижен. */
  pulse(): void {
    this.play(this.sequence)
  }
}
