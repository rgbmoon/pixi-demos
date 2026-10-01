import {
  type FrameSize,
  type GroundPoint,
  PhaseName,
  type ScreenPoint,
  type WorldPlane,
  type WorldPoint,
} from './types'

/** Потолок плотности канваса: на экранах до DPR 3 пиксель рендера совпадает с пикселем экрана. */
export const CANVAS_MAX_RESOLUTION = 3

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.booting

// Масштаб арта и проекция
/** Пиксель исходного арта в единицах сцены. */
export const ART_PIXEL = 4
/** Сторона ячейки в пикселях арта. */
export const ART_CELL = 16
/** Сторона ячейки в единицах сцены; в исходном арте это 16 пикселей. */
export const CELL_SIZE = ART_CELL * ART_PIXEL
/** Толщина линий арта: один пиксель. */
export const LINE_THICKNESS = ART_PIXEL
/** Экранный шаг на ячейку вдоль оси x: она уходит вглубь сцены, наклон 1:1. */
export const AXIS_X: ScreenPoint = { x: 8, y: -8 }
/** Экранный шаг на ячейку вдоль оси y: она идёт вдоль фронтальной грани влево, наклон 1:16. */
export const AXIS_Y: ScreenPoint = { x: -64, y: -4 }
/** Экранная длина единицы высоты `z`. */
export const UNIT_HEIGHT = CELL_SIZE

// Бокс и лоток
/** Сторона сетки в ячейках. */
export const GRID_SIZE = 8
/** Высота стеклянного бокса в ячейках. */
export const CUBE_HEIGHT = 8
/** Сторона лотка в ячейках. */
export const TRAY_SIZE = 2
/** Угол лотка на полу с наименьшими координатами: лоток стоит в левом углу фронтальной грани. */
export const TRAY_ORIGIN: GroundPoint = { x: 0, y: GRID_SIZE - TRAY_SIZE }
/** Точка, над которой клешня отпускает игрушку. */
export const TRAY_CENTER: GroundPoint = { x: TRAY_ORIGIN.x + TRAY_SIZE / 2, y: TRAY_ORIGIN.y + TRAY_SIZE / 2 }
/** Точка, над которой клешня стоит в покое. */
export const FIELD_CENTER: GroundPoint = { x: GRID_SIZE / 2, y: GRID_SIZE / 2 }
/** Высота стенок лотка: ниже верха кучи, поэтому игрушка через них переваливается. */
export const TRAY_WALL_HEIGHT = 2

// Корпус
/** Передний край панели выступает к игроку на три ячейки. */
export const CABINET_FRONT_X = -3
/** Верх передней грани тумбы на одну ячейку ниже пола бокса. */
export const CABINET_TOP_Z = -1
/** Нижняя грань тумбы: при ней высота автомата на экране равна 1264 единицам сцены. */
export const CABINET_BOTTOM_Z = -8.875
/** Верх табло на полторы ячейки выше стеклянного бокса: 24 px арта под строку текста и ряд ламп. */
export const MARQUEE_TOP_Z = CUBE_HEIGHT + 1.5
/** Ширина плашки кнопки сброса у правого края табло в ячейках; экран табло занимает остальную ширину. */
export const RESET_PLATE_WIDTH = 1.5
/** Отступ экрана табло от верха табло и от его боковых краёв, px арта. */
export const MARQUEE_SCREEN_TOP = 2
export const MARQUEE_SCREEN_SIDE = 4
/** Высота экрана табло, px арта: рама, строка текста и фаска. */
export const MARQUEE_SCREEN_HEIGHT = 14
/** Число гнёзд ламп в ряду под экраном табло. */
export const MARQUEE_LAMP_COUNT = 8
/** Ширина стойки куба, px арта: стойка лежит внутри силуэта куба. */
export const PILLAR_WIDTH = 4
/** Отступ корпуса от края канваса в единицах сцены: одна ячейка. */
export const MACHINE_MARGIN = CELL_SIZE
/** Доля канваса, в которую вписывается автомат с отступами; меньше единицы — автомат меньше на экране. */
export const MACHINE_CANVAS_SHARE = 1

// Фон
/**
 * Стена зала за автоматом: по её основанию идёт линия плинтуса. Ячейка глубины поднимает точку на экране на 2 px арта,
 * поэтому между задним углом тумбы и плинтусом видно 2 × (WALL_X − GRID_SIZE) px пола.
 */
export const WALL_X = GRID_SIZE + 8
/**
 * Сторона блока раскладки декалей стены в пикселях арта: в блоке не больше одной декали, поэтому декали разнесены
 * по стене равномерно.
 */
