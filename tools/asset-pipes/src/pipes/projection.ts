import type { AssetPipe } from '@assetpack/core'

import type { ShearSlopes } from '#src/types'
import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'
import { shearImage, shearPoint } from '#src/utils/shear'

/**
 * Переводит PNG с тегом `{face=…}` из прямоугольного рисунка в проекцию игры по наклонам грани. Опорная точка
 * из сайдкара переносится вместе с пикселями; без неё опорной точкой становится левый верхний угол рисунка.
 */
export const projectionPipe = (projections: Readonly<Record<string, ShearSlopes>>): AssetPipe => ({
  name: 'projection',
  defaultOptions: {},
  tags: { face: 'face' },
  test: (asset) => !asset.isFolder && typeof asset.allMetaData.face === 'string' && asset.extension === '.png',
  async transform(asset) {
    const face = String(asset.allMetaData.face)
    const slopes = projections[face]

    if (!slopes) throw new Error(`Unknown face "${face}", expected one of: ${Object.keys(projections).join(', ')}`)

    const { image, origin } = shearImage(await decodePng(asset.buffer), slopes)
    const pivot = (await getFrameMeta(asset))?.pivot

    return [
      await createImageAsset(asset, getBaseName(asset.path), image, {
        pivot: pivot ? shearPoint(pivot, slopes, origin) : origin,
      }),
    ]
  },
})
