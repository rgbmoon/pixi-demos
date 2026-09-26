import sharp from 'sharp'

import type { RasterImage } from '#src/types'

/** Создаёт прозрачный растр. */
export const createImage = (width: number, height: number): RasterImage => ({
  width,
  height,
  data: new Uint8Array(width * height * 4),
})

/** Декодирует картинку в RGBA по 8 бит на канал. */
export const decodePng = async (buffer: Buffer): Promise<RasterImage> => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true })

  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) }
}

/** Кодирует растр в PNG без потерь: цвета и альфа пикселей не меняются. */
export const encodePng = (image: RasterImage): Promise<Buffer> =>
  sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()

/** Индекс первого байта пикселя в массиве растра. */
export const getOffset = (image: RasterImage, x: number, y: number): number => (y * image.width + x) * 4

/** Цвет пикселя одним числом RGBA; за границей растра — прозрачный 0. */
export const getColor = (image: RasterImage, x: number, y: number): number => {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 0

  const offset = getOffset(image, x, y)

  return (
    ((image.data[offset] << 24) |
      (image.data[offset + 1] << 16) |
      (image.data[offset + 2] << 8) |
      image.data[offset + 3]) >>>
    0
  )
}

/** Записывает цвет, упакованный `getColor`. */
export const setColor = (image: RasterImage, x: number, y: number, color: number): void => {
  const offset = getOffset(image, x, y)

  image.data[offset] = color >>> 24
  image.data[offset + 1] = (color >>> 16) & 0xff
  image.data[offset + 2] = (color >>> 8) & 0xff
  image.data[offset + 3] = color & 0xff
}

/** Непрозрачен ли пиксель; за границей растра — нет. */
export const isOpaque = (image: RasterImage, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < image.width && y < image.height && image.data[getOffset(image, x, y) + 3] > 0

/** Копирует непрозрачные пиксели `source` в `target` со сдвигом; пиксели за границей `target` отбрасываются. */
export const drawImage = (target: RasterImage, source: RasterImage, dx: number, dy: number): void => {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const tx = x + dx
      const ty = y + dy

      if (tx < 0 || ty < 0 || tx >= target.width || ty >= target.height || !isOpaque(source, x, y)) continue

      target.data.set(
        source.data.subarray(getOffset(source, x, y), getOffset(source, x, y) + 4),
        getOffset(target, tx, ty)
      )
    }
  }
}

/** Вырезает прямоугольник растра; прямоугольник лежит внутри растра. */
export const cropImage = (
  image: RasterImage,
  left: number,
  top: number,
  width: number,
  height: number
): RasterImage => {
  const result = createImage(width, height)

  for (let y = 0; y < height; y++) {
    const start = getOffset(image, left, top + y)

    result.data.set(image.data.subarray(start, start + width * 4), y * width * 4)
  }

  return result
}

/** Повторяет растр `columns` × `rows` раз. */
export const repeatImage = (image: RasterImage, columns: number, rows: number): RasterImage => {
  const result = createImage(image.width * columns, image.height * rows)

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      drawImage(result, image, column * image.width, row * image.height)
    }
  }

  return result
}

/** Увеличивает растр в целое число раз без сглаживания. */
export const scaleImage = (image: RasterImage, factor: number): RasterImage => {
  const result = createImage(image.width * factor, image.height * factor)

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      setColor(result, x, y, getColor(image, Math.floor(x / factor), Math.floor(y / factor)))
    }
  }

  return result
}
