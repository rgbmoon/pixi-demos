import type { Random } from './types'

/**
 * Детерминированный генератор чисел в `[0, 1)` по 32-битному сиду (mulberry32).
 * Нужен там, где случайность обязана воспроизводиться: моки сервера и наполнение лент.
 */
export const createRandom = (seed: number): Random => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let value = state

    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Случайный элемент списка по переданному генератору. */
export const pickRandom = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)]
