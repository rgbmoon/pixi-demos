import { SymbolKey } from 'src/types/game'

import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const LOW_ATLAS_URL = '/src/assets/game/animations/symbols/low/1/low.atlas'

const SYMBOL_ASSETS: Record<
  SymbolKey,
  {
    skeletonUrl: string
    atlasUrl: string
  }
> = {
  [SymbolKey.K]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_1.json',
    atlasUrl: LOW_ATLAS_URL,
  },
  [SymbolKey.L]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_2.json',
    atlasUrl: LOW_ATLAS_URL,
  },
  [SymbolKey.M]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_3.json',
    atlasUrl: LOW_ATLAS_URL,
  },
  [SymbolKey.N]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_4.json',
    atlasUrl: LOW_ATLAS_URL,
  },
  [SymbolKey.O]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_5.json',
    atlasUrl: LOW_ATLAS_URL,
  },
  [SymbolKey.P]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_6.json',
    atlasUrl: LOW_ATLAS_URL,
  },
  [SymbolKey.E]: {
    skeletonUrl: '/src/assets/game/animations/symbols/middle_1/middle_1.json',
    atlasUrl: '/src/assets/game/animations/symbols/middle_1/1/middle_1.atlas',
  },
  [SymbolKey.F]: {
    skeletonUrl: '/src/assets/game/animations/symbols/middle_2/middle_2.json',
    atlasUrl: '/src/assets/game/animations/symbols/middle_2/1/middle_2.atlas',
  },
  [SymbolKey.A]: {
    skeletonUrl: '/src/assets/game/animations/symbols/high_1/high_1.json',
    atlasUrl: '/src/assets/game/animations/symbols/high_1/1/high_1.atlas',
  },
  [SymbolKey.W]: {
    skeletonUrl: '/src/assets/game/animations/symbols/wild/wild.json',
    atlasUrl: '/src/assets/game/animations/symbols/wild/1/wild.atlas',
  },
  [SymbolKey.S]: {
    skeletonUrl: '/src/assets/game/animations/symbols/scatter/scatter.json',
    atlasUrl: '/src/assets/game/animations/symbols/scatter/1/scatter.atlas',
  },
}

const TRACK_MAIN = 0

export class SymbolAnimation extends SpineAnimation {
  private key: SymbolKey | null = null

  constructor(ticker: GameTicker) {
    super(ticker)
  }

  private get isScatter(): boolean {
    return this.key === SymbolKey.S
  }

  protected override onLoaded(): void {
    this.idle()
  }

  setKey(key: SymbolKey): void {
    if (key === this.key) return

    const { skeletonUrl, atlasUrl } = SYMBOL_ASSETS[key]

    this.key = key

    void this.load(skeletonUrl, atlasUrl)
  }

  blur(): void {
    this.play(TRACK_MAIN, 'blur')
  }

  idle(): void {
    this.play(TRACK_MAIN, this.isScatter ? 'idle_1' : 'idle')
  }

  async win(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, this.isScatter ? 'win_1' : 'win', signal)

    this.idle()
  }

  /** Скаттер: простой с надписью free games. У остальных символов ничего не делает. */
  idleFreeGames(): void {
    if (!this.isScatter) return

    this.play(TRACK_MAIN, 'idle_2')
  }

  /** Скаттер: переход во free games один раз, дальше — `winFreeGamesLoop`. У остальных символов ничего не делает. */
  winToFreeGames(signal?: AbortSignal): Promise<void> {
    if (!this.isScatter) return Promise.resolve()

    return this.playOnce(TRACK_MAIN, 'win_2', signal)
  }

  /** Скаттер: циклическая выигрышная анимация во free games. У остальных символов ничего не делает. */
  winFreeGamesLoop(): void {
    if (!this.isScatter) return

    this.play(TRACK_MAIN, 'win_3')
  }
}
