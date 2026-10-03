import type {
  ModelColor,
  ModelFrame,
  ModelHit,
  ModelPart,
  ModelPlanePoint,
  ModelPose,
  ModelRenderOptions,
  ModelTransform,
  ModelVector,
  RasterImage,
  ToyModel,
} from '#src/types'

import { createImage, getOffset, setColor } from './image'
import { parseHex } from './palette'

/** Соседи пикселя по стороне. */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

/** Часть с обратным сдвигом своей группы в позе. */
type PosedPart = {
  readonly part: ModelPart
  readonly index: number
  readonly transform: ModelTransform | undefined
  /** Косинус и синус угла группы. */
  readonly cos: number
  readonly sin: number
}

/** Попадание луча с глубиной и нормалью в позе. */
type RayHit = ModelHit & {
  readonly index: number
  readonly depth: number
  readonly posedNormal: ModelVector
}

/** Поворачивает вектор `(x, y)` с осью y вверх на угол против часовой стрелки: косинус и синус угла. */
const rotate = (x: number, y: number, cos: number, sin: number): ModelPlanePoint => [
  x * cos - y * sin,
  x * sin + y * cos,
]

/** Цвет палитры одним числом RGBA. */
const toRgba = (ramps: ModelRenderOptions['ramps'], [ramp, step]: ModelColor): number => {
  const [red, green, blue] = parseHex(ramps[ramp][step])

  return ((red << 24) | (green << 16) | (blue << 8) | 0xff) >>> 0
}

/** Переводит точку позы в систему группы в покое: обратные смещение, поворот и масштаб. */
const toRest = ({ transform, cos, sin }: PosedPart, a: number, b: number): ModelPlanePoint => {
  if (!transform) return [a, b]

  const [pivotA, pivotB] = transform.pivot ?? [0, 0]
  const [offsetA, offsetB] = transform.offset ?? [0, 0]
  const [scaleA, scaleB] = transform.scale ?? [1, 1]
  const [restA, restB] = rotate(a - offsetA - pivotA, b - offsetB - pivotB, cos, sin)

  return [restA / scaleA + pivotA, restB / scaleB + pivotB]
}

/** Переводит направление позы в систему группы в покое. */
const toRestDirection = ({ transform, cos, sin }: PosedPart, a: number, b: number): ModelPlanePoint => {
  if (!transform) return [a, b]

  const [scaleA, scaleB] = transform.scale ?? [1, 1]
  const [restA, restB] = rotate(a, b, cos, sin)

  return [restA / scaleA, restB / scaleB]
}

/** Переводит нормаль из системы группы в покое в позу: нормаль меняется обратно-транспонированной матрицей. */
const toPosedNormal = ({ transform, cos, sin }: PosedPart, normal: ModelVector): ModelVector => {
  if (!transform) return normal

  const [a, b, d] = normal
  const [scaleA, scaleB] = transform.scale ?? [1, 1]
  const [posedA, posedB] = rotate(a / scaleA, b / scaleB, cos, -sin)
  const length = Math.hypot(posedA, posedB, d)

  return [posedA / length, posedB / length, d / length]
}

/** Ближайшее к игроку попадание луча из точки `(a, b)` модели в направлении `(da, db, 1)`. */
const castRay = (parts: readonly PosedPart[], a: number, b: number, da: number, db: number): RayHit | undefined => {
  let best: RayHit | undefined

  for (const posed of parts) {
    const { part } = posed
    const { center, radii } = part
    const [restA, restB] = toRest(posed, a, b)
    const [restDa, restDb] = toRestDirection(posed, da, db)
    const origin = [(restA - center[0]) / radii[0], (restB - center[1]) / radii[1], -center[2] / radii[2]]
    const direction = [restDa / radii[0], restDb / radii[1], 1 / radii[2]]
    const qa = direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2
    const qb = 2 * (origin[0] * direction[0] + origin[1] * direction[1] + origin[2] * direction[2])
    const qc = origin[0] ** 2 + origin[1] ** 2 + origin[2] ** 2 - 1
    const discriminant = qb * qb - 4 * qa * qc

    if (discriminant < 0) continue

    const depth = (-qb - Math.sqrt(discriminant)) / (2 * qa)

    if (best && depth >= best.depth) continue

    const point: ModelVector = [restA + depth * restDa, restB + depth * restDb, depth]
    const gradient: ModelVector = [
      (point[0] - center[0]) / radii[0] ** 2,
      (point[1] - center[1]) / radii[1] ** 2,
      (point[2] - center[2]) / radii[2] ** 2,
    ]
    const length = Math.hypot(...gradient)
    const normal: ModelVector = [gradient[0] / length, gradient[1] / length, gradient[2] / length]

    best = { part, index: posed.index, depth, point, normal, posedNormal: toPosedNormal(posed, normal) }
  }

  return best
}

