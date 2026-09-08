import { WRAP_EPSILON } from './constants'

/** Сколько ленте не хватает до ближайшей границы ячейки: добор до ровной посадки слотов. */
export const getAlignmentGap = (position: number, cellHeight: number): number => {
  const offset = ((position % cellHeight) + cellHeight) % cellHeight

  return (cellHeight - offset) % cellHeight
}

/**
 * Свёртка позиции слота в диапазон ленты `[min, min + stripHeight)`.
 * Позиция в пределах `WRAP_EPSILON` от верхней границы складывается в начало диапазона:
 * иначе слот, чья точка покоя попала на границу, паркуется под зоной вместо буфера над ней.
 */
export const wrapOffset = (position: number, min: number, stripHeight: number): number => {
  const wrapped = ((((position - min) % stripHeight) + stripHeight) % stripHeight) + min

  return wrapped >= min + stripHeight - WRAP_EPSILON ? min : wrapped
}

/**
 * Номер круга ленты: меняется, когда слот пересекает границу диапазона.
 * Обёртка ловится сменой круга, а не сравнением с порогом, — детект не зависит от направления.
 * Допуск тот же, что у `wrapOffset`: круг и позиция обязаны решать про границу одинаково.
 */
export const getLap = (position: number, min: number, stripHeight: number): number =>
  Math.floor((position - min + WRAP_EPSILON) / stripHeight)
