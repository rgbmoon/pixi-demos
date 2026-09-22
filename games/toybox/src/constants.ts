import { PALETTE } from '@pixi-demos/core/palette'

import { type CellAddress, type GroundPoint, PhaseName, type ScreenPoint, type Shape, type ShapeKey } from './types'

/** Ширина макета сцены. */
export const DESIGN_WIDTH = 941
/** Высота макета сцены. */
export const DESIGN_HEIGHT = 1672
/** Пропорции игрового поля: выше CANVAS_FILL_MAX_WIDTH канвас повторяет их. */
export const GAME_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT

/** Ширина контейнера, до которой канвас занимает его целиком. */
export const CANVAS_FILL_MAX_WIDTH = 640

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.booting

/** Сторона сетки в ячейках. */
export const GRID_SIZE = 8

/** Экранный шаг на ячейку вдоль оси x: она уходит вглубь сцены, наклон 1:1. */
export const AXIS_X: ScreenPoint = { x: 8, y: -8 }
/** Экранный шаг на ячейку вдоль оси y: она идёт вдоль фронтальной грани влево, наклон 1:16. */
export const AXIS_Y: ScreenPoint = { x: -64, y: -4 }
/** Экранная длина единицы высоты `z`. */
export const UNIT_HEIGHT = 68
/** Высота куба в единицах мира: столько единиц `z` от пола до верхней грани. */
export const CUBE_HEIGHT = 6

/** Ширина пола в дизайн-единицах. */
export const FLOOR_WIDTH = GRID_SIZE * (Math.abs(AXIS_X.x) + Math.abs(AXIS_Y.x))
/** Высота пола в дизайн-единицах. */
export const FLOOR_HEIGHT = GRID_SIZE * (Math.abs(AXIS_X.y) + Math.abs(AXIS_Y.y))
/** Полная высота куба на экране: пол плюс вертикальные рёбра. */
export const BOX_HEIGHT = FLOOR_HEIGHT + CUBE_HEIGHT * UNIT_HEIGHT
// Начало координат куба — ближний угол пола, а сам пол несимметричен относительно него
/** Сдвиг куба, при котором его пол встаёт по центру отведённого места. */
export const BOX_CENTER_OFFSET_X = (-(AXIS_X.x + AXIS_Y.x) * GRID_SIZE) / 2

/** Сторона лотка в ячейках. */
export const TRAY_SIZE = 2
/** Ближняя к игроку ячейка лотка: лоток стоит в левом углу фронтальной грани. */
export const TRAY_ORIGIN: CellAddress = { col: 0, row: GRID_SIZE - TRAY_SIZE }
/** Точка, над которой клешня отпускает игрушку. */
export const TRAY_CENTER: GroundPoint = { x: TRAY_ORIGIN.col + TRAY_SIZE / 2, y: TRAY_ORIGIN.row + TRAY_SIZE / 2 }
/** Точка, над которой клешня стоит в покое. */
export const FIELD_CENTER: GroundPoint = { x: GRID_SIZE / 2, y: GRID_SIZE / 2 }

/** Предельная скорость клешни при полном отклонении джойстика, ячеек в секунду. */
export const CLAW_MAX_SPEED = 3.6
/** Предел разгона клешни, ячеек в секунду за секунду: мотор выходит на скорость почти сразу. */
export const CLAW_ACCELERATION = 60
/** Предел торможения: клешня встаёт за доли ячейки после отпускания джойстика. */
export const CLAW_BRAKE_ACCELERATION = 90
/** Постоянная времени разгона: чем ближе цель, тем короче фаза ускорения. */
export const CLAW_RESPONSE_MS = 25
/** Постоянная времени торможения: клешня встаёт заметно резче, чем разгоняется. */
export const CLAW_BRAKE_MS = 30
/** Порог, ниже которого остаточная скорость гасится: иначе клешня ползёт после остановки. */
export const CLAW_MIN_SPEED = 0.1
/** Скорость переездов, которые ведёт автомат, ячеек в секунду. */
export const CLAW_TRAVEL_SPEED = 4
/** Длина троса в покое, в слоях: на столько клешня висит ниже каретки, пока её не опустили. */
export const ROPE_REST_LENGTH = 0.8
/** Высота клешни в покое: с неё начинается спуск и на неё же она возвращается. */
export const CLAW_REST_HEIGHT = CUBE_HEIGHT - ROPE_REST_LENGTH
/** Длительность опускания клешни до пола, мс. */
export const CLAW_DROP_MS = 1400
/** Длительность подъёма клешни к верхней грани, мс. */
export const CLAW_LIFT_MS = 1300
/** Доля хода на разгон и на торможение у движений автомата: тросик набирает скорость коротко. */
export const CLAW_RAMP_SHARE = 0.15
/** Предел затухания пружины: на единице колебания исчезают, и решение её шага теряет смысл. */
export const SPRING_MAX_DAMPING = 0.99
/** Отклонение, ниже которого пружина считается пришедшей к цели. */
export const SPRING_MIN_VALUE = 0.001
/** Скорость, ниже которой пружина считается остановившейся. */
export const SPRING_MIN_VELOCITY = 0.01

