import { Cell } from './cell'
import type { ReelsMachine } from './reels-machine'
import type { LandingPlan, ReelContext, ReelDef, ReelOptions, StripSlot } from './types'
import { ReelPhase } from './types'
import { getLap, wrapOffset } from './utils'

/**
 * Барабан: лента слотов, крутящаяся и садящаяся по расписанию стратегии.
 * Доступа к тикеру не имеет: величину шага приносит владелец вызовом `advance`.
 * Значения слотов читает из данных машины.
 */
export class Reel<TData, TValue> {
  readonly id: string
  readonly index: number
  readonly def: ReelDef<TData, TValue>
  readonly machine: ReelsMachine<TData, TValue>

  private readonly options: ReelOptions<TData, TValue>
  private readonly context: ReelContext
  private readonly cells: Cell<TData, TValue>[]
  private readonly strip: StripSlot<TValue>[]
  /**
   * Номер круга каждого слота: лента замкнута, и позиция слота — это бесконечный путь
   * `база + offset`, свёрнутый в её длину. Смена номера означает, что слот ушёл за нижнюю
   * границу и появился сверху заново, — момент, когда ему пора выдать новое значение.
   * Порог (`позиция >= высоты зоны`) для этого не годится: круг ловит обёртку в обе стороны.
   */
  private readonly laps: number[]
  /** Нижняя граница диапазона позиций: буферные ячейки лежат над зоной. */
  private readonly min: number

  private phase: ReelPhase = ReelPhase.idle
  /** Накопленный путь ленты: позиции слотов — производные от него. */
  private offset = 0
  private revision = 0

  private plan: LandingPlan | null = null
  private landingStart = 0
  private elapsed = 0
  private landingResolve: (() => void) | null = null
  private landingReject: ((reason: Error) => void) | null = null
  private landingSignal: AbortSignal | null = null

  constructor(
    machine: ReelsMachine<TData, TValue>,
    def: ReelDef<TData, TValue>,
    index: number,
    options: ReelOptions<TData, TValue>
  ) {
    const { rows, buffer, cellHeight } = options

    this.machine = machine
    this.def = def
    this.index = index
    this.id = def.id
    this.options = options
    this.min = -buffer * cellHeight
    this.context = {
      index,
      rows,
      buffer,
      cellHeight,
      stripHeight: (rows + buffer) * cellHeight,
    }

    this.cells = Array.from({ length: rows }, (_, row) => new Cell(this, row))
    this.strip = Array.from({ length: rows + buffer }, (_, slotIndex) => ({
      id: `${this.id}_slot_${slotIndex}`,
      value: options.getFillerValue(index),
      offset: this.getBase(slotIndex),
      span: 1,
      moving: false,
    }))
    this.laps = this.strip.map(() => 0)
  }

  getPhase(): ReelPhase {
    return this.phase
  }

  /**
   * Счётчик правок ленты: растёт на каждом сдвиге, смене значения слота, `reset` и `spin`.
   * По нему адаптер отличает изменившийся барабан от неподвижного.
   */
  getRevision(): number {
    return this.revision
  }

  getCells(): Cell<TData, TValue>[] {
    return this.cells
  }

  getCell(row: number): Cell<TData, TValue> | undefined {
    return this.cells[row]
  }

  /** Слоты ленты в порядке создания: он стабилен, поэтому по нему адаптер держит свои view. */
  getStrip(): readonly StripSlot<TValue>[] {
    return this.strip
  }

  /** Индексы слотов внутри видимой зоны сверху вниз; порядок берётся из позиций на ленте. */
  getVisibleSlotIndices(): number[] {
    return [...this.strip.keys()]
      .sort((a, b) => this.strip[a].offset - this.strip[b].offset)
      .slice(this.options.buffer)
  }

  getSlotAt(row: number): StripSlot<TValue> | undefined {
    const slotIndex = this.getVisibleSlotIndices()[row]

    return slotIndex === undefined ? undefined : this.strip[slotIndex]
  }

  /** Значение ряда в данных раунда; `undefined` — результата на него нет. */
  readValue(row: number): TValue | undefined {
    const data = this.machine.getData()

    if (data === null) return undefined

    return this.options.accessorFn(data, { reel: this.index, row })
  }

  /** Ставит ленту в исходную позицию и наполняет видимые ячейки данными раунда. Рассчитан на доску до прокрутки. */
  reset(): void {
    if (this.phase !== ReelPhase.idle) return

    this.offset = 0

    this.syncStrip()
    this.getVisibleSlotIndices().forEach((slotIndex, row) => {
      const value = this.readValue(row)

      if (value === undefined) return

      this.strip[slotIndex].value = value
      this.strip[slotIndex].moving = false
    })

    this.revision += 1
  }

  /** Запускает бесконечную прокрутку: слоты переходят в размытую позу. */
  spin(): void {
    if (this.phase !== ReelPhase.idle) return

    this.phase = ReelPhase.spinning

    for (const slot of this.strip) {
      slot.moving = true
    }

    this.revision += 1
  }

