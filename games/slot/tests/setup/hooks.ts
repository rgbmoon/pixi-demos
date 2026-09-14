import { configure } from 'mobx'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { server } from './msw-server'

// Как в проде: мутация вне экшена — ошибка, иначе тест мягче боевого рантайма
configure({ enforceActions: 'always' })

// Хуки общие для всех тестов, а браузерное окружение есть не у каждого — отсюда проверка на window
if (typeof window !== 'undefined') {
  // Композиция игры тянет PIXI, а он щупает канвас на импорте; контекста в jsdom нет и не нужно
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

  // jsdom не реализует matchMedia, а на неё смотрит проверка prefers-reduced-motion
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
  server.listen({ onUnhandledRequest: 'error' })
  // trace-функции живут в DEV-режиме, а тесты идут именно в нём
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
