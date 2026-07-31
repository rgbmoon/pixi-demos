/** Геометрия линии выплат: ряд (0..2) на каждом барабане и вертикальный сдвиг линии в долях высоты ячейки. */
export type PaylineShape = {
  readonly rows: number[]
  readonly offsetCells: number
}

/** Расписание посадки барабана: путь ленты до остановки и её позиция на любом кадре посадки. */
export type LandingPlan = {
  /** Полный путь ленты до остановки, px. */
  readonly distance: number
  /** Длительность посадки в кадрах приведённой частоты. */
  readonly totalFrames: number
  /** Позиция ленты через `frames` кадров после начала посадки, px от её старта. */
  positionAt(frames: number): number
}
