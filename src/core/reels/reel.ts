import { Cell } from './cell'
import { FallMotion } from './motions/fall-motion'
import { LandingMotion } from './motions/landing-motion'
import { SpinMotion } from './motions/spin-motion'
import type { FallingSlot, ReelMotion } from './motions/types'
import type { ReelsMachine } from './reels-machine'
import { ReelStrip } from './strip'
import type {
  ReelCascadeOptions,
  ReelContext,
  ReelDef,
  ReelLandOptions,
  ReelOptions,
  ReelStrategies,
  StripSlot,
} from './types'
import { ReelPhase } from './types'

/**
 * Барабан: лента слотов, крутящаяся, садящаяся и падающая на каскаде по расписаниям стратегий.
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
  private readonly strip: ReelStrip<TValue>

  /** Текущее движение ленты; `null` — барабан в покое. */
  private motion: ReelMotion | null = null
  /** Стратегии текущего раунда: фиксируются на старте спина. */
  private strategies: ReelStrategies

  private motionResolve: (() => void) | null = null
  private motionReject: ((reason: Error) => void) | null = null
  private motionSignal: AbortSignal | null = null

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

  /**
   * Счётчик правок ленты: растёт на каждом сдвиге, смене значения слота, `reset` и `spin`.
   * По нему адаптер отличает изменившийся барабан от неподвижного.
   */
  getRevision(): number {
    return this.strip.getRevision()
  }

  getCells(): Cell<TData, TValue>[] {
    return this.cells
  }

  getCell(row: number): Cell<TData, TValue> | undefined {
    return this.cells[row]
  }

  /** Слоты ленты в порядке создания: он стабилен, поэтому по нему адаптер держит свои view. */
  getStrip(): readonly StripSlot<TValue>[] {
    return this.strip.getSlots()
  }

  /** Индексы слотов внутри видимой зоны сверху вниз; порядок берётся из позиций на ленте. */
  getVisibleSlotIndices(): number[] {
    return this.strip.getVisibleSlotIndices()
  }

  getSlotAt(row: number): StripSlot<TValue> | undefined {
    const slotIndex = this.getVisibleSlotIndices()[row]

    return slotIndex === undefined ? undefined : this.strip.getSlot(slotIndex)
  }

  /** Значение ряда в данных раунда; `undefined` — результата на него нет. */
  readValue(row: number): TValue | undefined {
    const data = this.machine.getData()

    if (data === null) return undefined

    return this.options.accessorFn(data, { reel: this.index, row })
  }

  /** Ставит ленту в исходную позицию и наполняет видимые ячейки данными раунда. Рассчитан на доску до прокрутки. */
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

    this.strip.touch()
  }

  /** Запускает бесконечную прокрутку: слоты переходят в размытую позу, стратегии раунда фиксируются. */
  spin(): void {
    if (this.motion) return

    this.strategies = this.resolveStrategies()
    this.motion = new SpinMotion(this.strip, this.strategies.spinStrategy, this.context, (slot) => this.fill(slot))

    for (const slot of this.strip.getSlots()) {
      slot.moving = true
    }

    this.strip.touch()
  }

  /**
   * Ловит барабан: докручивает ленту до ровной посадки слотов и подставляет значения раунда.
   * Барабан, который не крутится, резолвится сразу. Место в лесенке, паузы anticipation и колбэк входа
   * в собственную паузу приходят в `options`.
   */
  land(options: ReelLandOptions = {}): Promise<void> {
    const { signal, order = this.index, anticipation = 0, anticipating = false, onAnticipated } = options
    const { motion } = this

    if (!(motion instanceof SpinMotion)) return Promise.resolve()

    const plan = this.strategies.landingStrategy.plan({
      ...this.context,
      order,
      fromOffset: this.strip.getOffset(),
      spunFrames: motion.getSpunFrames(),
      anticipation,
      anticipating,
    })

    return this.run(
      new LandingMotion(this.strip, plan, (slot, remaining) => this.fillLanding(slot, remaining), onAnticipated),
      signal
    )
  }

  /**
   * Каскад: слоты рядов `removedRows` поднимаются над зоной и получают значения новых верхних рядов из данных
   * раунда, уцелевшие слоты сохраняют порядок и падают на освободившиеся ряды. Работает из покоя;
   * без убранных рядов резолвится сразу. Данные раунда обязаны повторять значения уцелевших слотов.
   */
  cascade(options: ReelCascadeOptions): Promise<void> {
    const { removedRows, order = this.index, signal } = options
    const { rows, cellHeight } = this.options
    const removed = new Set(removedRows.filter((row) => row >= 0 && row < rows))

    if (this.motion || removed.size === 0) return Promise.resolve()

    if (signal?.aborted) return Promise.reject(signal.reason as Error)

    const { fallStrategy } = this.strategies

    if (!fallStrategy) {
      throw new Error(`Reel ${this.id} has no fall strategy`)
    }

    const count = removed.size
    const visible = this.getVisibleSlotIndices()
    const falling: FallingSlot[] = []

    // Уцелевшие садятся в нижние ряды в прежнем порядке; не сменивший ряд слот не падает
    visible
      .filter((_, row) => !removed.has(row))
      .forEach((slotIndex, survivor) => {
        const row = count + survivor
        const from = this.strip.getSlot(slotIndex).offset

        if (visible[row] !== slotIndex) falling.push({ slotIndex, row, from, to: row * cellHeight })
      })

    // Убранные слоты встают столбиком над зоной с новыми значениями и падают на верхние ряды
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

    const plan = fallStrategy.plan({
      ...this.context,
      order,
      drops: falling.map(({ row, from, to }) => ({ row, distance: to - from })),
    })

    return this.run(new FallMotion(this.strip, plan, falling), signal)
  }

  /**
   * Проматывает текущее движение к финальному участку. План не меняется, двигается только время,
   * поэтому слоты получают значения раунда так же, как без промотки. Барабан в покое не трогает.
   */
  slam(): void {
    this.motion?.slam()
  }

  /** Шаг модели: двигает текущее движение и снимает его, когда оно кончилось. Зовётся владельцем раз в кадр. */
  advance(deltaFrames: number): void {
    const { motion } = this

    if (!motion) return

    motion.advance(deltaFrames)

    // Колбэк движения мог снять его отменой: тогда промис уже реджекнут
    if (motion !== this.motion || !motion.isDone()) return

    const resolve = this.motionResolve

    this.stopMotion()
    resolve?.()
  }

  /** Стратегии барабана: описание барабана перекрывает текущие стратегии машины. */
  private resolveStrategies(): ReelStrategies {
    const { spinStrategy, landingStrategy, fallStrategy } = this.machine.getStrategies()

    return {
      spinStrategy: this.def.spinStrategy ?? spinStrategy,
      landingStrategy: this.def.landingStrategy ?? landingStrategy,
      fallStrategy: this.def.fallStrategy ?? fallStrategy,
    }
  }

  /** Ставит движение с концом и отдаёт промис его завершения; `signal` реджектит его и возвращает барабан в покой. */
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

  private handleAbort = (): void => {
    const reject = this.motionReject
    const reason = this.motionSignal?.reason as Error

    this.stopMotion()
    reject?.(reason)
  }

  /** Снимает движение и возвращает барабан в покой; идемпотентна. */
  private stopMotion(): void {
    this.motionSignal?.removeEventListener('abort', this.handleAbort)

    this.motionSignal = null
    this.motionResolve = null
    this.motionReject = null
    this.motion = null
  }
}
