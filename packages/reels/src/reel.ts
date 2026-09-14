import { Cell } from './cell'
import { FallMotion } from './motions/fall-motion'
import { LandingMotion } from './motions/landing-motion'
import { SpinMotion } from './motions/spin-motion'
import type { FallingSlot, ReelMotion } from './motions/types'
import { ReelStrip } from './reel-strip'
import type { ReelsMachine } from './reels-machine'
import type {
  ReelCascadeOptions,
  ReelContext,
  ReelDef,
  ReelLandOptions,
  ReelModel,
  ReelOptions,
  ReelStrategies,
  StripSlot,
} from './types'
import { ReelPhase } from './types'

/**
 * Барабан: ячейки, лента слотов и текущее движение. Движения строятся по стратегиям,
 * значения слотов берутся из данных машины.
 */
export class Reel<TValue> implements ReelModel<TValue> {
  readonly id: string
  readonly index: number
  readonly rows: number
  readonly def: ReelDef
  readonly machine: ReelsMachine<TValue>

  private readonly options: ReelOptions<TValue>
  private readonly context: ReelContext
  private readonly cells: Cell<TValue>[]
  private readonly strip: ReelStrip<TValue>

  /** Текущее движение барабана; `null` — барабан в покое. */
  private motion: ReelMotion | null = null
  /** Стратегии текущего раунда: фиксируются на старте спина. */
  private strategies: ReelStrategies

  private motionResolve: (() => void) | null = null
  private motionReject: ((reason: Error) => void) | null = null
  private motionSignal: AbortSignal | null = null

  constructor(machine: ReelsMachine<TValue>, def: ReelDef, index: number, options: ReelOptions<TValue>) {
    const { rows, buffer, cellHeight } = options

    this.machine = machine
    this.def = def
    this.index = index
    this.id = def.id
    this.rows = rows
    this.options = options
    this.context = {
      index,
      rows,
      buffer,
      cellHeight,
      stripHeight: (rows + buffer) * cellHeight,
    }

    this.cells = Array.from({ length: rows }, (_, row) => new Cell(this, row))
    this.strip = new ReelStrip(this.id, this.context, () => options.getFillerValue(index))
    this.strategies = this.resolveStrategies()
  }

  getPhase(): ReelPhase {
    return this.motion?.phase ?? ReelPhase.idle
  }

  getCells(): Cell<TValue>[] {
    return this.cells
  }

  getCell(row: number): Cell<TValue> | undefined {
    return this.cells[row]
  }

  /** Слоты в порядке создания; порядок не меняется, адаптер хранит view по этому индексу. */
  getStrip(): readonly Readonly<StripSlot<TValue>>[] {
    return this.strip.getSlots()
  }

  /** Индексы слотов видимых рядов сверху вниз. */
  getVisibleSlotIndices(): number[] {
    return this.strip.getVisibleSlotIndices()
  }

  getSlotAt(row: number): Readonly<StripSlot<TValue>> | undefined {
    const slotIndex = this.getVisibleSlotIndices()[row]

    return slotIndex === undefined ? undefined : this.strip.getSlot(slotIndex)
  }

  /** Значение ряда в данных раунда; `undefined` — результата на него нет. */
  readValue(row: number): TValue | undefined {
    return this.machine.getData()?.[this.index]?.[row]
  }

  /** Обнуляет путь ленты и записывает в видимые слоты значения из данных раунда. Работает только в покое. */
  reset(): void {
    if (this.motion) return

    this.strip.moveTo(0)
    this.getVisibleSlotIndices().forEach((slotIndex, row) => {
      const value = this.readValue(row)
      const slot = this.strip.getSlot(slotIndex)

      if (value === undefined) return

      slot.value = value
      slot.moving = false
    })
  }

  /** Запускает прокрутку: фиксирует стратегии раунда и переводит слоты в позу движения. */
  spin(): void {
    if (this.motion) return

    this.strategies = this.resolveStrategies()
    this.motion = new SpinMotion(this.strip, this.strategies.spinStrategy.plan(this.context), (slot) =>
      this.fill(slot)
    )

    for (const slot of this.strip.getSlots()) {
      slot.moving = true
    }
  }

  /**
   * Запускает посадку по плану `landingStrategy`; промис резолвится после остановки барабана.
   * Вне прокрутки резолвится сразу.
   */
  land(options: ReelLandOptions = {}): Promise<void> {
    const { signal, order = this.index, anticipationPauses = 0, isAnticipating = false, onAnticipated } = options
    const { motion } = this

    if (!(motion instanceof SpinMotion)) return Promise.resolve()

    const plan = this.strategies.landingStrategy.plan({
      ...this.context,
      order,
      fromOffset: this.strip.getOffset(),
      spunFrames: motion.getSpunFrames(),
      anticipationPauses,
      isAnticipating,
    })

    return this.run(
      new LandingMotion(this.strip, plan, (slot, remaining) => this.fillLanding(slot, remaining), onAnticipated),
      signal
    )
  }

