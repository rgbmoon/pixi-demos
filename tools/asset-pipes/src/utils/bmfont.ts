import { FONT_ICON_SPACING, FONT_PAGE_PADDING, FONT_PAGE_WIDTH } from '#src/constants'
import type {
  BitmapFontData,
  BitmapFontPage,
  BitmapGlyph,
  FontSpec,
  FontStyle,
  RasterImage,
  RasterPoint,
  Rgb,
} from '#src/types'

import { createImage, drawImage } from './image'
import { isRecord } from './json'
import { outlineImage } from './outline'

/** Проверяет цвета шрифта или его стиля; при ошибке сообщает поле. */
const parseFontStyle = (value: Record<string, unknown>): FontStyle => {
  const { color, outline } = value

  if (color !== undefined && typeof color !== 'string') throw new Error('Font color must be #rrggbb')
  if (outline !== undefined && typeof outline !== 'string') throw new Error('Font outline must be #rrggbb')

  return { color, outline }
}

/** Проверяет параметры шрифта из `font.json`; при ошибке сообщает поле. */
export const parseFontSpec = (value: unknown): FontSpec => {
  if (!isRecord(value)) throw new Error('Font spec must be an object')

  const { styles } = value

  if (styles !== undefined && !isRecord(styles)) throw new Error('Font styles must be an object')

  return {
    ...parseFontStyle(value),
    styles:
      styles &&
      Object.fromEntries(
        Object.entries(styles).map(([name, style]) => {
          if (!isRecord(style)) throw new Error(`Font style "${name}" must be an object`)

          return [name, parseFontStyle(style)]
        })
      ),
  }
}

/** Перекрашивает непрозрачные пиксели растра в один цвет, прозрачность сохраняется. */
export const recolorImage = (image: RasterImage, [red, green, blue]: Rgb): RasterImage => {
  const result: RasterImage = { width: image.width, height: image.height, data: image.data.slice() }

  for (let offset = 0; offset < result.data.length; offset += 4) {
    if (result.data[offset + 3] > 0) result.data.set([red, green, blue], offset)
  }

  return result
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
