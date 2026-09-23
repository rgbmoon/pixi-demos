import type { Container } from 'inversify'

import type { GameModule } from '@pixi-demos/core/types'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

import { bindToybox } from './bindings'
import { TOYBOX_TOKENS } from './tokens'

/** У игры пока нет растровых ассетов для загрузки. */
const preload = async (): Promise<void> => {}

/**
 * Поднимает игру внутри элемента: граф собран, остаётся показать канвас и дождаться готовности —
 * её объявляет стартовая фаза автомата.
 */
const start = async (container: Container, element: HTMLElement, signal: AbortSignal): Promise<void> => {
  // Ожидание ставится до mount: стартовая фаза объявляет готовность уже внутри него
  const booted = container.get(TOYBOX_TOKENS.GameEmitter).waitFor('game:booted', { signal })

  await container.get(ENGINE_TOKENS.GameRoot).mount(element)
  await booted
}

/** Контракт toybox: единственный модуль пакета, который импортирует страница игры. */
export const toyboxGame: GameModule = {
  preload,
  bind: bindToybox,
  start,
}
