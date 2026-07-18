import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const LOW_ATLAS_URL = '/src/assets/game/animations/symbols/low/1/low.atlas'

// путь к скелету и атласу на тир символа + ширина скелета из его .json (origin арта — в его центре)
const SYMBOL_TIERS = {
  low_1: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_1.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 156,
  },
  low_2: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_2.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 135.43,
  },
  low_3: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_3.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 164.82,
  },
  low_4: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_4.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 105.73,
  },
  low_5: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_5.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 191,
  },
  low_6: {
    skeletonUrl: '/src/assets/game/animations/symbols/low/low_6.json',
    atlasUrl: LOW_ATLAS_URL,
    nativeWidth: 132.95,
  },
  middle_1: {
    skeletonUrl: '/src/assets/game/animations/symbols/middle_1/middle_1.json',
    atlasUrl: '/src/assets/game/animations/symbols/middle_1/1/middle_1.atlas',
    nativeWidth: 167.4,
  },
  middle_2: {
    skeletonUrl: '/src/assets/game/animations/symbols/middle_2/middle_2.json',
    atlasUrl: '/src/assets/game/animations/symbols/middle_2/1/middle_2.atlas',
    nativeWidth: 157.81,
  },
  high_1: {
    skeletonUrl: '/src/assets/game/animations/symbols/high_1/high_1.json',
    atlasUrl: '/src/assets/game/animations/symbols/high_1/1/high_1.atlas',
    nativeWidth: 207.9,
  },
  wild: {
    skeletonUrl: '/src/assets/game/animations/symbols/wild/wild.json',
    atlasUrl: '/src/assets/game/animations/symbols/wild/1/wild.atlas',
    nativeWidth: 196.25,
  },
} as const

export type SymbolTier = keyof typeof SYMBOL_TIERS

const TRACK_MAIN = 0

/** Анимация символа барабана: ассеты и размер — из `SYMBOL_TIERS` по имени тира. */
export class SymbolAnimation extends SpineAnimation {
  private readonly nativeWidth: number
  private width = 0
  private height = 0

  constructor(ticker: GameTicker, tier: SymbolTier) {
    super(ticker)

    const { skeletonUrl, atlasUrl, nativeWidth } = SYMBOL_TIERS[tier]

    this.nativeWidth = nativeWidth

    void this.load(skeletonUrl, atlasUrl)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'idle')
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

  /** Простой символа. */
  idle(): void {
    this.play(TRACK_MAIN, 'idle')
  }

  /** Выигрышная анимация символа, затем возврат в простой. */
  async win(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'win', signal)

    this.play(TRACK_MAIN, 'idle')
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / this.nativeWidth)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
