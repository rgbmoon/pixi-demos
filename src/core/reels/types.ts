import type { Cell } from './cell'
import type { Reel } from './reel'
import type { ReelsMachine } from './reels-machine'

/** Адрес ячейки поля: барабан и ряд в нём. */
export type CellIndex = {
  readonly reel: number
  readonly row: number
}

/** Фаза барабана: свободен, крутится, садится, падает на каскаде. */
export const ReelPhase = {
  idle: 'idle',
  spinning: 'spinning',
  landing: 'landing',
  falling: 'falling',
} as const

export type ReelPhase = (typeof ReelPhase)[keyof typeof ReelPhase]

/** Геометрия барабана: всё, что стратегии нужно знать о ленте. */
export type ReelContext = {
  readonly index: number
  readonly rows: number
  readonly buffer: number
  readonly cellHeight: number
  readonly stripHeight: number
}

/** Как барабан крутится: путь ленты за кадр. */
export type SpinStrategy = {
  step(deltaFrames: number, context: ReelContext): number
}

/** Расписание посадки барабана: путь ленты до остановки и её позиция на любом кадре посадки. */
export type LandingPlan = {
  /** Полный путь ленты до остановки, в единицах машины. */
  readonly distance: number
  /** Длительность посадки в кадрах приведённой частоты. */
  readonly totalFrames: number
  /** Начало финального участка посадки: до этого кадра `slam` проматывает расписание. */
  readonly settleFrames: number
  /** Начало собственной паузы anticipation: кадр, с которого барабан крутится сверх расписания без неё. */
  readonly anticipationFrames?: number
  /** Позиция ленты через `frames` кадров после начала посадки, в единицах машины от её старта. */
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
  readonly anticipation: number
  /** У барабана есть собственная пауза anticipation, а не только сдвиг за соседей слева. */
  readonly anticipating: boolean
}

/** Настройки посадки одного барабана. */
export type ReelLandOptions = {
  readonly signal?: AbortSignal
  /** Место барабана в лесенке посадки; по умолчанию — его индекс. */
  readonly order?: number
  /** Число пауз anticipation до посадки барабана, включая его собственную. */
  readonly anticipation?: number
  /** У барабана есть собственная пауза anticipation. */
  readonly anticipating?: boolean
  /** Зовётся синхронно из `advance`, когда барабан вошёл в собственную паузу; после `slam` не зовётся. */
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
  /** Зовётся с номером барабана, как только он встал. */
  readonly onReelLanded?: (reel: number) => void
  /** Зовётся синхронно из `advance` с номером барабана, вошедшего в паузу anticipation; после `slam` не зовётся. */
  readonly onReelAnticipated?: (reel: number) => void
}

/** Как барабан садится: строит расписание пути от текущей позиции ленты. */
export type LandingStrategy = {
  plan(context: LandingContext): LandingPlan
}

/** Падающий слот каскада: ряд, в который он садится, и путь до него. */
export type FallDrop = {
  readonly row: number
  /** Путь слота до ряда, в единицах машины. */
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
  /** Длительность падения в кадрах приведённой частоты. */
  readonly totalFrames: number
  /** Кадр, к которому все слоты коснулись своих рядов: до него `slam` проматывает падение. */
  readonly settleFrames: number
  /** Путь слота `drop` (индекс в `FallContext.drops`) через `frames` кадров после начала падения. */
  positionAt(drop: number, frames: number): number
}

/** Как слоты барабана падают на каскаде: строит расписание по падающим слотам. */
export type FallStrategy = {
  plan(context: FallContext): FallPlan
}

/** Стратегии движения барабана: как он крутится, как садится и как падает на каскаде. */
export type ReelStrategies = {
  readonly spinStrategy: SpinStrategy
  readonly landingStrategy: LandingStrategy
  /** Без неё машина каскадов не принимает. */
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
  /** Зовётся с номером барабана, как только его слоты встали. */
  readonly onReelLanded?: (reel: number) => void
}

/** Слот ленты: движущаяся ячейка, которую рисует адаптер. */
export type StripSlot<TValue> = {
  readonly id: string
  /** Значение, которое слот показывает сейчас. */
  value: TValue
  /** Позиция слота в единицах машины, свёрнутая в диапазон ленты. */
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
  /** Высота ячейки в единицах машины: их же адаптер кладёт в позиции view. */
  readonly cellHeight: number
  readonly data?: TData | null
  /** Достаёт значение ячейки из данных раунда; `undefined` — ячейки в результате нет. */
  readonly accessorFn: (data: TData, index: CellIndex) => TValue | undefined
  /** Значение ячейки вне результата раунда: наполнение ленты во время вращения. */
  readonly getFillerValue: (reel: number) => TValue
}

/**
 * Разрешённые опции барабана: конфиг машины, перекрытый описанием барабана.
 * Стратегий здесь нет: их можно сменить на ходу, и барабан берёт их у машины на старте спина.
 */
export type ReelOptions<TData, TValue> = {
  readonly rows: number
  readonly buffer: number
  readonly cellHeight: number
  readonly accessorFn: (data: TData, index: CellIndex) => TValue | undefined
  readonly getFillerValue: (reel: number) => TValue
}

/** Контекст ячейки: машина, барабан и сама ячейка одним объектом для владельца view. */
export type CellContext<TData, TValue> = {
  readonly machine: ReelsMachine<TData, TValue>
  readonly reel: Reel<TData, TValue>
  readonly cell: Cell<TData, TValue>
  getValue(): TValue | undefined
}
