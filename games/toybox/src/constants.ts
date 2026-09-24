import { PALETTE } from '@pixi-demos/core/palette'

import { type GroundPoint, PhaseName, type ScreenPoint, type Shape, type ShapeKey, type WorldPoint } from './types'

/** Ширина контейнера, до которой канвас занимает его целиком. */
export const CANVAS_FILL_MAX_WIDTH = 640

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.booting

/** Сторона сетки в ячейках. */
export const GRID_SIZE = 8
/** Сторона ячейки в единицах сцены; в исходном арте это 16 пикселей. */
export const CELL_SIZE = 64

/** Экранный шаг на ячейку вдоль оси x: она уходит вглубь сцены, наклон 1:1. */
export const AXIS_X: ScreenPoint = { x: 8, y: -8 }
/** Экранный шаг на ячейку вдоль оси y: она идёт вдоль фронтальной грани влево, наклон 1:16. */
export const AXIS_Y: ScreenPoint = { x: -64, y: -4 }
/** Экранная длина единицы высоты `z`. */
export const UNIT_HEIGHT = CELL_SIZE
/** Высота стеклянного бокса в ячейках. */
export const CUBE_HEIGHT = 8

/** Передний край панели выступает к игроку на три ячейки. */
export const CABINET_FRONT_X = -3
/** Верх передней грани тумбы на одну ячейку ниже пола бокса. */
export const CABINET_TOP_Z = -1
/** Нижняя грань тумбы: при ней высота автомата на экране равна 1264 единицам сцены. */
export const CABINET_BOTTOM_Z = -8.875
/** Верх табло на одну ячейку выше стеклянного бокса. */
export const MARQUEE_TOP_Z = CUBE_HEIGHT + 1

/** Базисы плоскостей задают направления вправо и вниз относительно установленного элемента. */
export const CONTROL_PANEL_HORIZONTAL: WorldPoint = { x: 0, y: -1, z: 0 }
export const CONTROL_PANEL_VERTICAL: WorldPoint = { x: -1, y: 0, z: CABINET_TOP_Z / -CABINET_FRONT_X }
export const CABINET_FRONT_HORIZONTAL: WorldPoint = { x: 0, y: -1, z: 0 }
export const CABINET_FRONT_VERTICAL: WorldPoint = { x: 0, y: 0, z: -1 }

/** Центры встроенных органов управления в координатах мира. */
export const JOYSTICK_CENTER: WorldPoint = { x: CABINET_FRONT_X / 2, y: 2, z: CABINET_TOP_Z / 2 }
export const DROP_BUTTON_CENTER: WorldPoint = { x: CABINET_FRONT_X / 2, y: 6, z: CABINET_TOP_Z / 2 }
export const PRIZE_HATCH_CENTER: WorldPoint = {
  x: CABINET_FRONT_X,
  y: GRID_SIZE / 2,
  z: (CABINET_TOP_Z + CABINET_BOTTOM_Z) / 2,
}
export const RESET_BUTTON_CENTER: WorldPoint = {
  x: CABINET_FRONT_X,
  y: 1,
  z: CABINET_BOTTOM_Z + 1,
}
export const MARQUEE_TEXT_CENTER: WorldPoint = { x: 0, y: GRID_SIZE / 2, z: CUBE_HEIGHT + 0.5 }

/** Сторона лотка в ячейках. */
export const TRAY_SIZE = 2
/** Угол лотка на полу с наименьшими координатами: лоток стоит в левом углу фронтальной грани. */
export const TRAY_ORIGIN: GroundPoint = { x: 0, y: GRID_SIZE - TRAY_SIZE }
/** Точка, над которой клешня отпускает игрушку. */
export const TRAY_CENTER: GroundPoint = { x: TRAY_ORIGIN.x + TRAY_SIZE / 2, y: TRAY_ORIGIN.y + TRAY_SIZE / 2 }
/** Точка, над которой клешня стоит в покое. */
export const FIELD_CENTER: GroundPoint = { x: GRID_SIZE / 2, y: GRID_SIZE / 2 }