/** Период свободных колебаний клешни на тросе, мс. */
export const SWAY_PERIOD_MS = 360
/** Затухание колебаний клешни в долях критического: ниже единицы клешня качается, а не просто отстаёт. */
export const SWAY_DAMPING = 0.3
/** Отклонение клешни на единицу скорости каретки, ячеек на ячейку в секунду. */
export const SWAY_DRAG = 0.07
/** Предельное отклонение клешни от каретки, ячеек. */
export const SWAY_MAX_OFFSET = 0.4
/** Сколько пустая клешня стоит над лотком: место под разжатие клешни. */
export const TRAY_HOLD_MS = 1000
/** Сколько клешня держит игрушку над лотком, прежде чем разжаться. */
export const TRAY_RELEASE_MS = 400
/** Сколько клешня сжимается на дне, прежде чем станет известен исход захвата, мс. */
export const GRAB_HOLD_MS = 400
/** Пауза в хвосте фазы цикла клешни: движения не склеиваются встык. */
export const PHASE_PAUSE_MS = 200

/** Максимум слоёв игрушек в ячейке: куб делится по высоте так же, как пол — по осям. */
export const MAX_LAYERS = 4
/** Наименьшая высота стопки на старте: каждая ячейка поля получает хотя бы один слой. */
export const DOME_MIN_LAYERS = 1
/** Высота стопки у края поля на старте, в слоях. */
export const DOME_EDGE_LAYERS = 2
/** Высота стопки под пиком купола на старте, в слоях. */
export const DOME_CENTER_LAYERS = 4
/** Насколько пик купола смещается от центра поля, в ячейках в обе стороны. */
export const DOME_PEAK_JITTER = 1.8
/** Разброс высоты отдельной ячейки вокруг профиля, в слоях в обе стороны. */
export const DOME_HEIGHT_JITTER = 0.9
/**
 * Пределы крутизны склона купола. Ниже единицы вершина выходит плоской — на таких площадках
 * находят себе место формы 2×2; выше единицы куча получается островерхой.
 */
export const DOME_FALLOFF_MIN = 0.6
export const DOME_FALLOFF_MAX = 1.8
/** Высота стенок лотка в слоях: ниже предельной стопки, поэтому игрушка через них переваливается. */
export const TRAY_WALL_LAYERS = 2

/** Доля доставок, в которых клешня роняет игрушку по дороге к лотку. */
export const FUMBLE_CHANCE = 0.24
/** Доля подъёмов, в которых игрушка выскальзывает из клешни по дороге вверх. */
export const LIFT_FUMBLE_CHANCE = 0.13
/** Доля подъёма, раньше которой игрушка не выскальзывает: сразу от стопки срыв не читается. */
export const LIFT_SLIP_MIN_SHARE = 0.15
/** Доля подъёма, позже которой игрушка не выскальзывает: у верхней грани клешня уже уходит в сторону. */
export const LIFT_SLIP_MAX_SHARE = 0.85
/** Шаг выборки пути в долях ячейки: мельче ячейки, поэтому пройденные ею не теряются. */
export const PATH_STEP = 0.25
/** Минимальный перепад, при котором игрушка может сползти на соседнюю стопку, в слоях. */
export const SLIDE_MIN_DROP = 3
/** Перепад под краем, начиная с которого провал считается дырой, а не неровностью, в слоях. */
export const HOLE_MIN_DROP = 2
/** Минимальное произведение площади и глубины, при котором начинается засыпка дыры. */
export const HOLE_MIN_PRESSURE = 2
/** Коэффициент вероятности засыпки дыры. */
export const HOLE_FILL_GAIN = 0.55
/** Максимальная вероятность засыпки дыры за один проход. */
export const HOLE_FILL_MAX_CHANCE = 0.95
/** Максимальное число проходов засыпки без перемещения игрушек. */
export const HOLE_MAX_WAVES = 30
/** Вероятность соскальзывания в лоток после посадки у его стенки. */
export const TRAY_SLIDE_CHANCE = 0.35
/** Пауза между посадкой у стенки и движением к центру лотка, мс. */
export const TRAY_SLIDE_DELAY_MS = 300

