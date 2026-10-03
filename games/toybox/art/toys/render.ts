import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ART_CELL, ART_PIXEL, AXIS_X, TOY_ANGLE_STEP } from '#src/constants'
import type {
  ModelFrame,
  ModelLight,
  ModelPose,
  ModelRenderOptions,
  Palette,
  RasterImage,
  ToyModel,
} from '@pixi-demos/asset-pipes/types'
import { encodePng } from '@pixi-demos/asset-pipes/utils/image'
import { renderModelStrip } from '@pixi-demos/asset-pipes/utils/model'

import { BEAR, BEAR_POSES } from './models/bear'

// Рендер игрушек: `pnpm toys`. Полосы кадров моделей пишутся в папку атласа игрушек, атлас собирает `pnpm assets`
const root = import.meta.dirname
const palette = JSON.parse(await readFile(path.join(root, '../palette/palette.json'), 'utf8')) as Palette
const atlas = path.join(root, 'toys{tps}{pal}')

/** Игрушка атласа: имя последовательностей, модель, сторона кадра и позы состояний. */
type ToyArt = {
  readonly name: string
  readonly model: ToyModel
  readonly frame: number
  readonly poses: {
    /** Сжатие клешнёй без крена: слабое и сильное. */
    readonly squeeze: readonly [ModelPose, ModelPose]
    /** Тик на полу, при каждом крене. */
    readonly twitch: ModelPose
  }
}

const TOYS: readonly ToyArt[] = [{ name: 'bear', model: BEAR, frame: 52, poses: BEAR_POSES }]

// Свет сверху-слева и от игрока, зафиксирован на экране: при крене освещение не переворачивается
const LIGHT_DIRECTION = [-0.45, 0.75, -0.5] as const
const LIGHT_LENGTH = Math.hypot(...LIGHT_DIRECTION)
const LIGHT: ModelLight = {
  direction: [LIGHT_DIRECTION[0] / LIGHT_LENGTH, LIGHT_DIRECTION[1] / LIGHT_LENGTH, LIGHT_DIRECTION[2] / LIGHT_LENGTH],
  lit: 0.62,
  shade: 0.05,
}
// Ячейка глубины сдвигает точку на экране на AXIS_X; ось y экрана направлена вниз, у модели — вверх
const DEPTH_SHIFT = [AXIS_X.x / ART_PIXEL / ART_CELL, -AXIS_X.y / ART_PIXEL / ART_CELL] as const
const ROLL_COUNT = Math.round((2 * Math.PI) / TOY_ANGLE_STEP)
const ROLLS = Array.from({ length: ROLL_COUNT }, (_, step) => (step * 360) / ROLL_COUNT)

/** Пишет полосу кадров и её сайдкар: опорная точка — центр кадра. */
const writeStrip = async (name: string, tags: string, image: RasterImage, frame: number): Promise<void> => {
  await writeFile(path.join(atlas, `${name}${tags}.png`), await encodePng(image))
  await writeFile(path.join(atlas, `${name}.meta.json`), `{ "pivot": { "x": ${frame / 2}, "y": ${frame / 2} } }\n`)
}

for (const { name, model, frame, poses } of TOYS) {
  const options: ModelRenderOptions = { ramps: palette.ramps, frame, depthShift: DEPTH_SHIFT, light: LIGHT }
  const strip = (frames: readonly ModelFrame[]) => renderModelStrip(model, frames, options)

  await writeStrip(name, `{strip=${ROLL_COUNT}}{outline}`, strip(ROLLS.map((roll) => ({ pose: {}, roll }))), frame)
  await writeStrip(`${name}-squeeze`, '{strip=2}', strip(poses.squeeze.map((pose) => ({ pose, roll: 0 }))), frame)
  await writeStrip(
    `${name}-twitch`,
    `{strip=${ROLL_COUNT}}`,
    strip(ROLLS.map((roll) => ({ pose: poses.twitch, roll }))),
    frame
  )
}
