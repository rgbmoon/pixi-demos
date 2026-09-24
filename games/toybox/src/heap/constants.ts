import { PALETTE } from '@pixi-demos/core/palette'

// Физика кучи
/** Ускорение свободного падения, клеток в секунду за секунду: падение с высоты 4 занимает ≈0,36 с. */
export const HEAP_GRAVITY = 60
/** Трение игрушек о кучу и стенки. */
export const TOY_FRICTION = 0.6
/** Упругость игрушек: мягкая игрушка почти не отскакивает. */
export const TOY_RESTITUTION = 0.05
/** Затухание скорости и вращения игрушки, в долях за секунду. */
export const TOY_LINEAR_DAMPING = 0.3
export const TOY_ANGULAR_DAMPING = 1
/** Толщина стенок куба и пола в физике, в клетках: стенка стоит снаружи куба. */
export const WALL_THICKNESS = 0.5
/** Толщина стенки лотка в физике, в клетках. */
export const TRAY_WALL_THICKNESS = 0.06
/** Конечная высота игрушки в шахте: полностью перекрыта корпусом с учётом контура и обводки. */
export const TRAY_EXIT_Z = -1.5

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

/** Шаг физики кучи. Между шагами позы игрушек интерполируются: на экранах 120 Гц движение остаётся ровным. */
export const HEAP_STEP_MS = 1000 / 60
/** Предел шагов физики за кадр: остаток кадра длиннее 100 мс отбрасывается. */
export const HEAP_MAX_STEPS_PER_FRAME = 6
/** Предел шагов, за которые куча обязана прийти в покой при наполнении и при уменьшенном движении. */
export const HEAP_SETTLE_MAX_STEPS = 3000
/** Через столько после последней команды тела кучи засыпают принудительно: дрожание не держит фазы. */
export const HEAP_SETTLE_TIMEOUT_MS = 8000

// Наполнение кучи
/**
 * Профиль купола при наполнении
 */
export const DOME_CENTER_HEIGHT = 4.2
export const DOME_EDGE_HEIGHT = 1.6
export const DOME_PEAK_JITTER = 1.2
export const DOME_FALLOFF_MIN = 0.7
export const DOME_FALLOFF_MAX = 1.6
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
/** Корневой цвет игрушек: от него каждая уходит случайным сдвигом. */
export const TOY_ROOT_COLOR = PALETTE.orange
/** Разброс тона игрушки вокруг корневого цвета, градусы в обе стороны. */
export const TOY_HUE_SPREAD = 45
/** Разброс светлоты игрушки вокруг корневого цвета, доли в обе стороны. */
export const TOY_LIGHTNESS_SPREAD = 0.14

// Захват и отпускание
/** Доля успешных захватов свободной игрушки весом в одну клетку. */
export const GRAB_BASE_CHANCE = 0.9
/** Насколько единица веса снижает шанс захвата. */
export const GRAB_WEIGHT_PENALTY = 0.072
/** Насколько единица нагрузки сверху снижает шанс захвата. */
export const GRAB_LOAD_PENALTY = 0.11
/** Пределы шанса захвата: самую тяжёлую игрушку всё же можно взять, самую лёгкую — упустить. */
export const GRAB_MIN_CHANCE = 0.15
export const GRAB_MAX_CHANCE = 0.92
/** Зазор между сечениями, при котором игрушки ещё касаются: движок держит тела на расстоянии своего допуска. */
export const LOAD_CONTACT_GAP = 0.05
/** Наименьшая вертикальная доля нормали касания, при которой сосед считается лежащим сверху. */
export const LOAD_NORMAL_MIN = 0.5
/** Запас вокруг рамки снятой игрушки, в котором будятся соседи, в клетках. */
export const WAKE_MARGIN = 0.1
/** Скорость, которую клешня передаёт игрушке при промахе, прожимая её вниз, клеток в секунду. */
export const PRESS_SPEED = 10
/** Шаг подъёма отпущенной игрушки, пересекающей кучу: она поднимается до свободного места. */
export const RELEASE_RAISE_STEP = 0.05
