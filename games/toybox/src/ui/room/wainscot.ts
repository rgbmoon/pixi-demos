import { Assets } from 'pixi.js'

import { ROOM_FRAMES } from '#src/assets'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { TiledBand } from './tiled-band'

/** Деревянная панель низа стены с плинтусом: тайл повторяется по горизонтали, высота полосы равна высоте тайла. */
export class Wainscot extends TiledBand {
  constructor(ticker: GameTicker) {
    super(ticker, Assets.get(ROOM_FRAMES.wainscot))
  }
}
