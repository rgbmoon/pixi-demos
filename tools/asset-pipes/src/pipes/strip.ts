import type { AssetPipe } from '@assetpack/core'

import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { cropImage, decodePng } from '#src/utils/image'

/**
 * Режет PNG с тегом `{strip=N}` на N кадров одной ширины слева направо: кадр `k` получает имя `<имя>-k`. Опорная
 * точка из сайдкара задана в пикселях одного кадра и общая для всех кадров.
 */
export const stripPipe = (): AssetPipe => ({
  name: 'strip',
  defaultOptions: {},
  tags: { strip: 'strip' },
  test: (asset) => !asset.isFolder && asset.allMetaData.strip !== undefined && asset.extension === '.png',
  async transform(asset) {
    const { strip: count } = asset.allMetaData

    if (!Number.isInteger(count) || count < 1)
      throw new Error(`{strip=${String(count)}}: expected a positive whole number`)

    const image = await decodePng(asset.buffer)

    if (image.width % count !== 0)
      throw new Error(`{strip=${count}}: width ${image.width} is not divisible by ${count}`)

    const width = image.width / count
    const meta = await getFrameMeta(asset)
    const name = getBaseName(asset.path)

    return Promise.all(
      Array.from({ length: count }, (_, frame) =>
        createImageAsset(asset, `${name}-${frame}`, cropImage(image, frame * width, 0, width, image.height), meta)
      )
    )
  },
})
