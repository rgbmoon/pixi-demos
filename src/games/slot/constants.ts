import { PhaseName, SymbolKey } from './types'
import type { ButtonSize, PaylineShape } from './types'

// Сцена раскладывается в координатах макета, а не в пикселях канваса: арт пака нарисован под этот
// размер, поэтому рамка барабанов и фон ложатся в него один к одному. GameScene масштабируется
// одним числом, все остальные размеры сцены — дизайн-единицы.
/** Ширина макета сцены: нативная ширина фона. */
export const DESIGN_WIDTH = 941
/** Высота макета сцены: нативная высота фона. */
export const DESIGN_HEIGHT = 1672
/** Пропорции игрового поля: выше CANVAS_FILL_MAX_WIDTH канвас повторяет их, и фон не обрезается. */
export const GAME_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT

export const CANVAS_FILL_MAX_WIDTH = 640

// Количество барабанов и видимых символов фиксировано: reel-frame не позволяет разместить больше
/** Барабанов в машине. */
export const REELS_COUNT = 5
/** Видимых символов в барабане. */
export const VISIBLE_SYMBOLS_COUNT = 3

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
export const SPINE_WARM_UP: { skeleton: string; count: number }[] = Object.values(SYMBOL_SKELETONS).map((skeleton) => ({
  skeleton,
  count: SYMBOL_POOL_SIZE,
}))

/** Непрозрачность затемнения поля на разборе выигрыша. */
export const TINT_ALPHA = 0.55
/** Длительность появления и снятия затемнения, мс. */
export const TINT_FADE_MS = 133

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

// Подсветка барабана на паузе anticipation рисуется по границам колонки: арта под неё в паке нет
/** Толщина обводки подсветки anticipation в нативных пикселях зоны символов. */
export const ANTICIPATION_GLOW_THICKNESS = 10
/** Непрозрачность заливки колонки под обводкой подсветки. */
export const ANTICIPATION_GLOW_FILL_ALPHA = 0.18
/** Появление подсветки, мс. */
export const ANTICIPATION_GLOW_FADE_MS = 200
/** Период пульса подсветки, мс. */
export const ANTICIPATION_GLOW_PULSE_MS = 600
/** Нижняя граница пульса: до этой доли непрозрачности подсветка гаснет между вспышками. */
export const ANTICIPATION_GLOW_PULSE_MIN = 0.45

// Выигрыш после anticipation: фон моргает белым слоем поверх спрайтов
/** Сколько раз моргает фон. */
export const ANTICIPATION_FLASH_COUNT = 2
/** Непрозрачность белого слоя на пике вспышки. */
export const ANTICIPATION_FLASH_ALPHA = 0.45
/** Нарастание и спад одной вспышки, мс на каждый. */
export const ANTICIPATION_FLASH_MS = 150

// Тайминги показа выигрыша
/** Сколько все выигравшие линии и символы показываются разом до разбора по линиям, мс. */
export const WIN_SHOWCASE_MS = 1000
/** Сколько линия выплат видна в цикле до смены на рамки, мс. */
export const PAYLINE_VISIBLE_MS = 700
/** Сколько рамки висят на символах после ухода линии, мс. */
export const WIN_FRAMES_VISIBLE_MS = 1000

/** Режим игры до ответа initGame: максимум линий из набора мока (Line10). */
export const DEFAULT_GAME_MODE = '4'

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.booting

/** Сколько сумма выигрыша висит в WinLabelController после анимаций, прежде чем уйти в кредит. */
export const WIN_DISPLAY_MS = 667

/** Показ всех выигравших линий в турбо-режиме: одна короткая вспышка вместо разбора по линиям. */
export const TURBO_WIN_SHOWCASE_MS = 400

/** Сколько кнопку спина нужно держать, чтобы в турбо-режиме началась серия. */
export const HOLD_MS = 400

