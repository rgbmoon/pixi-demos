import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { BOX_FRAMES, CABINET_FRAMES, PILLAR_FRAMES } from '#src/assets'
import { ART_CELL, RESET_PLATE_WIDTH } from '#src/constants'
import { getCabinetFaces, getCubeFaces, getMarqueeLampCenters, getPillarFaces } from '#src/utils/machine-geometry'
import { getFaceSize } from '#src/utils/projection'
import { AssetBuild } from '@pixi-demos/asset-pipes/asset-build'
import type { DecalPlacement, FaceLayout, Palette } from '@pixi-demos/asset-pipes/types'

// Сборка ассетов toybox: `pnpm assets`. Скрипт запускает tsx: код игры импортирует модули без расширений,
// и Node со стрипом типов их не находит
const root = import.meta.dirname
const palette = JSON.parse(await readFile(path.join(root, 'art/palette/palette.json'), 'utf8')) as Palette

/** Ширина гнезда лампы на табло, px арта. */
const SOCKET_WIDTH = 5

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
    ...getMarqueeLampCenters().map(
      (center): DecalPlacement => ({
        name: 'socket',
        corner: 'bottom-left',
        x: Math.round(center - SOCKET_WIDTH / 2),
        y: 2,
      })
    ),
    { name: 'divider', corner: 'top-right', x: RESET_PLATE_WIDTH * ART_CELL + 1, y: 2 },
    { name: 'plate', corner: 'top-right', x: 1, y: 2 },
  ],
}

// Декали граней куба: отступы от угла грани в пикселях арта
const BOX_DECALS: Partial<Record<keyof typeof BOX_FRAMES, DecalPlacement[]>> = {
  glass: [
    { name: 'crack', corner: 'top-left', x: 1, y: 1 },
    { name: 'smudge', corner: 'top-right', x: 20, y: 14 },
    { name: 'print-left', corner: 'bottom-left', x: 30, y: 48 },
    { name: 'print-right', corner: 'bottom-right', x: 16, y: 38 },
  ],
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
  // Палитра, выходы PixelLab и журналы генераций — исходники для людей и пайпов, в сборку они не идут
  ignore: ['palette/**', '**/raw/**', '**/source.json'],
  palette,
  faces: getFaceLayouts(),
  outlineColor: palette.ramps.neon[4],
  previewDir: process.env.ASSET_PREVIEW_DIR,
}).run()
