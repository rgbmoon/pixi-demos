import { configure } from 'mobx'
import { beforeAll, vi } from 'vitest'

// Как в проде: мутация вне экшена — ошибка, иначе тест мягче боевого рантайма
configure({ enforceActions: 'always' })

// Хуки общие для всех тестов, а браузерное окружение есть не у каждого — отсюда проверка на window
if (typeof window !== 'undefined') {
  // Композиция игры тянет PIXI, а он щупает канвас на импорте; контекста в jsdom нет и не нужно
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
}

beforeAll(() => {
  // trace-функции живут в DEV-режиме, а тесты идут именно в нём
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
