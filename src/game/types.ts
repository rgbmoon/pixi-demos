import type { Container } from 'pixi.js'

/**
 * Слушатель трека. Параметр объявлен `never`, потому что колбэк вызывается с записью конкретной
 * реализации: по контравариантности параметров сюда подходит и `AnimationStateListener` Spine,
 * и слушатель стаба, а вызывающая сторона в `SpineAnimation` аргумент не читает.
 */
export type TrackListenerLike = {
  complete?: (entry: never) => void
  dispose?: (entry: never) => void
}

/** Запись трека: то, что `SpineAnimation` читает у `state.tracks`. */
export type TrackEntryLike = {
  readonly animation: { readonly duration: number } | null
  readonly mixingFrom: TrackEntryLike | null
  listener: TrackListenerLike | null
}

/** Состояние анимаций скелета: треки и операции над ними. */
export type SkeletonStateLike = {
  readonly tracks: readonly (TrackEntryLike | null)[]
  setAnimation(trackIndex: number, animationName: string, loop?: boolean): TrackEntryLike
  setEmptyAnimation(trackIndex: number, mixDuration?: number): TrackEntryLike
  clearTracks(): void
}

/**
 * Скелет в терминах игры — подмножество `Spine`, которым пользуются `SpinePool` и `SpineAnimation`.
 * Настоящий `Spine` подходит под интерфейс структурно, адаптер ему не нужен.
 */
export interface SkeletonLike extends Container {
  autoUpdate: boolean
  readonly skeleton: { setToSetupPose(): void }
  readonly state: SkeletonStateLike
  /** Применяет состояние за прошедшее время в секундах. */
  update(deltaSeconds: number): void
  removeSlotObjects(): void
}

/** Размер канваса в CSS-пикселях: считается один раз на маунте и дальше не меняется. */
export type CanvasSize = {
  readonly width: number
  readonly height: number
}

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
