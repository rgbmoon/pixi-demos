import {
  ART_CELL,
  ART_PIXEL,
  AXIS_X,
  AXIS_Y,
  CABINET_BOTTOM_Z,
  CUBE_HEIGHT,
  FLOOR_PILE_DEPTH,
  FLOOR_PILE_WIDTH,
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  MARQUEE_LAMP_COUNT,
  MARQUEE_TOP_Z,
  PILLAR_WIDTH,
  TOY_INSET,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_HEIGHT,
} from '#src/constants'
import { TOY_SPECS } from '#src/toy-specs'
import { TOY_KEYS } from '#src/toys'
import type { GroundPoint, HeapSnapshot, HeapSnapshotBody, ToyId, ToyKey, ToyPose } from '#src/types'
import { lerp } from '#src/utils/math'
import { worldToScreen } from '#src/utils/projection'
import { getContactSection, getDepth, getDepthCenter, getSection, getSectionExtent, getWeight } from '#src/utils/shapes'
import type { Random } from '@pixi-demos/core/types'

import {
  COLLISION_FAR_SPAN,
  DOME_CENTER_HEIGHT,
  DOME_EDGE_HEIGHT,
  DOME_FALLOFF_MAX,
  DOME_FALLOFF_MIN,
  DOME_PEAK_JITTER,
  FILL_BATCH,
  FILL_BATCH_STEPS,
  FILL_CANDIDATES,
  FILL_MAX_FAILURES,
  FILL_MAX_TILT,
  FILL_SPAWN_GAP,
  FILL_VOLUME,
  HEAP_SETTLE_MAX_STEPS,
  HEAP_STEP_MS,
  TRAY_EXIT_Z,
  TRAY_WALL_THICKNESS,
  WALL_THICKNESS,
} from './constants'
import { HeapWorld } from './heap-world'
import type { DomeProfile, SnapshotBounds, StaticBox, WorldStatics } from './types'

/** Край полосы пола справа от тумбы по оси `y`: полоса стоит серединой под серединой куба. */
const getFloorPileRight = (): number => (GRID_SIZE - FLOOR_PILE_WIDTH) / 2

/**
 * Правая стенка куба (сторона `y = 0`) в срезе `slab`. На экране глубина уходит вправо, и у дальних срезов стенка
 * отодвинута внутрь: игрушка, прижатая к ней, вместе с обводкой подсветки не заходит на заднюю правую стойку.
 */
export const getRightWallY = (slab: number): number => {
  // Дальний край игрушки в срезе и внутренний край задней правой стойки на экране за вычетом обводки
  const far = slab + (1 + TOY_INSET) / 2
  const limit = worldToScreen({ x: GRID_SIZE, y: PILLAR_WIDTH / ART_CELL, z: 0 }).x - ART_PIXEL

  return Math.max(0, (far * AXIS_X.x - limit) / -AXIS_Y.x)
}

/**
 * Статика куба: пол, стенки и лоток. Пол перед шахтой лотка лежит во всех срезах, над шахтой — только в срезах за
 * лотком. Стенки стоят снаружи куба; правая стенка у дальних срезов отодвинута внутрь (`getRightWallY`).
 */
