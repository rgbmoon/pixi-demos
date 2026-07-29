import type { DestroyOptions, Ticker, TickerCallback } from 'pixi.js'
import { SymbolAnimation } from 'src/game/animations/symbol-animation'
import { BUFFER_SYMBOLS_COUNT, SPIN_SPEED, VISIBLE_SYMBOLS_COUNT } from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import type { LandingPlan } from 'src/game/types'
import { LiveContainer } from 'src/game/ui/live-container'
import { getLandingKey, getRandomSymbolKey, planLanding } from 'src/game/utils'
import type { SymbolKey } from 'src/types/game'

export class ReelController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly symbols: SymbolAnimation[]

  private cellHeight: number = 0

  private spinStep: TickerCallback<unknown> | null = null
  private landingStep: TickerCallback<unknown> | null = null

  constructor(ticker: GameTicker, pool: SpinePool) {
    super()

    this.ticker = ticker

    this.symbols = Array.from({ length: VISIBLE_SYMBOLS_COUNT + BUFFER_SYMBOLS_COUNT }, () => {
      const symbol = new SymbolAnimation(pool)

      symbol.setKey(getRandomSymbolKey())

      return symbol
    })

    this.addChild(...this.symbols.map((symbol) => symbol.view))
  }

  override destroy(options?: DestroyOptions): void {
    this.removeSpinStep()
    this.removeLandingStep()

    super.destroy(options)
  }

  /** Высота видимой зоны барабана: за её нижней границей символ уходит в буферную ячейку. */
  private get visibleHeight(): number {
    return VISIBLE_SYMBOLS_COUNT * this.cellHeight
  }

  /** Длина ленты барабана: период прокрутки, через который повторяются позиции символов. */
  private get stripHeight(): number {
    return (VISIBLE_SYMBOLS_COUNT + BUFFER_SYMBOLS_COUNT) * this.cellHeight
  }

  /** Опорная позиция ленты: символы двигаются синхронно, для выравнивания годится любой из них. */
  private get stripY(): number {
    return this.symbols[0].view.y
  }

  /** Лента крутится: шаг вращения стоит на тикере. */
  private get isSpinning(): boolean {
    return this.spinStep !== null
  }

  /** Идёт посадка: шаг посадки стоит на тикере. */
  private get isLanding(): boolean {
    return this.landingStep !== null
  }

  /** Индекс слота по позиции на ленте: 0 — верхний видимый слот, -1 — буферная ячейка над зоной. */
  private getSlotIndex(y: number): number {
    return Math.round(y / this.cellHeight)
  }

  /** Символ видимого слота: лента лежит в массиве сверху вниз, первая ячейка — буферная. */
  private getSlotSymbol(slotIndex: number): SymbolAnimation {
    return this.symbols[slotIndex + BUFFER_SYMBOLS_COUNT]
  }

  /** Ведёт ленту по расписанию посадки: промис резолвится на последнем кадре, реджектится по `signal`. */
  private runLanding(plan: LandingPlan, symbolKeys: SymbolKey[], signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      let elapsed = 0
      let traveled = 0

      const settle = (finish: () => void) => {
        this.removeLandingStep()
        signal?.removeEventListener('abort', handleAbort)

        finish()
      }

      const landingStep = (ticker: Ticker) => {
        elapsed += ticker.deltaTime

        const position = plan.positionAt(elapsed)
        // Отскок задаёт позицию: на возврате из-за точки посадки шаг отрицательный
        const step = position - traveled
        const remainingDistance = plan.distance - position

        traveled = position

        for (let index = 0; index < this.symbols.length; index++) {
          const symbol = this.symbols[index]

          symbol.view.y += step

          if (this.wrapSymbol(symbol)) this.showLandingSymbol(symbol, remainingDistance, symbolKeys)
        }

        if (elapsed < plan.totalFrames) return

        settle(() => {
          this.snapToCells()
          resolve()
        })
      }

      const handleAbort = () => settle(() => reject(signal?.reason as Error))

      signal?.addEventListener('abort', handleAbort, { once: true })

      this.landingStep = landingStep
      this.ticker.add(landingStep)
    })
  }

  /**
   * Возвращает символ в полосу ленты, если он ушёл за нижнюю границу зоны; `true` — перенос был.
   * Вычитает длину ленты, а не присваивает верхнюю границу: перескок сохраняет дробный остаток, символы держат шаг.
   */
  private wrapSymbol(symbol: SymbolAnimation): boolean {
    if (symbol.view.y < this.visibleHeight) return false

    while (symbol.view.y >= this.visibleHeight) {
      symbol.view.y -= this.stripHeight
    }

    return true
  }

  /**
   * Добивает символы точно на границы ячеек, гася накопленную за посадку погрешность.
   * Анимации не трогает: idle каждый символ получает на своём последнем обороте, повторный вызов сбросил бы фазу цикла.
   */
  private snapToCells(): void {
    this.symbols.forEach((symbol) => {
      symbol.view.y = this.getSlotIndex(symbol.view.y) * this.cellHeight
    })
  }

  /** Ставит в ячейку случайный символ в размытой позе. */
  private showRandomSymbol(symbol: SymbolAnimation): void {
    symbol.setKey(getRandomSymbolKey())
    symbol.blur()
  }

  /** Наполняет обёрнутую ячейку: на последнем обороте — финальным символом в покое, иначе случайным в размытии. */
  private showLandingSymbol(symbol: SymbolAnimation, remainingDistance: number, symbolKeys: SymbolKey[]): void {
    // Точка посадки символа известна на любом кадре: текущий y плюс непройденный остаток пути
    const landingY = symbol.view.y + remainingDistance

    if (landingY >= this.visibleHeight) {
      this.showRandomSymbol(symbol)

      return
    }

    symbol.setKey(getLandingKey(symbolKeys, this.getSlotIndex(landingY)))
    symbol.idle()
  }

  /** Снимает шаг вращения с тикера. */
  private removeSpinStep(): void {
    if (this.spinStep) this.ticker.remove(this.spinStep)

    this.spinStep = null
  }

  /** Снимает шаг посадки с тикера. */
  private removeLandingStep(): void {
    if (this.landingStep) this.ticker.remove(this.landingStep)

    this.landingStep = null
  }

  /** Запускает бесконечную прокрутку: символы проигрывают blur анимацию. */
  spin(): void {
    if (this.isSpinning || this.isLanding) return

    this.symbols.forEach((symbol) => symbol.blur())

    this.spinStep = (ticker: Ticker) => {
      const step = SPIN_SPEED * ticker.deltaTime

      for (let index = 0; index < this.symbols.length; index++) {
        const symbol = this.symbols[index]

        symbol.view.y += step

        if (this.wrapSymbol(symbol)) this.showRandomSymbol(symbol)
      }
    }

    this.ticker.add(this.spinStep)
  }

  /**
   * Ловит барабан: докручивает ленту до ровной посадки символов в слоты и подставляет финальные символы.
   * `offsetCells` — дополнительные ячейки прокрутки до торможения, ими барабаны стопятся лесенкой.
   * Барабан, который не крутится, резолвится сразу.
   */
  land(symbolKeys: SymbolKey[], offsetCells: number, signal?: AbortSignal): Promise<void> {
    if (!this.isSpinning) return Promise.resolve()

    this.removeSpinStep()

    const plan = planLanding(this.stripY, this.cellHeight, this.stripHeight, offsetCells)

    return this.runLanding(plan, symbolKeys, signal)
  }

  /** Ставит символы в видимые слоты сверху вниз и переводит их в покой. Рассчитан на заполнение доски до прокрутки. */
  setSymbols(symbolKeys: SymbolKey[]): void {
    symbolKeys.forEach((key, slotIndex) => {
      const symbol = this.getSlotSymbol(slotIndex)

      symbol.setKey(key)
      symbol.idle()
    })
  }

  /** Раскладывает ленту по ячейкам высотой `cellHeight`; первый символ встаёт в буферную ячейку над зоной. */
  layout(cellHeight: number): void {
    this.cellHeight = cellHeight

    this.symbols.forEach((symbol, index) => {
      symbol.view.position.set(0, cellHeight * (index - BUFFER_SYMBOLS_COUNT))
    })
  }
}
