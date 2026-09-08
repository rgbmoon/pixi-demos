import type { Cell } from './cell'
import { DEFAULT_BUFFER } from './constants'
import { Reel } from './reel'
import { Row } from './row'
import type { CellIndex, ReelDef, ReelOptions, ReelsConfig } from './types'
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

  constructor(config: ReelsConfig<TData, TValue>) {
    this.config = config
    this.data = config.data ?? null
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

  spin(): void {
    for (const reel of this.reels) {
      reel.spin()
    }
  }

  async land(signal?: AbortSignal): Promise<void> {
    await Promise.all(this.reels.map((reel) => reel.land(signal)))
  }

  advance(deltaFrames: number): void {
    for (const reel of this.reels) {
      reel.advance(deltaFrames)
    }
  }

  /** Опции барабана: конфиг машины, перекрытый его описанием. */
  private resolveOptions(def: ReelDef<TData, TValue>): ReelOptions<TData, TValue> {
    const { rows, buffer, cellHeight, accessorFn, getFillerValue, spinStrategy, landingStrategy } = this.config

    return {
      rows: def.rows ?? rows,
      buffer: def.buffer ?? buffer ?? DEFAULT_BUFFER,
      cellHeight,
      accessorFn: def.accessorFn ?? accessorFn,
      getFillerValue,
      spinStrategy: def.spinStrategy ?? spinStrategy,
      landingStrategy: def.landingStrategy ?? landingStrategy,
    }
  }
}
