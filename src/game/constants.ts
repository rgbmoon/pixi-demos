import { SymbolKey } from 'src/types/game'

import type { PaylineShape, SymbolArtBox } from './types'

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

/** Нативная ширина арта рамки (reels-bg.webp). */
export const REELS_FRAME_WIDTH = 1394
/** Нативная высота арта рамки. */
export const REELS_FRAME_HEIGHT = 955

// Зона символов внутри рамки: её непрозрачная область, x 137…1252 и y 66…857 в нативных пикселях
/** Ширина зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_WIDTH = 1116
/** Высота зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_HEIGHT = 792
/** Смещение центра зоны от центра рамки: нижний орнамент рамки выше верхнего. */
export const REELS_ZONE_OFFSET_X = -2
/** Смещение центра зоны от центра рамки по вертикали. */
export const REELS_ZONE_OFFSET_Y = -15.5
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
/** Потолок масштаба машины: арт рамки растровый, выше нативного размера он мылит. */
export const REELS_MACHINE_MAX_SCALE = 1

/** Нативная ширина подложки ячейки (symbol-bg.webp 432×520). */
export const SYMBOL_BG_WIDTH = 432
/** Нативная высота подложки ячейки. */
export const SYMBOL_BG_HEIGHT = 520
/** Просвет между подложками соседних ячеек в пикселях зоны. */
export const SYMBOL_GAP = 12
// Подложка садится в ячейку за вычетом просвета; спрайты символов и их скелеты лежат
// в тех же единицах, поэтому весь контент ячейки масштабируется одним числом
/** Масштаб содержимого ячейки: из нативных единиц символа в пиксели зоны. */
export const SYMBOL_SCALE = Math.min(
  (CELL_WIDTH - SYMBOL_GAP) / SYMBOL_BG_WIDTH,
  (CELL_HEIGHT - SYMBOL_GAP) / SYMBOL_BG_HEIGHT
)
// Арты символов разного размера (контент от 228 до 483 единиц), поэтому каждый ещё
// вписывается в подложку с общим отступом — иначе крупные вылезают за её края
/** Отступ арта символа от края подложки в нативных единицах. */
export const SYMBOL_INSET = 24
/** Ширина поля, в которое вписывается арт символа. */
export const SYMBOL_FIT_WIDTH = SYMBOL_BG_WIDTH - 2 * SYMBOL_INSET
/** Высота поля, в которое вписывается арт символа. */
export const SYMBOL_FIT_HEIGHT = SYMBOL_BG_HEIGHT - 2 * SYMBOL_INSET

// Непрозрачный бокс спрайта single-symbol-N.webp: размер контента и сдвиг его центра от центра
// холста. Холсты экспортированы по-разному (405×293 … 800×800), поэтому размер текстуры для
// посадки арта не годится. Замеряется скриптом по альфа-каналу, пересобирать при смене пака.
/** Габариты арта символа и поправка центра, нативные единицы. */
export const SYMBOL_ART_BOXES: Record<SymbolKey, SymbolArtBox> = {
  [SymbolKey.S]: { width: 448, height: 416, offsetX: 10, offsetY: -28 },
  // Вайлд: покой рисует скелет, бокс взят по его клиппингу — карточка-рамка с него снята.
  // Сдвиг вниз сажает персонажа на низ подложки: ноги обрезаны границей анимации
  [SymbolKey.W]: { width: 435, height: 525, offsetX: 0, offsetY: 28 },
  [SymbolKey.A]: { width: 400, height: 290, offsetX: -0.5, offsetY: 1.5 },
  [SymbolKey.E]: { width: 400, height: 292, offsetX: -0.5, offsetY: 0.5 },
  [SymbolKey.F]: { width: 400, height: 290, offsetX: -0.5, offsetY: 1.5 },
  [SymbolKey.K]: { width: 400, height: 290, offsetX: -0.5, offsetY: 1.5 },
  [SymbolKey.L]: { width: 362, height: 397, offsetX: 0, offsetY: -11.5 },
  [SymbolKey.M]: { width: 362, height: 398, offsetX: 0, offsetY: -9 },
  [SymbolKey.N]: { width: 351, height: 418, offsetX: -0.5, offsetY: -25 },
  [SymbolKey.O]: { width: 228, height: 414, offsetX: 6, offsetY: -14 },
  [SymbolKey.P]: { width: 422, height: 399, offsetX: 0, offsetY: -20.5 },
}

// Нативный бокс скелета фона из background.json: по нему считается cover-масштаб под экран
/** Нативная ширина фона. */
export const BACKGROUND_WIDTH = 2547.76
/** Нативная высота фона. */
export const BACKGROUND_HEIGHT = 1100.26
/** Доля высоты фона, срезаемая сверху и снизу при вписывании в канвас. */
export const BACKGROUND_CROP_Y = 0.03
/** Пропорции игрового поля: фон обрезается по бокам до этого соотношения. */
export const GAME_ASPECT_RATIO = 4 / 3
/** Анимация заднего слоя фона: показывает всё, кроме переднего плана. */
export const BACKGROUND_BACK_ANIMATION = 'background-back'
/** Анимация переднего слоя фона: показывает только передний план. */
export const BACKGROUND_FRONT_ANIMATION = 'background-front'

/** Непрозрачность затемнения поля на разборе выигрыша. */
export const TINT_ALPHA = 0.55
/** Длительность появления и снятия затемнения, мс. */
export const TINT_FADE_MS = 200

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

// Вин-рамка рисуется по границам ячейки: готового арта под неё в паке нет
/** Радиус скругления вин-рамки в нативных пикселях зоны символов. */
export const WIN_FRAME_RADIUS = 24
/** Толщина обводки вин-рамки в нативных пикселях зоны символов. */
export const WIN_FRAME_THICKNESS = 8
/** На столько обводка вин-рамки отступает внутрь ячейки, чтобы не наезжать на соседей. */
export const WIN_FRAME_INSET = 6

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
