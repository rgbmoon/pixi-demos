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
}

beforeAll(() => {
  // trace-функции живут в DEV-режиме, а тесты идут именно в нём
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