/**
 * Каталог форм: клетки в базовой ориентации и частота, с которой форма попадается при наполнении.
 * Размер формы не превышает две клетки по любой оси.
 */
export const SHAPES: Record<ShapeKey, Shape> = {
  single: { cells: [{ dx: 0, dy: 0, dz: 0 }], fillWeight: 2 },
  bar2: {
    cells: [
      { dx: 0, dy: 0, dz: 0 },
      { dx: 1, dy: 0, dz: 0 },
    ],
    fillWeight: 7,
  },
  square4: {
    cells: [
      { dx: 0, dy: 0, dz: 0 },
      { dx: 1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 },
      { dx: 1, dy: 1, dz: 0 },
    ],
    fillWeight: 6,
  },
  cube8: {
    cells: [
      { dx: 0, dy: 0, dz: 0 },
      { dx: 1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 },
      { dx: 1, dy: 1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 },
      { dx: 1, dy: 0, dz: 1 },
      { dx: 0, dy: 1, dz: 1 },
      { dx: 1, dy: 1, dz: 1 },
    ],
    fillWeight: 3,
  },
}

/**
 * Какой доле нижних клеток игрушки нужна опора, чтобы та держалась. Полная опора дала бы кучу
 * без нависаний, нулевая — игрушки в воздухе.
 */
export const SUPPORT_SHARE = 0.5

/** Сколько игрушка проходит один слой по высоте, мс. */
export const TOY_FALL_MS = 180
/** Сколько игрушка проходит одну ячейку по полу, мс. */
export const TOY_TRAVEL_MS = 140
/** Нижний предел длительности хода: ход без спуска и почти без пути всё равно виден. */
export const TOY_MIN_MOTION_MS = 120
/** Насколько единица веса сверх первой уменьшает длительность движения. */
export const MOTION_WEIGHT_GAIN = 0.02
/** Минимальный множитель длительности движения тяжёлой игрушки. */
export const MOTION_MIN_DURATION_SCALE = 0.86

/** Доля успешных захватов свободной игрушки весом в одну клетку. */
export const GRAB_BASE_CHANCE = 0.9
/** Насколько единица веса снижает шанс захвата. */
export const GRAB_WEIGHT_PENALTY = 0.072
/** Насколько единица нагрузки сверху снижает шанс захвата. */
export const GRAB_LOAD_PENALTY = 0.11
/** Пределы шанса захвата: самую тяжёлую игрушку всё же можно взять, самую лёгкую — упустить. */
export const GRAB_MIN_CHANCE = 0.15
export const GRAB_MAX_CHANCE = 0.92

/** Коэффициент вероятности сползания на единицу перепада сверх порога. */
export const SLIDE_BASE = 1.2
/** Добавка к весу в знаменателе: без неё лёгкая игрушка сползала бы почти всегда. */
export const SLIDE_WEIGHT_BIAS = 2
/** Потолок вероятности сползания за один разбор. */
export const SLIDE_MAX_CHANCE = 0.6

/** Толчок соседям на единицу веса севшей игрушки, слоёв в секунду. */
export const IMPACT_BASE = 0.35

/** Версия снимка кучи: не сошлась — снимок игнорируется и куча складывается заново. */
export const HEAP_SNAPSHOT_VERSION = 2
/** Адрес снимка кучи в IndexedDB. */
export const HEAP_DB_NAME = 'toybox'
export const HEAP_STORE_NAME = 'heap'
export const HEAP_SNAPSHOT_KEY = 'current'

