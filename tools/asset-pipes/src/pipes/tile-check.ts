import { type AssetPipe, BuildReporter } from '@assetpack/core'

import { TILE_PREVIEW_REPEAT, TILE_SEAM_RATIO } from '#src/constants'
import { getPreviewName, writePreview } from '#src/utils/asset'
import { decodePng, repeatImage } from '#src/utils/image'
import { measureSeam } from '#src/utils/tile'

/**
 * Проверяет бесшовность PNG с тегом `{tile}` по обеим осям, `{tile=x}` и `{tile=y}` — по одной. Резкий шов
 * попадает в отчёт сборки; с каталогом превью тайл пишется туда повтором 3 × 3. Файл идёт дальше без изменений.
 */
export const tileCheckPipe = (previewDir: string | undefined): AssetPipe => ({
  name: 'tile-check',
  defaultOptions: {},
  tags: { tile: 'tile' },
  test: (asset) => !asset.isFolder && asset.allMetaData.tile !== undefined && asset.extension === '.png',
  async transform(asset) {
    const image = await decodePng(asset.buffer)
    const tag = asset.allMetaData.tile
    const axes = tag === 'x' || tag === 'y' ? [tag] : (['x', 'y'] as const)

    for (const axis of axes) {
      const ratio = measureSeam(image, axis)

      if (ratio > TILE_SEAM_RATIO) {
        BuildReporter.warn(
          `[tile-check] ${asset.rootTransformAsset.path}: the seam along ${axis} is ${ratio.toFixed(1)}× sharper than the tile interior`
        )
      }
    }

    if (previewDir) {
      await writePreview(
        previewDir,
        `${getPreviewName(asset)}-tile`,
        repeatImage(image, TILE_PREVIEW_REPEAT, TILE_PREVIEW_REPEAT)
      )
    }

    return [asset]
  },
})
