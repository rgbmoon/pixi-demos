import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { type AssetPipe, BuildReporter, createNewAssetAt, stripTags } from '@assetpack/core'

import { DEFAULT_FONT_CHARS, FONT_SPEC_FILE } from '#src/constants'
import type { BitmapFontData, BitmapGlyph, FontStyle } from '#src/types'
import { getBaseName } from '#src/utils/asset'
import {
  addGlyphOutline,
  createIconGlyph,
  formatBmfont,
  packGlyphs,
  parseFontSpec,
  rasterizeFont,
  recolorImage,
} from '#src/utils/bmfont'
import { decodePng, encodePng } from '#src/utils/image'
import { readJson } from '#src/utils/json'
import { parseHex } from '#src/utils/palette'

const ICON_FILE = /^u([0-9a-f]{4,5})\.png$/i

/**
 * Собирает BMFont (`.fnt` и страницу `.png`) из папки `{bmfont}`: символы TTF, растеризованного без сглаживания,
 * и PNG-глифы с кодом символа в имени (`u2665.png` → ♥). Параметры — в `font.json` папки; каждый стиль из `styles`
 * собирается в отдельный BMFont из тех же глифов.
 */
export const bitmapFontPipe = (): AssetPipe => ({
  name: 'bitmap-font',
  folder: true,
  defaultOptions: {},
  tags: { bmfont: 'bmfont' },
  test: (asset) => asset.isFolder && asset.metaData.bmfont === true,
  async transform(folder) {
    // Вызов идёт до первого await: файлы шрифта помечаются пропущенными раньше, чем AssetPack начнёт их обработку
    folder.skipChildren()

    const face = getBaseName(folder.path)
    const files = await readdir(folder.path)
    const spec = parseFontSpec((await readJson(path.join(folder.path, FONT_SPEC_FILE))) ?? {})
    const ttfFiles = files.filter((file) => path.extname(file) === '.ttf')

    if (ttfFiles.length > 1) throw new Error(`Font "${face}" has more than one TTF`)

    const icons = await Promise.all(
      files
        .map((file) => [file, ICON_FILE.exec(stripTags(file))] as const)
        .filter(([, match]) => match)
        .map(async ([file, match]) => ({
          id: parseInt(match?.[1] ?? '0', 16),
          image: await decodePng(await readFile(path.join(folder.path, file))),
        }))
    )
    const ttf = ttfFiles.length === 1 ? await readFile(path.join(folder.path, ttfFiles[0])) : undefined

    if (ttf && !spec.size) throw new Error(`${FONT_SPEC_FILE} of font "${face}" needs size`)

    const styles: [string, FontStyle][] = spec.styles
      ? Object.entries(spec.styles).map(([name, style]) => [
          `${face}-${name}`,
          { color: style.color ?? spec.color, outline: style.outline ?? spec.outline },
        ])
      : [[face, spec]]

    return (
      await Promise.all(
        styles.map(async ([styleFace, style]) => {
          const color = style.color === undefined ? undefined : parseHex(style.color)
          const rasterized =
            ttf && spec.size
              ? rasterizeFont(
                  new Uint8Array(ttf).buffer,
                  styleFace,
                  spec.size,
                  spec.chars ?? DEFAULT_FONT_CHARS,
                  color ?? parseHex('#ffffff')
                )
              : undefined

          if (rasterized && rasterized.missing.length > 0) {
            BuildReporter.warn(`[bitmap-font] ${styleFace}: no glyphs for ${rasterized.missing.join(' ')}`)
          }

          // У шрифта из одних PNG-глифов строку задаёт самый высокий глиф
          const iconHeight = Math.max(0, ...icons.map(({ image }) => image.height))
          const font: BitmapFontData = rasterized?.font ?? {
            face: styleFace,
            size: iconHeight,
            lineHeight: iconHeight,
            base: iconHeight,
            glyphs: [],
          }
          const outline = style.outline && parseHex(style.outline)
          const glyphs: BitmapGlyph[] = [
            ...font.glyphs,
            ...icons.map(({ id, image }) => createIconGlyph(id, color ? recolorImage(image, color) : image, font.base)),
          ].map((glyph) => (outline ? addGlyphOutline(glyph, outline) : glyph))
          const page = packGlyphs(glyphs)
          const fnt = createNewAssetAt(folder, `${styleFace}.fnt`)
          const png = createNewAssetAt(folder, `${styleFace}.png`)

          fnt.buffer = Buffer.from(formatBmfont({ ...font, glyphs }, page, `${styleFace}.png`))
          png.buffer = await encodePng(page.image)

          return [fnt, png]
        })
      )
    ).flat()
  },
})
