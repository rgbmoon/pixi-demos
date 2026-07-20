import { SymbolKey } from 'src/types/game'

import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const LOW_ATLAS_URL = '/src/assets/game/animations/symbols/low/1/low.atlas'

const SYMBOL_TIERS: Record<
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

const NATIVE_CELL_WIDTH = 201.34
const NATIVE_CELL_HEIGHT = 196.33

const TRACK_MAIN = 0

/** Анимация символа барабана: ассеты и размер — из `SYMBOL_TIERS` по текущему ключу (`setKey`). У скаттера (`S`) — доп. состояния free games. */
export class SymbolAnimation extends SpineAnimation {
  // до первого setKey ассетов нет: null отличает «ключ ещё не задан» от «задан тот же самый»
  private key: SymbolKey | null = null
  private width = 0
  private height = 0

  constructor(ticker: GameTicker, visible = true) {
    super(ticker)

    this.view.visible = visible
  }

  protected override onLoaded(): void {
    this.idle()
    this.applySize()
  }

  /** Задаёт значение символа: грузит скелет с ассетами (на смене ключа — подменяет) и ставит символ в простой. */
  setKey(key: SymbolKey): void {
    if (key === this.key) return

    const { skeletonUrl, atlasUrl } = SYMBOL_TIERS[key]

    this.key = key

    void this.load(skeletonUrl, atlasUrl)
  }

  /** Показывает или скрывает символ. */
  setVisible(visible: boolean): void {
    this.view.visible = visible
  }

  /** Вписывает символ в ячейку барабана: масштаб от эталонной ячейки, центр скелета — в центр ячейки. */
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

  private get isScatter(): boolean {
    return this.key === SymbolKey.S
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(Math.min(this.width / NATIVE_CELL_WIDTH, this.height / NATIVE_CELL_HEIGHT))
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
