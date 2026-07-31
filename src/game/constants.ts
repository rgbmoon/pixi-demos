import type { PaylineShape } from './types'

// Количество барабанов и видимых символов фиксировано: reel-frame не позволяет разместить больше
/** Барабанов в машине. */
export const REELS_COUNT = 5
/** Видимых символов в барабане. */
export const VISIBLE_SYMBOLS_COUNT = 3
/** Ячейка сверх видимых: держит символ, въезжающий в зону сверху. */
export const BUFFER_SYMBOLS_COUNT = 1
/** Лесенка остановки: на столько ячеек каждый следующий барабан крутится дольше предыдущего. */
export const LAND_STAGGER_CELLS = 2

// Скорости и ускорение — на кадр приведённой частоты (deltaTime = 1 при 60 fps)
/** Скорость прокрутки ленты, px/кадр. */
export const SPIN_SPEED = 60
/** На столько падает скорость ленты за кадр торможения, px/кадр². */
export const LANDING_DECELERATION = 2
/** Скорость, до которой линейное торможение доводит ленту перед отскоком, px/кадр. */
export const LANDING_HANDOVER_SPEED = 30
/** Длительность торможения в кадрах: за неё скорость падает с `SPIN_SPEED` до `LANDING_HANDOVER_SPEED`. */
export const LANDING_BRAKE_FRAMES = (SPIN_SPEED - LANDING_HANDOVER_SPEED) / LANDING_DECELERATION
/** Путь торможения: интеграл скорости по `LANDING_BRAKE_FRAMES`. */
export const LANDING_BRAKE_DISTANCE = (SPIN_SPEED ** 2 - LANDING_HANDOVER_SPEED ** 2) / (2 * LANDING_DECELERATION)
/** Хвост посадки, который лента проходит отскоком, в долях ячейки. */
export const LANDING_EASE_CELLS = 0.25
/** Сила отскока в терминах `easeOutBack`: заброс за точку посадки растёт быстрее этого числа, см. её JSDoc. */
export const LANDING_BACK_STRENGTH = 0.35

// Зона символов внутри рамки: пять шагов между divider_center и высота разделителя, обе величины из frame.json
/** Ширина зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_WIDTH = 1006.7
/** Высота зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_HEIGHT = 589
/** Ширина ячейки символа: зона делится поровну между барабанами. */
export const CELL_WIDTH = REELS_ZONE_WIDTH / REELS_COUNT
/** Высота ячейки символа: зона делится поровну между видимыми символами. */
export const CELL_HEIGHT = REELS_ZONE_HEIGHT / VISIBLE_SYMBOLS_COUNT
/** Высота видимой зоны барабана: за её нижней границей символ уходит в буферную ячейку. */
export const VISIBLE_REEL_HEIGHT = VISIBLE_SYMBOLS_COUNT * CELL_HEIGHT
/** Длина ленты барабана: период прокрутки, через который повторяются позиции символов. */
export const STRIP_HEIGHT = (VISIBLE_SYMBOLS_COUNT + BUFFER_SYMBOLS_COUNT) * CELL_HEIGHT
// Начало координат зоны символов — центр левой верхней ячейки: ячейка (барабан, ряд) лежит
// в (CELL_WIDTH * reel, CELL_HEIGHT * row), origin арта символа — его центр
/** Смещение зоны символов внутри рамки по горизонтали. */
export const CELLS_ORIGIN_X = (-REELS_ZONE_WIDTH + CELL_WIDTH) / 2
/** Смещение зоны символов внутри рамки по вертикали. */
export const CELLS_ORIGIN_Y = (-REELS_ZONE_HEIGHT + CELL_HEIGHT) / 2
/** Масштаб машины: задаётся один раз, на ресайз экрана машина не реагирует (пока что). */
export const REELS_MACHINE_SCALE = 0.4

/** Линии выплат: ряд на каждом барабане и вертикальный сдвиг линии. */
export const PAYLINES: Record<string, PaylineShape> = {
  '0': { rows: [1, 1, 1, 1, 1], offsetCells: 0 },
  '1': { rows: [0, 0, 0, 0, 0], offsetCells: 0 },
  '2': { rows: [2, 2, 2, 2, 2], offsetCells: 0 },
  '3': { rows: [0, 1, 2, 1, 0], offsetCells: -0.13 },
  '4': { rows: [2, 1, 0, 1, 2], offsetCells: 0.13 },
  '5': { rows: [0, 0, 1, 0, 0], offsetCells: 0.13 },
  '6': { rows: [2, 2, 1, 2, 2], offsetCells: -0.13 },
  '7': { rows: [1, 0, 0, 0, 1], offsetCells: -0.13 },
  '8': { rows: [1, 2, 2, 2, 1], offsetCells: -0.26 },
  '9': { rows: [2, 1, 1, 1, 0], offsetCells: 0.26 },
}

/** Сколько линии режима видны после нажатия кнопки настройки, мс. */
export const PAYLINE_PREVIEW_MS = 1000
/** Толщина линии выплат в нативных пикселях зоны символов. */
export const PAYLINE_THICKNESS = 10
/** На столько соседние отрезки заходят друг за друга на изломе: без нахлёста на внешнем углу остаётся вырез. */
export const PAYLINE_JOINT_OVERLAP = PAYLINE_THICKNESS / 2

/** Масштаб вин-рамки: арт крупнее ячейки, без уменьшения рамка крайнего ряда вылезает за рамку барабанов. */
export const WIN_FRAME_SCALE = 0.93

// Тайминги показа выигрыша
/** Сколько все выигравшие линии и символы показываются разом до разбора по линиям, мс. */
export const WIN_SHOWCASE_MS = 1500
/** Сколько линия выплат видна в цикле до смены на рамки, мс. */
export const PAYLINE_VISIBLE_MS = 1050
/** Сколько рамки висят на символах после ухода линии, мс. */
export const WIN_FRAMES_VISIBLE_MS = 1500
/** Коэффициент отката канонической easeOutBack (значение с easings.net). */
export const REFERENCE_BACK_FACTOR = 1.70158
/** Заброс канонической кривой: её пик превышает цель на 9.99% дистанции. Служит нормировкой для `backStrength`. */
export const REFERENCE_OVERSHOOT = 0.0999