/** Предельная скорость клешни при включённом движении, ячеек в секунду. */
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
/** Длина троса в покое, в ячейках. */
export const ROPE_REST_LENGTH = 1.5
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
/** Длительность захвата и центрирования игрушки в прототипе, мс. */
export const CLAW_GRAB_MS = 200
/** Пауза в хвосте фазы цикла клешни: движения не склеиваются встык. */
export const PHASE_PAUSE_MS = 200

/**
 * Профиль купола при наполнении
 */
export const DOME_CENTER_HEIGHT = 4.2
export const DOME_EDGE_HEIGHT = 1.6
export const DOME_PEAK_JITTER = 1.2
export const DOME_FALLOFF_MIN = 0.7
export const DOME_FALLOFF_MAX = 1.6
/** Высота стенок лотка: ниже верха кучи, поэтому игрушка через них переваливается. */
export const TRAY_WALL_HEIGHT = 2

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

/**
 * Каталог форм: сечения в плоскости `(y, z)` в клетках — выпуклые многоугольники со скруглёнными углами,
 * глубина в срезах, вес в клетках и частота при наполнении. Скругление приближает силуэты к упрощённым
 * мягким игрушкам; габариты и веса форм соответствуют прежним клеточным формам.
 */
export const SHAPES: Record<ShapeKey, Shape> = {
  single: {
    variants: [
      {
        section: [
          { y: -0.5, z: -0.45 },
          { y: 0.5, z: -0.45 },
          { y: 0.5, z: 0.45 },
          { y: -0.5, z: 0.45 },
        ],
        radius: 0.4,
        depth: 1,
      },
    ],
    weight: 1,
    fillWeight: 2,
  },
  bar2: {
    variants: [
      {
        section: [
          { y: -1, z: -0.5 },
          { y: 1, z: -0.5 },
          { y: 1, z: 0.5 },
          { y: -1, z: 0.5 },
        ],
        radius: 0.45,
        depth: 1,
      },
      {
        section: [
          { y: -0.5, z: -0.5 },
          { y: 0.5, z: -0.5 },
          { y: 0.5, z: 0.5 },
          { y: -0.5, z: 0.5 },
        ],
        radius: 0.42,
        depth: 2,
      },
    ],
    weight: 2,
    fillWeight: 7,
  },
  square4: {
    variants: [
      {
        section: [
          { y: -1, z: -0.5 },
          { y: 1, z: -0.5 },
          { y: 1, z: 0.5 },
          { y: -1, z: 0.5 },
        ],
        radius: 0.3,
        depth: 2,
      },
    ],
    weight: 4,
    fillWeight: 6,
  },
  cube8: {
    variants: [
      {
        section: [
          { y: -1, z: -1 },
          { y: 1, z: -1 },
          { y: 0.85, z: 1 },
          { y: -0.85, z: 1 },
        ],
        radius: 0.55,
        depth: 2,
      },
    ],
    weight: 8,
    fillWeight: 3,
  },
  triangle: {
    variants: [
      {
        section: [
          { y: -1, z: -0.5 },
          { y: 1, z: -0.5 },
          { y: 0, z: 1 },
        ],
        radius: 0.35,
        depth: 2,
      },
    ],
    weight: 3,
    fillWeight: 4,
  },
}

/** Наибольшая доля ребра сечения, которую занимает скругление угла: соседние скругления не смыкаются. */
export const CORNER_EDGE_SHARE = 0.45
/** Доля сечения и глубины, которую занимает игрушка внутри своих клеток: между соседями остаётся зазор. */
export const TOY_INSET = 0.875
/** Трение игрушек о кучу и стенки. */
export const TOY_FRICTION = 0.6
/** Упругость игрушек: мягкая игрушка почти не отскакивает. */
export const TOY_RESTITUTION = 0.05
/** Затухание скорости и вращения игрушки, в долях за секунду. */
export const TOY_LINEAR_DAMPING = 0.3
export const TOY_ANGULAR_DAMPING = 1
/** Шаг угла, с которым рисуется крен игрушки. */
export const TOY_ANGLE_STEP = Math.PI / 36
/** Пересечение силуэтов мельче этого, в единицах сцены, порядка наложения не требует: это касание контуров. */
export const DEPTH_OVERLAP_TOLERANCE = 0.5
/** Сдвиг силуэта, начиная с которого предмет заново сравнивается с соседями, в единицах сцены. */
export const DEPTH_SORT_STEP = 1

