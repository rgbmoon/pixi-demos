import { type AssetPipe, BuildReporter } from '@assetpack/core'

import type { Palette, RasterImage } from '#src/types'
import { createImageAsset, getBaseName, getFrameMeta, getTagValues } from '#src/utils/asset'
import { decodePng } from '#src/utils/image'
import {
  assertSameStructure,
  cycleSteps,
  indexPalette,
  quantizeImage,
  remapImage,
  shiftSteps,
  toAlphaMode,
} from '#src/utils/palette'

/**
 * Приводит PNG с тегом `{pal}` к мастер-палитре и переводит в целевую палитру по рампе и ступени. Сообщает о
 * пикселях вне мастер-палитры. Варианты: `{dim=N}` — темнее на N ступеней, `{lit=N}` — светлее, `{cycle=N}` —
 * N кадров цикла цветов вместо исходного кадра.
 */
export const palettePipe = (options: {
  palette: Palette
  target?: Palette
  cycleRamps?: readonly string[]
}): AssetPipe => {
  const master = indexPalette(options.palette)
  const target = options.target && indexPalette(options.target)

  if (target) assertSameStructure(master, target)

  return {
    name: 'palette',
    defaultOptions: {},
    tags: { pal: 'pal', alpha: 'alpha', dim: 'dim', lit: 'lit', cycle: 'cycle' },
    test: (asset) => !asset.isFolder && asset.allMetaData.pal === true && asset.extension === '.png',
    async transform(asset) {
      const tags = asset.allMetaData
      const { image, outside } = quantizeImage(await decodePng(asset.buffer), master, toAlphaMode(tags.alpha))

      if (outside > 0) {
        BuildReporter.warn(`[palette] ${asset.rootTransformAsset.path}: ${outside} px outside the master palette`)
      }

      const name = getBaseName(asset.path)
      const variants: [string, RasterImage][] =
        typeof tags.cycle === 'number'
          ? Array.from({ length: tags.cycle }, (_, frame) => [
              `${name}-${frame}`,
              cycleSteps(image, master, frame, options.cycleRamps),
            ])
          : [[name, image]]

      for (const steps of getTagValues(tags.dim))
        variants.push([`${name}-dim${steps}`, shiftSteps(image, master, -Number(steps))])
      for (const steps of getTagValues(tags.lit))
        variants.push([`${name}-lit${steps}`, shiftSteps(image, master, Number(steps))])

      const meta = await getFrameMeta(asset)

      return Promise.all(
        variants.map(([variant, raster]) =>
          createImageAsset(asset, variant, target ? remapImage(raster, master, target) : raster, meta)
        )
      )
    },
  }
}
