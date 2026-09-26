import opentype from 'opentype.js'

import {
  FONT_ICON_SPACING,
  FONT_PAGE_PADDING,
  FONT_PAGE_WIDTH,
  GLYPH_CURVE_STEPS,
  GLYPH_EDGE_EPSILON,
} from '#src/constants'
import type { BitmapFontData, BitmapFontPage, BitmapGlyph, FontSpec, RasterImage, RasterPoint, Rgb } from '#src/types'

import { createImage, drawImage, getOffset } from './image'
import { isRecord } from './json'
import { outlineImage } from './outline'

type Segment = readonly [RasterPoint, RasterPoint]

/** Разбивает контур глифа на отрезки; кривые — на `GLYPH_CURVE_STEPS` отрезков. */
const flattenPath = (commands: readonly opentype.PathCommand[]): Segment[] => {
  const segments: Segment[] = []
  let start: RasterPoint = { x: 0, y: 0 }
  let current: RasterPoint = { x: 0, y: 0 }
  const lineTo = (point: RasterPoint): void => {
    segments.push([current, point])
    current = point
  }

  for (const command of commands) {
    if (command.type === 'M') {
      start = { x: command.x, y: command.y }
      current = start
    } else if (command.type === 'L') {
      lineTo({ x: command.x, y: command.y })
    } else if (command.type === 'Q') {
      const from = current

      for (let step = 1; step <= GLYPH_CURVE_STEPS; step++) {
        const t = step / GLYPH_CURVE_STEPS
        const u = 1 - t

        lineTo({
          x: u * u * from.x + 2 * u * t * command.x1 + t * t * command.x,
          y: u * u * from.y + 2 * u * t * command.y1 + t * t * command.y,
        })
      }
    } else if (command.type === 'C') {
      const from = current

      for (let step = 1; step <= GLYPH_CURVE_STEPS; step++) {
        const t = step / GLYPH_CURVE_STEPS
        const u = 1 - t

        lineTo({
          x: u * u * u * from.x + 3 * u * u * t * command.x1 + 3 * u * t * t * command.x2 + t * t * t * command.x,
          y: u * u * u * from.y + 3 * u * u * t * command.y1 + 3 * u * t * t * command.y2 + t * t * t * command.y,
        })
      }
    } else if (current.x !== start.x || current.y !== start.y) {
      lineTo(start)
    }
  }

  return segments
}

/** Лежит ли точка внутри контура по правилу ненулевой обмотки, как у TrueType. */
const isInside = (segments: readonly Segment[], point: RasterPoint): boolean => {
  let winding = 0

  for (const [a, b] of segments) {
    const side = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)

    if (a.y <= point.y && b.y > point.y && side > 0) winding += 1
    else if (a.y > point.y && b.y <= point.y && side < 0) winding -= 1
  }

  return winding !== 0
}

/** Проверяет параметры шрифта из `font.json`; при ошибке сообщает поле. */
export const parseFontSpec = (value: unknown): FontSpec => {
  if (!isRecord(value)) throw new Error('Font spec must be an object')

  const { size, chars, color, outline } = value

  if (size !== undefined && (typeof size !== 'number' || size <= 0))
    throw new Error('Font size must be a positive number')
  if (chars !== undefined && typeof chars !== 'string') throw new Error('Font chars must be a string')
  if (color !== undefined && typeof color !== 'string') throw new Error('Font color must be #rrggbb')
  if (outline !== undefined && typeof outline !== 'string') throw new Error('Font outline must be #rrggbb')

  return { size, chars, color, outline }
}

/** Растеризует отрезки контура без сглаживания: пиксель закрашен, если его центр внутри контура. */
const rasterizeSegments = (
  segments: readonly Segment[],
  color: Rgb
): { image: RasterImage; left: number; top: number } => {
  if (segments.length === 0) return { image: createImage(0, 0), left: 0, top: 0 }

  const xs = segments.flatMap(([a, b]) => [a.x, b.x])
  const ys = segments.flatMap(([a, b]) => [a.y, b.y])
  const left = Math.floor(Math.min(...xs) + GLYPH_EDGE_EPSILON)
  const top = Math.floor(Math.min(...ys) + GLYPH_EDGE_EPSILON)
  const right = Math.ceil(Math.max(...xs) - GLYPH_EDGE_EPSILON)
  const bottom = Math.ceil(Math.max(...ys) - GLYPH_EDGE_EPSILON)
  const image = createImage(right - left, bottom - top)

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (isInside(segments, { x: left + x + 0.5, y: top + y + 0.5 })) {
        image.data.set([...color, 255], getOffset(image, x, y))
      }
    }
  }

  return { image, left, top }
}