/** Ускорение свободного падения, клеток в секунду за секунду: падение с высоты 4 занимает ≈0,36 с. */
export const HEAP_GRAVITY = 60
/** Шаг физики кучи. Между шагами позы игрушек интерполируются: на экранах 120 Гц движение остаётся ровным. */
export const HEAP_STEP_MS = 1000 / 60
/** Предел шагов физики за кадр: остаток кадра длиннее 100 мс отбрасывается. */
export const HEAP_MAX_STEPS_PER_FRAME = 6
/** Предел шагов, за которые куча обязана прийти в покой при наполнении и при уменьшенном движении. */
export const HEAP_SETTLE_MAX_STEPS = 3000
/** Через столько после последней команды тела кучи засыпают принудительно: дрожание не держит фазы. */
export const HEAP_SETTLE_TIMEOUT_MS = 8000
/** Зазор между сечениями, при котором игрушки ещё касаются: движок держит тела на расстоянии своего допуска. */
export const LOAD_CONTACT_GAP = 0.05
/** Наименьшая вертикальная доля нормали касания, при которой сосед считается лежащим сверху. */
export const LOAD_NORMAL_MIN = 0.5
/** Запас вокруг рамки снятой игрушки, в котором будятся соседи, в клетках. */
export const WAKE_MARGIN = 0.1
/** Шаг подъёма отпущенной игрушки, пересекающей кучу: она поднимается до свободного места. */
export const RELEASE_RAISE_STEP = 0.05

/** Суммарный вес игрушек, до которого идёт наполнение. */
export const FILL_VOLUME = 170
/** Сколько мест пробуется для каждой новой игрушки: она встаёт туда, где до купола дальше всего. */
export const FILL_CANDIDATES = 8
/** Сколько раз подряд игрушке может не найтись места до конца наполнения. */
export const FILL_MAX_FAILURES = 40
/** Сколько игрушек появляется перед каждой пачкой шагов и сколько шагов в пачке. */
export const FILL_BATCH = 6
export const FILL_BATCH_STEPS = 20
/** Зазор между поверхностью кучи и новой игрушкой. */
export const FILL_SPAWN_GAP = 0.1
/** Наибольший крен новой игрушки, радианы в обе стороны. */
export const FILL_MAX_TILT = 0.3

/** Толщина стенок куба и пола в физике, в клетках: стенка стоит снаружи куба. */
export const WALL_THICKNESS = 0.5
/** Толщина стенки лотка в физике, в клетках. */
export const TRAY_WALL_THICKNESS = 0.06

/**
 * Биты фильтра столкновений. Биты 0–7 — срезы глубины: игрушки сталкиваются, если занимают общий срез.
 * Остальные — категории статики.
 */
export const COLLISION_WALL = 1 << 8
export const COLLISION_BACK_FLOOR = 1 << 9
export const COLLISION_TRAY_WALL = 1 << 10
export const COLLISION_FAR_WALL = 1 << 11
/** Бит игрушки, занимающей срезы 1 и 2: только она упирается в дальнюю стенку лотка. */
export const COLLISION_FAR_SPAN = 1 << 12

/** Доля успешных захватов свободной игрушки весом в одну клетку. */
export const GRAB_BASE_CHANCE = 0.9
/** Насколько единица веса снижает шанс захвата. */
export const GRAB_WEIGHT_PENALTY = 0.072
/** Насколько единица нагрузки сверху снижает шанс захвата. */
export const GRAB_LOAD_PENALTY = 0.11
/** Пределы шанса захвата: самую тяжёлую игрушку всё же можно взять, самую лёгкую — упустить. */
export const GRAB_MIN_CHANCE = 0.15
export const GRAB_MAX_CHANCE = 0.92

/** Версия снимка кучи: не сошлась — снимок игнорируется и куча складывается заново. */
export const HEAP_SNAPSHOT_VERSION = 3
/** Адрес снимка кучи в IndexedDB. */
export const HEAP_DB_NAME = 'toybox'
export const HEAP_STORE_NAME = 'heap'
export const HEAP_SNAPSHOT_KEY = 'current'

