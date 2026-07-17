import { Container, Graphics, Text, type Ticker } from 'pixi.js'
import { PALETTE } from 'src/constants/palette'
import type { SpinResult } from 'src/types/game'

import type { GameTicker } from '../game-ticker'

const REEL_WIDTH = 300
const REEL_HEIGHT = 120
const SPIN_DURATION_MS = 900
const LAND_DURATION_MS = 350
const FLICKER_PERIOD_MS = 60
const SYMBOL_VARIANTS = 5

const COLOR_IDLE = '#e2e8f0'
const COLOR_WIN = PALETTE.primary

const formatSymbols = (symbols: number[]): string => symbols.join('   ')

export class ReelAnimation {
  readonly view = new Container()

  private readonly ticker: GameTicker
  private readonly background = new Graphics()
  private readonly label: Text

  constructor(ticker: GameTicker) {
    this.ticker = ticker

    this.label = new Text({
      text: formatSymbols([0, 0, 0]),
      style: { fontFamily: 'monospace', fontSize: 48, fill: COLOR_IDLE },
    })

    this.label.anchor.set(0.5)

    this.view.addChild(this.background, this.label)
    this.resize(REEL_WIDTH, REEL_HEIGHT)
  }

  /** Перерисовывает подложку под переданный размер и центрирует символы. */
  resize(width: number, height: number): void {
    this.background.clear().roundRect(0, 0, width, height, 16).fill('#1e293b')
    this.label.position.set(width / 2, height / 2)
  }

  /** Раскрутка: символы мелькают, пока не выйдет время. Результат тут ещё неизвестен. */
  async spin(signal?: AbortSignal): Promise<void> {
    this.label.style.fill = COLOR_IDLE

    let sinceFlicker = 0

    const flicker = (ticker: Ticker) => {
      sinceFlicker += ticker.deltaMS

      if (sinceFlicker < FLICKER_PERIOD_MS) {
        return
      }

      sinceFlicker = 0
      this.label.text = formatSymbols([0, 0, 0].map(() => Math.floor(Math.random() * SYMBOL_VARIANTS)))
    }

    this.ticker.add(flicker)

    try {
      await this.ticker.waitTicks(SPIN_DURATION_MS, signal)
    } finally {
      this.ticker.remove(flicker)
    }
  }

  /** Приземление на присланный сервером результат. Промис держит фазу, пока показ не закончится. */
  async land(result: SpinResult, signal?: AbortSignal): Promise<void> {
    this.label.text = formatSymbols(result.symbols)

    await this.ticker.waitTicks(LAND_DURATION_MS, signal)
  }

  /** Реакция на уже случившееся событие — синхронная, промиса не возвращает. */
  highlight(result: SpinResult): void {
    this.label.style.fill = result.win > 0 ? COLOR_WIN : COLOR_IDLE
  }
}
