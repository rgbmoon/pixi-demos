import {
  type FrameSize,
  type GroundPoint,
  LampColor,
  LampLight,
  type LightStep,
  type LitterPlacement,
  PhaseName,
  PrizeLight,
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
/** Размеры лотка по осям поля в ячейках: глубина `x` — целое число срезов кучи, ширина `y` идёт вдоль фасада. */
export const TRAY_SIZE: GroundPoint = { x: 3, y: 2.5 }
/** Угол лотка на полу с наименьшими координатами: лоток стоит в левом углу фронтальной грани. */
export const TRAY_ORIGIN: GroundPoint = { x: 0, y: GRID_SIZE - TRAY_SIZE.y }
/** Точка, над которой клешня отпускает игрушку. */
export const TRAY_CENTER: GroundPoint = { x: TRAY_ORIGIN.x + TRAY_SIZE.x / 2, y: TRAY_ORIGIN.y + TRAY_SIZE.y / 2 }
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
/** Сторона гнезда лампы и его отступ от нижнего края табло, px арта. */
export const MARQUEE_LAMP_SIZE = 5
export const MARQUEE_LAMP_BOTTOM = 2
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
/** Цвет пылинки — светлая ступень рампы `warm`; свет пылинки складывается с фоном. */
export const DUST_COLOR = '#f4e5ac'
/** Сид генератора пылинок: их полёт не тратит `Math.random` игры. */
export const DUST_SEED = 7
/** Пауза ровного света ореола стены между мерцаниями, мс. */
export const WALL_GLOW_MIN_PAUSE_MS = 40000
export const WALL_GLOW_MAX_PAUSE_MS = 90000
/** Провалы мерцания ореола стены: до полнакала и до темноты. */
export const WALL_GLOW_DIPS: readonly LampLight[] = [LampLight.dim, LampLight.off]
/** Прозрачность ореола стены при каждом состоянии света: в провале ореол тускнеет, но не гаснет. */
export const WALL_GLOW_ALPHA: Readonly<Record<LampLight, number>> = {
  [LampLight.off]: 0.45,
  [LampLight.dim]: 0.75,
  [LampLight.on]: 1,
}
/** Сид генератора мерцания ореола стены: мерцание не тратит `Math.random` игры. */
export const WALL_GLOW_SEED = 13
/** Центр пятна света автомата на ковре: середина нижнего края фасада тумбы. */
export const FLOOR_GLOW_CENTER: WorldPoint = { x: CABINET_FRONT_X, y: GRID_SIZE / 2, z: CABINET_BOTTOM_Z }
/** Центр тени автомата: середина основания тумбы. */
export const SHADOW_CENTER: WorldPoint = { x: (CABINET_FRONT_X + GRID_SIZE) / 2, y: GRID_SIZE / 2, z: CABINET_BOTTOM_Z }
/** Мусор на крыше табло: кадр атласа `litter` и точка мира под его опорной точкой. */
export const LITTER_ON_ROOF: readonly LitterPlacement[] = [
  { frame: 'can-red.png', point: { x: 1.2, y: 6.3, z: MARQUEE_TOP_Z } },
  { frame: 'bottle-lying.png', point: { x: 3.5, y: 3.8, z: MARQUEE_TOP_Z } },
  { frame: 'cup.png', point: { x: 1.2, y: 1.6, z: MARQUEE_TOP_Z } },
]
/** Мусор на полу справа от тумбы: стоит перед её видимой боковиной и рисуется над корпусом, под игрушками на полу. */
export const LITTER_BESIDE_CABINET: readonly LitterPlacement[] = [
  { frame: 'bottle.png', point: { x: -2.4, y: -1, z: CABINET_BOTTOM_Z } },
  { frame: 'can-crushed-red.png', point: { x: -0.6, y: -2.3, z: CABINET_BOTTOM_Z } },
  { frame: 'butts-pile.png', point: { x: -1.8, y: -3.4, z: CABINET_BOTTOM_Z } },
  { frame: 'butt-a.png', point: { x: -3.6, y: -4.6, z: CABINET_BOTTOM_Z } },
  { frame: 'butt-c.png', point: { x: 1.8, y: -1.4, z: CABINET_BOTTOM_Z } },
  { frame: 'pack.png', point: { x: 3.6, y: -2.6, z: CABINET_BOTTOM_Z } },
  { frame: 'butt-b.png', point: { x: 5.6, y: -1.6, z: CABINET_BOTTOM_Z } },
  { frame: 'bottle-green.png', point: { x: 7.6, y: -1.2, z: CABINET_BOTTOM_Z } },
]
/** Мусор на полу у левого угла тумбы: стоит за её корпусом и рисуется в слое фона. */
export const LITTER_BEHIND_CABINET: readonly LitterPlacement[] = [
  { frame: 'butts-two.png', point: { x: -1.5, y: 9.3, z: CABINET_BOTTOM_Z } },
  { frame: 'can-crushed-green.png', point: { x: 2, y: 9.5, z: CABINET_BOTTOM_Z } },
]
/** Розетка на панели стены у правого края автомата: кадр атласа `litter` и точка стены под низом кадра. */
export const OUTLET: LitterPlacement = { frame: 'outlet.png', point: { x: WALL_X, y: 0.4, z: CABINET_BOTTOM_Z + 0.4 } }
/**
 * Кабель автомата: ломаная от точки под тумбой, скрытой корпусом, по полу к стене и вверх к низу кадра розетки. Изгиб
 * на полу задают промежуточные точки.
 */
export const CABLE_PATH: readonly WorldPoint[] = [
  { x: 7, y: 0.5, z: CABINET_BOTTOM_Z },
  { x: 9, y: -0.4, z: CABINET_BOTTOM_Z },
  { x: 12, y: -0.6, z: CABINET_BOTTOM_Z },
  { x: WALL_X, y: 0.4, z: CABINET_BOTTOM_Z },
  OUTLET.point,
]
/** Цвет кабеля — ступень 1 рампы `metal`. */
export const CABLE_COLOR = '#47443e'

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

/** Центр джойстика и кнопки Drop от бокового края панели, в ячейках: основание Ø24 отступает от края на 13 px арта. */
export const CONTROL_SIDE_OFFSET = (12 + 13) / ART_CELL
/** Центры встроенных органов управления в координатах мира. */
export const JOYSTICK_CENTER: WorldPoint = { x: CABINET_FRONT_X / 2, y: CONTROL_SIDE_OFFSET, z: CABINET_TOP_Z / 2 }
export const DROP_BUTTON_CENTER: WorldPoint = {
  x: CABINET_FRONT_X / 2,
  y: GRID_SIZE - CONTROL_SIDE_OFFSET,
  z: CABINET_TOP_Z / 2,
}
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

// Клешня
/** Доля хода на разгон и на торможение у движений автомата: тросик набирает скорость коротко. */
export const CLAW_RAMP_SHARE = 0.15
/** Длительности кадров захвата, мс: замах, смыкание в два кадра, отскок с приоткрытием, сжатие. */
export const CLAW_GRIP_FRAME_MS = [70, 20, 20, 50, 40] as const
/** Длительность захвата, мс: за это время клешня сжимается, а игрушка встаёт под точку захвата. */
export const CLAW_GRAB_MS = CLAW_GRIP_FRAME_MS.reduce((sum, ms) => sum + ms, 0)
/**
 * Время выравнивания крена игрушки при захвате, мс: замах и смыкание. К первому сжатому кадру клешни игрушка стоит без
 * крена.
 */
export const CLAW_GRAB_ROLL_MS = CLAW_GRIP_FRAME_MS[0] + CLAW_GRIP_FRAME_MS[1]
/** Длительности кадров разжатия, мс: клешня раскрывается медленнее, чем сжимается. */
export const CLAW_RELEASE_FRAME_MS = [80, 80, 80] as const
/** Длительность разжатия, мс: клешня уходит от лотка, только когда раскрылась полностью. */
export const CLAW_RELEASE_MS = CLAW_RELEASE_FRAME_MS.reduce((sum, ms) => sum + ms, 0)
/** Ширина раскрытой клешни, px арта. */
export const CLAW_ART_WIDTH = 28
/** Сторона каретки в ячейках равна ширине клешни: каретка и клешня на тросе упираются в стенки куба краем клешни. */
export const CART_SIZE = CLAW_ART_WIDTH / ART_CELL
/** Расстояние от точки крепления троса до точки захвата по оси клешни, px арта. */
export const CLAW_GRIP_DEPTH = 14
/** Шаг кадров поворота клешни, градусы: совпадает с тегом `{rot=180}` её кадров в `art/claw/`. */
export const CLAW_TILT_STEP = 2
/** На сколько px арта трос заходит под верх клешни: на стыке не открывается щель. */
export const CLAW_ROPE_OVERLAP = 2
/** Полуширина корпуса клешни в ячейках: сечение корпуса над точкой захвата сортирует клешню с игрушками. */
export const CLAW_HUB_HALF_WIDTH = 0.25

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
export const HEAP_SNAPSHOT_VERSION = 8
/** Адрес снимка кучи в IndexedDB. */
export const HEAP_DB_NAME = 'toybox'
export const HEAP_STORE_NAME = 'heap'
export const HEAP_SNAPSHOT_KEY = 'current'

// Игрушки
/** Доля глубины, которую занимает игрушка внутри своих срезов: между соседями по глубине остаётся зазор. */
export const TOY_INSET = 0.875
/**
 * Доля сечения, которой игрушка касается других игрушек: мягкие игрушки вдавливаются друг в друга и ложатся плотнее.
 * Стенки, пол и клешня держат полное сечение.
 */
export const TOY_CONTACT_SHARE = 0.92
/** Шаг угла, с которым рисуется крен игрушки. */
export const TOY_ANGLE_STEP = Math.PI / 18
/** Пауза между тиками игрушки на полу, мс: в среднем раз в минуту. */
export const TOY_TWITCH_MIN_PAUSE_MS = 45000
export const TOY_TWITCH_MAX_PAUSE_MS = 75000
/** Длительности кадров тика, мс: рывок, возврат, второй рывок; последний кадр — поза покоя. */
export const TOY_TWITCH_FRAME_MS = [100, 80, 140, 0] as const
/** Сид генератора тиков игрушек: тики не тратят `Math.random` игры. */
export const TOY_TWITCH_SEED = 17

// Слой содержимого
/** Пересечение силуэтов мельче этого, в единицах сцены, порядка наложения не требует: это касание контуров. */
export const DEPTH_OVERLAP_TOLERANCE = 0.5
/** Сдвиг силуэта, начиная с которого предмет заново сравнивается с соседями, в единицах сцены. */
export const DEPTH_SORT_STEP = 1

// Органы управления
/** Доля хода ручки, ниже которой джойстик не трогает клешню. */
export const JOYSTICK_DEADZONE = 0.3
/** Радиус хода ручки в плоскости панели: жест до этого радиуса задаёт силу отклонения. */
export const JOYSTICK_RADIUS = 48
/** Радиус крупной невидимой области захвата джойстика. */
export const JOYSTICK_HIT_RADIUS = 96
/** Длина стержня от центра основания до центра шара по нормали к панели, px арта: над пыльником видно 6 px. */
export const JOYSTICK_STICK_LENGTH = 16
/** Высота пыльника над панелью, px арта: из его верха выходит стержень. */
export const JOYSTICK_BOOT_HEIGHT = 4
/** Наибольший ход шара в плоскости панели, px арта: ручка отклоняется на угол около 25°. */
export const JOYSTICK_TILT = 5

/** Сторона подложки кнопки в единицах сцены. */
export const BUTTON_SIZE_UNITS = 96
/** Сторона кнопки сброса в единицах сцены: 16 px арта, кнопка помещается на плашке табло. */
export const RESET_BUTTON_SIZE_UNITS = 64
/** Имя кнопки сброса в слое доступности. */
export const RESET_BUTTON_LABEL = 'Reset the heap'
/** Дополнительный отступ невидимой области нажатия от контура. */
export const CONTROL_HIT_PADDING = 16
/**
 * Цвет, на который умножается погашенный орган управления: затемнение на полступени рампы. Сдвиг на ступень темнит
 * пиксели органов управления в среднем до 0.716 яркости, полступени — 0.858.
 */
export const DISABLED_TINT = 0xdbdbdb

// Тур по управлению
/** Ключ флага пройденного тура в localStorage. */
export const TOUR_STORAGE_KEY = 'pixi-demos:toybox:tour-done'
/** Длительности кадров стрелок тура, мс: стрелки отходят наружу и возвращаются. */
export const TOUR_HINT_FRAME_MS = [400, 400] as const
/** На сколько px арта нижний край кадра стрелки Drop поднят над центром кнопки: стрелка не заходит на купол. */
export const TOUR_DROP_HINT_LIFT = 5
/** Число точек для окружностей, лежащих на гранях корпуса. */
export const CONTROL_OUTLINE_STEPS = 24

/** Физические коды клавиш игрового управления. */
export const KEYBOARD_ARROW_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const
export const KEYBOARD_DROP_CODES = ['Enter', 'Space'] as const

// Выдача приза
/** Сторона окна выдачи на передней грани тумбы, в ячейках. */
export const PRIZE_HATCH_SIZE = 3
/** Глубина ниши за окном выдачи, в ячейках: задняя стенка ниши на экране сдвинута на 8 px арта вправо и вверх. */
export const PRIZE_NICHE_DEPTH = 4
/** Ширина металлического обода вокруг окна выдачи, px арта. */
export const PRIZE_RIM_WIDTH = 4
/** Точка на полу ниши под центром окна, посередине глубины: на ней стоит приз, отсюда он выпадает на пол. */
export const PRIZE_NICHE_FLOOR: WorldPoint = {
  x: PRIZE_HATCH_CENTER.x + PRIZE_NICHE_DEPTH / 2,
  y: PRIZE_HATCH_CENTER.y,
  z: PRIZE_HATCH_CENTER.z - PRIZE_HATCH_SIZE / 2,
}
/**
 * Этапы выдачи приза после выхода игрушки из внутреннего лотка: пауза за закрытой шторкой, выдержка в открытом окне,
 * пауза между выпадением игрушки и закрытием шторки.
 */
export const PRIZE_PAUSE_MS = 300
export const PRIZE_OPEN_HOLD_MS = 2000
export const PRIZE_EJECT_HOLD_MS = 600
/** Длительности кадров открытия шторки, мс. */
export const PRIZE_DOOR_OPEN_MS = [50, 50, 50, 40, 60]
/** Длительности кадров открытия заевшей шторки, мс: на втором кадре хода шторка застревает. */
export const PRIZE_DOOR_JAM_MS = [50, 150, 50, 40, 60]
/** Вероятность, что шторка заест при открытии. */
export const PRIZE_DOOR_JAM_CHANCE = 0.1
/** Длительности кадров закрытия шторки, мс: шторка захлопывается. */
export const PRIZE_DOOR_CLOSE_MS = [30, 30, 30, 30, 30]
/** Вероятность, что свет в нише загорится с перебоями и будет мерцать; иначе он сразу горит ровно. */
export const PRIZE_LIGHT_FLICKER_CHANCE = 0.1
/** Включение света в нише: кадр света и его длительность, мс. Ниша остаётся тёмной, затем свет загорается ровно. */
export const PRIZE_LIGHT_SWITCH: readonly (readonly [PrizeLight, number])[] = [
  [PrizeLight.off, 250],
  [PrizeLight.on, 50],
]
/** Розжиг света в нише: кадр света и его длительность, мс. Свет загорается с перебоями. */
export const PRIZE_LIGHT_IGNITION: readonly (readonly [PrizeLight, number])[] = [
  [PrizeLight.off, 120],
  [PrizeLight.dim, 60],
  [PrizeLight.off, 90],
  [PrizeLight.dim, 50],
  [PrizeLight.off, 40],
  [PrizeLight.on, 80],
]
/** Мерцание горящего света по кругу: первый кадр горит, поэтому при уменьшенном движении свет горит ровно. */
export const PRIZE_LIGHT_FLICKER: readonly (readonly [PrizeLight, number])[] = [
  [PrizeLight.on, 600],
  [PrizeLight.dim, 60],
  [PrizeLight.on, 500],
  [PrizeLight.off, 50],
  [PrizeLight.on, 80],
  [PrizeLight.off, 40],
  [PrizeLight.on, 900],
  [PrizeLight.dim, 120],
]
/** Тинт приза при каждом кадре света: в тёмной нише игрушка почти не видна. */
export const PRIZE_LIGHT_TINT: Readonly<Record<PrizeLight, number>> = {
  [PrizeLight.off]: 0x3a3048,
  [PrizeLight.dim]: 0x9a8a90,
  [PrizeLight.on]: 0xffffff,
}

// Пол перед автоматом
/** Глубина полосы пола с выигранными игрушками перед фасадом тумбы, в срезах: как у куба. */
export const FLOOR_PILE_DEPTH = GRID_SIZE
/** Ширина полосы пола в ячейках: вдвое шире куба, середина полосы — под серединой куба. */
export const FLOOR_PILE_WIDTH = GRID_SIZE * 2

// Мерцание света
/** Наибольшее число провалов света за одно мерцание. */
export const FLICKER_MAX_DIPS = 3
/** Длительность провала света и возврата к ровному свету, мс. */
export const FLICKER_MIN_DIP_MS = 30
export const FLICKER_MAX_DIP_MS = 90
export const FLICKER_MIN_RETURN_MS = 30
export const FLICKER_MAX_RETURN_MS = 120

// Табло
/** Розжиг лампы табло: лампа загорается с перебоями. */
export const LAMP_IGNITION: readonly LightStep[] = [
  [LampLight.off, 60],
  [LampLight.dim, 40],
  [LampLight.off, 90],
  [LampLight.on, 50],
  [LampLight.off, 40],
  [LampLight.on, 60],
]
/** Пауза ровного света лампы между мерцаниями, мс: лампа мерцает раз в пару минут. */
export const LAMP_MIN_PAUSE_MS = 90000
export const LAMP_MAX_PAUSE_MS = 150000
/** Провалы мерцания лампы: только до полнакала, горящая лампа не гаснет. */
export const LAMP_DIPS: readonly LampLight[] = [LampLight.dim]
/** Прозрачность ореола лампы при каждом состоянии света. */
export const LAMP_HALO_ALPHA: Readonly<Record<LampLight, number>> = {
  [LampLight.off]: 0,
  [LampLight.dim]: 0.5,
  [LampLight.on]: 1,
}
/** Цвет ламп выигранных игрушек. */
export const LAMP_PRIZE_COLOR: LampColor = LampColor.yellow
/** Сид генератора мерцания ламп: мерцание не тратит `Math.random` игры. */
export const LAMP_FLICKER_SEED = 11
/** Кегль пиксельных шрифтов: высота клетки глифа в px арта, при нём глиф выводится один к одному. */
export const PIXEL_FONT_SIZE = 9
/** Высота заглавных пиксельного шрифта, px арта: выносные строчных уходят ниже, в поле облака. */
export const PIXEL_FONT_CAP_HEIGHT = 7
/** Рама экрана табло, px арта: текст выводится внутри неё. */
export const MARQUEE_SCREEN_FRAME = 1
/** Строки экрана табло внутри рамы над фаской. */
export const MARQUEE_TEXT_ROWS = 11
/** Отступ текста табло от рамы, px арта: строка заглавных стоит посередине рамы, слева отступ тот же. */
export const MARQUEE_TEXT_INSET = (MARQUEE_TEXT_ROWS - PIXEL_FONT_CAP_HEIGHT) / 2
/** Бегущая строка табло: сдвиг на пиксель арта за шаг. */
export const MARQUEE_SCROLL_STEP_MS = 50
/** Время временных сообщений на табло. */
export const WELCOME_MS = 1500
export const RESET_MS = 1000

// Облако диалога
/** Поле между краем облака и текстом, px арта. */
export const BUBBLE_PADDING = 4
/** Наибольшая ширина строки текста в облаке, px арта: длинная реплика переносится по словам. */
export const BUBBLE_TEXT_WIDTH = 64
/** Шаг строк текста в облаке, px арта: клетка глифа и просвет в строку. */
export const BUBBLE_LINE_HEIGHT = 10
/** Сторона облака в начале роста, px арта: меньше двух бордеров 9-slice кадр не сжимается. */
export const BUBBLE_MIN_SIZE = 16
/** Рост облака при появлении: число шагов и длительность шага. */
export const BUBBLE_GROW_STEPS = 4
export const BUBBLE_GROW_STEP_MS = 30
/** Отступ хвоста от бокового края облака, px арта: хвост не заходит на скругление угла. */
export const BUBBLE_TAIL_INSET = 6

// Реплики игрушек
/** Доля призов, которые говорят в окне выдачи. */
export const TOY_SPEECH_CHANCE = 1 / 3
/** Реплики игрушек. Пока игрушек нет, список общий для всех форм. */
export const TOY_SPEECH_LINES = ['Help', 'Test', "It's cold out here.", 'Thank you', 'I love you', 'Are you the one?']
/** Значки реплики из случайных символов, как ругательство в комиксах; за ними идут восклицательные знаки. */
export const TOY_SYMBOL_CHARS = '#$&*@%'
export const TOY_SYMBOL_MIN_LENGTH = 4
export const TOY_SYMBOL_MAX_LENGTH = 6
export const TOY_SYMBOL_MAX_BANGS = 3
/** Вывод реплики: мс на символ. */
export const TOY_SPEECH_CHAR_MS = 40
/** Выдержка на чтение после вывода реплики. */
export const TOY_SPEECH_READ_MS = 1500
/** Острие хвоста облака реплики: на 4 px арта ниже середины верхнего края проёма окна выдачи. */
export const TOY_SPEECH_TIP: WorldPoint = {
  ...PRIZE_HATCH_CENTER,
  z: PRIZE_HATCH_CENTER.z + PRIZE_HATCH_SIZE / 2 - 4 / ART_CELL,
}

// Подтверждение сброса
/** Вопрос диалога сброса. */
export const RESET_CONFIRM_TEXT = 'Reset?'
/** Иконки кнопок диалога из пиксельного шрифта: галочка и крестик. */
export const RESET_CONFIRM_ICON = '\u2713'
export const RESET_CANCEL_ICON = '\u2715'
/** Имена кнопок диалога в слое доступности. */
export const RESET_CONFIRM_LABEL = 'Confirm reset'
export const RESET_CANCEL_LABEL = 'Cancel reset'
/** Клавиши кнопок диалога: подтверждение и отмена. */
export const KEYBOARD_CONFIRM_CODES = ['Enter'] as const
export const KEYBOARD_CANCEL_CODES = ['Escape'] as const
/** Промежуток между вопросом и кнопками и между кнопками, px арта. */
export const RESET_CONFIRM_GAP = 6
/** Острие хвоста диалога от центра кнопки сброса, px арта: у её нижнего левого края. */
export const RESET_CONFIRM_TAIL: ScreenPoint = { x: -6, y: 7 }
/** На сколько px арта нижний край стрелки над кнопкой сброса поднят над её центром. */
export const RESET_HINT_LIFT = 9