/**
 * Растеризует символы TTF цветом `color` без сглаживания: em шрифта занимает `size` пикселей. `missing` — символы,
 * которых в шрифте нет.
 */
export const rasterizeFont = (
  ttf: ArrayBuffer,
  face: string,
  size: number,
  chars: string,
  color: Rgb
): { font: BitmapFontData; missing: string[] } => {
  // opentype.js 1.x собран как UMD: Node отдаёт его экспорты только через default
  // eslint-disable-next-line import/no-named-as-default-member
  const font = opentype.parse(ttf)
  const scale = size / font.unitsPerEm
  const base = Math.round(font.ascender * scale)
  const glyphs: BitmapGlyph[] = []
  const missing: string[] = []

  for (const char of new Set(chars)) {
    const glyph = font.charToGlyph(char)

    if (glyph.index === 0) {
      missing.push(char)
      continue
    }

    const { image, left, top } = rasterizeSegments(flattenPath(glyph.getPath(0, 0, size).commands), color)

    glyphs.push({
      id: char.codePointAt(0) ?? 0,
      image,
      xOffset: left,
      yOffset: base + top,
      xAdvance: Math.round((glyph.advanceWidth ?? 0) * scale),
    })
  }

  return {
    font: { face, size, lineHeight: Math.round((font.ascender - font.descender) * scale), base, glyphs },
    missing,
  }
}

/** Глиф-иконка: растр стоит на базовой линии, за ним — интервал `FONT_ICON_SPACING`. */
export const createIconGlyph = (id: number, image: RasterImage, base: number): BitmapGlyph => ({
  id,
  image,
  xOffset: 0,
  yOffset: base - image.height,
  xAdvance: image.width + FONT_ICON_SPACING,
})

/** Добавляет глифу контур-свечение 1 px под растром; ширина шага не меняется. */
export const addGlyphOutline = (glyph: BitmapGlyph, color: Rgb): BitmapGlyph => {
  if (glyph.image.width === 0) return glyph

  const image = outlineImage(glyph.image, color)

  drawImage(image, glyph.image, 1, 1)

  return { ...glyph, image, xOffset: glyph.xOffset - 1, yOffset: glyph.yOffset - 1 }
}

/** Раскладывает глифы на странице полками от высоких к низким. */
export const packGlyphs = (glyphs: readonly BitmapGlyph[]): BitmapFontPage => {
  const positions = new Map<number, RasterPoint>()
  const sorted = [...glyphs].sort((a, b) => b.image.height - a.image.height)
  let x = FONT_PAGE_PADDING
  let y = FONT_PAGE_PADDING
  let shelfHeight = 0

  for (const glyph of sorted) {
    if (glyph.image.width + FONT_PAGE_PADDING * 2 > FONT_PAGE_WIDTH) {
      throw new Error(`Glyph ${glyph.id} is wider than the font page`)
    }

    if (x + glyph.image.width + FONT_PAGE_PADDING > FONT_PAGE_WIDTH) {
      x = FONT_PAGE_PADDING
      y += shelfHeight + FONT_PAGE_PADDING
      shelfHeight = 0
    }

    positions.set(glyph.id, { x, y })
    x += glyph.image.width + FONT_PAGE_PADDING
    shelfHeight = Math.max(shelfHeight, glyph.image.height)
  }

  const image = createImage(FONT_PAGE_WIDTH, y + shelfHeight + FONT_PAGE_PADDING)

  for (const glyph of glyphs) {
    const position = positions.get(glyph.id)

    if (position) drawImage(image, glyph.image, position.x, position.y)
  }

  return { image, positions }
}

/** Текст BMFont (`.fnt`) в формате, который читает `bitmapFontTextParser` PIXI. */
export const formatBmfont = (font: BitmapFontData, page: BitmapFontPage, pageFile: string): string =>
  [
    `info face="${font.face}" size=${font.size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=${FONT_PAGE_PADDING},${FONT_PAGE_PADDING}`,
    `common lineHeight=${font.lineHeight} base=${font.base} scaleW=${page.image.width} scaleH=${page.image.height} pages=1 packed=0`,
    `page id=0 file="${pageFile}"`,
    `chars count=${font.glyphs.length}`,
    ...font.glyphs.map((glyph) => {
      const position = page.positions.get(glyph.id) ?? { x: 0, y: 0 }

      return `char id=${glyph.id} x=${position.x} y=${position.y} width=${glyph.image.width} height=${glyph.image.height} xoffset=${glyph.xOffset} yoffset=${glyph.yOffset} xadvance=${glyph.xAdvance} page=0 chnl=15`
    }),
    '',
  ].join('\n')
