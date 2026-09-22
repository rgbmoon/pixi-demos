import {
  DOME_CENTER_LAYERS,
  DOME_EDGE_LAYERS,
  DOME_FALLOFF_MAX,
  DOME_FALLOFF_MIN,
  DOME_HEIGHT_JITTER,
  DOME_MIN_LAYERS,
  DOME_PEAK_JITTER,
  GRAB_BASE_CHANCE,
  GRAB_LOAD_PENALTY,
  GRAB_MAX_CHANCE,
  GRAB_MIN_CHANCE,
  GRAB_WEIGHT_PENALTY,
  GRID_SIZE,
  HOLE_FILL_GAIN,
  HOLE_FILL_MAX_CHANCE,
  HOLE_MIN_DROP,
  HOLE_MIN_PRESSURE,
  HEAP_SNAPSHOT_VERSION,
  IMPACT_BASE,
  MAX_LAYERS,
  SLIDE_MIN_DROP,
  SHAPES,
  SLIDE_BASE,
  SLIDE_MAX_CHANCE,
  SLIDE_WEIGHT_BIAS,
  SUPPORT_SHARE,
  TOY_LAYER_CENTER,
  TOY_MIN_MOTION_MS,
  PIXEL_SCALE,
  TOY_OUTLINE_STEPS,
  TOY_RADIUS,
  TRAY_SLIDE_CHANCE,
  TRAY_WALL_LAYERS,
} from '#src/constants'
import type {
  CellAddress,
  Facing,
  HeapSnapshot,
  Hole,
  Occupancy,
  Placement,
  ScreenPoint,
  ShapeCell,
  ShapeKey,
  Surface,
  ToyBody,
  ToyId,
  VolumeCell,
  WorldPoint,
} from '#src/types'
import { ToyState } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { clamp, lerp } from './math'
import { getCellCenter, getDepthOrder, getNeighbours, isTrayCell, worldToScreen } from './projection'

/** Все ориентации формы, в порядке поворота. */
export const FACINGS: Facing[] = [0, 1, 2, 3]

/** Ключи каталога форм. */
const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[]

/** Создаёт пустую трёхмерную решётку занятости. */
export const createOccupancy = (): (ToyId | undefined)[][][] =>
  Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => Array.from({ length: MAX_LAYERS }, () => undefined))
  )

/** Возвращает число клеток формы. */
export const getWeight = (shape: ShapeKey): number => SHAPES[shape].cells.length

/**
 * Вероятность захвата с учётом веса игрушки и нагрузки сверху.
 */
export const getGrabChance = (weight: number, load: number): number =>
  clamp(
    GRAB_BASE_CHANCE / (1 + GRAB_WEIGHT_PENALTY * weight + GRAB_LOAD_PENALTY * load),
    GRAB_MIN_CHANCE,
    GRAB_MAX_CHANCE
  )

/**
 * Вероятность сползания по перепаду высот и весу игрушки.
 */
export const getSlideChance = (weight: number, gap: number): number => {
  const excess = gap - SLIDE_MIN_DROP

  if (excess <= 0) return 0

  return clamp((SLIDE_BASE * excess) / (weight + SLIDE_WEIGHT_BIAS), 0, SLIDE_MAX_CHANCE)
}

/** Толчок, который севшая игрушка передаёт соседу: слабеет с расстоянием между ними. */
export const getImpact = (weight: number, distance: number): number =>
  (IMPACT_BASE * weight) / (1 + Math.max(distance, 0))

/** Поворот ориентации на `steps` четвертей оборота. */
export const rotateFacing = (facing: Facing, steps: number): Facing => ((((facing + steps) % 4) + 4) % 4) as Facing

/** Четверть оборота клетки формы вокруг вертикальной оси: `(dx, dy)` переходит в `(-dy, dx)`. */
const turnCell = ({ dx, dy, dz }: ShapeCell, facing: Facing): ShapeCell => {
  if (facing === 1) return { dx: -dy, dy: dx, dz }
  if (facing === 2) return { dx: -dx, dy: -dy, dz }
  if (facing === 3) return { dx: dy, dy: -dx, dz }

  return { dx, dy, dz }
}

/**
 * Клетки формы в ориентации `facing`, приведённые к нулевому якорю: после поворота смещения
 * сдвигаются так, что минимальные `dx` и `dy` снова равны нулю. Поэтому четыре поворота подряд
 * возвращают исходный набор.
 */