export const DECAL_BLOCK_SIZE = 128
/** Доля блоков стены, в которых лежит декаль. */
export const DECAL_BLOCK_SHARE = 0.75
/** Длительности кадров пульса обоев, мс: узор задерживается в тёмной и светлой фазе и быстро переходит между ними. */
export const WALLPAPER_PULSE_MS = [600, 150, 150, 150, 600, 150, 150, 150]
/** Шаг сдвига рисунка ковра на пиксель арта, мс: рисунок проходит тайл за 48 шагов. */
export const CARPET_DRIFT_STEP_MS = 200
/** Середина стеклянного куба: от неё светит ореол на стене, вокруг неё летают пылинки. */
export const GLOW_SOURCE_CENTER: WorldPoint = { x: GRID_SIZE / 2, y: GRID_SIZE / 2, z: CUBE_HEIGHT / 2 }
/** Пылинки в свете куба: число, область вокруг середины куба в пикселях арта, срок жизни, скорость. */
export const DUST_COUNT = 24
export const DUST_AREA: FrameSize = { width: 368, height: 150 }
export const DUST_MIN_LIFE_MS = 4000
export const DUST_MAX_LIFE_MS = 8000
/** Наибольшая скорость пылинки, пикселей арта в секунду: оседание быстрее бокового дрейфа. */
export const DUST_FALL_SPEED = 4
export const DUST_DRIFT_SPEED = 2
/** Цвет пылинки — светлая ступень рампы `neon`; свет пылинки складывается с фоном. */
export const DUST_COLOR = '#f97f96'
/** Сид генератора пылинок: их полёт не тратит `Math.random` игры. */
export const DUST_SEED = 7
/** Центр тени автомата: середина основания тумбы. */
export const SHADOW_CENTER: WorldPoint = { x: (CABINET_FRONT_X + GRID_SIZE) / 2, y: GRID_SIZE / 2, z: CABINET_BOTTOM_Z }

/** Плоскость наклонной панели управления. */
export const CONTROL_PANEL_PLANE: WorldPlane = {
  horizontal: { x: 0, y: -1, z: 0 },
  vertical: { x: -1, y: 0, z: CABINET_TOP_Z / -CABINET_FRONT_X },
}
/** Передняя вертикальная плоскость тумбы и табло. */
export const CABINET_FRONT_PLANE: WorldPlane = {
  horizontal: { x: 0, y: -1, z: 0 },
  vertical: { x: 0, y: 0, z: -1 },
}

/** Центры встроенных органов управления в координатах мира. */
export const JOYSTICK_CENTER: WorldPoint = { x: CABINET_FRONT_X / 2, y: 2, z: CABINET_TOP_Z / 2 }
export const DROP_BUTTON_CENTER: WorldPoint = { x: CABINET_FRONT_X / 2, y: 6, z: CABINET_TOP_Z / 2 }
export const PRIZE_HATCH_CENTER: WorldPoint = {
  x: CABINET_FRONT_X,
  y: GRID_SIZE / 2,
  z: (CABINET_TOP_Z + CABINET_BOTTOM_Z) / 2,
}
export const RESET_BUTTON_CENTER: WorldPoint = {
  x: 0,
  y: RESET_PLATE_WIDTH / 2,
  z: (CUBE_HEIGHT + MARQUEE_TOP_Z) / 2,
}
/** Центр строки текста: середина экрана табло. */
export const MARQUEE_TEXT_CENTER: WorldPoint = {
  x: 0,
  y: (GRID_SIZE + RESET_PLATE_WIDTH) / 2,
  z: MARQUEE_TOP_Z - (MARQUEE_SCREEN_TOP + MARQUEE_SCREEN_HEIGHT / 2) / ART_CELL,
}

// Клешня
/** Доля хода на разгон и на торможение у движений автомата: тросик набирает скорость коротко. */
export const CLAW_RAMP_SHARE = 0.15
/** Длительность захвата и центрирования игрушки в прототипе, мс. */
export const CLAW_GRAB_MS = 200
/** Радиус точки клешни в единицах сцены. */
export const CLAW_RADIUS = 16
/** Сторона каретки в ячейках: каретка занимает клетку и этой стороной упирается в край поля. */
export const CART_SIZE = 1

// Цикл клешни
/** Сколько пустая клешня стоит над лотком: место под разжатие клешни. */
export const TRAY_HOLD_MS = 1000
/** Сколько клешня держит игрушку над лотком, прежде чем разжаться. */
export const TRAY_RELEASE_MS = 400
/** Пауза в хвосте фазы цикла клешни: движения не склеиваются встык. */
export const PHASE_PAUSE_MS = 200
/** Доля доставок, в которых клешня роняет игрушку по дороге к лотку. */
export const FUMBLE_CHANCE = 0.24
/** Расстояние от места захвата, раньше которого клешня игрушку не роняет: сразу у места захвата потеря не читается. */
export const FUMBLE_START_CLEARANCE = 1
/** Доля подъёмов, в которых игрушка выскальзывает из клешни по дороге вверх. */
export const LIFT_FUMBLE_CHANCE = 0.13
/** Доля подъёма, раньше которой игрушка не выскальзывает: сразу от стопки срыв не читается. */
export const LIFT_SLIP_MIN_SHARE = 0.15
/** Доля подъёма, позже которой игрушка не выскальзывает: у верхней грани клешня уже уходит в сторону. */
export const LIFT_SLIP_MAX_SHARE = 0.85

