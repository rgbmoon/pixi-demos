import type { Cell } from './cell'
import type { Reel } from './reel'
import type { ReelsMachine } from './reels-machine'

/** Адрес ячейки поля: барабан и ряд в нём. */
export type CellIndex = {
  readonly reel: number
  readonly row: number
}

/** Фаза барабана: свободен, крутится, садится. */
export const ReelPhase = {
  idle: 'idle',
  spinning: 'spinning',
  landing: 'landing',
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
  /** Число пауз anticipation до посадки барабана, включая его собственную. */
  readonly anticipation?: number
  /** У барабана есть собственная пауза anticipation. */
  readonly anticipating?: boolean
  /** Зовётся синхронно из `advance`, когда барабан вошёл в собственную паузу; после `slam` не зовётся. */
  readonly onAnticipated?: () => void
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

/** Стратегии движения барабана: как он крутится и как садится. */
export type ReelStrategies = {
  readonly spinStrategy: SpinStrategy
  readonly landingStrategy: LandingStrategy
}

/** Слот ленты: движущаяся ячейка, которую рисует адаптер. */
export type StripSlot<TValue> = {
  readonly id: string
  /** Значение, которое слот показывает сейчас. */
  value: TValue
  /** Позиция слота в единицах машины, свёрнутая в диапазон ленты. */
  offset: number
  /** Сколько рядов занимает слот. Пока всегда 1 — шов под двойные ячейки. */
  span: number
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
