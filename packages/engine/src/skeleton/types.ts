// База стаб-скелета — данные, а не PIXI-объекты: слоты со ссылкой на текстуру манифеста и клипы
// с ключевыми кадрами по свойствам. Спрайты `StubSkeleton` собирает из этого описания сам.

/** Свойство слота, которое умеет вести таймлайн. */
export type StubProperty = 'x' | 'y' | 'scale' | 'alpha' | 'rotation' | 'visible'

/** Ключевой кадр: значение свойства в момент `time` (секунды от начала клипа). */
export type StubKey = {
  readonly time: number
  readonly value: number
}

/** Дорожка одного свойства одного слота. Значения линейные, `visible` — ступенчато 0/1. */
export type StubTimelineData = {
  readonly slot: string
  readonly property: StubProperty
  readonly keys: readonly StubKey[]
}

/** Клип скелета. Нулевая длительность — неподвижная поза: по ней скелет снимается с тикера. */
export type StubAnimationData = {
  readonly duration: number
  readonly timelines: readonly StubTimelineData[]
}

/** Слот скелета: спрайт с текстурой из манифеста и его setup-поза в единицах скелета. */
export type StubSlotData = {
  readonly name: string
  readonly texture: string
  readonly x?: number
  readonly y?: number
  readonly visible?: boolean
  readonly alpha?: number
  readonly scale?: number
}

/** Описание скелета: слоты в порядке отрисовки и клипы по именам анимаций. */
export type StubSkeletonData = {
  readonly slots: readonly StubSlotData[]
  readonly animations: Readonly<Record<string, StubAnimationData>>
}

/**
 * Слушатель трека стаба: те же `complete` и `dispose`, что у `AnimationStateListener`.
 * Саму запись трека колбэку не передаёт — в проекте её никто не читает.
 */
export type StubTrackListener = {
  complete?: () => void
  dispose?: () => void
}
