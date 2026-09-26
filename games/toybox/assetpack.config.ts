import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { CABINET_FRONT_PLANE, CABINET_SIDE_PLANE, CONTROL_PANEL_PLANE } from '#src/constants'
import { getPlaneShear } from '#src/utils/projection'
import { AssetBuild } from '@pixi-demos/asset-pipes/asset-build'
import type { Palette } from '@pixi-demos/asset-pipes/types'

// Сборка ассетов toybox: `pnpm assets`. Скрипт запускает tsx: код игры импортирует модули без расширений,
// и Node со стрипом типов их не находит
const root = import.meta.dirname
const palette = JSON.parse(await readFile(path.join(root, 'art/palette/palette.json'), 'utf8')) as Palette

await new AssetBuild({
  entry: path.join(root, 'art'),
  output: path.join(root, '../../web/public/games/toybox/assets'),
  cacheDir: path.join(root, 'node_modules/.cache/assets'),
  // Палитра, выходы PixelLab и журналы генераций — исходники для людей и пайпов, в сборку они не идут
  ignore: ['palette/**', '**/raw/**', '**/source.json'],
  palette,
  projections: {
    front: getPlaneShear(CABINET_FRONT_PLANE),
    side: getPlaneShear(CABINET_SIDE_PLANE),
    panel: getPlaneShear(CONTROL_PANEL_PLANE),
  },
  outlineColor: palette.ramps.neon[4],
  previewDir: process.env.ASSET_PREVIEW_DIR,
}).run()
