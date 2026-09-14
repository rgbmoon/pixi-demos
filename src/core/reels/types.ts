/** Адрес ячейки поля: барабан и ряд в нём. */
export type CellIndex = {
  readonly reel: number
  readonly row: number
}

/** Данные раунда: значения ячеек по барабанам, `[барабан][ряд]`; `undefined` — ячейки в результате нет. */
export type ReelsData<TValue> = readonly (readonly (TValue | undefined)[])[]

/** Фаза барабана: покой, прокрутка, посадка, падение каскада. */
export const ReelPhase = {
  idle: 'idle',
  spinning: 'spinning',
  landing: 'landing',
  falling: 'falling',
} as const

export type ReelPhase = (typeof ReelPhase)[keyof typeof ReelPhase]

/** Геометрия барабана для стратегий. */
export type ReelContext = {
  readonly index: number
  readonly rows: number
  readonly buffer: number
  readonly cellHeight: number
  readonly stripHeight: number
}

/** Расписание прокрутки: позиция ленты на любом кадре от старта спина. Конца у прокрутки нет. */
export type SpinPlan = {
  /** Путь ленты от старта спина через `frames` кадров; отрицательный путь двигает ленту вверх. */
  positionAt(frames: number): number
}

/** Стратегия прокрутки: план пути ленты от старта спина. */
export type SpinStrategy = {
  plan(context: ReelContext): SpinPlan
}

/** Расписание посадки барабана: путь ленты до остановки и её позиция на любом кадре посадки. */
export type LandingPlan = {
  /** Полный путь ленты до остановки, в единицах длины модели. */
  readonly distance: number
  /** Длительность посадки в кадрах. */
  readonly totalFrames: number
  /** Начало финального участка посадки: до этого кадра `slam` проматывает расписание. */
  readonly settleFrames: number
  /** Кадр начала собственной паузы anticipation: без паузы барабан остановился бы в этом кадре. */
  readonly anticipationFrames?: number
  /** Путь ленты от начала посадки через `frames` кадров. */
  positionAt(frames: number): number
}

export type LandingContext = ReelContext & {
  /** Порядковый номер барабана среди садящихся в раунде: по нему стратегия считает stagger. */
  readonly order: number
  /** Позиция ленты в момент начала посадки. */
  readonly fromOffset: number
  /** Сколько кадров барабан крутился до начала посадки. */
  readonly spunFrames: number
  /** Число пауз anticipation до посадки барабана, включая его собственную; 0 — обычное расписание. */
  readonly anticipationPauses: number
  /** У барабана есть собственная пауза anticipation; без неё он только сдвигается за соседями слева. */
  readonly isAnticipating: boolean
}

/** Настройки посадки одного барабана. */
export type ReelLandOptions = {
  readonly signal?: AbortSignal
  /** Порядковый номер барабана среди садящихся, для stagger; по умолчанию — его индекс. */
  readonly order?: number
  /** Число пауз anticipation до посадки барабана, включая его собственную. */
  readonly anticipationPauses?: number
  /** У барабана есть собственная пауза anticipation. */
  readonly isAnticipating?: boolean
  /** Вызывается в кадре начала собственной паузы; пауза, промотанная `slam`, не объявляется. */
  readonly onAnticipated?: () => void
}

/** Настройки прокрутки машины на раунд. */
export type SpinOptions = {
  /** Индексы удержанных барабанов: на этот раунд они не крутятся. */
  readonly held?: readonly number[]
}

/** Настройки посадки машины на раунд. */
export type LandOptions = {
  readonly signal?: AbortSignal
  /** Индексы барабанов, которые садятся с паузой anticipation. */
  readonly anticipation?: readonly number[]
  /** Вызывается с номером барабана после его остановки. */
  readonly onReelLanded?: (reel: number) => void
  /** Вызывается с номером барабана в кадре начала его собственной паузы; пауза, промотанная `slam`, не объявляется. */
  readonly onReelAnticipated?: (reel: number) => void
}

/** Стратегия посадки: план пути от текущей позиции ленты. */
export type LandingStrategy = {
  plan(context: LandingContext): LandingPlan
}

/** Падающий слот каскада: ряд, в который он садится, и путь до него. */
export type FallDrop = {
  readonly row: number
  /** Путь слота до ряда, в единицах длины модели. */
  readonly distance: number
}

