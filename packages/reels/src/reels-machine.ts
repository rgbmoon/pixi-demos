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
  ReelsData,
  ReelsModel,
  ReelStrategies,
  SpinOptions,
} from './types'
import { ReelPhase } from './types'
import { getDataValues, pickRandom } from './utils'

/**
 * Рил-машина: корневая сущность модели барабанов
 */
export class ReelsMachine<TValue> implements ReelsModel<TValue> {
  readonly cellHeight: number

  private readonly config: ReelsConfig<TValue>
  private readonly reels: Reel<TValue>[]
  private readonly rows: Row<TValue>[]

  private data: ReelsData<TValue> | null
  private strategies: ReelStrategies
  /** Значения последних непустых данных раунда: из них берётся наполнение, если конфиг не задал `getFillerValue`. */
  private fillerValues: TValue[]
  /** Промотка запрошена до старта посадки или падения: ближайшие `land` или `cascade` применят её сразу после запуска. */
  private isSlamPending = false

  constructor(config: ReelsConfig<TValue>) {
    this.config = config
    this.cellHeight = config.cellHeight
    this.data = config.data ?? null
    this.fillerValues = this.data ? getDataValues(this.data) : []

    if (!config.getFillerValue && this.fillerValues.length === 0) {
      throw new Error('ReelsMachine: config needs getFillerValue or data with at least one value')
    }

    this.strategies = {
      spinStrategy: config.spinStrategy,
      landingStrategy: config.landingStrategy,
      fallStrategy: config.fallStrategy,
    }
    this.reels = config.reels.map((def, index) => new Reel(this, def, index, this.resolveOptions(def)))
    this.rows = Array.from({ length: config.rows }, (_, index) => new Row(this, index))
  }

  getData(): ReelsData<TValue> | null {
    return this.data
  }

  /** Записывает данные раунда в модель. Эти данные будут отображены на барабанах к концу посадки или сразу после `reset` */
  setData(data: ReelsData<TValue> | null): void {
    this.data = data

    const values = data ? getDataValues(data) : []

    // Пустые данные наполнение не сбрасывают: слоту всегда есть из чего взять значение
    if (values.length > 0) this.fillerValues = values
  }

  /** Стратегии машины по умолчанию */
  getStrategies(): ReelStrategies {
    return this.strategies
  }

  /** Меняет дефолтные стратегии; барабан применяет их со следующего вызова `spin`. */
  setStrategies(strategies: ReelStrategies): void {
    this.strategies = strategies
  }

  getReels(): Reel<TValue>[] {
    return this.reels
  }

  getReel(index: number): Reel<TValue> | undefined {
    return this.reels[index]
  }

  getRows(): Row<TValue>[] {
    return this.rows
  }

  getCell(index: CellIndex): Cell<TValue> | undefined {
    return this.reels[index.reel]?.getCell(index.row)
  }

  /** Ячейки поля по барабанам: сетка `[барабан][ряд]`. */
  getGrid(): Cell<TValue>[][] {
    return this.reels.map((reel) => reel.getCells())
  }

  /** Фаза машины по приоритету: `landing`, `spinning`, `falling`, если такая фаза есть хотя бы у одного барабана, иначе `idle`. */
  getPhase(): ReelPhase {
    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.landing)) return ReelPhase.landing

    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.spinning)) return ReelPhase.spinning

    if (this.reels.some((reel) => reel.getPhase() === ReelPhase.falling)) return ReelPhase.falling

    return ReelPhase.idle
  }

  /** Ставит барабаны на текущие данные без анимаций. Чаще всего используется для инициализации. */
  reset(): void {
    this.isSlamPending = false

    for (const reel of this.reels) {
      reel.reset()
    }
  }

  /** Запускает прокрутку всех барабанов, кроме барабанов из `held`. */
  spin(options: SpinOptions = {}): void {
    const { held = [] } = options

    for (const reel of this.reels) {
      if (!held.includes(reel.index)) reel.spin()
    }
  }

  /**
   * Сажает крутящиеся барабаны со stagger; порядок остановки — по индексу барабана. Барабан получает паузу
   * за каждый садящийся барабан из `anticipation` с индексом не больше своего, собственную — только если
   * он сам в списке.
   */
  async land(options: LandOptions = {}): Promise<void> {
    const { signal, anticipation = [], onReelLanded, onReelAnticipated } = options
    const spinning = this.reels.filter((reel) => reel.getPhase() === ReelPhase.spinning)
    // Удержанный барабан не садится, поэтому пауз соседям справа не добавляет
    const anticipating = spinning.map((reel) => reel.index).filter((index) => anticipation.includes(index))

    const landing = Promise.all(
      spinning.map(async (reel, order) => {
        await reel.land({
          signal,
          order,
          anticipationPauses: anticipating.filter((index) => index <= reel.index).length,
          isAnticipating: anticipating.includes(reel.index),
          onAnticipated: () => onReelAnticipated?.(reel.index),
        })

        onReelLanded?.(reel.index)
      })
    )

    await this.awaitMotions(landing)
  }

  /** Каскад по текущим данным в барабанах с ячейками из `removed`; номер для stagger — порядковый среди падающих. */
  async cascade(options: CascadeOptions): Promise<void> {
    const { removed, signal, onReelLanded } = options
    // Убранные ряды каждого барабана; барабан без них не падает и в порядок stagger не входит
    const falling = this.reels.flatMap((reel) => {
      const removedRows = removed
        .filter((cell) => cell.reel === reel.index && cell.row >= 0 && cell.row < reel.rows)
        .map((cell) => cell.row)

      return removedRows.length > 0 ? [{ reel, removedRows }] : []
    })

    const fall = Promise.all(
      falling.map(async ({ reel, removedRows }, order) => {
        await reel.cascade({ removedRows, order, signal })

        onReelLanded?.(reel.index)
      })
    )

    await this.awaitMotions(fall)
  }

  /**
   * Переводит посадку и падение всех барабанов к началу финального участка: они останавливаются одновременно.
   * До старта посадки или падения промотка запоминается и применяется к ближайшим `land` или `cascade`;
   * `reset` её снимает.
   */
  slam(): void {
    this.isSlamPending = true

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

  /** Ждёт запущенные движения; промотку, запрошенную до их старта, применяет сразу и снимает с их концом. */
  private async awaitMotions(motions: Promise<unknown>): Promise<void> {
    if (this.isSlamPending) this.slam()

    try {
      await motions
    } finally {
      this.isSlamPending = false
    }
  }

  /** Опции барабана: конфиг машины, перекрытый его описанием. */
  private resolveOptions(def: ReelDef): ReelOptions<TValue> {
    const { rows, buffer, cellHeight, getFillerValue } = this.config

    return {
      rows: def.rows ?? rows,
      buffer: def.buffer ?? buffer ?? DEFAULT_BUFFER,
      cellHeight,
      getFillerValue: getFillerValue ?? (() => pickRandom(this.fillerValues, Math.random)),
    }
  }
}
