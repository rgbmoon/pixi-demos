import type { ReelPhase } from '#src/types'

/** Движение ленты барабана по кадрам. У барабана одно текущее движение, после `isDone()` барабан его снимает. */
export type ReelMotion = {
  /** Фаза барабана, пока идёт движение. */
  readonly phase: ReelPhase
  advance(deltaFrames: number): void
  /** Переводит время движения к началу финального участка; без такого участка ничего не делает. */
  slam(): void
  isDone(): boolean
}

/** Падающий слот ленты: начальная и конечная позиция, в единицах длины модели. */
export type FallingSlot = {
  readonly slotIndex: number
  readonly row: number
  readonly from: number
  readonly to: number
}
