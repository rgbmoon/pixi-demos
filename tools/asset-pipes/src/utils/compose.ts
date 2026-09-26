import { FACE_PARTS } from '#src/constants'
import type { FaceCorner, FaceLayout, RasterImage } from '#src/types'

import { createImage, cropImage, drawImage } from './image'

/** Рисует деталь повтором вдоль отрезка оси от `start` до `end`; последний повтор обрезается. */
const tileAlong = (
  target: RasterImage,
  part: RasterImage,
  axis: 'x' | 'y',
  start: number,
  end: number,
  offset: number
): void => {
  const step = axis === 'x' ? part.width : part.height

  for (let position = start; position < end; position += step) {
    const visible = Math.min(step, end - position)
    const piece =
      axis === 'x' ? cropImage(part, 0, 0, visible, part.height) : cropImage(part, 0, 0, part.width, visible)

    if (axis === 'x') drawImage(target, piece, position, offset)
    else drawImage(target, piece, offset, position)
  }
}

/** Положение левого верхнего угла детали размером `width` × `height` у заданного угла грани с отступом внутрь. */
const placeAtCorner = (
  layout: FaceLayout,
  corner: FaceCorner,
  width: number,
  height: number,
  inset: { x: number; y: number }
): { x: number; y: number } => ({
  x: corner.endsWith('left') ? inset.x : layout.width - inset.x - width,
  y: corner.startsWith('top') ? inset.y : layout.height - inset.y - height,
})

/**
 * Собирает плоскую грань из набора деталей: заливка повтором по всей площади, кромки повтором вдоль краёв между
 * углами, углы, затем декали от своих углов. Обязательна только заливка; грань, на которую не помещаются углы,
 * отклоняется.
 */
export const composeFace = (parts: ReadonlyMap<string, RasterImage>, layout: FaceLayout): RasterImage => {
  const fill = parts.get(FACE_PARTS.fill)

  if (!fill) throw new Error(`Face parts have no "${FACE_PARTS.fill}"`)

  const face = createImage(layout.width, layout.height)
  const cornerTopLeft = parts.get(FACE_PARTS.cornerTopLeft)
  const cornerTopRight = parts.get(FACE_PARTS.cornerTopRight)
  const cornerBottomLeft = parts.get(FACE_PARTS.cornerBottomLeft)
  const cornerBottomRight = parts.get(FACE_PARTS.cornerBottomRight)
  const leftWidth = Math.max(cornerTopLeft?.width ?? 0, cornerBottomLeft?.width ?? 0)
  const rightWidth = Math.max(cornerTopRight?.width ?? 0, cornerBottomRight?.width ?? 0)
  const topHeight = Math.max(cornerTopLeft?.height ?? 0, cornerTopRight?.height ?? 0)
  const bottomHeight = Math.max(cornerBottomLeft?.height ?? 0, cornerBottomRight?.height ?? 0)

  if (leftWidth + rightWidth > layout.width || topHeight + bottomHeight > layout.height) {
    throw new Error(`Face ${layout.width}×${layout.height} is smaller than its corners`)
  }

  for (let y = 0; y < layout.height; y += fill.height) tileAlong(face, fill, 'x', 0, layout.width, y)

  const edgeTop = parts.get(FACE_PARTS.edgeTop)
  const edgeBottom = parts.get(FACE_PARTS.edgeBottom)
  const edgeLeft = parts.get(FACE_PARTS.edgeLeft)
  const edgeRight = parts.get(FACE_PARTS.edgeRight)

  if (edgeTop) tileAlong(face, edgeTop, 'x', leftWidth, layout.width - rightWidth, 0)
  if (edgeBottom)
    tileAlong(face, edgeBottom, 'x', leftWidth, layout.width - rightWidth, layout.height - edgeBottom.height)
  if (edgeLeft) tileAlong(face, edgeLeft, 'y', topHeight, layout.height - bottomHeight, 0)
  if (edgeRight)
    tileAlong(face, edgeRight, 'y', topHeight, layout.height - bottomHeight, layout.width - edgeRight.width)

  const corners: [RasterImage | undefined, FaceCorner][] = [
    [cornerTopLeft, 'top-left'],
    [cornerTopRight, 'top-right'],
    [cornerBottomLeft, 'bottom-left'],
    [cornerBottomRight, 'bottom-right'],
  ]

  for (const [corner, name] of corners) {
    if (!corner) continue

    const { x, y } = placeAtCorner(layout, name, corner.width, corner.height, { x: 0, y: 0 })

    drawImage(face, corner, x, y)
  }

  for (const decal of layout.decals ?? []) {
    const image = parts.get(decal.name)

    if (!image) throw new Error(`Face parts have no decal "${decal.name}"`)

    const { x, y } = placeAtCorner(layout, decal.corner, image.width, image.height, decal)

    drawImage(face, image, x, y)
  }

  return face
}