// Снимок кучи
/** Версия снимка кучи: не сошлась — снимок игнорируется и куча складывается заново. */
export const HEAP_SNAPSHOT_VERSION = 3
/** Адрес снимка кучи в IndexedDB. */
export const HEAP_DB_NAME = 'toybox'
export const HEAP_STORE_NAME = 'heap'
export const HEAP_SNAPSHOT_KEY = 'current'

// Игрушки
/** Наибольшая доля ребра сечения, которую занимает скругление угла: соседние скругления не смыкаются. */
export const CORNER_EDGE_SHARE = 0.45
/** Доля сечения и глубины, которую занимает игрушка внутри своих клеток: между соседями остаётся зазор. */
export const TOY_INSET = 0.875
/** Шаг угла, с которым рисуется крен игрушки. */
export const TOY_ANGLE_STEP = Math.PI / 36
/** Толщина бордера подсвеченной игрушки: её клешня возьмёт. */
export const TOY_HIGHLIGHT_THICKNESS = 2 * LINE_THICKNESS
/** Прозрачность заливки игрушки: сквозь кучу видно её глубину. */
export const TOY_FILL_ALPHA = 0.35

// Слой содержимого
/** Пересечение силуэтов мельче этого, в единицах сцены, порядка наложения не требует: это касание контуров. */
export const DEPTH_OVERLAP_TOLERANCE = 0.5
/** Сдвиг силуэта, начиная с которого предмет заново сравнивается с соседями, в единицах сцены. */
export const DEPTH_SORT_STEP = 1

// Органы управления
/** Доля хода ручки, ниже которой джойстик не трогает клешню. */
export const JOYSTICK_DEADZONE = 0.3
/** Радиус подложки джойстика: диаметр совпадает с кнопкой Drop. */
export const JOYSTICK_RADIUS = 48
/** Радиус ручки джойстика. */
export const JOYSTICK_KNOB_RADIUS = 32
/** Прозрачность заливки подложки джойстика. */
export const JOYSTICK_FILL_ALPHA = 0.16
/** Толщина стойки ручки джойстика. */
export const JOYSTICK_STEM_THICKNESS = 16
/** Радиус крупной невидимой области захвата джойстика. */
export const JOYSTICK_HIT_RADIUS = 96

/** Сторона подложки кнопки в единицах сцены. */
export const BUTTON_SIZE_UNITS = 96
/** Прозрачность заливки кнопки. */
export const BUTTON_FILL_ALPHA = 0.2
/** Сторона кнопки сброса в единицах сцены: 16 px арта, кнопка помещается на плашке табло. */
export const RESET_BUTTON_SIZE_UNITS = 64
/** Начало и конец дуги круговой стрелки на кнопке сброса, радианы. */
export const RESET_ARC_START = -Math.PI * 0.35
export const RESET_ARC_END = Math.PI * 1.15
/** Размер наконечника стрелки в долях радиуса дуги. */
export const RESET_HEAD_RATIO = 0.42
/** Имя кнопки сброса в слое доступности. */
export const RESET_BUTTON_LABEL = 'Reset the heap'
/** Прозрачность погашенного элемента управления. */
export const DISABLED_ALPHA = 0.4
/** Доля подложки, которую занимает иконка. */
export const ICON_RATIO = 0.4
/** Дополнительный отступ невидимой области нажатия от контура. */
export const CONTROL_HIT_PADDING = 16
/** Число точек для окружностей, лежащих на гранях корпуса. */
export const CONTROL_OUTLINE_STEPS = 24

/** Физические коды клавиш игрового управления. */
export const KEYBOARD_ARROW_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const
export const KEYBOARD_DROP_CODES = ['Enter', 'Space'] as const

// Выдача приза
/** Размер окна выдачи на передней грани тумбы. */
export const PRIZE_HATCH_SIZE = CELL_SIZE * 2
/** Отступ дверцы от контура окна. */
export const PRIZE_DOOR_INSET = 8
/** Масштаб игрушки в окне выдачи. */
export const PRIZE_SCALE = 0.8
/** Прирост масштаба игрушки к концу получения. */
export const PRIZE_TAKE_GROWTH = 0.12
/** Этапы выдачи приза после выхода игрушки из внутреннего лотка. */
export const PRIZE_PAUSE_MS = 300
export const PRIZE_DOOR_MS = 250
export const PRIZE_OPEN_HOLD_MS = 600
export const PRIZE_TAKE_MS = 450

// Табло
/** Шрифт текстов сцены: своих ассетов у игры нет, берётся системный гротеск. */
export const HUD_FONT_FAMILY = 'Arial, Helvetica, sans-serif'
/** Время временных сообщений на табло. */
export const WELCOME_MS = 1500
export const RESET_MS = 1000
