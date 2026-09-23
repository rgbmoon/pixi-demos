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
  FACINGS,
  SHAPE_KEYS,
  HOLE_FILL_GAIN,
  HOLE_FILL_MAX_CHANCE,
  HOLE_MIN_DROP,
  HOLE_MIN_PRESSURE,
  IMPACT_BASE,
  MAX_LAYERS,
  SHAPES,
  HOLE_WEIGHT_BIAS,
  SUPPORT_SHARE,
  TOY_LAYER_CENTER,
  TOY_MIN_MOTION_MS,
  TRAY_SLIDE_CHANCE,
  TRAY_WALL_LAYERS,
} from '#src/constants'
import type {
  CellAddress,
  Facing,
  Hole,
  Occupancy,
  Placement,
  ShapeKey,
  Surface,
  ToyBody,
  ToyId,
  VolumeCell,
  WorldPoint,
} from '#src/types'
import { ToyState } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { getColumnKey, getNeighbours, isTrayCell, toCell } from './grid'
import { clamp, lerp } from './math'
import {
  getShapeCells,
  getShapeCenter,
  getPlacementCells,
  getBottomCells,
  rotateFacing,
  getBodyCenter,
  getWeight,
} from './shapes'

/** Создаёт пустую трёхмерную решётку занятости. */
export const createOccupancy = (): (ToyId | undefined)[][][] =>
  Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => Array.from({ length: MAX_LAYERS }, () => undefined))
  )

/**
 * Вероятность захвата с учётом веса игрушки и нагрузки сверху.
 */
export const getGrabChance = (weight: number, load: number): number =>
  clamp(
    GRAB_BASE_CHANCE / (1 + GRAB_WEIGHT_PENALTY * weight + GRAB_LOAD_PENALTY * load),
    GRAB_MIN_CHANCE,
    GRAB_MAX_CHANCE
  )

/** Толчок, который севшая игрушка передаёт соседу: растёт с её весом. */
export const getImpact = (weight: number): number => IMPACT_BASE * weight

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
 * Спуск останавливается на первом слое с опорой или над первой занятой клеткой.
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
 * Ищет посадку возле центра отпущенной игрушки в мировых координатах, учитывая смещения формы.
 * Поиск идёт со слоя, ближайшего к нижней грани игрушки, и ниже: выше своей позы игрушка поднимается
 * не больше чем на полслоя. Сначала проверяет четверть оборота и остальные ориентации, затем соседние ячейки.
 */
export const planLanding = (
  shape: ShapeKey,
  facing: Facing,
  point: WorldPoint,
  isOccupied: Occupancy
): Placement | undefined => {
  const preferred = rotateFacing(facing, 1)
  const facings = [preferred, ...FACINGS.filter((other) => other !== preferred)]
  // Поворот вокруг вертикальной оси высоту середины формы не меняет, поэтому слой общий для всех ориентаций
  const from = clamp(Math.round(point.z - TOY_LAYER_CENTER - getShapeCenter(shape, facing).dz), 0, MAX_LAYERS - 1)
  const cell = toCell(point)
  const visited = new Set([getColumnKey(cell)])
  const queue: CellAddress[] = [cell]

  while (queue.length > 0) {
    const current = queue.shift() as CellAddress

    for (const candidate of facings) {
      const { dx, dy } = getShapeCenter(shape, candidate)
      // Округление ближайшего якоря: round(центр − смещение − 0.5) = floor(центр − смещение).
      const anchor = toCell({
        x: point.x - dx + (current.col - cell.col),
        y: point.y - dy + (current.row - cell.row),
      })
      const layer = findLanding(shape, candidate, anchor, from, isOccupied)

      if (layer !== undefined) return { anchor, facing: candidate, layer }
    }

    for (const next of getNeighbours(current)) {
      const key = getColumnKey(next)

      if (visited.has(key) || isTrayCell(next)) continue

      visited.add(key)
      queue.push(next)
    }
  }

  return undefined
}

/**
 * Куда игрушка может сползти: соседняя ячейка, где она встанет ниже нынешнего слоя.
 * Из всех вариантов берётся самый низкий. Клетки самой игрушки вызывающий освобождает заранее:
 * занятыми они закрыли бы ей часть мест.
 */
export const findSlide = (
  shape: ShapeKey,
  cells: readonly VolumeCell[],
  layer: number,
  isOccupied: Occupancy
): Placement | undefined => {
  // Кандидаты берутся от всех клеток игрушки: у формы из двух клеток якорь стоит в одном углу,
  // и соседи одного угла покрывают только половину направлений
  const anchors = new Map<number, CellAddress>()

  for (const cell of cells) {
    for (const next of getNeighbours(cell)) {
      if (!isTrayCell(next)) anchors.set(getColumnKey(next), next)
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
 * от снятого кубика включает края у стенки, где локальный перепад меньше. Семена перебираются от низких
 * столбцов к высоким, поэтому основанием дыры становится её самый низкий столбец. Неровности меньше порога
 * не считаются провалами.
 */
export const findHoles = (getSurfaceHeight: Surface): Hole[] => {
  const heights = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, key) =>
    getSurfaceHeight({ col: Math.floor(key / GRID_SIZE), row: key % GRID_SIZE })
  )
  const getHeight = (cell: CellAddress): number => heights[getColumnKey(cell)]
  const getRim = (cell: CellAddress): number =>
    Math.max(
      0,
      ...getNeighbours(cell)
        .filter((next) => !isTrayCell(next))
        .map(getHeight)
    )
  const columns: CellAddress[] = []

  for (let col = 0; col < GRID_SIZE; col++) {
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!isTrayCell({ col, row })) columns.push({ col, row })
    }
  }

  columns.sort((first, second) => getHeight(first) - getHeight(second))

  const visited = new Set<number>()
  const holes: Hole[] = []

  for (const seed of columns) {
    const floor = getHeight(seed)

    if (visited.has(getColumnKey(seed)) || getRim(seed) - floor < HOLE_MIN_DROP) continue

    const cells: CellAddress[] = []
    const queue: CellAddress[] = [seed]
    let rim = 0

    visited.add(getColumnKey(seed))

    while (queue.length > 0) {
      const cell = queue.shift() as CellAddress

      cells.push(cell)
      rim = Math.max(rim, getRim(cell))

      for (const next of getNeighbours(cell)) {
        if (visited.has(getColumnKey(next)) || isTrayCell(next)) continue
        // Столбец выше основания относится к краю провала
        if (getHeight(next) > floor) continue

        visited.add(getColumnKey(next))
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

  return clamp((HOLE_FILL_GAIN * pressure) / (weight + HOLE_WEIGHT_BIAS), 0, HOLE_FILL_MAX_CHANCE)
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
    placement: { anchor: { ...anchor }, layer, facing },
    pose: { point, facing },
    state: ToyState.resting,
    from: { ...point },
    target: { ...point },
    elapsed: 0,
    durationMs: TOY_MIN_MOTION_MS,
    bounce: { value: 0, velocity: 0 },
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