export const getShapeCells = (shape: ShapeKey, facing: Facing): ShapeCell[] => {
  const turned = SHAPES[shape].cells.map((cell) => turnCell(cell, facing))
  const minX = Math.min(...turned.map(({ dx }) => dx))
  const minY = Math.min(...turned.map(({ dy }) => dy))

  return turned.map(({ dx, dy, dz }) => ({ dx: dx - minX, dy: dy - minY, dz }))
}

/** Возвращает клетки формы для заданных якоря, ориентации и слоя. */
export const getPlacementCells = (
  shape: ShapeKey,
  facing: Facing,
  anchor: CellAddress,
  layer: number
): VolumeCell[] =>
  getShapeCells(shape, facing).map(({ dx, dy, dz }) => ({
    col: anchor.col + dx,
    row: anchor.row + dy,
    layer: layer + dz,
  }))

/** Возвращает самую нижнюю клетку каждого столбца формы. */
export const getBottomCells = (cells: readonly VolumeCell[]): VolumeCell[] => {
  const lowest = new Map<string, VolumeCell>()

  for (const cell of cells) {
    const key = `${cell.col}:${cell.row}`
    const current = lowest.get(key)

    if (!current || cell.layer < current.layer) lowest.set(key, cell)
  }

  return [...lowest.values()]
}

/** Лежит ли клетка в объёме куба: внутри поля, в пределах слоёв и вне лотка. */
export const isBoxCell = ({ col, row, layer }: VolumeCell): boolean =>
  col >= 0 &&
  col < GRID_SIZE &&
  row >= 0 &&
  row < GRID_SIZE &&
  layer >= 0 &&
  layer < MAX_LAYERS &&
  !isTrayCell({ col, row })

/** Проверяет, что все клетки находятся в кубе и свободны. */
export const canPlace = (cells: readonly VolumeCell[], isOccupied: Occupancy): boolean =>
  cells.every((cell) => isBoxCell(cell) && !isOccupied(cell))

/** Нижние клетки, под которыми есть пол или другая игрушка. */
const getSupports = (cells: readonly VolumeCell[], isOccupied: Occupancy): VolumeCell[] =>
  getBottomCells(cells).filter(({ col, row, layer }) => layer === 0 || isOccupied({ col, row, layer: layer - 1 }))

/**
 * Держится ли игрушка: опора нужна хотя бы под долей `SUPPORT_SHARE` её нижних клеток,
 * с округлением вверх. Опорой считается пол или занятая клетка под ней.
 */
export const isSupported = (cells: readonly VolumeCell[], isOccupied: Occupancy): boolean =>
  getSupports(cells, isOccupied).length >= Math.ceil(getBottomCells(cells).length * SUPPORT_SHARE)

/**
 * Опирается ли игрушка каждой своей нижней клеткой. Правило плотной укладки: по нему насыпается
 * куча на старте, чтобы под ней не оставалось пустот. Нависания появляются потом, от игры.
 */
export const isFullySupported = (cells: readonly VolumeCell[], isOccupied: Occupancy): boolean =>
  getSupports(cells, isOccupied).length === getBottomCells(cells).length

/**
 * Слой, на котором форма остановится, падая в колонку якоря с высоты `from`.
 * Спуск прекращается на первой опоре и упирается в занятую клетку: сквозь кучу игрушка не идёт.
 * `undefined` означает, что форма не встаёт даже на высоте, с которой падает.
 */
export const findLanding = (
  shape: ShapeKey,
  facing: Facing,
  anchor: CellAddress,
  from: number,
  isOccupied: Occupancy
): number | undefined => {
  let landing: number | undefined
  const topOffset = Math.max(...getShapeCells(shape, facing).map(({ dz }) => dz))
  const start = Math.min(from, MAX_LAYERS - 1 - topOffset)

  for (let layer = start; layer >= 0; layer--) {
    const cells = getPlacementCells(shape, facing, anchor, layer)

    if (!canPlace(cells, isOccupied)) break

    landing = layer

    if (isSupported(cells, isOccupied)) break
  }

  return landing
}

/**
 * Рассчитывает место посадки после отпускания над ячейкой. Сначала проверяет ориентацию после
 * доворота на четверть, затем остальные ориентации и соседние ячейки. `undefined` означает, что
 * свободного места в кубе нет.
 */
