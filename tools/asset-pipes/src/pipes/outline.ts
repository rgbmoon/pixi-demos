import type { AssetPipe } from '@assetpack/core'

import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'
import { getOutlineName, outlineImage } from '#src/utils/outline'
import { parseHex } from '#src/utils/palette'

/** Добавляет к PNG с тегом `{outline}` кадр контура 1 px цветом подсветки; исходный кадр остаётся. */
export const outlinePipe = (color: string): AssetPipe => {
  const rgb = parseHex(color)

  return {
    name: 'outline',
    defaultOptions: {},
    tags: { outline: 'outline' },
    test: (asset) => !asset.isFolder && asset.allMetaData.outline === true && asset.extension === '.png',
    async transform(asset) {
      const image = await decodePng(asset.buffer)
      const meta = await getFrameMeta(asset)
      const name = getBaseName(asset.path)
      // Растр контура шире исходного на пиксель с каждой стороны
      const pivot = meta?.pivot && { x: meta.pivot.x + 1, y: meta.pivot.y + 1 }

      return Promise.all([
        createImageAsset(asset, name, image, meta),
        createImageAsset(asset, getOutlineName(name), outlineImage(image, rgb), pivot && { pivot }),
      ])
    },
  }
}
