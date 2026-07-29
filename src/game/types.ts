/** Расписание посадки барабана: путь ленты до остановки и её позиция на любом кадре посадки. */
export type LandingPlan = {
  /** Полный путь ленты до остановки, px. */
  readonly distance: number
  /** Длительность посадки в кадрах приведённой частоты. */
  readonly totalFrames: number
  /** Позиция ленты через `frames` кадров после начала посадки, px от её старта. */
  positionAt(frames: number): number
}
