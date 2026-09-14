import { WRAP_EPSILON } from './constants'
import type { ReelsData } from './types'

/** Значения данных раунда по всем ячейкам, без ячеек, которых в результате нет. */
export const getDataValues = <TValue>(data: ReelsData<TValue>): TValue[] =>
  data.flatMap((reel) => reel.filter((value): value is TValue => value !== undefined))

/** Сколько пути не хватает до ближайшей границы ячейки: добор до ровной посадки слотов. */
export const getAlignmentGap = (position: number, cellHeight: number): number => {
  const offset = ((position % cellHeight) + cellHeight) % cellHeight

  return (cellHeight - offset) % cellHeight
}

/**
 * Приводит позицию слота к диапазону ленты `[min, min + stripHeight)`. Позиция ближе `WRAP_EPSILON`
 * к верхней границе переходит в начало диапазона.
 */
export const wrapOffset = (position: number, min: number, stripHeight: number): number => {
  const wrapped = ((((position - min) % stripHeight) + stripHeight) % stripHeight) + min

  return wrapped >= min + stripHeight - WRAP_EPSILON ? min : wrapped
}

/**
 * Номер круга ленты: меняется, когда слот пересекает границу диапазона в любую сторону.
 * Допуск тот же, что у `wrapOffset`: круг и позиция обязаны одинаково трактовать границу.
 */
export const getLap = (position: number, min: number, stripHeight: number): number =>
  Math.floor((position - min + WRAP_EPSILON) / stripHeight)
