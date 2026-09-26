import type { AssetPipe } from '@assetpack/core'

import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'
import { rotateSprite, upscaleForRotation } from '#src/utils/rotsprite'

/**
 * Заменяет PNG с тегом `{rot=N}` на N кадров поворота RotSprite на полный оборот по часовой стрелке: кадр `k`
 * повёрнут на `k · 360° / N` вокруг опорной точки из сайдкара, по умолчанию — вокруг центра рисунка.
 */
export const rotspritePipe = (): AssetPipe => ({
  name: 'rotsprite',
  defaultOptions: {},
  tags: { rot: 'rot' },
  test: (asset) => !asset.isFolder && asset.allMetaData.rot !== undefined && asset.extension === '.png',
  async transform(asset) {
    const count = asset.allMetaData.rot

    if (!Number.isInteger(count) || count < 1)
      throw new Error(`{rot=${String(count)}}: expected a positive whole number`)

    const image = await decodePng(asset.buffer)
    const upscaled = upscaleForRotation(image)
    const pivot = (await getFrameMeta(asset))?.pivot ?? { x: image.width / 2, y: image.height / 2 }
    const name = getBaseName(asset.path)

    return Promise.all(
      Array.from({ length: count }, (_, frame) => {
        const rotated = rotateSprite(image, upscaled, (frame * 360) / count, pivot)

        return createImageAsset(asset, `${name}-${frame}`, rotated.image, { pivot: rotated.pivot })
      })
    )
  },
})
