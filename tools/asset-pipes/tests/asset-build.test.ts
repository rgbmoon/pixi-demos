import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AssetBuild } from '#src/asset-build'
import type { AtlasJson, Palette } from '#src/types'
import { decodePng, encodePng } from '#src/utils/image'
import { indexPalette } from '#src/utils/palette'

import { fromRows, getVisibleColors } from './setup/raster'

const PALETTE: Palette = {
  ramps: {
    neon: ['#41107a', '#a50e7b', '#f97f96'],
    metal: ['#2b2a44', '#746b91', '#f0cdef'],
  },
}

/** Цвета рядом с цветами палитры: такие приходят из генерации. */
const NEAR_PALETTE = { a: '#43127c', b: '#a30c79', c: '#2d2c46' }

let root = ''

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('сборка ассетов', () => {
  it('собирает атлас в цветах палитры с опорными точками кадров и оставляет соседние файлы каталога выхода', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'asset-build-'))

    const atlasDir = path.join(root, 'art/sprites/icons{tps}{pal}')
    const publicDir = path.join(root, 'public')

    await mkdir(atlasDir, { recursive: true })
    await mkdir(publicDir)
    await writeFile(path.join(publicDir, 'card.jpg'), 'card')
    await writeFile(path.join(atlasDir, 'dot-0.png'), await encodePng(fromRows(['.a.', 'aba', '.a.'], NEAR_PALETTE)))
    await writeFile(path.join(atlasDir, 'dot-1.png'), await encodePng(fromRows(['bab', 'a.a', 'bab'], NEAR_PALETTE)))
    await writeFile(path.join(atlasDir, 'dot-0.meta.json'), JSON.stringify({ pivot: { x: 1, y: 3 } }))
    // Кадры поворота вокруг левого верхнего угла: опорная точка обходит углы кадра
    await writeFile(path.join(atlasDir, 'arrow{rot=4}.png'), await encodePng(fromRows(['abca', 'cbac'], NEAR_PALETTE)))
    await writeFile(path.join(atlasDir, 'arrow.meta.json'), JSON.stringify({ pivot: { x: 0, y: 0 } }))

    await new AssetBuild({
      entry: path.join(root, 'art'),
      output: path.join(publicDir, 'assets'),
      cacheDir: path.join(root, 'cache'),
      palette: PALETTE,
      outlineColor: PALETTE.ramps.neon[2],
      logLevel: 'error',
    }).run()

    const atlas = JSON.parse(await readFile(path.join(publicDir, 'assets/sprites/icons.json'), 'utf8')) as AtlasJson & {
      animations: Record<string, string[]>
    }
    const page = await decodePng(await readFile(path.join(publicDir, 'assets/sprites/icons.png')))
    const paletteColors = new Set(indexPalette(PALETTE).entries.map(({ rgb }) => [...rgb, 255].join(',')))

    expect(atlas.animations).toEqual({
      arrow: ['arrow-0.png', 'arrow-1.png', 'arrow-2.png', 'arrow-3.png'],
      dot: ['dot-0.png', 'dot-1.png'],
    })
    expect(atlas.frames['dot-0.png'].anchor).toEqual({ x: 1 / 3, y: 1 })
    expect(atlas.frames['dot-1.png'].anchor).toBeUndefined()
    expect([0, 1, 2, 3].map((frame) => atlas.frames[`arrow-${frame}.png`].anchor)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ])
    expect(getVisibleColors(page).every((color) => paletteColors.has(color))).toBe(true)
    expect(await readFile(path.join(publicDir, 'card.jpg'), 'utf8')).toBe('card')
  })
})
