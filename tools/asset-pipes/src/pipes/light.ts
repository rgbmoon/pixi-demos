import type { AssetPipe } from '@assetpack/core'

import type { Palette } from '#src/types'
import { createImageAsset, getBaseName, getFrameMeta } from '#src/utils/asset'
import { parseLightSpot, renderLight } from '#src/utils/light'
import { parseHex } from '#src/utils/palette'

/** Рисует PNG пятна света по параметрам из файла `<имя>{light}.json` цветами рампы палитры. */
export const lightPipe = (palette: Palette): AssetPipe => ({
  name: 'light',
  defaultOptions: {},
  tags: { light: 'light' },
  test: (asset) => !asset.isFolder && asset.allMetaData.light === true && asset.extension === '.json',
  async transform(asset) {
    const spot = parseLightSpot(JSON.parse(asset.buffer.toString('utf8')))
    const ramp = palette.ramps[spot.ramp]
    const [from, to] = spot.steps

    if (!ramp) throw new Error(`Unknown ramp "${spot.ramp}" in ${asset.path}`)
    if (from < 0 || to >= ramp.length || from > to)
      throw new Error(`Steps [${from}, ${to}] do not fit ramp "${spot.ramp}"`)

    const colors = ramp.slice(from, to + 1).map(parseHex)

    return [
      await createImageAsset(asset, getBaseName(asset.path), renderLight(spot, colors), await getFrameMeta(asset)),
    ]
  },
})