  /**
   * Каскад: слоты рядов `removedRows` получают значения новых верхних рядов и падают сверху, уцелевшие
   * опускаются на освободившиеся ряды. Работает только в покое; данные раунда повторяют значения уцелевших.
   */
  cascade(options: ReelCascadeOptions): Promise<void> {
    const { removedRows, order = this.index, signal } = options
    const { rows, cellHeight } = this.options
    const removed = new Set(removedRows.filter((row) => row >= 0 && row < rows))

    if (this.motion || removed.size === 0) return Promise.resolve()

    if (signal?.aborted) return Promise.reject(signal.reason as Error)

    const count = removed.size
    const visible = this.getVisibleSlotIndices()
    const falling: FallingSlot[] = []

    // Уцелевшие занимают нижние ряды в прежнем порядке; слот, чей ряд не изменился, не падает
    visible
      .filter((_, row) => !removed.has(row))
      .forEach((slotIndex, survivor) => {
        const row = count + survivor
        const from = this.strip.getSlot(slotIndex).offset

        if (visible[row] !== slotIndex) falling.push({ slotIndex, row, from, to: row * cellHeight })
      })

    // Убранные слоты получают новые значения и выстраиваются столбиком над зоной
    visible
      .filter((_, row) => removed.has(row))
      .forEach((slotIndex, row) => {
        const slot = this.strip.getSlot(slotIndex)
        const from = (row - count) * cellHeight

        slot.value = this.readValue(row) ?? this.options.getFillerValue(this.index)
        slot.moving = false

        this.strip.place(slotIndex, from)
        falling.push({ slotIndex, row, from, to: row * cellHeight })
      })

    const plan = this.strategies.fallStrategy.plan({
      ...this.context,
      order,
      drops: falling.map(({ row, from, to }) => ({ row, distance: to - from })),
    })

    return this.run(new FallMotion(this.strip, plan, falling), signal)
  }

  /** Переводит время текущего движения к началу финального участка; в покое и на прокрутке ничего не делает. */
  slam(): void {
    this.motion?.slam()
  }

  /** Продвигает текущее движение на `deltaFrames` кадров; закончившееся движение снимает и резолвит его промис. */
  advance(deltaFrames: number): void {
    const { motion } = this

    if (!motion) return

    motion.advance(deltaFrames)

    // Колбэк внутри движения мог отменить его, тогда промис уже отклонён
    if (motion !== this.motion || !motion.isDone()) return

    const resolve = this.motionResolve

    this.stopMotion()
    resolve?.()
  }

  /** Стратегии из `ReelDef`, недостающие — текущие стратегии машины. */
  private resolveStrategies(): ReelStrategies {
    const { spinStrategy, landingStrategy, fallStrategy } = this.machine.getStrategies()

    return {
      spinStrategy: this.def.spinStrategy ?? spinStrategy,
      landingStrategy: this.def.landingStrategy ?? landingStrategy,
      fallStrategy: this.def.fallStrategy ?? fallStrategy,
    }
  }

  /** Делает движение текущим и возвращает промис его конца; `signal` снимает движение и отклоняет промис. */
  private run(motion: ReelMotion, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        this.stopMotion()
        reject(signal.reason as Error)

        return
      }

      this.motion = motion
      this.motionResolve = resolve
      this.motionReject = reject
      this.motionSignal = signal ?? null

      signal?.addEventListener('abort', this.handleAbort, { once: true })
    })
  }

  /** Записывает в слот значение наполнения и позу движения. */
  private fill(slot: StripSlot<TValue>): void {
    slot.value = this.options.getFillerValue(this.index)
    slot.moving = true
  }

  /**
   * Значение перенесённого слота на посадке: ряд остановки вычисляется из остатка пути. Слот, которому
   * предстоит ещё круг, получает наполнение.
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

  // Поле, а не метод: отписка в stopMotion требует той же ссылки, что и подписка в run
  private handleAbort = (): void => {
    const reject = this.motionReject
    const reason = this.motionSignal?.reason as Error

    this.stopMotion()
    reject?.(reason)
  }

  /** Снимает текущее движение и подписку на `signal`; повторный вызов безопасен. */
  private stopMotion(): void {
    this.motionSignal?.removeEventListener('abort', this.handleAbort)

    this.motionSignal = null
    this.motionResolve = null
    this.motionReject = null
    this.motion = null
  }
}
