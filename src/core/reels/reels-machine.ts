import type { Cell } from './cell'
import { DEFAULT_BUFFER } from './constants'
import { Reel } from './reel'
import { Row } from './row'
import type {
  CascadeOptions,
  CellIndex,
  LandOptions,
  ReelDef,
  ReelOptions,
  ReelsConfig,
  ReelsModel,
  ReelStrategies,
  SpinOptions,
} from './types'
import { ReelPhase } from './types'

/**
 * Машина барабанов: данные раунда, барабаны и стратегии по умолчанию. Передаёт вызовы раунда барабанам
 * и вычисляет параметры, которые зависят от соседних барабанов.
 */
export class ReelsMachine<TData, TValue> implements ReelsModel<TValue> {
  readonly cellHeight: number

  private readonly config: ReelsConfig<TData, TValue>
  private readonly reels: Reel<TData, TValue>[]
  private readonly rows: Row<TData, TValue>[]

  private data: TData | null
  private strategies: ReelStrategies

  constructor(config: ReelsConfig<TData, TValue>) {
    this.config = config
    this.cellHeight = config.cellHeight
    this.data = config.data ?? null
    this.strategies = {
      spinStrategy: config.spinStrategy,
      landingStrategy: config.landingStrategy,
      fallStrategy: config.fallStrategy,
    }
    this.reels = config.reels.map((def, index) => new Reel(this, def, index, this.resolveOptions(def)))
    this.rows = Array.from({ length: config.rows }, (_, index) => new Row(this, index))
  }

  getData(): TData | null {
    return this.data
  }

  /** Записывает данные раунда: из них читают посадка, каскад и `Cell.getValue`. */
  setData(data: TData | null): void {
    this.data = data
  }

  /** Стратегии машины по умолчанию; барабан со своими стратегиями в `ReelDef` их перекрывает. */
  getStrategies(): ReelStrategies {
    return this.strategies
  }

  /** Меняет стратегии по умолчанию; барабан применяет их со следующего `spin`. */
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

  /** Фаза машины по приоритету: `landing`, `spinning`, `falling`, если такая фаза есть хотя бы у одного барабана, иначе `idle`. */
  getPhase(): ReelPhase {
    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.landing)) return ReelPhase.landing

    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.spinning)) return ReelPhase.spinning

    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.falling)) return ReelPhase.falling

    return ReelPhase.idle
  }

  /** Ставит ленты барабанов в покое на текущие данные: стартовая доска. */
  reset(): void {
    for (const reel of this.reels) {
      reel.reset()
    }
  }

  /** Запускает прокрутку всех барабанов, кроме `held`. */
  spin(options: SpinOptions = {}): void {
    const { held = [] } = options

    for (const reel of this.reels) {
      if (!held.includes(reel.index)) reel.spin()
    }
  }

  /**
   * Сажает крутящиеся барабаны лесенкой по их порядку. Барабан получает паузу за каждый барабан
   * из `anticipation` с индексом не больше своего, собственную — только если он сам в списке.
   */
  async land(options: LandOptions = {}): Promise<void> {
    const { signal, slamSignal, anticipation = [], onReelLanded, onReelAnticipated } = options
    const spinning = this.reels.filter((reel) => reel.getPhase() === ReelPhase.spinning)

    const landing = Promise.all(
      spinning.map(async (reel, order) => {
        await reel.land({
          signal,
          order,
          anticipationPauses: anticipation.filter((index) => index <= reel.index).length,
          isAnticipating: anticipation.includes(reel.index),
          onAnticipated: () => onReelAnticipated?.(reel.index),
        })

        onReelLanded?.(reel.index)
      })
    )

    await this.awaitWithSlam(landing, slamSignal)
  }

  /** Каскад по текущим данным в барабанах с ячейками из `removed`; место в лесенке — номер среди падающих. */
  async cascade(options: CascadeOptions): Promise<void> {
    const { removed, signal, slamSignal, onReelLanded } = options
    const falling = this.reels.flatMap((reel) => {
      const removedRows = removed.filter((cell) => cell.reel === reel.index).map((cell) => cell.row)

      return removedRows.length > 0 ? [{ reel, removedRows }] : []
    })

    const fall = Promise.all(
      falling.map(async ({ reel, removedRows }, order) => {
        await reel.cascade({ removedRows, order, signal })

        onReelLanded?.(reel.index)
      })
    )

    await this.awaitWithSlam(fall, slamSignal)
  }

  /** Переводит посадку и падение всех барабанов к началу финального участка: они останавливаются одновременно. */
  slam(): void {
    for (const reel of this.reels) {
      reel.slam()
    }
  }

  /** Продвигает движения всех барабанов на `deltaFrames` кадров. */
  advance(deltaFrames: number): void {
    for (const reel of this.reels) {
      reel.advance(deltaFrames)
    }
  }

  /** Ждёт движение и вызывает `slam` по `slamSignal`: сразу, если сигнал уже сработал, иначе в момент срабатывания. */
  private async awaitWithSlam(motion: Promise<unknown>, slamSignal?: AbortSignal): Promise<void> {
    if (slamSignal?.aborted) this.slam()

    slamSignal?.addEventListener('abort', this.handleSlam, { once: true })

    try {
      await motion
    } finally {
      slamSignal?.removeEventListener('abort', this.handleSlam)
    }
  }

  private handleSlam = (): void => {
    this.slam()
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
