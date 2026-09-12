import type { ReelPhase } from 'src/core/reels/types'

/** Движение барабана: ведёт ленту по кадрам. Барабан держит одно текущее движение и снимает его по `isDone`. */
export type ReelMotion = {
  /** Фаза барабана, пока идёт движение. */
  readonly phase: ReelPhase
  advance(deltaFrames: number): void
  /** Проматывает движение к финальному участку; движение без него не меняется. */
  slam(): void
  isDone(): boolean
}

/** Падающий слот ленты: откуда и куда он падает, в единицах машины. */
export type FallingSlot = {
  readonly slotIndex: number
  readonly row: number
  readonly from: number
  readonly to: number
}
