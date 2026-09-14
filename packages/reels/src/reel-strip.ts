import type { ReelContext, StripSlot } from './types'
import { getLap, wrapOffset } from './utils'

/**
 * Лента барабана: слоты, их базы, номера кругов и путь ленты. Позиция слота — база плюс путь, приведённые
 * к диапазону ленты; `place` ставит слот на позицию напрямую.
 */
export class ReelStrip<TValue> {
  private readonly context: ReelContext
  private readonly slots: StripSlot<TValue>[]
  /** Позиция каждого слота при нулевом пути ленты; после падения каскада переписывается `rebase`. */
  private readonly bases: number[]
  /**
   * Номер круга каждого слота: сколько раз путь `база + offset` перешёл границу ленты в любую сторону.
   * Смена номера означает полный оборот слота: в этот момент он получает новое значение.
   */
  private readonly laps: number[]
  /** Нижняя граница диапазона позиций, `-buffer * cellHeight`: буферные слоты лежат над видимой зоной. */
  private readonly min: number

  /** Путь ленты: позиции слотов вычисляются из него и баз. */
  private offset = 0

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

  /** Слоты в порядке создания; порядок не меняется, адаптер хранит view по этому индексу. */
  getSlots(): readonly StripSlot<TValue>[] {
    return this.slots
  }

  getSlot(slotIndex: number): StripSlot<TValue> {
    return this.slots[slotIndex]
  }

  getOffset(): number {
    return this.offset
  }

  /** Индексы слотов видимых рядов сверху вниз, отсортированные по позиции. */
  getVisibleSlotIndices(): number[] {
    return [...this.slots.keys()].sort((a, b) => this.slots[a].offset - this.slots[b].offset).slice(this.context.buffer)
  }

  /**
   * Задаёт путь ленты и пересчитывает позиции слотов; `onWrap` вызывается для слотов, сменивших круг.
   * Позиции вычисляются из одного числа, поэтому погрешность между слотами не накапливается.
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
  }

  /** Ставит слот на позицию без приведения к диапазону ленты: у падающих слотов каскада пути разные. */
  place(slotIndex: number, position: number): void {
    this.slots[slotIndex].offset = position
  }

  /**
   * Выравнивает путь и позиции слотов на границы ячеек, убирая погрешность посадки.
   * Позы не меняет: повторная смена позы сбросила бы idle-анимацию.
   */
  snap(): void {
    const { cellHeight } = this.context

    this.moveTo(Math.round(this.offset / cellHeight) * cellHeight)

    // После приведения к диапазону на позициях остаётся погрешность округления
    for (const slot of this.slots) {
      slot.offset = Math.round(slot.offset / cellHeight) * cellHeight
    }
  }

  /**
   * Записывает текущие позиции слотов в базы и обнуляет путь. Нужна после падения: порядок слотов на ленте
   * отличается от прежних баз.
   */
  rebase(): void {
    const { stripHeight } = this.context

    this.offset = 0

    this.slots.forEach((slot, slotIndex) => {
      this.bases[slotIndex] = slot.offset
      this.laps[slotIndex] = getLap(slot.offset, this.min, stripHeight)
    })
  }
}