/** Цвет освещённой точки: ступень рампы части по косинусу угла между нормалью и светом. */
const getShade = (hit: RayHit, light: ModelVector, options: ModelRenderOptions): ModelColor => {
  const { ramp, base } = hit.part
  const [na, nb, nd] = hit.posedNormal
  const cosine = na * light[0] + nb * light[1] + nd * light[2]
  const step = cosine > options.light.lit ? base + 1 : cosine < options.light.shade ? base - 1 : base

  return [ramp, Math.max(0, Math.min(options.ramps[ramp].length - 1, step))]
}

/**
 * Рендерит модель в позе лучом в проекции экрана: кадр `options.frame` с опорной точкой в центре, модель повёрнута
 * по часовой стрелке на `roll` градусов. Свет зафиксирован на экране. Внешний край силуэта получает ступень контура
 * части, стык с той же рампой глубже — ступень шва.
 */
export const renderModel = (
  model: ToyModel,
  pose: ModelPose,
  roll: number,
  options: ModelRenderOptions
): RasterImage => {
  const { frame, depthShift, light, ramps } = options
  const pivot = frame / 2
  const radians = (roll * Math.PI) / 180
  // Экран → модель: поворот против часовой стрелки на крен модели
  const toModel = (x: number, y: number) => rotate(x, y, Math.cos(radians), Math.sin(radians))
  const parts = model.parts.map((part, index): PosedPart => {
    const transform = part.group === undefined ? undefined : pose[part.group]
    const angle = ((transform?.angle ?? 0) * Math.PI) / 180

    // Обратный поворот группы, которая повёрнута по часовой стрелке, — поворот против неё на тот же угол
    return { part, index, transform, cos: Math.cos(angle), sin: Math.sin(angle) }
  })
  // Точка глубины d видна на экране со сдвигом d × depthShift, поэтому луч пикселя идёт против сдвига
  const [da, db] = toModel(-depthShift[0], -depthShift[1])
  const [lightA, lightB] = toModel(light.direction[0], light.direction[1])
  const lightVector: ModelVector = [lightA, lightB, light.direction[2]]
  const hits: (RayHit | undefined)[][] = Array.from({ length: frame }, (_, y) =>
    Array.from({ length: frame }, (_, x) => {
      const [a, b] = toModel(x + 0.5 - pivot, pivot - (y + 0.5))

      return castRay(parts, a, b, da, db)
    })
  )
  const image = createImage(frame, frame)

  for (let y = 0; y < frame; y++) {
    for (let x = 0; x < frame; x++) {
      const hit = hits[y][x]

      if (!hit) continue

      const { part } = hit
      const isOuter = SIDES.some(([dx, dy]) => !hits[y + dy]?.[x + dx])
      const isSeam = SIDES.some(([dx, dy]) => {
        const other = hits[y + dy]?.[x + dx]

        return (
          other !== undefined &&
          other.index !== hit.index &&
          other.depth - hit.depth > model.seamDepth &&
          other.part.ramp === part.ramp
        )
      })
      let color = model.decal?.(hit) ?? getShade(hit, lightVector, options)

      if (isSeam && part.seam !== undefined) color = [part.ramp, part.seam]
      if (isOuter) color = [part.ramp, part.outline]
      setColor(image, x, y, toRgba(ramps, color))
    }
  }

  return image
}

/** Полоса кадров модели слева направо. */
export const renderModelStrip = (
  model: ToyModel,
  frames: readonly ModelFrame[],
  options: ModelRenderOptions
): RasterImage => {
  const { frame } = options
  const strip = createImage(frame * frames.length, frame)

  frames.forEach(({ pose, roll }, index) => {
    const image = renderModel(model, pose, roll, options)

    for (let y = 0; y < frame; y++) {
      strip.data.set(
        image.data.subarray(getOffset(image, 0, y), getOffset(image, 0, y + 1)),
        getOffset(strip, index * frame, y)
      )
    }
  })

  return strip
}

/** Лежит ли точка `(a, b)` внутри эллипса с центром `center` и полуосями `radii`. */
export const isInEllipse = (a: number, b: number, center: ModelPlanePoint, radii: ModelPlanePoint): boolean =>
  ((a - center[0]) / radii[0]) ** 2 + ((b - center[1]) / radii[1]) ** 2 <= 1

/** Лежит ли точка `(a, b)` на отрезке `from`–`to` толщиной `width`. */
export const isOnSegment = (
  a: number,
  b: number,
  from: ModelPlanePoint,
  to: ModelPlanePoint,
  width: number
): boolean => {
  const [fromA, fromB] = from
  const dx = to[0] - fromA
  const dy = to[1] - fromB
  const t = Math.max(0, Math.min(1, ((a - fromA) * dx + (b - fromB) * dy) / (dx * dx + dy * dy)))

  return Math.hypot(a - fromA - t * dx, b - fromB - t * dy) <= width / 2
}
