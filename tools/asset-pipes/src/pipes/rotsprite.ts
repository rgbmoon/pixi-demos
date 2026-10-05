import type { AssetPipe } from '@assetpack/core'

import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'
import { getRotationAngles, rotateSprite, upscaleForRotation } from '#src/utils/rotsprite'

/**
 * Заменяет PNG с тегом `{rot=N}` на N кадров поворота RotSprite на полный оборот по часовой стрелке: кадр `k`
 * повёрнут на `k · 360° / N` вокруг опорной точки из сайдкара, по умолчанию — вокруг центра рисунка. Тег `{arc=D}`
 * оставляет кадры с тем же шагом в пределах ±D°: кадр `k` повёрнут на `(k − m) · 360° / N`, где `m` — номер кадра
 * без поворота.
 */
export const rotspritePipe = (): AssetPipe => ({
  name: 'rotsprite',
  defaultOptions: {},
  tags: { rot: 'rot', arc: 'arc' },
  test: (asset) => !asset.isFolder && asset.allMetaData.rot !== undefined && asset.extension === '.png',
  async transform(asset) {
    const { rot: count, arc } = asset.allMetaData

    if (!Number.isInteger(count) || count < 1)
      throw new Error(`{rot=${String(count)}}: expected a positive whole number`)
    if (arc !== undefined && !(typeof arc === 'number' && arc >= 0))
      throw new Error(`{arc=${String(arc)}}: expected a non-negative number of degrees`)

    const image = await decodePng(asset.buffer)
    const upscaled = upscaleForRotation(image)
    const pivot = (await getFrameMeta(asset))?.pivot ?? { x: image.width / 2, y: image.height / 2 }
    const name = getBaseName(asset.path)

    return Promise.all(
      getRotationAngles(count, arc).map((degrees, frame) => {
        const rotated = rotateSprite(image, upscaled, degrees, pivot)

        return createImageAsset(asset, `${name}-${frame}`, rotated.image, { pivot: rotated.pivot })
      })
    )
  },
})
