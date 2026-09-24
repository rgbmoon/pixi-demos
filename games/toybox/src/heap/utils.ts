import { CUBE_HEIGHT, GRID_SIZE, HEAP_SNAPSHOT_VERSION, TRAY_ORIGIN, TRAY_SIZE } from '#src/constants'
import { SHAPE_KEYS, SHAPES } from '#src/toys'
import type { GroundPoint, HeapSnapshot, HeapSnapshotBody, ShapeKey, ToyId, ToyPose } from '#src/types'
import { clamp, lerp } from '#src/utils/math'
import { getDepthCenter, getSection, getSectionExtent, getVariant, getVariantCount, getWeight } from '#src/utils/shapes'
import type { Random } from '@pixi-demos/core/types'

import {
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
  TOY_HUE_SPREAD,
  TOY_LIGHTNESS_SPREAD,
  TOY_ROOT_COLOR,
  TRAY_EXIT_Z,
} from './constants'
import { HeapWorld } from './heap-world'
import type { DomeProfile } from './types'

/** Форма для наполнения: выбор с весами `fillWeight`. */
const pickShape = (random: Random): ShapeKey => {
  const total = SHAPE_KEYS.reduce((sum, key) => sum + SHAPES[key].fillWeight, 0)
  let roll = random() * total

  for (const key of SHAPE_KEYS) {
    roll -= SHAPES[key].fillWeight

    if (roll < 0) return key
  }

  return SHAPE_KEYS[SHAPE_KEYS.length - 1]
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

/** Компоненты цвета в HSL: тон в градусах, насыщенность и светлота в долях единицы. */
const toHsl = (color: string): { h: number; s: number; l: number } => {
  const rgb = Number.parseInt(color.slice(1), 16)
  const r = ((rgb >> 16) & 255) / 255
  const g = ((rgb >> 8) & 255) / 255
  const b = (rgb & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  const l = (max + min) / 2

  if (span === 0) return { h: 0, s: 0, l }

  const s = span / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4

  return { h: (((h * 60) % 360) + 360) % 360, s, l }
}

/** Цвет игрушки: корневой цвет со случайным сдвигом тона и светлоты. */
const shiftColor = (base: string, random: Random): number => {
  const { h, s, l } = toHsl(base)
  const hue = (((h + (random() * 2 - 1) * TOY_HUE_SPREAD) % 360) + 360) % 360
  const lightness = clamp(l + (random() * 2 - 1) * TOY_LIGHTNESS_SPREAD, 0.2, 0.8)

  const amplitude = s * Math.min(lightness, 1 - lightness)
  const channel = (offset: number): number => {
    const k = (offset + hue / 30) % 12

    return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }

  return (channel(0) << 16) | (channel(8) << 8) | channel(4)
}

/**
 * Насыпает купол во временном мире и отдаёт позы покоя. Каждая новая игрушка пробует несколько случайных мест
 * и встаёт туда, где верх кучи дальше всего ниже профиля купола. Между пачками появлений мир делает шаги,
 * в конце — до сна всех тел. Игрушка, опустившаяся в шахте лотка до `TRAY_EXIT_Z`, в кучу не попадает.
 */
export const pourHeap = (random: Random): HeapSnapshotBody[] => {
  // Новый мир на каждое насыпание: повторно использованный мир planck теряет детерминизм
  const world = new HeapWorld()
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

  while (volume < FILL_VOLUME && failures < FILL_MAX_FAILURES) {
    const shape = pickShape(random)
    const variant = Math.floor(random() * getVariantCount(shape))
    const { depth } = getVariant(shape, variant)
    const section = getSection(shape, variant)
    const { halfWidth, halfHeight } = getSectionExtent(section)
    let best: { slab: number; y: number; surface: number; deficit: number } | undefined

    for (let candidate = 0; candidate < FILL_CANDIDATES; candidate++) {
      const slab = Math.floor(random() * (GRID_SIZE - depth + 1))
      // Над шахтой лотка игрушка не появляется: там нет пола
      const right = slab < TRAY_ORIGIN.x + TRAY_SIZE ? TRAY_ORIGIN.y : GRID_SIZE
      const y = halfWidth + random() * (right - 2 * halfWidth)
      const surface = Math.max(
        world.castDown(y - halfWidth, slab, depth).z,
        world.castDown(y, slab, depth).z,
        world.castDown(y + halfWidth, slab, depth).z
      )
      const deficit = getDomeHeight(dome, { x: getDepthCenter(slab, depth), y }) - (surface + halfHeight)

      if (!best || deficit > best.deficit) best = { slab, y, surface, deficit }
    }

    if (!best || best.deficit <= 0) {
      failures += 1
      continue
    }

    failures = 0

    const pose: ToyPose = {
      y: best.y,
      z: best.surface + halfHeight + FILL_SPAWN_GAP,
      angle: (random() * 2 - 1) * FILL_MAX_TILT,
    }
    const color = shiftColor(TOY_ROOT_COLOR, random)

    // Номер появления служит id тела во временном мире
    spawned += 1
    toys.set(spawned, { shape, variant, slab: best.slab, ...pose, color })
    world.add(spawned, section, getWeight(shape), best.slab, depth, pose, true)
    volume += getWeight(shape)

    if (spawned % FILL_BATCH === 0) {
      for (let step = 0; step < FILL_BATCH_STEPS; step++) stepWorld()
    }
  }

  for (let step = 0; step < HEAP_SETTLE_MAX_STEPS && world.hasAwake(); step++) stepWorld()

  // Тела сдвинулись с мест появления: позы покоя отдаёт мир
  return [...toys].map(([id, toy]) => ({ ...toy, ...world.getPose(id) }))
}

/** Предел числа игрушек в снимке: куча столько не вмещает, больший список — мусор. */
const MAX_BODIES = GRID_SIZE * GRID_SIZE * CUBE_HEIGHT

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const isShapeKey = (value: unknown): value is ShapeKey => typeof value === 'string' && Object.hasOwn(SHAPES, value)

const isSnapshotBody = (value: unknown): value is HeapSnapshotBody => {
  if (!isRecord(value)) return false

  const { shape, variant, slab, y, z, angle, color } = value

  if (!isShapeKey(shape)) return false

  const { variants } = SHAPES[shape]

  if (!isInteger(variant, 0, variants.length - 1)) return false

  return (
    isInteger(slab, 0, GRID_SIZE - variants[variant].depth) &&
    isNumberIn(y, 0, GRID_SIZE) &&
    isNumberIn(z, 0, CUBE_HEIGHT) &&
    isNumberIn(angle, -Number.MAX_VALUE, Number.MAX_VALUE) &&
    isInteger(color, 0, 0xffffff)
  )
}

/** Проверяет весь снимок до загрузки: версию, схему и диапазоны каждой игрушки. */
export const isHeapSnapshot = (value: unknown): value is HeapSnapshot =>
  isRecord(value) &&
  value.version === HEAP_SNAPSHOT_VERSION &&
  isInteger(value.collected, 0, Number.MAX_SAFE_INTEGER) &&
  Array.isArray(value.bodies) &&
  value.bodies.length <= MAX_BODIES &&
  value.bodies.every(isSnapshotBody)

/**
 * Поза между двумя шагами физики на доле `share` пути от `from` к `to`. Крен идёт по кратчайшей дуге:
 * угол тела после смены позы приводится к полуинтервалу (−π, π], и прямая интерполяция прокрутила бы полный оборот.
 */
export const lerpPose = (from: ToyPose, to: ToyPose, share: number): ToyPose => {
  const turn = Math.atan2(Math.sin(to.angle - from.angle), Math.cos(to.angle - from.angle))

  return { y: lerp(from.y, to.y, share), z: lerp(from.z, to.z, share), angle: from.angle + turn * share }
}
