import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { configure } from 'mobx'
import { beforeAll, vi } from 'vitest'

// Как в проде: мутация вне экшена — ошибка, иначе тест мягче боевого рантайма
configure({ enforceActions: 'always' })

// Хуки общие для всех тестов, а браузерное окружение есть не у каждого — отсюда проверка на window
if (typeof window !== 'undefined') {
  // PIXI запрашивает контекст канваса при импорте; модельные тесты не используют этот контекст
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

  // jsdom не реализует matchMedia, а её читает isReducedMotion: без заглушки движение не проверить
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia

  // Текст сцены выводят пиксельные шрифты игры. Без них BitmapText строит шрифт на канвасе, которого в jsdom нет;
  // метрики берутся из собранных BMFont, страница шрифта тесту не нужна
  const { BitmapFont, Cache, Texture, bitmapFontTextParser } = await import('pixi.js')
  const { FONT_FAMILIES } = await import('#src/assets')

  for (const family of Object.values(FONT_FAMILIES)) {
    const fnt = await readFile(
      path.join(import.meta.dirname, `../../../../web/public/games/toybox/assets/fonts/${family}.fnt`)
    )
    const data = bitmapFontTextParser.parse(fnt.toString('utf8'))

    Cache.set(`${family}-bitmap`, new BitmapFont({ data, textures: [Texture.WHITE] }))
  }
}

beforeAll(() => {
  // trace-функции живут в DEV-режиме, а тесты идут именно в нём
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
