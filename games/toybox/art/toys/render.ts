import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ART_CELL, TOY_ANGLE_STEPS } from '#src/constants'
import type { PlaneVector, SectionPoint } from '#src/types'
import { getConvexHull, getSignedArea, getTurn } from '#src/utils/geometry'
import type { Palette, RasterImage } from '@pixi-demos/asset-pipes/types'
import { downscaleImage } from '@pixi-demos/asset-pipes/utils/downscale'
import {
  copyImage,
  createImage,
  cropImage,
  decodePng,
  drawImage,
  encodePng,
  isOpaque,
} from '@pixi-demos/asset-pipes/utils/image'
import { softenDarkest } from '@pixi-demos/asset-pipes/utils/outline'
import { rotateSprite, upscaleForRotation } from '@pixi-demos/asset-pipes/utils/rotsprite'

// Рендер игрушек: `pnpm toys`. Полосы кадров крена пишутся в папку атласа игрушек, атлас собирает `pnpm assets`;
// сечение, глубина и вес каждой игрушки по её арту пишутся в модуль игры
const root = import.meta.dirname
const palette = JSON.parse(await readFile(path.join(root, '../palette/palette.json'), 'utf8')) as Palette
const atlas = path.join(root, 'toys{tps}{pal}{trim}')
const spritesDir = path.join(root, 'sprites')
const specsModule = path.join(root, '../../src/toy-specs.ts')

/** Спрайты, у которых голова сидит над телом: тик — голова дёргается на пиксель вбок. Сейчас тик выключен у всех. */
const TWITCHING_SPRITES: ReadonlySet<string> = new Set<string>()

/**
 * Множитель размера базы спрайта: PixelLab рисует все игрушки в одном кадре, и утёнок выходит ростом с медведя.
 * Игрушки без множителя остаются в размере базы.
 */
const SPRITE_SCALES: Readonly<Record<string, number>> = {
  ...Object.fromEntries(['duckling-a', 'duckling-b', 'duckling-c', 'duckling-d'].map((key) => [key, 0.6])),
  ...Object.fromEntries(['star-a', 'star-b', 'star-c', 'star-d', 'crab'].map((key) => [key, 0.6])),
  ...Object.fromEntries(['frog-a', 'frog-b', 'frog-c', 'frog-d'].map((key) => [key, 0.75])),
  ...Object.fromEntries(['owl-a', 'owl-b', 'owl-c', 'owl-d'].map((key) => [key, 0.75])),
  ...Object.fromEntries(['piglet-a', 'piglet-b', 'piglet-c', 'piglet-d'].map((key) => [key, 0.8])),
  ...Object.fromEntries(['penguin-a', 'penguin-b', 'penguin-c', 'penguin-d'].map((key) => [key, 0.8])),
  ...Object.fromEntries(['octopus-a', 'octopus-b'].map((key) => [key, 0.8])),
  ...Object.fromEntries(['bunny-a', 'bunny-b', 'bunny-c'].map((key) => [key, 0.85])),
  ...Object.fromEntries(['cat-a', 'cat-b', 'cat-c', 'cat-d', 'cat-e', 'cat-f', 'cat-g', 'cat-h'].map((key) => [key, 0.85])),
  ...Object.fromEntries(['puppy-a', 'puppy-b', 'puppy-c', 'puppy-d'].map((key) => [key, 0.85])),
  ...Object.fromEntries(['fox-a', 'fox-b', 'fox-c', 'fox-d'].map((key) => [key, 0.85])),
  ...Object.fromEntries(['whale-a', 'whale-b', 'sheep', 'koala'].map((key) => [key, 0.85])),
  ...Object.fromEntries(['dino-a', 'dino-b', 'dino-c', 'dino-d'].map((key) => [key, 0.9])),
  ...Object.fromEntries(['grey-elephant', 'lion', 'panda', 'unicorn'].map((key) => [key, 0.9])),
}

/**
 * Почти чёрный цвет баз PixelLab — контур и глубокие тени — слишком контрастен для сцены. При записи полос он
 * смягчается: край силуэта — серо-фиолетовым, внутренние линии — нижней ступенью цвета соседей.
 */
const HARSH_BLACK = palette.ramps.night[0]
const SOFT_EDGE = palette.ramps.metal[0]

const ROLLS = Array.from({ length: TOY_ANGLE_STEPS }, (_, step) => (step * 360) / TOY_ANGLE_STEPS)
/** Предел вершин многоугольника planck. */
const MAX_SECTION_VERTICES = 12
/** Игрушка не больше этого по обеим осям, в клетках, занимает один срез глубины; крупнее — два. */
const THIN_EXTENT = 1.5
/** Вес игрушек раскладывается по площади сечения линейно от самой маленькой до самой большой. */
const MIN_WEIGHT = 1
const MAX_WEIGHT = 8

/** Арт игрушки до записи: сечение относительно опорной точки и полосы кадров. */
type ToyArt = {
  readonly key: string
  readonly hull: readonly PlaneVector[]
  readonly twitch: boolean
}