  /**
   * Ловит барабан: докручивает ленту до ровной посадки слотов и подставляет значения раунда.
   * Барабан, который не крутится, резолвится сразу.
   */
  land(signal?: AbortSignal): Promise<void> {
    if (this.phase !== ReelPhase.spinning) return Promise.resolve()

    this.phase = ReelPhase.landing
    this.landingStart = this.offset
    this.elapsed = 0
    this.plan = this.options.landingStrategy.plan({ ...this.context, fromOffset: this.offset })

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        this.stopLanding()
        reject(signal.reason as Error)

        return
      }

      this.landingResolve = resolve
      this.landingReject = reject
      this.landingSignal = signal ?? null

      signal?.addEventListener('abort', this.handleAbort, { once: true })
    })
  }

  /** Шаг модели: сдвигает ленту и наполняет обёрнутые слоты. Зовётся владельцем раз в кадр. */
  advance(deltaFrames: number): void {
    if (this.phase === ReelPhase.spinning) {
      this.advanceSpin(deltaFrames)

      return
    }

    if (this.phase === ReelPhase.landing) this.advanceLanding(deltaFrames)
  }

  /** Позиция слота на неподвижной ленте: буферные ячейки лежат над видимой зоной. */
  private getBase(slotIndex: number): number {
    return this.options.cellHeight * (slotIndex - this.options.buffer)
  }

  private advanceSpin(deltaFrames: number): void {
    this.offset += this.options.spinStrategy.step(deltaFrames, this.context)

    this.syncStrip((slot) => this.fill(slot))
  }

  private advanceLanding(deltaFrames: number): void {
    const { plan } = this

    if (!plan) return

    this.elapsed += deltaFrames

    const position = plan.positionAt(this.elapsed)
    const remaining = plan.distance - position

    this.offset = this.landingStart + position

    this.syncStrip((slot) => this.fillLanding(slot, remaining))

    if (this.elapsed < plan.totalFrames) return

    this.snap()

    const resolve = this.landingResolve

    this.stopLanding()
    resolve?.()
  }

  /**
   * Пересчитывает позиции слотов из накопленного пути и сообщает об обёртке.
   * Позиции производны от одного числа, поэтому слоты не расходятся накопленной погрешностью.
   */
  private syncStrip(onWrap?: (slot: StripSlot<TValue>) => void): void {
    const { stripHeight } = this.context

    for (let slotIndex = 0; slotIndex < this.strip.length; slotIndex++) {
      const slot = this.strip[slotIndex]
      const position = this.getBase(slotIndex) + this.offset
      const lap = getLap(position, this.min, stripHeight)

      slot.offset = wrapOffset(position, this.min, stripHeight)

      if (lap === this.laps[slotIndex]) continue

      this.laps[slotIndex] = lap

      onWrap?.(slot)
    }

    this.revision += 1
  }

  /** Наполняет слот значением вне результата раунда. */
  private fill(slot: StripSlot<TValue>): void {
    slot.value = this.options.getFillerValue(this.index)
    slot.moving = true
  }

  /**
   * Наполняет обёрнутый слот на посадке: точка его остановки известна на любом кадре,
   * поэтому на последнем обороте он сразу получает значение раунда и покой.
   */
  private fillLanding(slot: StripSlot<TValue>, remaining: number): void {
    const landingOffset = slot.offset + remaining

    if (landingOffset >= this.options.rows * this.options.cellHeight) {
      this.fill(slot)

      return
    }

    const value = this.readValue(Math.round(landingOffset / this.options.cellHeight))

    if (value === undefined) {
      this.fill(slot)

      return
    }

    slot.value = value
    slot.moving = false
  }

  /**
   * Добивает ленту точно на границу ячейки, гася накопленную за посадку погрешность.
   * Позы не меняет: покой каждый слот получил на своём последнем обороте, повтор сбросил бы фазу цикла.
   */
  private snap(): void {
    const { cellHeight } = this.options

    this.offset = Math.round(this.offset / cellHeight) * cellHeight

    this.syncStrip()

    // Свёртка оставляет на позициях остаток округления: добиваем слоты ровно на границы ячеек
    for (const slot of this.strip) {
      slot.offset = Math.round(slot.offset / cellHeight) * cellHeight
    }
  }

  private handleAbort = (): void => {
    const reject = this.landingReject
    const reason = this.landingSignal?.reason as Error

    this.stopLanding()
    reject?.(reason)
  }

  /** Снимает посадку и возвращает барабан в покой; идемпотентна. */
  private stopLanding(): void {
    this.landingSignal?.removeEventListener('abort', this.handleAbort)

    this.landingSignal = null
    this.landingResolve = null
    this.landingReject = null
    this.plan = null
    this.phase = ReelPhase.idle
  }
}
