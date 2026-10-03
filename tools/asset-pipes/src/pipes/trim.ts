import type { AssetPipe } from '@assetpack/core'

import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { decodePng, trimImage } from '#src/utils/image'

/**
 * Обрезает у PNG с тегом `{trim}` прозрачные поля до рамки непрозрачных пикселей. Опорная точка сдвигается вместе с
 * пикселями, поэтому кадр встаёт на прежнее место; без опорной точки в сайдкаре кадр сдвинулся бы, и пайп падает.
 */
export const trimPipe = (): AssetPipe => ({
  name: 'trim',
  defaultOptions: {},
  tags: { trim: 'trim' },
  test: (asset) => !asset.isFolder && asset.allMetaData.trim === true && asset.extension === '.png',
  async transform(asset) {
    const meta = await getFrameMeta(asset)

    if (!meta?.pivot) throw new Error(`{trim}: ${asset.path} has no pivot`)

    const { image, offset } = trimImage(await decodePng(asset.buffer))
    const pivot = { x: meta.pivot.x - offset.x, y: meta.pivot.y - offset.y }

    return [await createImageAsset(asset, getBaseName(asset.path), image, { ...meta, pivot })]
  },
})