/** Ошибки проверок всех игрушек: скрипт сообщает их разом и падает. */
const problems: string[] = []

/** Пишет полосу кадров со смягчённым чёрным и её сайдкар: опорная точка — `pivot` кадра. */
const writeStrip = async (name: string, tags: string, image: RasterImage, pivot: PlaneVector): Promise<void> => {
  const soft = softenDarkest(image, palette, HARSH_BLACK, SOFT_EDGE)

  await writeFile(path.join(atlas, `${name}${tags}.png`), await encodePng(soft))
  await writeFile(path.join(atlas, `${name}.meta.json`), `{ "pivot": { "x": ${pivot.x}, "y": ${pivot.y} } }\n`)
}

/** Проверяет полосу: у края кадра остаётся пустая строка под обводку подсветки. */
const checkMargin = (name: string, strip: RasterImage, frame: number): void => {
  for (let y = 0; y < strip.height; y++) {
    for (let x = 0; x < strip.width; x++) {
      const column = x % frame

      if ((column === 0 || column === frame - 1 || y === 0 || y === frame - 1) && isOpaque(strip, x, y)) {
        problems.push(`${name}: frame ${Math.floor(x / frame)} touches the edge, enlarge the frame`)

        return
      }
    }
  }
}

/**
 * Упрощает выпуклый многоугольник до `MAX_SECTION_VERTICES` вершин: убирает вершину, чей треугольник с соседями меньше
 * всех. Многоугольник остаётся выпуклым и лежит внутри исходного.
 */
const simplify = (polygon: readonly PlaneVector[]): PlaneVector[] => {
  const points = [...polygon]

  while (points.length > MAX_SECTION_VERTICES) {
    const areas = points.map((point, index) =>
      Math.abs(getTurn(points[(index + points.length - 1) % points.length], point, points[(index + 1) % points.length]))
    )

    points.splice(areas.indexOf(Math.min(...areas)), 1)
  }

  return points
}

/** Центр масс многоугольника. */
const getCentroid = (polygon: readonly PlaneVector[]): PlaneVector => {
  let area = 0
  let x = 0
  let y = 0

  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const cross = point.x * next.y - next.x * point.y

    area += cross
    x += (point.x + next.x) * cross
    y += (point.y + next.y) * cross
  })

  return { x: x / (3 * area), y: y / (3 * area) }
}

/**
 * Выпуклая оболочка углов непрозрачных пикселей растра, упрощённая до предела вершин. Точки — в пикселях растра
 * относительно `origin`, ось `y` вверх.
 */
const getPixelHull = (image: RasterImage, origin: PlaneVector): PlaneVector[] => {
  const corners: PlaneVector[] = []

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!isOpaque(image, x, y)) continue

      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        corners.push({ x: x + dx - origin.x, y: origin.y - (y + dy) })
      }
    }
  }

  return simplify(getConvexHull(corners))
}

/** Тик спрайта: строки выше шеи — самой узкой строки силуэта в средней части высоты — сдвинуты на пиксель вправо. */
const getHeadTwitch = (image: RasterImage): RasterImage => {
  const widths = Array.from({ length: image.height }, (_, y) => {
    const xs = Array.from({ length: image.width }, (_, x) => x).filter((x) => isOpaque(image, x, y))

    return xs.length > 0 ? Math.max(...xs) - Math.min(...xs) + 1 : 0
  })
  const rows = widths.flatMap((width, y) => (width > 0 ? [y] : []))
  const top = rows[0]
  const height = rows.at(-1)! - top + 1
  const from = Math.round(top + height * 0.3)
  const candidates = widths.slice(from, Math.round(top + height * 0.6) + 1)
  const neck = from + candidates.indexOf(Math.min(...candidates))
  const twitch = createImage(image.width, image.height)

  copyImage(twitch, cropImage(image, 0, neck, image.width, image.height - neck), 0, neck)
  copyImage(twitch, cropImage(image, 0, 0, image.width, neck), 1, 0)

  return twitch
}

/** Полоса кадров крена спрайта поворотом RotSprite вокруг опорной точки; кадр — квадрат со стороной `frame`. */
const rotateStrip = (image: RasterImage, pivot: PlaneVector, frame: number): RasterImage => {
  const upscaled = upscaleForRotation(image)
  const strip = createImage(frame * TOY_ANGLE_STEPS, frame)
  const target = frame / 2 + (pivot.x - Math.floor(pivot.x))

  ROLLS.forEach((roll, index) => {
    const rotated = rotateSprite(image, upscaled, roll, pivot)
    // Дробная часть опорной точки одна во всех кадрах поворота, сдвиг до центра кадра целый
    const dx = Math.round(target - rotated.pivot.x)
    const dy = Math.round(frame / 2 + (pivot.y - Math.floor(pivot.y)) - rotated.pivot.y)

    drawImage(strip, rotated.image, index * frame + dx, dy)
  })

  return strip
}

/**
 * Спрайт: база, уменьшенная по `SPRITE_SCALES`, оболочка непрозрачных пикселей, опорная точка в её центре масс, полосы
 * крена поворотом RotSprite.
 */
