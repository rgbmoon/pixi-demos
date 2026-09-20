import { PALETTE } from '@pixi-demos/core/palette'

import { type CellAddress, type GroundPoint, PhaseName, type ScreenPoint } from './types'

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
/** Отклонение клешни на единицу скорости каретки, ячеек на ячейку в секунду: так клешня тянется за ходом. */
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
/** Высота стопки у края поля на старте, в слоях. */
export const DOME_EDGE_LAYERS = 2
/** Высота стопки в центре поля на старте, в слоях. */
export const DOME_CENTER_LAYERS = 4
/** Высота стенок лотка в слоях: ниже предельной стопки, поэтому игрушка через них переваливается. */
export const TRAY_WALL_LAYERS = 2

/** Доля удачных захватов. */
export const GRAB_CHANCE = 0.82
/** Доля доставок, в которых клешня роняет игрушку по дороге к лотку. */
export const FUMBLE_CHANCE = 0.35
/** Доля подъёмов, в которых игрушка выскальзывает из клешни по дороге вверх. */
export const LIFT_FUMBLE_CHANCE = 0.2
/** Доля подъёма, раньше которой игрушка не выскальзывает: сразу от стопки срыв не читается. */
export const LIFT_SLIP_MIN_SHARE = 0.15
/** Доля подъёма, позже которой игрушка не выскальзывает: у верхней грани клешня уже уходит в сторону. */
export const LIFT_SLIP_MAX_SHARE = 0.85
/** Шаг выборки пути в долях ячейки: мельче ячейки, поэтому пройденные ею не теряются. */
export const PATH_STEP = 0.25
/** Перепад между соседними стопками, выше которого верхняя игрушка сползает в низкую, в слоях. */
export const SETTLE_GAP = 3
/** Доля осыпаний, которые случаются при достаточном перепаде. */
export const SETTLE_CHANCE = 0.5
/** Вес лотка при выборе соседа для отскока: ячейка бокса идёт с весом 1. */
export const TRAY_BOUNCE_WEIGHT = 0.35
/** Предел отскоков подряд: дальше место ищется обходом поля, а не броском. */
export const MAX_BOUNCES = 6

/** Длительность падения игрушки на один слой, мс. */
export const TOY_FALL_MS = 180
/** Длительность отскока игрушки в соседнюю ячейку, мс. */
export const TOY_BOUNCE_MS = 160
/** Длительность ухода игрушки в лоток, мс. */
export const TOY_COLLECT_MS = 320
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
