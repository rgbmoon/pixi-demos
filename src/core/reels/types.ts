import type { Cell } from './cell'
import type { Reel } from './reel'
import type { ReelsMachine } from './reels-machine'

/** Адрес ячейки поля: барабан и ряд в нём. */
export type CellIndex = {
  readonly reel: number
  readonly row: number
}

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

/** Стратегия прокрутки: путь ленты за `deltaFrames` кадров. */
export type SpinStrategy = {
  step(deltaFrames: number, context: ReelContext): number
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
  /** Место барабана в лесенке посадки: номер среди садящихся барабанов раунда. */
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
  /** Место барабана в лесенке посадки; по умолчанию — его индекс. */
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
  /** Сигнал промотки: при срабатывании до или во время посадки машина вызывает `slam`. */
  readonly slamSignal?: AbortSignal
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
  /** Место барабана в лесенке падения: номер среди падающих барабанов каскада. */
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
  /** Нужна для `cascade`; без неё каскад бросает ошибку конфигурации. */
  readonly fallStrategy?: FallStrategy
}

/** Настройки падения одного барабана. */
export type ReelCascadeOptions = {
  /** Ряды, ушедшие из поля. */
  readonly removedRows: readonly number[]
  /** Место барабана в лесенке падения; по умолчанию — его индекс. */
  readonly order?: number
  readonly signal?: AbortSignal
}

/** Настройки каскада машины. */
export type CascadeOptions = {
  /** Ячейки, ушедшие из поля: уцелевшие символы их колонок падают вниз, сверху падают новые. */
  readonly removed: readonly CellIndex[]
  readonly signal?: AbortSignal
  /** Сигнал промотки: при срабатывании до или во время падения машина вызывает `slam`. */
  readonly slamSignal?: AbortSignal
  /** Вызывается с номером барабана после остановки его слотов. */
  readonly onReelLanded?: (reel: number) => void
}

/** Слот ленты: значение, позиция и поза одного view-объекта. */
export type StripSlot<TValue> = {
  readonly id: string
  /** Значение, которое слот показывает сейчас. */
  value: TValue
  /** Позиция слота в единицах длины модели, свёрнутая в диапазон ленты. */
  offset: number
  /** Слот в движении: view показывает размытую позу. */
  moving: boolean
}

/** Произвольные данные барабана: игра расширяет интерфейс аугментацией модуля. */
export interface ReelMeta {
  readonly [key: string]: unknown
}

/** Описание барабана: перекрывает конфиг машины на своей ленте. */
export type ReelDef<TData, TValue> = {
  readonly id: string
  readonly rows?: number
  readonly buffer?: number
  readonly spinStrategy?: SpinStrategy
  readonly landingStrategy?: LandingStrategy
  readonly fallStrategy?: FallStrategy
  readonly accessorFn?: (data: TData, index: CellIndex) => TValue | undefined
  readonly meta?: ReelMeta
}

/** Конфиг машины: данные раунда, состав барабанов, геометрия и стратегии по умолчанию. */
export type ReelsConfig<TData, TValue> = ReelStrategies & {
  readonly reels: readonly ReelDef<TData, TValue>[]
  readonly rows: number
  readonly buffer?: number
  /** Высота ячейки — единица длины модели; адаптер переводит её в пиксели через свою высоту ячейки. */
  readonly cellHeight: number
  readonly data?: TData | null
  /** Достаёт значение ячейки из данных раунда; `undefined` — ячейки в результате нет. */
  readonly accessorFn: (data: TData, index: CellIndex) => TValue | undefined
  /** Значение слота вне результата раунда: на прокрутке и в буфере. */
  readonly getFillerValue: (reel: number) => TValue
}

/**
 * Опции барабана: конфиг машины, перекрытый `ReelDef`. Стратегий здесь нет: барабан получает их у машины
 * на каждом `spin`.
 */
export type ReelOptions<TData, TValue> = {
  readonly rows: number
  readonly buffer: number
  readonly cellHeight: number
  readonly accessorFn: (data: TData, index: CellIndex) => TValue | undefined
  readonly getFillerValue: (reel: number) => TValue
}

/** Барабан в контракте адаптера: число рядов, слоты ленты и счётчик их правок. */
export type ReelModel<TValue> = {
  readonly rows: number
  getRevision(): number
  getStrip(): readonly Readonly<StripSlot<TValue>>[]
  getVisibleSlotIndices(): number[]
}

/** Машина в контракте адаптера: барабаны, единица длины и шаг модели. */
export type ReelsModel<TValue> = {
  readonly cellHeight: number
  getReels(): readonly ReelModel<TValue>[]
  advance(deltaFrames: number): void
}

/** Контекст ячейки: машина, барабан, ячейка и её значение одним объектом. */
export type CellContext<TData, TValue> = {
  readonly machine: ReelsMachine<TData, TValue>
  readonly reel: Reel<TData, TValue>
  readonly cell: Cell<TData, TValue>
  getValue(): TValue | undefined
}
