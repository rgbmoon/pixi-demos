import { mkdir, writeFile } from 'node:fs/promises'

import { type AssetPipe, createNewAssetAt, stripTags } from '@assetpack/core'

import { getFrameMeta, getSidecarPath } from '#src/utils/asset'

/**
 * Записывает результат прогона подготовки в его каталог выхода. Теги папок сохраняются: по ним прогон упаковки
 * находит атласы и шрифты. Данные кадра ложатся сайдкаром рядом с PNG.
 */
export const stagePipe = (): AssetPipe => ({
  name: 'stage',
  defaultOptions: {},
  test: (asset) => !asset.isFolder,
  async transform(asset, _options, pipeSystem) {
    const staged = createNewAssetAt(asset, stripTags(asset.filename), pipeSystem.outputPath, false)

    await mkdir(staged.directory, { recursive: true })
    await writeFile(staged.path, asset.buffer)

    const meta = asset.extension === '.png' ? await getFrameMeta(asset) : undefined

    if (meta) await writeFile(getSidecarPath(staged.path), JSON.stringify(meta))

    // Пустой список: финальное копирование AssetPack убрало бы теги из имён папок
    return []
  },
})
