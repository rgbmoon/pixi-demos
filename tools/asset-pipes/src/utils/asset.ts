import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { type Asset, createNewAssetAt, stripTags } from '@assetpack/core'

import { PREVIEW_SCALE, SIDECAR_SUFFIX } from '#src/constants'
import type { FrameMeta, RasterImage } from '#src/types'

import { encodePng, scaleImage } from './image'
import { hasNumbers, isRecord, readJson } from './json'

/** Ключ данных кадра в `transformData` ассета: так их получают следующие пайпы цепочки. */
const FRAME_META_KEY = 'frameMeta'

/** Имя файла без тегов и расширения. */
export const getBaseName = (filePath: string): string => {
  const name = stripTags(path.basename(filePath))

  return name.slice(0, name.length - path.extname(name).length)
}

/** Путь сайдкара кадра: рядом с PNG, имя без тегов с суффиксом `.meta.json`. */
export const getSidecarPath = (pngPath: string): string =>
  path.join(path.dirname(pngPath), `${getBaseName(pngPath)}${SIDECAR_SUFFIX}`)

/** Читает и проверяет сайдкар кадра; нет файла — `undefined`. */
export const readSidecar = async (pngPath: string): Promise<FrameMeta | undefined> => {
  const value = await readJson(getSidecarPath(pngPath))

  if (value === undefined) return undefined

  if (
    !isRecord(value) ||
    (value.pivot !== undefined && !hasNumbers(value.pivot, ['x', 'y'])) ||
    (value.borders !== undefined && !hasNumbers(value.borders, ['left', 'top', 'right', 'bottom']))
  ) {
    throw new Error(
      `Invalid sidecar ${getSidecarPath(pngPath)}: expected { pivot?: { x, y }, borders?: { left, top, right, bottom } }`
    )
  }

  return value as FrameMeta
}

/** Данные кадра: заданные предыдущим пайпом цепочки или сайдкар исходного файла. */
export const getFrameMeta = async (asset: Asset): Promise<FrameMeta | undefined> =>
  FRAME_META_KEY in asset.transformData
    ? (asset.transformData[FRAME_META_KEY] as FrameMeta | undefined)
    : readSidecar(asset.rootTransformAsset.path)

/** Новый PNG-ассет, производный от `source`: растр и данные кадра для следующих пайпов. */
export const createImageAsset = async (
  source: Asset,
  name: string,
  image: RasterImage,
  meta: FrameMeta | undefined
): Promise<Asset> => {
  const asset = createNewAssetAt(source, `${name}.png`)

  asset.buffer = await encodePng(image)
  asset.transformData[FRAME_META_KEY] = meta

  return asset
}

/** Значение тега одним списком: `{dim=1&2}` даёт `[1, 2]`, `{dim=1}` — `[1]`, без тега — пустой список. */
export const getTagValues = (value: unknown): unknown[] => {
  if (value === undefined) return []

  return Array.isArray(value) ? value : [value]
}

/** Имя превью: путь исходника от корня арта без тегов, через дефис. */
export const getPreviewName = (asset: Asset): string => {
  const source = asset.rootTransformAsset
  const relative = path.relative(source.rootAsset.path, path.join(source.directory, getBaseName(asset.path)))

  return stripTags(relative).split(path.sep).join('-')
}

/** Пишет растр в каталог превью, увеличенный в `PREVIEW_SCALE` раз без сглаживания. */
export const writePreview = async (previewDir: string, name: string, image: RasterImage): Promise<void> => {
  await mkdir(previewDir, { recursive: true })
  await writeFile(path.join(previewDir, `${name}.png`), await encodePng(scaleImage(image, PREVIEW_SCALE)))
}
