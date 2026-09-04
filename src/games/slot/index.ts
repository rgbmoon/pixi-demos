import type { Container } from 'inversify'
import type { GameModule } from 'src/core/types'
import { ENGINE_TOKENS } from 'src/engine/tokens'

import { preloadGameAssets } from './assets'
import { bindSlot } from './bindings'
import { SLOT_TOKENS } from './tokens'

/**
 * Поднимает игру внутри элемента: ассеты уже в кэше, граф собран, остаётся показать канвас
 * и дождаться данных раунда — их грузит стартовая фаза автомата.
 */
const start = async (container: Container, element: HTMLElement, signal: AbortSignal): Promise<void> => {
  // Ожидание ставится до mount: стартовая фаза объявляет готовность уже внутри него
  const booted = container.get(SLOT_TOKENS.GameEmitter).waitFor('game:booted', { signal })

  await container.get(ENGINE_TOKENS.GameRoot).mount(element)
  await booted
}

/** Контракт слота: всё, что страница знает об игре. */
export const slotGame: GameModule = {
  preload: preloadGameAssets,
  bind: bindSlot,
  start,
}
