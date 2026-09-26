import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { type AssetPipe, BuildReporter, createNewAssetAt, stripTags } from '@assetpack/core'

import { DEFAULT_FONT_CHARS, FONT_SPEC_FILE } from '#src/constants'
import type { BitmapFontData, BitmapGlyph } from '#src/types'
import { getBaseName } from '#src/utils/asset'
import {
  addGlyphOutline,
  createIconGlyph,
  formatBmfont,
  packGlyphs,
  parseFontSpec,
  rasterizeFont,
} from '#src/utils/bmfont'
import { decodePng, encodePng } from '#src/utils/image'
import { readJson } from '#src/utils/json'
import { parseHex } from '#src/utils/palette'

const ICON_FILE = /^u([0-9a-f]{4,5})\.png$/i

/**
 * Собирает BMFont (`.fnt` и страницу `.png`) из папки `{bmfont}`: символы TTF, растеризованного без сглаживания,
 * и PNG-иконки с кодом символа в имени (`u2665.png` → ♥). Параметры — в `font.json` папки.
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

    const rasterized =
      ttf && spec.size
        ? rasterizeFont(
            new Uint8Array(ttf).buffer,
            face,
            spec.size,
            spec.chars ?? DEFAULT_FONT_CHARS,
            parseHex(spec.color ?? '#ffffff')
          )
        : undefined

    if (rasterized && rasterized.missing.length > 0) {
      BuildReporter.warn(`[bitmap-font] ${face}: no glyphs for ${rasterized.missing.join(' ')}`)
    }

    // У шрифта из одних иконок строку задаёт самая высокая иконка
    const iconHeight = Math.max(0, ...icons.map(({ image }) => image.height))
    const font: BitmapFontData = rasterized?.font ?? {
      face,
      size: iconHeight,
      lineHeight: iconHeight,
      base: iconHeight,
      glyphs: [],
    }
    const outline = spec.outline && parseHex(spec.outline)
    const glyphs: BitmapGlyph[] = [
      ...font.glyphs,
      ...icons.map(({ id, image }) => createIconGlyph(id, image, font.base)),
    ].map((glyph) => (outline ? addGlyphOutline(glyph, outline) : glyph))
    const page = packGlyphs(glyphs)
    const fnt = createNewAssetAt(folder, `${face}.fnt`)
    const png = createNewAssetAt(folder, `${face}.png`)

    fnt.buffer = Buffer.from(formatBmfont({ ...font, glyphs }, page, `${face}.png`))
    png.buffer = await encodePng(page.image)

    return [fnt, png]
  },
})
