import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { AssetPipe } from '@assetpack/core'

import type { FaceLayout } from '#src/types'
import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { composeFace } from '#src/utils/compose'
import { decodePng } from '#src/utils/image'

/** Собирает грань из деталей папки `{compose}` по раскладке с её именем; грань ложится рядом с папкой. */
export const composePipe = (faces: Readonly<Record<string, FaceLayout>>): AssetPipe => ({
  name: 'compose',
  folder: true,
  defaultOptions: {},
  tags: { compose: 'compose' },
  test: (asset) => asset.isFolder && asset.metaData.compose === true,
  async transform(folder) {
    // Вызов идёт до первого await: детали помечаются пропущенными раньше, чем AssetPack начнёт их обработку
    folder.skipChildren()

    const name = getBaseName(folder.path)
    const layout = faces[name]

    if (!layout) throw new Error(`No face layout for "${name}"`)

    const files = (await readdir(folder.path)).filter((file) => path.extname(file) === '.png')
    const parts = new Map(
      await Promise.all(
        files.map(
          async (file) => [getBaseName(file), await decodePng(await readFile(path.join(folder.path, file)))] as const
        )
      )
    )

    return [await createImageAsset(folder, name, composeFace(parts, layout), await getFrameMeta(folder))]
  },
})
