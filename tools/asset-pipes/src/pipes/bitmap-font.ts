import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { type AssetPipe, createNewAssetAt, stripTags } from '@assetpack/core'

import { FONT_SPEC_FILE } from '#src/constants'
import type { BitmapFontData, FontStyle } from '#src/types'
import { getBaseName } from '#src/utils/asset'
import { addGlyphOutline, createIconGlyph, formatBmfont, packGlyphs, parseFontSpec, recolorImage } from '#src/utils/bmfont'
import { decodePng, encodePng } from '#src/utils/image'
import { readJson } from '#src/utils/json'
import { parseHex } from '#src/utils/palette'

const ICON_FILE = /^u([0-9a-f]{4,5})\.png$/i

/**
 * Собирает BMFont (`.fnt` и страницу `.png`) из PNG-глифов папки `{bmfont}` с кодом символа в имени
 * (`u2665.png` → ♥). Параметры — в `font.json` папки; каждый стиль из `styles` собирается в отдельный BMFont из тех
 * же глифов.
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

    const icons = await Promise.all(
      files
        .map((file) => [file, ICON_FILE.exec(stripTags(file))] as const)
        .filter(([, match]) => match)
        .map(async ([file, match]) => ({
          id: parseInt(match?.[1] ?? '0', 16),
          image: await decodePng(await readFile(path.join(folder.path, file))),
        }))
    )
    // Строку задаёт самый высокий глиф
    const height = Math.max(0, ...icons.map(({ image }) => image.height))
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
          const outline = style.outline && parseHex(style.outline)
          const glyphs = icons
            .map(({ id, image }) => createIconGlyph(id, color ? recolorImage(image, color) : image, height))
            .map((glyph) => (outline ? addGlyphOutline(glyph, outline) : glyph))
          const font: BitmapFontData = { face: styleFace, size: height, lineHeight: height, base: height, glyphs }
          const page = packGlyphs(glyphs)
          const fnt = createNewAssetAt(folder, `${styleFace}.fnt`)
          const png = createNewAssetAt(folder, `${styleFace}.png`)

          fnt.buffer = Buffer.from(formatBmfont(font, page, `${styleFace}.png`))
          png.buffer = await encodePng(page.image)

          return [fnt, png]
        })
      )
    ).flat()
  },
})