export type FallContext = ReelContext & {
  /** Порядковый номер барабана среди падающих в каскаде: по нему стратегия считает stagger. */
  readonly order: number
  /** Падающие слоты барабана. */
  readonly drops: readonly FallDrop[]
}

/** Расписание падения: путь каждого падающего слота на любом кадре. */
export type FallPlan = {
  /** Длительность падения в кадрах. */
  readonly totalFrames: number
  /** Кадр, к которому все слоты коснулись своих рядов: до него `slam` проматывает падение. */
  readonly settleFrames: number
  /** Путь слота `drop` (индекс в `FallContext.drops`) через `frames` кадров после начала падения. */
  positionAt(drop: number, frames: number): number
}

/** Стратегия падения каскада: план пути каждого падающего слота. */
export type FallStrategy = {
  plan(context: FallContext): FallPlan
}

/** Стратегии движения барабана: как он крутится, как садится и как падает на каскаде. */
export type ReelStrategies = {
  readonly spinStrategy: SpinStrategy
  readonly landingStrategy: LandingStrategy
  readonly fallStrategy: FallStrategy
}

/** Настройки падения одного барабана. */
export type ReelCascadeOptions = {
  /** Ряды, ушедшие из поля. */
  readonly removedRows: readonly number[]
  /** Порядковый номер барабана среди падающих, для stagger; по умолчанию — его индекс. */
  readonly order?: number
  readonly signal?: AbortSignal
}

/** Настройки каскада машины. */
export type CascadeOptions = {
  /** Ячейки, ушедшие из поля: уцелевшие символы их колонок падают вниз, сверху падают новые. */
  readonly removed: readonly CellIndex[]
  readonly signal?: AbortSignal
  /** Вызывается с номером барабана после остановки его слотов. */
  readonly onReelLanded?: (reel: number) => void
}

/** Слот ленты: значение, позиция и поза одного view-объекта. */
export type StripSlot<TValue> = {
  readonly id: string
  /** Значение, которое слот показывает сейчас. */
  value: TValue
  /** Позиция слота в единицах длины модели, приведённая к диапазону ленты. */
  offset: number
  /** Слот в движении: view показывает размытую позу. */
  moving: boolean
}

/** Произвольные данные барабана: игра расширяет интерфейс аугментацией модуля. */
export interface ReelMeta {
  readonly [key: string]: unknown
}

/** Описание барабана: перекрывает конфиг машины для этого барабана. */
export type ReelDef = {
  readonly id: string
  readonly rows?: number
  readonly buffer?: number
  readonly spinStrategy?: SpinStrategy
  readonly landingStrategy?: LandingStrategy
  readonly fallStrategy?: FallStrategy
  readonly meta?: ReelMeta
}

/** Состав барабанов, геометрия и стратегии по умолчанию. */
type ReelsLayoutConfig = ReelStrategies & {
  readonly reels: readonly ReelDef[]
  readonly rows: number
  readonly buffer?: number
  /** Высота ячейки — единица длины модели; адаптер переводит её в пиксели через свою высоту ячейки. */
  readonly cellHeight: number
}

/**
 * Конфиг машины. Значения слотов вне результата раунда берутся из `getFillerValue`; без неё — случайные
 * значения из данных раунда, поэтому тогда стартовые данные обязательны.
 */
export type ReelsConfig<TValue> = ReelsLayoutConfig &
  (
    | {
        /** Значение слота вне результата раунда: на прокрутке, в буфере, в ячейке без значения в данных. */
        readonly getFillerValue: (reel: number) => TValue
        readonly data?: ReelsData<TValue> | null
      }
    | {
        readonly getFillerValue?: undefined
        readonly data: ReelsData<TValue>
      }
  )

/**
 * Опции барабана: конфиг машины, перекрытый `ReelDef`. Стратегий здесь нет: барабан получает их у машины
 * на каждом `spin`.
 */
export type ReelOptions<TValue> = {
  readonly rows: number
  readonly buffer: number
  readonly cellHeight: number
  readonly getFillerValue: (reel: number) => TValue
}

/** Барабан в контракте адаптера: число рядов и слоты ленты. */
export type ReelModel<TValue> = {
  readonly rows: number
  getStrip(): readonly Readonly<StripSlot<TValue>>[]
  getVisibleSlotIndices(): number[]
}

/** Машина в контракте адаптера: барабаны, единица длины и шаг модели. */
export type ReelsModel<TValue> = {
  readonly cellHeight: number
  getReels(): readonly ReelModel<TValue>[]
  advance(deltaFrames: number): void
}
