import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { type AssetPipe, BuildReporter } from '@assetpack/core'

import type { AtlasJson } from '#src/types'
import { readSidecar } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'
import { findNonUniformBands } from '#src/utils/nine-slice'

/**
 * Дописывает в JSON атласа `anchor` и `borders` кадров из сайдкаров: встроенный упаковщик их не пишет, а PIXI
 * читает как `defaultAnchor` и `defaultBorders` текстуры. Кромки и центр кадра 9-slice проверяет на однородность.
 */
export const frameMetaPipe = (): AssetPipe => ({
  name: 'frame-meta',
  defaultOptions: {},
  test: (asset) =>
    !asset.isFolder && asset.extension === '.json' && asset.transformParent?.transformName === 'texture-packer',
  async transform(asset) {
    // Родитель JSON — папка атласа, из которой упаковщик брал кадры; сайдкары лежат рядом с ними
    const folder = asset.transformParent?.path ?? ''
    const atlas = JSON.parse(asset.buffer.toString('utf8')) as AtlasJson

    for (const [name, frame] of Object.entries(atlas.frames)) {
      const framePath = path.join(folder, name)
      const meta = await readSidecar(framePath)

      if (meta?.pivot) frame.anchor = { x: meta.pivot.x / frame.sourceSize.w, y: meta.pivot.y / frame.sourceSize.h }

      if (meta?.borders) {
        frame.borders = meta.borders

        const bands = findNonUniformBands(await decodePng(await readFile(framePath)), meta.borders)

        if (bands.length > 0) {
          BuildReporter.warn(`[frame-meta] ${name}: 9-slice ${bands.join(', ')} change along the stretch direction`)
        }
      }
    }

    asset.buffer = Buffer.from(`${JSON.stringify(atlas, null, 2)}\n`)

    return [asset]
  },
})