/** Размах тряски строки кредита при пополнении, в дизайн-единицах. */
export const SHAKE_AMPLITUDE = 12

/** Длительность тряски строки кредита, мс. */
export const SHAKE_MS = 400

/** Сколько полных колебаний делает строка кредита за тряску. */
export const SHAKE_OSCILLATIONS = 4

/** Доля подложки под молнию турбо-спина. */
export const TURBO_ICON_RATIO = 0.7

/** Сторона подложки кнопки в дизайн-единицах на каждый пресет размера. */
export const BUTTON_SIZE_UNITS: Record<ButtonSize, number> = {
  md: 130,
  lg: 260,
}

/** Доля стороны подложки, которую занимает иконка. */
export const ICON_RATIO = 0.5

/** Доля подложки под иконку спина. */
export const SPIN_ICON_RATIO = 0.6

/** Доля подложки под иконку остановки. */
export const STOP_ICON_RATIO = 0.6

/** Прозрачность погашенной кнопки. */
export const DISABLED_ALPHA = 0.7

/** Ширина плашки панели HUD в дизайн-единицах. */
export const PANEL_WIDTH = 440

/** Высота плашки панели HUD. */
export const PANEL_HEIGHT = 128

/** Зазор между плашкой панели HUD и кнопками шага по бокам. */
export const PANEL_BUTTON_GAP = 16

/** Ширина строки панели вместе с кнопками шага: по ней выравниваются строки модалки. */
export const PANEL_ROW_WIDTH = PANEL_WIDTH + 2 * (PANEL_BUTTON_GAP + BUTTON_SIZE_UNITS.md)

/** Отступ элементов сцены и плашки модалки от края видимой области. */
export const SCREEN_MARGIN = 32

/** Отступ содержимого модалки от края её плашки. */
export const MODAL_PADDING = 64

/** Высота шапки модалки: кнопка закрытия плюс MODAL_PADDING сверху и снизу. */
export const MODAL_HEADER_HEIGHT = 2 * MODAL_PADDING + BUTTON_SIZE_UNITS.md

// Цвет и прозрачность разделителя шапки совпадают с обводкой в modal-bg.svg
/** Цвет разделителя шапки. */
export const MODAL_BORDER_COLOR = 0xa05a72

/** Прозрачность разделителя шапки. */
export const MODAL_BORDER_ALPHA = 0.55

/** Толщина разделителя шапки в дизайн-единицах. */
export const MODAL_DIVIDER_THICKNESS = 6

/** Непрозрачность затемнения сцены под модалкой. */
export const MODAL_BACKDROP_ALPHA = 0.6

/** Длительность появления и скрытия модалки, мс. */
export const MODAL_FADE_MS = 200

/** Ширина немасштабируемой кромки подложки модалки в NineSliceSprite, пиксели арта. */
export const MODAL_NINE_SLICE = 24

/** Зазор между строками содержимого модалки. */
export const MODAL_ROW_GAP = 48


/** Кегль подписи чекбокса. */
export const CHECKBOX_FONT_SIZE = 48

/** Сторона подложки чекбокса: в полтора раза меньше средней кнопки. */
export const CHECKBOX_SIZE = BUTTON_SIZE_UNITS.md / 1.5

// Звук
/** Общая громкость синтезатора: голоса рецептов звучат относительно неё. */
export const SOUND_MASTER_GAIN = 0.5

/** Категория аудиосессии: `playback` звучит и в беззвучном режиме iOS, пока звук не выключен в игре. */
export const SOUND_SESSION_TYPE = 'playback'

/** Ключ флага звука в localStorage. */
export const SOUND_STORAGE_KEY = 'pixi-demos:slot:sound-on'

/** Выигрыш от стольких ставок озвучивается как крупный. */
export const BIG_WIN_MULTIPLIER = 10

/** Шаг высоты удара посадки: каждый следующий барабан звучит на эту долю выше. */
export const REEL_STOP_PITCH_STEP = 0.05