export const getCubeStatics = (): WorldStatics => {
  const allSlabs = (1 << GRID_SIZE) - 1
  const traySlabs = ((1 << TRAY_SIZE.x) - 1) << TRAY_ORIGIN.x
  const wallHeight = CUBE_HEIGHT - TRAY_EXIT_Z + WALL_THICKNESS
  const wallCenter = (CUBE_HEIGHT + TRAY_EXIT_Z - WALL_THICKNESS) / 2
  const trayWallHeight = TRAY_WALL_HEIGHT - TRAY_EXIT_Z + WALL_THICKNESS
  const box = (width: number, height: number, y: number, z: number, mask: number): StaticBox => ({
    y,
    z,
    width,
    height,
    mask,
  })
  // Срезы с одним положением правой стенки делят один бокс
  const rightWalls = new Map<number, number>()

  for (let slab = 0; slab < GRID_SIZE; slab++) {
    const wall = getRightWallY(slab)

    rightWalls.set(wall, (rightWalls.get(wall) ?? 0) | (1 << slab))
  }

  return {
    boxes: [
      box(TRAY_ORIGIN.y, WALL_THICKNESS, TRAY_ORIGIN.y / 2, -WALL_THICKNESS / 2, allSlabs),
      box(
        GRID_SIZE - TRAY_ORIGIN.y,
        WALL_THICKNESS,
        (GRID_SIZE + TRAY_ORIGIN.y) / 2,
        -WALL_THICKNESS / 2,
        allSlabs & ~traySlabs
      ),
      ...[...rightWalls].map(([wall, mask]) =>
        box(WALL_THICKNESS, wallHeight, wall - WALL_THICKNESS / 2, wallCenter, mask)
      ),
      box(WALL_THICKNESS, wallHeight, GRID_SIZE + WALL_THICKNESS / 2, wallCenter, allSlabs),
      box(
        TRAY_WALL_THICKNESS,
        trayWallHeight,
        TRAY_ORIGIN.y,
        (TRAY_WALL_HEIGHT + TRAY_EXIT_Z - WALL_THICKNESS) / 2,
        traySlabs
      ),
      // Дальняя стенка лотка стоит на границе срезов: в неё упирается только игрушка, занимающая оба
      box(
        GRID_SIZE - TRAY_ORIGIN.y,
        TRAY_WALL_HEIGHT,
        (GRID_SIZE + TRAY_ORIGIN.y) / 2,
        TRAY_WALL_HEIGHT / 2,
        COLLISION_FAR_SPAN
      ),
    ],
    spanEdge: TRAY_ORIGIN.x + TRAY_SIZE.x,
  }
}

/** Статика пола перед автоматом: пол зала и невидимые стенки по краям полосы с выигранными игрушками. */
export const getFloorStatics = (): WorldStatics => {
  const slabs = (1 << FLOOR_PILE_DEPTH) - 1
  const right = getFloorPileRight()
  const wallHeight = MARQUEE_TOP_Z - CABINET_BOTTOM_Z
  const wallCenter = CABINET_BOTTOM_Z + wallHeight / 2

  return {
    boxes: [
      {
        y: right + FLOOR_PILE_WIDTH / 2,
        z: CABINET_BOTTOM_Z - WALL_THICKNESS / 2,
        width: FLOOR_PILE_WIDTH + 2 * WALL_THICKNESS,
        height: WALL_THICKNESS,
        mask: slabs,
      },
      { y: right - WALL_THICKNESS / 2, z: wallCenter, width: WALL_THICKNESS, height: wallHeight, mask: slabs },
      {
        y: right + FLOOR_PILE_WIDTH + WALL_THICKNESS / 2,
        z: wallCenter,
        width: WALL_THICKNESS,
        height: wallHeight,
        mask: slabs,
      },
    ],
  }
}

/**
 * Мешок игрушек для наполнения: каталог в случайном порядке, новый мешок — когда старый кончился. Игрушка повторяется,
 * только когда в кучу легли все; игрушка, которой не нашлось места, возвращается на дно мешка.
 */
const createToyBag = (random: Random) => {
  const bag: ToyKey[] = []

  return {
    take(): ToyKey {
      if (bag.length === 0) {
        bag.push(...TOY_KEYS)

        for (let index = bag.length - 1; index > 0; index--) {
          const pick = Math.floor(random() * (index + 1))

          ;[bag[index], bag[pick]] = [bag[pick], bag[index]]
        }
      }

      return bag.pop() as ToyKey
    },
    putBack(toy: ToyKey): void {
      bag.unshift(toy)
    },
  }
}

/** Профиль купола: бросок сдвигает пик от центра поля и задаёт крутизну склона. */
const planDome = (random: Random): DomeProfile => {
  const middle = GRID_SIZE / 2
  const peak = {
    x: middle + (random() * 2 - 1) * DOME_PEAK_JITTER,
    y: middle + (random() * 2 - 1) * DOME_PEAK_JITTER,
  }
  const corners = [0, GRID_SIZE].flatMap((x) => [0, GRID_SIZE].map((y) => Math.hypot(x - peak.x, y - peak.y)))

  return {
    peak,
    falloff: DOME_FALLOFF_MIN + random() * (DOME_FALLOFF_MAX - DOME_FALLOFF_MIN),
    reach: Math.max(...corners),
  }
}

