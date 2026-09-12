import type { ReelContext, StripSlot } from './types'
import { getLap, wrapOffset } from './utils'

/**
 * Лента барабана: слоты, их базы на неподвижной ленте, номера кругов и накопленный путь.
 * Позиция слота — база плюс путь, свёрнутые в длину ленты; падение каскада ставит слоты по одному.
 */
export class ReelStrip<TValue> {
  private readonly context: ReelContext
  private readonly slots: StripSlot<TValue>[]
  /** Позиция каждого слота на неподвижной ленте. Своя у каждого слота: падение меняет их порядок. */
  private readonly bases: number[]
  /**
   * Номер круга каждого слота: лента замкнута, и позиция слота — это бесконечный путь
   * `база + offset`, свёрнутый в её длину. Смена номера означает, что слот ушёл за нижнюю
   * границу и появился сверху заново, — момент, когда ему пора выдать новое значение.
   * Порог (`позиция >= высоты зоны`) для этого не годится: круг ловит обёртку в обе стороны.
   */
  private readonly laps: number[]
  /** Нижняя граница диапазона позиций: буферные ячейки лежат над зоной. */
  private readonly min: number

  /** Накопленный путь ленты: позиции слотов — производные от него. */
  private offset = 0
  private revision = 0

  constructor(id: string, context: ReelContext, createValue: () => TValue) {
    const { rows, buffer, cellHeight } = context

    this.context = context
    this.min = -buffer * cellHeight
    this.bases = Array.from({ length: rows + buffer }, (_, slotIndex) => cellHeight * (slotIndex - buffer))
    this.slots = this.bases.map((base, slotIndex) => ({
      id: `${id}_slot_${slotIndex}`,
      value: createValue(),
      offset: base,
      moving: false,
    }))
    this.laps = this.slots.map(() => 0)
  }

  /** Слоты в порядке создания: он стабилен, поэтому по нему адаптер держит свои view. */
  getSlots(): readonly StripSlot<TValue>[] {
    return this.slots
  }

  getSlot(slotIndex: number): StripSlot<TValue> {
    return this.slots[slotIndex]
  }

  getOffset(): number {
    return this.offset
  }

  /** Счётчик правок ленты: растёт на каждом сдвиге, перестановке и смене значений слотов. */
  getRevision(): number {
    return this.revision
  }

  /** Отмечает правку значений или поз слотов, сделанную владельцем напрямую. */
  touch(): void {
    this.revision += 1
  }

  /** Индексы слотов внутри видимой зоны сверху вниз; порядок берётся из позиций на ленте. */
  getVisibleSlotIndices(): number[] {
    return [...this.slots.keys()]
      .sort((a, b) => this.slots[a].offset - this.slots[b].offset)
      .slice(this.context.buffer)
  }

  /**
   * Ставит путь ленты и пересчитывает позиции слотов; `onWrap` получает слоты, сменившие круг.
   * Позиции производны от одного числа, поэтому слоты не расходятся накопленной погрешностью.
   */
  moveTo(offset: number, onWrap?: (slot: StripSlot<TValue>) => void): void {
    const { stripHeight } = this.context

    this.offset = offset

    for (let slotIndex = 0; slotIndex < this.slots.length; slotIndex++) {
      const slot = this.slots[slotIndex]
      const position = this.bases[slotIndex] + offset
      const lap = getLap(position, this.min, stripHeight)

      slot.offset = wrapOffset(position, this.min, stripHeight)

      if (lap === this.laps[slotIndex]) continue

      this.laps[slotIndex] = lap

      onWrap?.(slot)
    }

    this.revision += 1
  }

  /** Ставит один слот на позицию вне свёртки ленты: падение ведёт слоты каждый своим путём. */
  place(slotIndex: number, position: number): void {
    this.slots[slotIndex].offset = position

    this.revision += 1
  }

  /**
   * Добивает ленту точно на границу ячейки, гася накопленную за посадку погрешность.
   * Позы не меняет: покой каждый слот получил на своём последнем обороте, повтор сбросил бы фазу цикла.
   */
  snap(): void {
    const { cellHeight } = this.context

    this.moveTo(Math.round(this.offset / cellHeight) * cellHeight)

    // Свёртка оставляет на позициях остаток округления: добиваем слоты ровно на границы ячеек
    for (const slot of this.slots) {
      slot.offset = Math.round(slot.offset / cellHeight) * cellHeight
    }
  }

  /**
   * Делает текущие позиции слотов базами неподвижной ленты и обнуляет путь.
   * Зовётся после падения: слоты стоят на границах ячеек, но в другом порядке, чем задают прежние базы.
   */
  rebase(): void {
    const { stripHeight } = this.context

    this.offset = 0

    this.slots.forEach((slot, slotIndex) => {
      this.bases[slotIndex] = slot.offset
      this.laps[slotIndex] = getLap(slot.offset, this.min, stripHeight)
    })

    this.revision += 1
  }
}