export const planLanding = (
  shape: ShapeKey,
  facing: Facing,
  cell: CellAddress,
  isOccupied: Occupancy
): Placement | undefined => {
  const preferred = rotateFacing(facing, 1)
  const facings = [preferred, ...FACINGS.filter((other) => other !== preferred)]
  const visited = new Set([`${cell.col}:${cell.row}`])
  const queue: CellAddress[] = [cell]

  while (queue.length > 0) {
    const anchor = queue.shift() as CellAddress

    for (const candidate of facings) {
      const layer = findLanding(shape, candidate, anchor, MAX_LAYERS - 1, isOccupied)

      if (layer !== undefined) return { anchor, facing: candidate, layer }
    }

    for (const next of getNeighbours(anchor)) {
      const key = `${next.col}:${next.row}`

      if (visited.has(key) || isTrayCell(next)) continue

      visited.add(key)
      queue.push(next)
    }
  }

  return undefined
}

/**
 * Куда игрушка может сползти: соседняя ячейка, где она встанет ниже нынешнего слоя.
 * Из всех вариантов берётся самый низкий. Собственные клетки игрушки к этому моменту уже свободны —
 * иначе она мешала бы сама себе.
 */
export const findSlide = (
  shape: ShapeKey,
  cells: readonly VolumeCell[],
  layer: number,
  isOccupied: Occupancy
): Placement | undefined => {
  // Кандидаты берутся от всех клеток игрушки, а не только от якоря: у формы из двух клеток якорь
  // стоит в одном углу, и по соседям одного угла половина направлений была бы не видна
  const anchors = new Map<string, CellAddress>()

  for (const { col, row } of cells) {
    for (const next of getNeighbours({ col, row })) {
      if (!isTrayCell(next)) anchors.set(`${next.col}:${next.row}`, next)
    }
  }

  let best: Placement | undefined

  for (const anchor of anchors.values()) {
    for (const facing of FACINGS) {
      const landing = findLanding(shape, facing, anchor, layer, isOccupied)

      if (landing === undefined || landing >= layer) continue
      if (best && landing >= best.layer) continue

      best = { anchor, facing, layer: landing }
    }
  }

  return best
}

/**
 * Дыры в куче: провалы, у которых край поднят над основанием хотя бы на `HOLE_MIN_DROP` слоёв.
 *
 * Поиск начинается с просевшего столбца и включает соседние столбцы не выше основания. Так кратер
 * от снятого кубика включает края у стенки, где локальный перепад меньше. Неровности меньше порога
 * не считаются провалами.
 */
export const findHoles = (getSurfaceHeight: Surface): Hole[] => {
  const columns: CellAddress[] = []

  for (let col = 0; col < GRID_SIZE; col++) {
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!isTrayCell({ col, row })) columns.push({ col, row })
    }
  }

  const getRim = (cell: CellAddress): number =>
    Math.max(
      0,
      ...getNeighbours(cell)
        .filter((next) => !isTrayCell(next))
        .map(getSurfaceHeight)
    )

  const key = ({ col, row }: CellAddress): string => `${col}:${row}`
  const visited = new Set<string>()
  const holes: Hole[] = []

  for (const seed of columns) {
    if (visited.has(key(seed)) || getRim(seed) - getSurfaceHeight(seed) < HOLE_MIN_DROP) continue

    const floor = getSurfaceHeight(seed)
    const cells: CellAddress[] = []
    const queue: CellAddress[] = [seed]
    let rim = 0

    visited.add(key(seed))

    while (queue.length > 0) {
      const cell = queue.shift() as CellAddress

      cells.push(cell)
      rim = Math.max(rim, getRim(cell))

      for (const next of getNeighbours(cell)) {
        if (visited.has(key(next)) || isTrayCell(next)) continue
        // Столбец выше основания относится к краю провала
        if (getSurfaceHeight(next) > floor) continue

        visited.add(key(next))
        queue.push(next)
      }
    }

    holes.push({ cells, floor, depth: rim - floor })
  }

  return holes
}

/**
 * Вероятность засыпки дыры с учётом её объёма, высоты основания и веса игрушки.
 */
export const getHoleFillChance = (weight: number, { cells, depth, floor }: Hole): number => {
  const reach = (MAX_LAYERS - floor) / MAX_LAYERS
  const threshold = floor === 0 ? 0 : HOLE_MIN_PRESSURE
  const pressure = cells.length * depth * reach - threshold

  if (pressure <= 0) return 0

  return clamp((HOLE_FILL_GAIN * pressure) / (weight + SLIDE_WEIGHT_BIAS), 0, HOLE_FILL_MAX_CHANCE)
}

/**
 * Перепад до самой низкой соседней стопки без учёта клеток самой игрушки.
 */