const renderSpriteArt = async (key: string, twitching: boolean): Promise<ToyArt> => {
  const base = await decodePng(await readFile(path.join(spritesDir, `${key}.png`)))
  const scale = SPRITE_SCALES[key]
  const image = scale === undefined ? base : downscaleImage(base, scale)
  const raw = getPixelHull(image, { x: 0, y: 0 })
  const centroid = getCentroid(raw)
  // Опорная точка на сетке полупикселей: поворот RotSprite держит её в одной доле пикселя во всех кадрах
  const pivot = { x: Math.round(centroid.x * 2) / 2, y: Math.round(-centroid.y * 2) / 2 }
  const reach = Math.max(...raw.map(({ x, y }) => Math.hypot(x - pivot.x, -y - pivot.y)))
  const frame = 2 * Math.ceil(reach) + 4
  const framePivot = { x: frame / 2 + (pivot.x - Math.floor(pivot.x)), y: frame / 2 + (pivot.y - Math.floor(pivot.y)) }
  const body = rotateStrip(image, pivot, frame)

  checkMargin(key, body, frame)
  await writeStrip(key, `{strip=${TOY_ANGLE_STEPS}}{outline}`, body, framePivot)
  if (twitching) {
    const twitch = rotateStrip(getHeadTwitch(image), pivot, frame)

    checkMargin(`${key}-twitch`, twitch, frame)
    await writeStrip(`${key}-twitch`, `{strip=${TOY_ANGLE_STEPS}}`, twitch, framePivot)
  }

  return { key, hull: raw.map(({ x, y }) => ({ x: x - pivot.x, y: y + pivot.y })), twitch: twitching }
}

/** Сечение в клетках плоскости `(y, z)` против часовой стрелки: ось `y` мира на экране направлена влево. */
const toSection = (hull: readonly PlaneVector[]): SectionPoint[] => {
  const section = hull.map(({ x, y }) => ({ y: -x / ART_CELL, z: y / ART_CELL }))

  return getSignedArea(section.map(({ y, z }) => ({ x: y, y: z }))) < 0 ? section.reverse() : section
}

/** Модуль игрушек: сечение, глубина, вес и наличие тика по ключу игрушки. */
const formatSpecs = (arts: readonly ToyArt[]): string => {
  const round = (value: number) => Number(value.toFixed(4))
  const areas = arts.map(({ hull }) => Math.abs(getSignedArea(hull)))
  const smallest = Math.min(...areas)
  const largest = Math.max(...areas)
  const toys = arts.map(({ key, hull, twitch }, index) => {
    const section = toSection(hull)
    const width = Math.max(...section.map(({ y }) => y)) - Math.min(...section.map(({ y }) => y))
    const height = Math.max(...section.map(({ z }) => z)) - Math.min(...section.map(({ z }) => z))
    const depth = width <= THIN_EXTENT && height <= THIN_EXTENT ? 1 : 2
    const share = largest > smallest ? (areas[index] - smallest) / (largest - smallest) : 1
    const weight = Math.round(MIN_WEIGHT + share * (MAX_WEIGHT - MIN_WEIGHT))
    const points = section.map(({ y, z }) => `      { y: ${round(y)}, z: ${round(z)} },\n`).join('')

    return `  '${key}': {\n    depth: ${depth},\n    weight: ${weight},\n    twitch: ${twitch},\n    section: [\n${points}    ],\n  },\n`
  })

  return `// Файл пишет \`pnpm toys\` (art/toys/render.ts) по артам игрушек: правка руками пропадёт при следующем рендере

/**
 * Игрушки по артам: глубина в срезах, вес, есть ли тик на полу и сечение тела в клетках — выпуклая оболочка лицевой
 * проекции арта без крена, упрощённая до ${MAX_SECTION_VERTICES} вершин, против часовой стрелки. Начало координат сечения — опорная
 * точка кадров крена. Вес разложен по площади сечения от ${MIN_WEIGHT} до ${MAX_WEIGHT}.
 */
export const TOY_SPECS = {
${toys.join('')}} as const
`
}

// Полосы прежнего рендера удаляются: состав игрушек задаёт папка спрайтов
for (const file of await readdir(atlas)) await rm(path.join(atlas, file))

const spriteKeys = (await readdir(spritesDir)).filter((file) => file.endsWith('.png')).map((file) => file.slice(0, -4))
const arts: ToyArt[] = []

for (const key of spriteKeys.sort()) arts.push(await renderSpriteArt(key, TWITCHING_SPRITES.has(key)))

const missing = [...TWITCHING_SPRITES].filter((key) => !spriteKeys.includes(key))

const strayScales = Object.keys(SPRITE_SCALES).filter((key) => !spriteKeys.includes(key))

if (missing.length > 0) problems.push(`twitching sprites without art: ${missing.join(', ')}`)
if (strayScales.length > 0) problems.push(`scaled sprites without art: ${strayScales.join(', ')}`)
if (problems.length > 0) throw new Error(problems.join('\n'))

await writeFile(specsModule, formatSpecs(arts))
