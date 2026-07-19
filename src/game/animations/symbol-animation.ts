import { SymbolKey } from 'src/types/game'

import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const LOW_ATLAS_URL = '/src/assets/game/animations/symbols/low/1/low.atlas'

const SYMBOL_TIERS: Record<
  SymbolKey,
  {
    skeletonUrl: string
    atlasUrl: string
    nativeWidth: number
  }
> = {
  [SymbolKey.K]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_1.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 156,
  },
  [SymbolKey.L]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_2.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 135.43,
  },
  [SymbolKey.M]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_3.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 164.82,
  },
  [SymbolKey.N]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_4.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 105.73,
  },
  [SymbolKey.O]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_5.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 191,
  },
  [SymbolKey.P]: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_6.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 132.95,
  },
  [SymbolKey.E]: {
    skeletonUrl: '/src/assets/game/animations/symbols/middle_1/middle_1.json',
    atlasUrl: '/src/assets/game/animations/symbols/middle_1/1/middle_1.atlas',
    nativeWidth: 167.4,
  },
  [SymbolKey.F]: {
    skeletonUrl: '/src/assets/game/animations/symbols/middle_2/middle_2.json',
    atlasUrl: '/src/assets/game/animations/symbols/middle_2/1/middle_2.atlas',
    nativeWidth: 157.81,
  },
  [SymbolKey.A]: {
    skeletonUrl: '/src/assets/game/animations/symbols/high_1/high_1.json',
    atlasUrl: '/src/assets/game/animations/symbols/high_1/1/high_1.atlas',
    nativeWidth: 207.9,
  },
  [SymbolKey.W]: {
    skeletonUrl: '/src/assets/game/animations/symbols/wild/wild.json',
    atlasUrl: '/src/assets/game/animations/symbols/wild/1/wild.atlas',
    nativeWidth: 196.25,
  },
  [SymbolKey.S]: {
    skeletonUrl: '/src/assets/game/animations/symbols/scatter/scatter.json',
    atlasUrl: '/src/assets/game/animations/symbols/scatter/1/scatter.atlas',
    nativeWidth: 219.77,
  },
}

const TRACK_MAIN = 0

/** Анимация символа барабана: ассеты и размер — из `SYMBOL_TIERS` по ключу символа. У скаттера (`S`) — доп. состояния free games. */
export class SymbolAnimation extends SpineAnimation {
  private readonly nativeWidth: number
  private readonly isScatter: boolean
  private width = 0
  private height = 0

  constructor(ticker: GameTicker, key: SymbolKey) {
    super(ticker)

    const { skeletonUrl, atlasUrl, nativeWidth } = SYMBOL_TIERS[key]

    this.nativeWidth = nativeWidth
    this.isScatter = key === SymbolKey.S

    void this.load(skeletonUrl, atlasUrl)
  }

  protected override onLoaded(): void {
    this.idle()
    this.applySize()
  }

  /** Вписывает символ в ячейку барабана: масштаб по ширине, центр скелета — в центр ячейки. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Статичный смазанный кадр — для символа во время вращения барабана. */
  blur(): void {
    this.play(TRACK_MAIN, 'blur')
  }

  /** Простой символа; у скаттера — простой с надписью scatter. */
  idle(): void {
    this.play(TRACK_MAIN, this.isScatter ? 'idle_1' : 'idle')
  }

  /** Выигрышная анимация символа, затем возврат в простой. */
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

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / this.nativeWidth)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