export const getSlideDrop = (
  cells: readonly VolumeCell[],
  layer: number,
  getSurfaceHeight: (cell: CellAddress) => number
): number => {
  const own = new Set(cells.map(({ col, row }) => `${col}:${row}`))
  let lowest = MAX_LAYERS

  for (const { col, row } of cells) {
    for (const next of getNeighbours({ col, row })) {
      if (isTrayCell(next) || own.has(`${next.col}:${next.row}`)) continue

      lowest = Math.min(lowest, getSurfaceHeight(next))
    }
  }

  return layer - lowest
}

/** Середина формы в её смещениях: по ней игрушка ставится на экране, а не по якорю. */
export const getShapeCenter = (shape: ShapeKey, facing: Facing): ShapeCell => {
  const cells = getShapeCells(shape, facing)
  const sum = cells.reduce(
    (total, { dx, dy, dz }) => ({ dx: total.dx + dx, dy: total.dy + dy, dz: total.dz + dz }),
    { dx: 0, dy: 0, dz: 0 }
  )

  return { dx: sum.dx / cells.length, dy: sum.dy / cells.length, dz: sum.dz / cells.length }
}

/** Точка мира, в которой стоит середина игрушки. */
export const getBodyCenter = (shape: ShapeKey, facing: Facing, anchor: CellAddress, layer: number): WorldPoint => {
  const { dx, dy, dz } = getShapeCenter(shape, facing)

  return { ...getCellCenter({ col: anchor.col + dx, row: anchor.row + dy }), z: layer + dz + TOY_LAYER_CENTER }
}

/**
 * Возвращает формы в порядке попытки размещения с учётом веса наполнения.
 */
export const pickFillShapes = (random: Random, allowSingle: boolean): ShapeKey[] => {
  const remaining = allowSingle ? [...SHAPE_KEYS] : SHAPE_KEYS.filter((key) => getWeight(key) > 1)
  const order: ShapeKey[] = []

  while (remaining.length > 0) {
    const total = remaining.reduce((sum, key) => sum + SHAPES[key].fillWeight, 0)
    let roll = random() * total
    let selected = remaining.length - 1

    for (let index = 0; index < remaining.length; index++) {
      roll -= SHAPES[remaining[index]].fillWeight

      if (roll < 0) {
        selected = index
        break
      }
    }

    order.push(remaining[selected])
    remaining.splice(selected, 1)
  }

  return order
}

/** Возвращает копию массива в случайном порядке. */
export const shuffle = <T>(items: readonly T[], random: Random): T[] => {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    const value = shuffled[index]

    shuffled[index] = shuffled[other]
    shuffled[other] = value
  }

  return shuffled
}

/** Создаёт покоящуюся игрушку на проверенном месте. */
export const createBody = (id: ToyId, shape: ShapeKey, { anchor, facing, layer }: Placement, color: number): ToyBody => {
  const point = getBodyCenter(shape, facing, anchor, layer)

  return {
    id,
    shape,
    color,
    anchor,
    layer,
    facing,
    state: ToyState.resting,
    point,
    from: { ...point },
    target: { ...point },
    elapsed: 0,
    durationMs: TOY_MIN_MOTION_MS,
    bounce: { value: 0, velocity: 0 },
    turn: 1,
    depth: getBodyDepth(shape, facing, anchor, layer),
  }
}

/** Клетки, которыми игрушка соприкасается с соседями: по сторонам её клеток и под ними. */
export const getTouchingCells = (cells: readonly VolumeCell[]): VolumeCell[] =>
  cells.flatMap(({ col, row, layer }) => [
    ...getNeighbours({ col, row }).map((cell) => ({ ...cell, layer })),
    { col, row, layer: layer - 1 },
  ])

/**
 * Проверяет возможность случайного соскальзывания с места посадки в лоток.
 */
export const shouldSlideIntoTray = (cells: readonly VolumeCell[], random: Random): boolean => {
  const bottom = getBottomCells(cells)

  if (bottom.some((cell) => cell.layer < TRAY_WALL_LAYERS)) return false
  if (!bottom.some((cell) => getNeighbours(cell).some(isTrayCell))) return false

  return random() < TRAY_SLIDE_CHANCE
}

/** Ориентация тройки точек: положительная означает поворот против часовой стрелки экрана. */
const getTurnSide = (origin: ScreenPoint, first: ScreenPoint, second: ScreenPoint): number =>
  (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)

