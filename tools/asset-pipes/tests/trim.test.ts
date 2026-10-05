import { describe, expect, it } from 'vitest'

import { createImage, trimImage } from '#src/utils/image'

import { fromRows, toRows } from './setup/raster'

const LEGEND = { '#': '#6e7c40' }

describe('пайп trim', () => {
  it('обрезает поля до рамки непрозрачных пикселей и отдаёт угол рамки в исходном растре', () => {
    const { image, offset } = trimImage(fromRows(['......', '..#...', '.##.#.', '......', '......'], LEGEND))

    expect(toRows(image, LEGEND)).toEqual(['.#..', '##.#'])
    expect(offset).toEqual({ x: 1, y: 1 })
  })

  it('не обрезает прозрачный растр', () => {
    const empty = createImage(3, 2)

    expect(trimImage(empty)).toEqual({ image: empty, offset: { x: 0, y: 0 } })
  })
})