/** Конечная высота игрушки в шахте: полностью перекрыта корпусом с учётом контура и обводки. */
export const TRAY_EXIT_Z = -1.5
/** Скорость, которую клешня передаёт игрушке при промахе, прожимая её вниз, клеток в секунду. */
export const PRESS_SPEED = 10
/** Толщина бордера игрушки. */
export const TOY_THICKNESS = 4
/** Толщина бордера подсвеченной игрушки: её клешня возьмёт. */
export const TOY_HIGHLIGHT_THICKNESS = 8
/** Прозрачность заливки игрушки: сквозь кучу видно её глубину. */
export const TOY_FILL_ALPHA = 0.35
/** Корневой цвет игрушек: от него каждая уходит случайным сдвигом. */
export const TOY_ROOT_COLOR = PALETTE.orange
/** Разброс тона игрушки вокруг корневого цвета, градусы в обе стороны. */
export const TOY_HUE_SPREAD = 45
/** Разброс светлоты игрушки вокруг корневого цвета, доли в обе стороны. */
export const TOY_LIGHTNESS_SPREAD = 0.14

/** Радиус точки клешни в единицах сцены. */
export const CLAW_RADIUS = 16
/** Сторона каретки в ячейках: каретка занимает клетку и этой стороной упирается в край поля. */
export const CART_SIZE = 1
/** Толщина контура каретки. */
export const CART_THICKNESS = 4

/** Толщина рёбер куба и линий сетки в пикселях. */
export const LINE_THICKNESS = 4
/** Прозрачность линий сетки: ими каркас отличается от рёбер. */
export const GRID_ALPHA = 0.35
/** Прозрачность заливки лотка. */
export const TRAY_ALPHA = 0.35

/** Доля хода ручки, ниже которой джойстик не трогает клешню. */
export const JOYSTICK_DEADZONE = 0.3

/** Радиус подложки джойстика: диаметр совпадает с кнопкой Drop. */
export const JOYSTICK_RADIUS = 48
/** Радиус ручки джойстика. */
export const JOYSTICK_KNOB_RADIUS = 32
/** Толщина обводки подложки джойстика. */
export const JOYSTICK_THICKNESS = 4
/** Прозрачность заливки подложки джойстика. */
export const JOYSTICK_FILL_ALPHA = 0.16
/** Толщина стойки ручки джойстика. */
export const JOYSTICK_STEM_THICKNESS = 16
/** Радиус крупной невидимой области захвата джойстика. */
export const JOYSTICK_HIT_RADIUS = 96

/** Сторона подложки кнопки в единицах сцены. */
export const BUTTON_SIZE_UNITS = 96
/** Толщина обводки кнопки. */
export const BUTTON_THICKNESS = 4
/** Прозрачность заливки кнопки. */
export const BUTTON_FILL_ALPHA = 0.2
/** Сторона кнопки сброса в единицах сцены: меньше кнопки опускания. */
export const RESET_BUTTON_SIZE_UNITS = 88
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

/** Шрифт текстов сцены: своих ассетов у игры нет, берётся системный гротеск. */
export const HUD_FONT_FAMILY = 'Arial, Helvetica, sans-serif'
/** Отступ корпуса от края канваса в единицах сцены: одна ячейка. */
export const MACHINE_MARGIN = CELL_SIZE

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

/** Время временных сообщений на табло. */
export const WELCOME_MS = 1500
export const RESET_MS = 1000

/** Физические коды клавиш игрового управления. */
export const KEYBOARD_ARROW_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const
export const KEYBOARD_DROP_CODES = ['Enter', 'Space'] as const

/** Ключи каталога для перебора при наполнении. */
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[]
/** Нижняя длительность движения исключает деление на ноль. */
export const MIN_TRAVEL_MS = 1
/** Кадровый шаг клешни выполняется раньше шага модели кучи и синхронизации View-компонентов. */
export const CLAW_PRIORITY = 10
export const CONTENTS_PRIORITY = 0
