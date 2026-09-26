import type { RasterImage } from '#src/types'
import { createImage, getOffset } from '#src/utils/image'
import { parseHex } from '#src/utils/palette'

/** Растр из строк-схем: символ — пиксель, `.` — прозрачный пиксель, остальные символы — цвета легенды. */
export const fromRows = (rows: readonly string[], legend: Readonly<Record<string, string>>): RasterImage => {
  const image = createImage(rows[0]?.length ?? 0, rows.length)

  rows.forEach((row, y) => {
    Array.from(row).forEach((symbol, x) => {
      if (symbol !== '.') image.data.set([...parseHex(legend[symbol]), 255], getOffset(image, x, y))
    })
  })

  return image
}

/** Строки-схемы растра по легенде: прозрачный пиксель — `.`, цвет вне легенды — `?`. */
export const toRows = (image: RasterImage, legend: Readonly<Record<string, string>>): string[] => {
  const symbols = new Map(Object.entries(legend).map(([symbol, hex]) => [parseHex(hex).join(','), symbol]))

  return Array.from({ length: image.height }, (_, y) =>
    Array.from({ length: image.width }, (_, x) => {
      const offset = getOffset(image, x, y)

      if (image.data[offset + 3] === 0) return '.'

      return symbols.get(Array.from(image.data.subarray(offset, offset + 3)).join(',')) ?? '?'
    }).join('')
  )
}

/** Цвета непрозрачных пикселей в формате `r,g,b,a`. */
export const getVisibleColors = (image: RasterImage): string[] => {
  const colors: string[] = []

  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] > 0) colors.push(Array.from(image.data.subarray(offset, offset + 4)).join(','))
  }

  return colors
}
