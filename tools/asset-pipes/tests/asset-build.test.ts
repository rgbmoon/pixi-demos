import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AssetBuild } from '#src/asset-build'
import type { AtlasJson, Palette } from '#src/types'
import { cropImage, decodePng, encodePng } from '#src/utils/image'
import { indexPalette, parseHex } from '#src/utils/palette'

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
    // Полоса из трёх кадров 2×2 с общей опорной точкой; у каждого кадра свой цвет
    await writeFile(
      path.join(atlasDir, 'strip{strip=3}.png'),
      await encodePng(fromRows(['aabbcc', 'aabbcc'], NEAR_PALETTE))
    )
    await writeFile(path.join(atlasDir, 'strip.meta.json'), JSON.stringify({ pivot: { x: 1, y: 2 } }))

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
      frames: Record<string, { frame: { x: number; y: number } }>
    }
    const page = await decodePng(await readFile(path.join(publicDir, 'assets/sprites/icons.png')))
    const paletteColors = new Set(indexPalette(PALETTE).entries.map(({ rgb }) => [...rgb, 255].join(',')))

    expect(atlas.animations).toEqual({
      arrow: ['arrow-0.png', 'arrow-1.png', 'arrow-2.png', 'arrow-3.png'],
      dot: ['dot-0.png', 'dot-1.png'],
      strip: ['strip-0.png', 'strip-1.png', 'strip-2.png'],
    })
    expect(atlas.frames['dot-0.png']).toEqual({ frame: atlas.frames['dot-0.png'].frame, anchor: { x: 1 / 3, y: 1 } })
    expect(atlas.frames['dot-1.png'].anchor).toBeUndefined()
    expect([0, 1, 2, 3].map((frame) => atlas.frames[`arrow-${frame}.png`].anchor)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ])
    expect([0, 1, 2].map((frame) => atlas.frames[`strip-${frame}.png`].anchor)).toEqual([
      { x: 0.5, y: 1 },
      { x: 0.5, y: 1 },
      { x: 0.5, y: 1 },
    ])
    expect(
      [0, 1, 2].map((frame) => {
        const { x, y } = atlas.frames[`strip-${frame}.png`].frame

        return getVisibleColors(cropImage(page, x, y, 2, 2))
      })
    ).toEqual(
      [PALETTE.ramps.neon[0], PALETTE.ramps.neon[1], PALETTE.ramps.metal[0]].map((hex) =>
        Array<string>(4).fill([...parseHex(hex), 255].join(','))
      )
    )
    expect(getVisibleColors(page).every((color) => paletteColors.has(color))).toBe(true)
    expect(await readFile(path.join(publicDir, 'card.jpg'), 'utf8')).toBe('card')
  })

  it('собирает из одной папки шрифт на каждый стиль: PNG-глифы в цвете стиля, контур только у стиля с outline', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'asset-build-'))

    const fontDir = path.join(root, 'art/fonts/pixel{bmfont}')
    const outputDir = path.join(root, 'public/assets')

    await mkdir(fontDir, { recursive: true })
    await writeFile(path.join(fontDir, 'u0041.png'), await encodePng(fromRows(['#', '#'], { '#': '#ffffff' })))
    await writeFile(
      path.join(fontDir, 'font.json'),
      JSON.stringify({ styles: { glow: { color: '#f1219f', outline: '#41107a' }, plain: { color: '#2b2a44' } } })
    )

    await new AssetBuild({
      entry: path.join(root, 'art'),
      output: outputDir,
      cacheDir: path.join(root, 'cache'),
      palette: PALETTE,
      outlineColor: PALETTE.ramps.neon[2],
      logLevel: 'error',
    }).run()

    const readPage = async (face: string): Promise<string[]> =>
      getVisibleColors(await decodePng(await readFile(path.join(outputDir, `fonts/${face}.png`))))

    expect(new Set(await readPage('pixel-glow'))).toEqual(new Set(['241,33,159,255', '65,16,122,255']))
    expect(new Set(await readPage('pixel-plain'))).toEqual(new Set(['43,42,68,255']))
    expect(await readFile(path.join(outputDir, 'fonts/pixel-plain.fnt'), 'utf8')).toContain('face="pixel-plain"')
  })
})
