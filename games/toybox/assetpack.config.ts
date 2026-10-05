import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { BOX_FRAMES, CABINET_FRAMES, PILLAR_FRAMES } from '#src/assets'
import { ART_CELL, MARQUEE_LAMP_BOTTOM, RESET_PLATE_WIDTH } from '#src/constants'
import { getCabinetFaces, getCubeFaces, getMarqueeLampLefts, getPillarFaces } from '#src/utils/machine-geometry'
import { getFaceSize } from '#src/utils/projection'
import { AssetBuild } from '@pixi-demos/asset-pipes/asset-build'
import type { DecalPlacement, FaceLayout, Palette } from '@pixi-demos/asset-pipes/types'

// Сборка ассетов toybox: `pnpm assets`. Скрипт запускает tsx: код игры импортирует модули без расширений,
// и Node со стрипом типов их не находит
const root = import.meta.dirname
const palette = JSON.parse(await readFile(path.join(root, 'art/palette/palette.json'), 'utf8')) as Palette

// Декали граней корпуса: отступы от угла грани в пикселях арта
const CABINET_DECALS: Partial<Record<keyof typeof CABINET_FRAMES, DecalPlacement[]>> = {
  cabinetFront: [
    ...(['top-left', 'top-right'] as const).flatMap((corner) => [
      { name: 'bolt', corner, x: 5, y: 2 },
      { name: 'bolt', corner, x: 5, y: 11 },
      { name: 'screw', corner, x: 5, y: 23 },
    ]),
    { name: 'screw', corner: 'bottom-left', x: 5, y: 13 },
    { name: 'screw', corner: 'bottom-right', x: 5, y: 13 },
    { name: 'coin-slot', corner: 'top-right', x: 10, y: 4 },
  ],
  marqueeFront: [
    ...getMarqueeLampLefts().map(
      (left): DecalPlacement => ({ name: 'socket', corner: 'bottom-left', x: left, y: MARQUEE_LAMP_BOTTOM })
    ),
    { name: 'divider', corner: 'top-right', x: RESET_PLATE_WIDTH * ART_CELL + 1, y: 2 },
    { name: 'plate', corner: 'top-right', x: 1, y: 2 },
  ],
}

// Декали граней куба: отступы от угла грани в пикселях арта
const BOX_DECALS: Partial<Record<keyof typeof BOX_FRAMES, DecalPlacement[]>> = {
  trayBack: [
    { name: 'scratch', corner: 'top-left', x: 5, y: 7 },
    { name: 'scratch', corner: 'bottom-right', x: 6, y: 4 },
  ],
}

/** Раскладки граней для `compose`: размеры считаются из геометрии автомата, поэтому смена размеров не требует арта. */
const getFaceLayouts = (): Record<string, FaceLayout> => {
  const cabinet = getCabinetFaces()
  const pillars = getPillarFaces()
  const box = getCubeFaces()
  const name = (frame: string): string => path.basename(frame, '.png')

  return Object.fromEntries([
    ...(Object.keys(CABINET_FRAMES) as (keyof typeof CABINET_FRAMES)[]).map((key) => [
      name(CABINET_FRAMES[key]),
      { ...getFaceSize(cabinet[key]), decals: CABINET_DECALS[key] },
    ]),
    ...(Object.keys(PILLAR_FRAMES) as (keyof typeof PILLAR_FRAMES)[]).map((key) => [
      name(PILLAR_FRAMES[key]),
      getFaceSize(pillars[key]),
    ]),
    ...(Object.keys(BOX_FRAMES) as (keyof typeof BOX_FRAMES)[]).map((key) => [
      name(BOX_FRAMES[key]),
      { ...getFaceSize(box[key]), decals: BOX_DECALS[key] },
    ]),
  ])
}

await new AssetBuild({
  entry: path.join(root, 'art'),
  output: path.join(root, '../../web/public/games/toybox/assets'),
  cacheDir: path.join(root, 'node_modules/.cache/assets'),
  // Палитра, выходы PixelLab, журналы генераций и модели игрушек — исходники для людей и пайпов, в сборку они не идут
  ignore: ['palette/**', '**/raw/**', '**/sprites/**', '**/source.json', '**/*.ts'],
  palette,
  faces: getFaceLayouts(),
  outlineColor: palette.ramps.bone[4],
  previewDir: process.env.ASSET_PREVIEW_DIR,
}).run()