/** Высота верха купола над точкой пола: под пиком `DOME_CENTER_HEIGHT`, у дальнего угла `DOME_EDGE_HEIGHT`. */
const getDomeHeight = ({ peak, falloff, reach }: DomeProfile, point: GroundPoint): number => {
  const slope = (Math.hypot(point.x - peak.x, point.y - peak.y) / reach) ** falloff

  return lerp(DOME_CENTER_HEIGHT, DOME_EDGE_HEIGHT, slope)
}

/** Отмечает лампой табло `MARQUEE_LAMP_COUNT` случайных игрушек кучи. */
const assignLamps = (bodies: HeapSnapshotBody[], random: Random): HeapSnapshotBody[] => {
  const order = bodies.map((_, index) => index)

  for (let marked = 0; marked < Math.min(MARQUEE_LAMP_COUNT, bodies.length); marked++) {
    const pick = marked + Math.floor(random() * (order.length - marked))
    const index = order[pick]

    order[pick] = order[marked]
    bodies[index].hasLamp = true
  }

  return bodies
}

/**
 * Насыпает купол во временном мире и отдаёт позы покоя. Каждая новая игрушка пробует несколько случайных мест
 * и встаёт туда, где верх кучи дальше всего ниже профиля купола. Между пачками появлений мир делает шаги,
 * в конце — до сна всех тел. Игрушка, опустившаяся в шахте лотка до `TRAY_EXIT_Z`, в кучу не попадает.
 * Лампой табло отмечены случайные игрушки насыпанной кучи.
 */
export const pourHeap = (random: Random): HeapSnapshotBody[] => {
  // Новый мир на каждое насыпание: повторно использованный мир planck теряет детерминизм
  const world = new HeapWorld(getCubeStatics())
  const toys = new Map<ToyId, HeapSnapshotBody>()
  const dome = planDome(random)
  let volume = 0
  let failures = 0
  let spawned = 0

  const stepWorld = (): void => {
    const moving = [...toys.keys()].filter((id) => world.isAwake(id))

    world.step(HEAP_STEP_MS)

    for (const id of moving) {
      if (world.getPose(id).z > TRAY_EXIT_Z) continue

      world.remove(id)
      toys.delete(id)
    }
  }

  const bag = createToyBag(random)

  while (volume < FILL_VOLUME && failures < FILL_MAX_FAILURES) {
    const toy = bag.take()
    const depth = getDepth(toy)
    const section = getSection(toy)
    const { halfWidth, halfHeight } = getSectionExtent(section)
    let best: { slab: number; y: number; surface: number; deficit: number } | undefined

    for (let candidate = 0; candidate < FILL_CANDIDATES; candidate++) {
      const slab = Math.floor(random() * (GRID_SIZE - depth + 1))
      // Над шахтой лотка игрушка не появляется: там нет пола
      const right = slab < TRAY_ORIGIN.x + TRAY_SIZE.x ? TRAY_ORIGIN.y : GRID_SIZE
      const wall = getRightWallY(slab + depth - 1)
      const y = wall + halfWidth + random() * (right - wall - 2 * halfWidth)
      const surface = Math.max(
        world.castDown(y - halfWidth, slab, depth).z,
        world.castDown(y, slab, depth).z,
        world.castDown(y + halfWidth, slab, depth).z
      )
      const deficit = getDomeHeight(dome, { x: getDepthCenter(slab, depth), y }) - (surface + halfHeight)

      if (!best || deficit > best.deficit) best = { slab, y, surface, deficit }
    }

    if (!best || best.deficit <= 0) {
      bag.putBack(toy)
      failures += 1
      continue
    }

    failures = 0

    const pose: ToyPose = {
      y: best.y,
      z: best.surface + halfHeight + FILL_SPAWN_GAP,
      angle: (random() * 2 - 1) * FILL_MAX_TILT,
    }
    // Номер появления служит id тела во временном мире
    spawned += 1
    toys.set(spawned, { slab: best.slab, ...pose, toy })
    world.add(spawned, section, getContactSection(toy), getWeight(toy), best.slab, depth, pose, true)
    volume += getWeight(toy)

    if (spawned % FILL_BATCH === 0) {
      for (let step = 0; step < FILL_BATCH_STEPS; step++) stepWorld()
    }
  }

  for (let step = 0; step < HEAP_SETTLE_MAX_STEPS && world.hasAwake(); step++) stepWorld()

  // Тела сдвинулись с мест появления: позы покоя отдаёт мир
  return assignLamps(
    [...toys].map(([id, toy]) => ({ ...toy, ...world.getPose(id) })),
    random
  )
}

