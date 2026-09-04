import { PhaseName, SymbolKey } from './types'
import type { ButtonSize, PaylineShape } from './types'

// Сцена раскладывается в координатах макета, а не в пикселях канваса: арт пака нарисован под этот
// размер, поэтому рамка барабанов и фон ложатся в него один к одному. GameScene масштабируется
// одним числом, все остальные размеры сцены — дизайн-единицы.
/** Ширина макета сцены: нативная ширина фона. */
export const DESIGN_WIDTH = 941
/** Высота макета сцены: нативная высота фона. */
export const DESIGN_HEIGHT = 1672
/** Пропорции игрового поля: канвас повторяет макет, поэтому фон встаёт без полей и обрезки. */
export const GAME_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT

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

/** Нативная ширина арта рамки (reels-bg): ровно ширина макета. */
export const REELS_FRAME_WIDTH = 941
/** Нативная высота арта рамки. */
export const REELS_FRAME_HEIGHT = 697

// Зона символов внутри рамки: замерена по альфе арта — пять полупрозрачных колонок, шаг 174.85
/** Ширина зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_WIDTH = 874.25
/** Высота зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_HEIGHT = 610
/** Смещение центра зоны от центра рамки по горизонтали. */
export const REELS_ZONE_OFFSET_X = -0.25
/** Смещение центра зоны от центра рамки по вертикали: нижняя кромка рамки толще верхней. */
export const REELS_ZONE_OFFSET_Y = -5.75
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

/** Нативная ширина холста символа: у всех символов пака он одинаковый. */
export const SYMBOL_ART_WIDTH = 176
/** Нативная высота холста символа. */
export const SYMBOL_ART_HEIGHT = 208
// Арт нарисован в размер ячейки, поэтому вписывается целиком; спрайты и скелеты символа лежат
// в тех же единицах, и весь контент ячейки масштабируется одним числом
/** Масштаб содержимого ячейки: из нативных единиц символа в пиксели зоны. */
export const SYMBOL_SCALE = Math.min(CELL_WIDTH / SYMBOL_ART_WIDTH, CELL_HEIGHT / SYMBOL_ART_HEIGHT)

// Скелет — имя набора анимаций: по нему пул раскладывает инстансы, а реализация скелета ищет своё
// описание. Единственная анимация скелета символа — `win`, покой и размытие идут спрайтами.
/** Скелет символа на его ключ. */
export const SYMBOL_SKELETONS: Record<SymbolKey, string> = Object.fromEntries(
  Object.keys(SymbolKey).map((key) => [key, `symbol-${key}`])
) as Record<SymbolKey, string>

// Скелет символа поднимается только под выигрышную анимацию, поэтому пик спроса на ключ —
// сколько выигравших ячеек одного вида показывается разом; при нехватке пул дорастает сам
const SYMBOL_POOL_SIZE = 3

/** Сколько инстансов каждого скелета `SpinePool` держит наготове после прогрева. */
export const SPINE_WARM_UP: { skeleton: string; count: number }[] = Object.values(SYMBOL_SKELETONS).map(
  (skeleton) => ({ skeleton, count: SYMBOL_POOL_SIZE })
)

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
export const PAYLINE_THICKNESS = 8
/** На столько соседние отрезки заходят друг за друга на изломе: без нахлёста на внешнем углу остаётся вырез. */
export const PAYLINE_JOINT_OVERLAP = PAYLINE_THICKNESS / 2

// Вин-рамка рисуется по границам ячейки: готового арта под неё в паке нет
/** Толщина обводки вин-рамки в нативных пикселях зоны символов. */
export const WIN_FRAME_THICKNESS = 6
/** На столько обводка вин-рамки отступает внутрь ячейки, чтобы не наезжать на соседей. */
export const WIN_FRAME_INSET = 5

// Тайминги показа выигрыша
/** Сколько все выигравшие линии и символы показываются разом до разбора по линиям, мс. */
export const WIN_SHOWCASE_MS = 1500
/** Сколько линия выплат видна в цикле до смены на рамки, мс. */
export const PAYLINE_VISIBLE_MS = 1050
/** Сколько рамки висят на символах после ухода линии, мс. */
export const WIN_FRAMES_VISIBLE_MS = 1500

/** Режим игры до ответа initGame: максимум линий из набора мока (Line10). */
export const DEFAULT_GAME_MODE = '4'

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.booting

/** Сколько сумма выигрыша висит в WinLabelController после анимаций, прежде чем уйти в кредит. */
export const WIN_DISPLAY_MS = 1000

/** Сторона подложки кнопки в дизайн-единицах на каждый пресет размера. */
export const BUTTON_SIZE_UNITS: Record<ButtonSize, number> = {
  md: 130,
  lg: 260,
}

/** Доля стороны подложки, которую занимает иконка. */
export const ICON_RATIO = 0.5

/** Прозрачность погашенной кнопки. */
export const DISABLED_ALPHA = 0.7

/** Ширина плашки панели HUD в дизайн-единицах. */
export const PANEL_WIDTH = 360

/** Высота плашки панели HUD. */
export const PANEL_HEIGHT = 128
