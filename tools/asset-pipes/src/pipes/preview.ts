import type { AssetPipe } from '@assetpack/core'

import { getPreviewName, writePreview } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'

/** Пишет каждую страницу атласа в каталог превью увеличенной для ревью; файл идёт дальше без изменений. */
export const previewPipe = (previewDir: string): AssetPipe => ({
  name: 'preview',
  defaultOptions: {},
  test: (asset) =>
    !asset.isFolder && asset.extension === '.png' && asset.transformParent?.transformName === 'texture-packer',
  async transform(asset) {
    await writePreview(previewDir, getPreviewName(asset), await decodePng(asset.buffer))

    return [asset]
  },
})
