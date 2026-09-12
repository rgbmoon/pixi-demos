import type { Cell } from './cell'
import { DEFAULT_BUFFER } from './constants'
import { Reel } from './reel'
import { Row } from './row'
import type { CellIndex, LandOptions, ReelDef, ReelOptions, ReelsConfig, ReelStrategies, SpinOptions } from './types'
import { ReelPhase } from './types'

/**
 * Машина барабанов: держит данные раунда, состав барабанов и общий такт модели.
 * Ничего не рисует и не знает про тикер — шаг приносит владелец вызовом `advance`.
 */
export class ReelsMachine<TData, TValue> {
  private readonly config: ReelsConfig<TData, TValue>
  private readonly reels: Reel<TData, TValue>[]
  private readonly rows: Row<TData, TValue>[]

  private data: TData | null
  private strategies: ReelStrategies

  constructor(config: ReelsConfig<TData, TValue>) {
    this.config = config
    this.data = config.data ?? null
    this.strategies = { spinStrategy: config.spinStrategy, landingStrategy: config.landingStrategy }
    this.reels = config.reels.map((def, index) => new Reel(this, def, index, this.resolveOptions(def)))
    this.rows = Array.from({ length: config.rows }, (_, index) => new Row(this, index))
  }

  getData(): TData | null {
    return this.data
  }

  /** Кладёт результат раунда: из него посадка берёт значения, а ячейки — `getValue`. */
  setData(data: TData | null): void {
    this.data = data
  }

  /** Стратегии машины по умолчанию; барабан со своими стратегиями в `ReelDef` их перекрывает. */
  getStrategies(): ReelStrategies {
    return this.strategies
  }

  /** Меняет стратегии машины по умолчанию. Барабаны берут их на старте спина, текущий раунд не меняется. */
  setStrategies(strategies: ReelStrategies): void {
    this.strategies = strategies
  }

  getReels(): Reel<TData, TValue>[] {
    return this.reels
  }

  getReel(index: number): Reel<TData, TValue> | undefined {
    return this.reels[index]
  }

  getRows(): Row<TData, TValue>[] {
    return this.rows
  }

  getCell(index: CellIndex): Cell<TData, TValue> | undefined {
    return this.reels[index.reel]?.getCell(index.row)
  }

  /** Ячейки поля по барабанам: сетка `[барабан][ряд]`. */
  getGrid(): Cell<TData, TValue>[][] {
    return this.reels.map((reel) => reel.getCells())
  }

  /** Фаза машины: садится, если садится хоть один барабан; крутится, если крутится хоть один. */
  getPhase(): ReelPhase {
    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.landing)) return ReelPhase.landing

    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.spinning)) return ReelPhase.spinning

    return ReelPhase.idle
  }

  /** Ставит ленты в исходную позицию по текущим данным: стартовая доска раунда. */
  reset(): void {
    for (const reel of this.reels) {
      reel.reset()
    }
  }

  /** Запускает прокрутку всех барабанов, кроме удержанных: те остаются в покое до конца раунда. */
  spin(options: SpinOptions = {}): void {
    const { held = [] } = options

    for (const reel of this.reels) {
      if (!held.includes(reel.index)) reel.spin()
    }
  }

  /**
   * Сажает крутящиеся барабаны; лесенка считается по их порядку, удержанные в ней не участвуют.
   * Барабан получает паузу за каждый барабан anticipation слева от себя и за
   * себя, если он в списке: так он не встанет раньше соседа, который ещё ждёт. Собственная пауза
   * есть только у барабанов из списка — о входе в неё сообщает `onReelAnticipated`.
   */
  async land(options: LandOptions = {}): Promise<void> {
    const { signal, anticipation = [], onReelLanded, onReelAnticipated } = options
    const spinning = this.reels.filter((reel) => reel.getPhase() === ReelPhase.spinning)

    await Promise.all(
      spinning.map(async (reel, order) => {
        await reel.land({
          signal,
          order,
          anticipation: anticipation.filter((index) => index <= reel.index).length,
          anticipating: anticipation.includes(reel.index),
          onAnticipated: () => onReelAnticipated?.(reel.index),
        })

        onReelLanded?.(reel.index)
      })
    )
  }

  /** Проматывает посадку всех садящихся барабанов к финальному участку: они встают одновременно. */
  slam(): void {
    for (const reel of this.reels) {
      reel.slam()
    }
  }

  advance(deltaFrames: number): void {
    for (const reel of this.reels) {
      reel.advance(deltaFrames)
    }
  }

  /** Опции барабана: конфиг машины, перекрытый его описанием. */
  private resolveOptions(def: ReelDef<TData, TValue>): ReelOptions<TData, TValue> {
    const { rows, buffer, cellHeight, accessorFn, getFillerValue } = this.config

    return {
      rows: def.rows ?? rows,
      buffer: def.buffer ?? buffer ?? DEFAULT_BUFFER,
      cellHeight,
      accessorFn: def.accessorFn ?? accessorFn,
      getFillerValue,
    }
  }
}
