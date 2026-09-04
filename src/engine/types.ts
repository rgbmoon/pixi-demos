import type { Container } from 'pixi.js'
import type { StubSkeletonData } from 'src/engine/skeleton/types'

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

/** Состав пула скелетов: что прогреть на старте и по какому описанию собирать скелет. */
export type SpinePoolConfig = {
  warmUp: readonly { skeleton: string; count: number }[]
  skeletons: ReadonlyMap<string, StubSkeletonData>
}

/** Пропорции макета игры: по ним хост считает размер канваса. */
export type CanvasConfig = {
  aspectRatio: number
}

/** Сцена глазами хоста: контейнер, который умеет разложиться под размер канваса. */
export interface SceneLike extends Container {
  layout(width: number, height: number): void
}

/** Размер канваса в CSS-пикселях: считается один раз на маунте и дальше не меняется. */
export type CanvasSize = {
  readonly width: number
  readonly height: number
}