/** Выпуклая оболочка набора точек, обходом Эндрю. */
const getConvexHull = (points: readonly ScreenPoint[]): ScreenPoint[] => {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y)

  if (sorted.length < 3) return sorted

  const build = (source: readonly ScreenPoint[]): ScreenPoint[] => {
    const chain: ScreenPoint[] = []

    for (const point of source) {
      while (chain.length >= 2 && getTurnSide(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) {
        chain.pop()
      }

      chain.push(point)
    }

    return chain
  }

  const lower = build(sorted)
  const upper = build([...sorted].reverse())

  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/**
 * Контур игрушки на экране: выпуклая оболочка центров её клеток, раздутая на радиус игрушки.
 * Выпуклая оболочка окружностей вокруг центров клеток образует единый силуэт составной формы.
 */
export const getShapeOutline = (shape: ShapeKey, facing: Facing): ScreenPoint[] => {
  const center = getShapeCenter(shape, facing)
  const samples = getShapeCells(shape, facing).flatMap(({ dx, dy, dz }) => {
    const origin = worldToScreen({ x: dx - center.dx, y: dy - center.dy, z: dz - center.dz })

    return Array.from({ length: TOY_OUTLINE_STEPS }, (_, step) => {
      const angle = (2 * Math.PI * step) / TOY_OUTLINE_STEPS

      return {
        x: Math.round((origin.x + Math.cos(angle) * TOY_RADIUS) / PIXEL_SCALE) * PIXEL_SCALE,
        y: Math.round((origin.y + Math.sin(angle) * TOY_RADIUS) / PIXEL_SCALE) * PIXEL_SCALE,
      }
    })
  })

  return getConvexHull(samples)
}

/**
 * Ключ наложения игрушки: максимальный порядок среди занятых клеток. Ключ по центру формы нарушает
 * порядок там, где её ближайшая клетка перекрывает соседний предмет.
 */
export const getBodyDepth = (shape: ShapeKey, facing: Facing, anchor: CellAddress, layer: number): number =>
  Math.max(
    ...getPlacementCells(shape, facing, anchor, layer).map((cell) =>
      getDepthOrder({ ...getCellCenter(cell), z: cell.layer + TOY_LAYER_CENTER })
    )
  )

/**
 * Профиль купола: высота стопки в каждой ячейке, `profile[col][row]`. Куча сложена куполом — под
 * пиком выше, к краям ниже, — но каждый раз по-своему: бросок сдвигает пик, задаёт крутизну склона
 * и разбрасывает высоты отдельных ячеек. Ячейки лотка остаются пустыми.
 */
export const planDomeProfile = (random: Random): number[][] => {
  const middle = (GRID_SIZE - 1) / 2
  const peak = {
    col: middle + (random() * 2 - 1) * DOME_PEAK_JITTER,
    row: middle + (random() * 2 - 1) * DOME_PEAK_JITTER,
  }
  const falloff = DOME_FALLOFF_MIN + random() * (DOME_FALLOFF_MAX - DOME_FALLOFF_MIN)
  // Нормирование по дальнему углу сохраняет заданную высоту у границы поля
  const reach = Math.max(
    ...[0, GRID_SIZE - 1].flatMap((col) => [0, GRID_SIZE - 1].map((row) => Math.hypot(col - peak.col, row - peak.row)))
  )

  return Array.from({ length: GRID_SIZE }, (_, col) =>
    Array.from({ length: GRID_SIZE }, (_, row) => {
      if (isTrayCell({ col, row })) return 0

      const slope = (Math.hypot(col - peak.col, row - peak.row) / reach) ** falloff
      const height = lerp(DOME_CENTER_LAYERS, DOME_EDGE_LAYERS, slope) + (random() * 2 - 1) * DOME_HEIGHT_JITTER

      // Минимальная высота не допускает пустых ячеек внутри начальной кучи
      return clamp(Math.round(height), DOME_MIN_LAYERS, MAX_LAYERS)
    })
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isSnapshotBody = (value: unknown): boolean => {
  if (!isRecord(value)) return false

  const { shape, facing, anchor, layer, color } = value

  return (
    typeof shape === 'string' &&
    shape in SHAPES &&
    typeof facing === 'number' &&
    facing >= 0 &&
    facing < 4 &&
    isRecord(anchor) &&
    typeof anchor.col === 'number' &&
    typeof anchor.row === 'number' &&
    typeof layer === 'number' &&
    typeof color === 'number'
  )
}

/**
 * Проверяет снимок кучи, прочитанный из хранилища: версию схемы и форму каждой записи.
 * Несовместимый снимок игнорируется, после чего создаётся новая куча.
 */
export const isHeapSnapshot = (value: unknown): value is HeapSnapshot =>
  isRecord(value) &&
  value.version === HEAP_SNAPSHOT_VERSION &&
  typeof value.collected === 'number' &&
  Array.isArray(value.bodies) &&
  value.bodies.every(isSnapshotBody)