/** Пределы игрушек кучи в кубе: куча столько не вмещает, больший список — мусор. */
const CUBE_BOUNDS: SnapshotBounds = { slabs: GRID_SIZE, minY: 0, maxY: GRID_SIZE, minZ: 0, maxZ: CUBE_HEIGHT }
const MAX_CUBE_BODIES = GRID_SIZE * GRID_SIZE * CUBE_HEIGHT

/** Пределы игрушек на полу: полоса пола до высоты табло. */
const FLOOR_BOUNDS: SnapshotBounds = {
  slabs: FLOOR_PILE_DEPTH,
  minY: getFloorPileRight(),
  maxY: getFloorPileRight() + FLOOR_PILE_WIDTH,
  minZ: CABINET_BOTTOM_Z,
  maxZ: MARQUEE_TOP_Z,
}
const MAX_FLOOR_BODIES = FLOOR_PILE_DEPTH * FLOOR_PILE_WIDTH * (MARQUEE_TOP_Z - CABINET_BOTTOM_Z)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const isToyKey = (value: unknown): value is ToyKey => typeof value === 'string' && Object.hasOwn(TOY_SPECS, value)

const isSnapshotBody = (
  value: unknown,
  { slabs, minY, maxY, minZ, maxZ }: SnapshotBounds
): value is HeapSnapshotBody => {
  if (!isRecord(value)) return false

  const { slab, y, z, angle, toy, hasLamp } = value

  if (!isToyKey(toy)) return false

  return (
    isInteger(slab, 0, slabs - getDepth(toy)) &&
    isNumberIn(y, minY, maxY) &&
    isNumberIn(z, minZ, maxZ) &&
    isNumberIn(angle, -Number.MAX_VALUE, Number.MAX_VALUE) &&
    (hasLamp === undefined || typeof hasLamp === 'boolean')
  )
}

const isSnapshotBodies = (value: unknown, bounds: SnapshotBounds, max: number): value is HeapSnapshotBody[] =>
  Array.isArray(value) && value.length <= max && value.every((body) => isSnapshotBody(body, bounds))

/** Проверяет весь снимок до загрузки: версию, схему и диапазоны каждой игрушки в кубе и на полу. */
export const isHeapSnapshot = (value: unknown): value is HeapSnapshot =>
  isRecord(value) &&
  value.version === HEAP_SNAPSHOT_VERSION &&
  isInteger(value.collected, 0, Number.MAX_SAFE_INTEGER) &&
  isSnapshotBodies(value.bodies, CUBE_BOUNDS, MAX_CUBE_BODIES) &&
  isSnapshotBodies(value.floor, FLOOR_BOUNDS, MAX_FLOOR_BODIES)

/**
 * Поза между двумя шагами физики на доле `share` пути от `from` к `to`. Крен идёт по кратчайшей дуге:
 * угол тела после смены позы приводится к полуинтервалу (−π, π], и прямая интерполяция прокрутила бы полный оборот.
 */
export const lerpPose = (from: ToyPose, to: ToyPose, share: number): ToyPose => {
  const turn = Math.atan2(Math.sin(to.angle - from.angle), Math.cos(to.angle - from.angle))

  return { y: lerp(from.y, to.y, share), z: lerp(from.z, to.z, share), angle: from.angle + turn * share }
}