/** Длительность вертикального падения на дно лотка, мс. */
export const TRAY_FALL_MS = 320
/** Насколько игрушка висит ниже клешни, в слоях. */
export const CARRY_OFFSET = 0.5
/** Насколько центр игрушки поднят над полом её слоя. */
export const TOY_LAYER_CENTER = 0.5

/** Насколько игрушка прожимается под весом клешни, в слоях. */
export const TOY_PRESS_DEPTH = 0.15
/** Период колебаний игрушки в куче, мс. */
export const TOY_SPRING_PERIOD_MS = 240
/** Затухание колебаний игрушки: куча вязкая, отскок гаснет за пару периодов. */
export const TOY_SPRING_DAMPING = 0.35
/** Просадка садящейся игрушки при падении с полной высоты куба, слоёв в секунду. */
export const TOY_LANDING_IMPULSE = 2.4

/** Масштаб предметов у дальнего края поля: с глубиной они видны мельче. */
export const DEPTH_SCALE_MIN = 0.92

/** Число точек окружности клетки при построении контура игрушки. */
export const TOY_OUTLINE_STEPS = 20
/** Радиус игрушки в дизайн-единицах. */
export const TOY_RADIUS = 26
/** Толщина бордера игрушки. */
export const TOY_THICKNESS = 2
/** Толщина бордера подсвеченной игрушки: её клешня возьмёт. */
export const TOY_HIGHLIGHT_THICKNESS = 6
/** Прозрачность заливки игрушки: сквозь кучу видно её глубину. */
export const TOY_FILL_ALPHA = 0.35
/** Корневой цвет игрушек: от него каждая уходит случайным сдвигом. */
export const TOY_ROOT_COLOR = PALETTE.orange
/** Разброс тона игрушки вокруг корневого цвета, градусы в обе стороны. */
export const TOY_HUE_SPREAD = 45
/** Разброс светлоты игрушки вокруг корневого цвета, доли в обе стороны. */
export const TOY_LIGHTNESS_SPREAD = 0.14

/** Радиус точки клешни в дизайн-единицах. */
export const CLAW_RADIUS = 16
/** Сторона каретки в ячейках: каретка занимает клетку и этой стороной упирается в край поля. */
export const CART_SIZE = 1
/** Толщина контура каретки. */
export const CART_THICKNESS = 2

/** Толщина рёбер куба и линий сетки в пикселях. */
export const LINE_THICKNESS = 1
/** Прозрачность линий сетки: ими каркас отличается от рёбер. */
export const GRID_ALPHA = 0.35
/** Прозрачность заливки лотка. */
export const TRAY_ALPHA = 0.35

/** Доля хода ручки, ниже которой джойстик не трогает клешню. */
export const JOYSTICK_DEADZONE = 0.3

/** Радиус подложки джойстика в дизайн-единицах. */
export const JOYSTICK_RADIUS = 95
/** Радиус ручки джойстика. */
export const JOYSTICK_KNOB_RADIUS = 46
/** Толщина обводки подложки джойстика. */
export const JOYSTICK_THICKNESS = 3
/** Прозрачность заливки подложки джойстика. */
export const JOYSTICK_FILL_ALPHA = 0.16

/** Сторона подложки кнопки в дизайн-единицах. */
export const BUTTON_SIZE_UNITS = 130
/** Толщина обводки кнопки. */
export const BUTTON_THICKNESS = 3
/** Прозрачность заливки кнопки. */
export const BUTTON_FILL_ALPHA = 0.2
/** Сторона кнопки сброса в дизайн-единицах: меньше кнопки опускания. */
export const RESET_BUTTON_SIZE_UNITS = 84
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

/** Смещение джойстика от центра блока управления. */
export const JOYSTICK_OFFSET_X = -170
/** Смещение кнопки опускания от центра блока управления. */
export const DROP_OFFSET_X = 230

/** Шрифт текстов сцены: своих ассетов у игры нет, берётся системный гротеск. */
export const HUD_FONT_FAMILY = 'Arial, Helvetica, sans-serif'
/** Кегль счётчика игрушек в дизайн-единицах. */
export const COUNTER_FONT_SIZE = 44

/** Отступ элементов сцены от края видимой области. */
export const SCREEN_MARGIN = 32
/** Отступ куба от верха игровой области. */
export const BOX_TOP_MARGIN = 64
