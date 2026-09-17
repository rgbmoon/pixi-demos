import type { Container } from 'inversify'

import { AudioSynth } from './audio/audio-synth'
import { GameRoot } from './game-root'
import { GameTicker } from './game-ticker'
import { SpinePool } from './spine-pool'
import { ENGINE_TOKENS } from './tokens'

/**
 * PIXI-рантайм игры: хост жизненного цикла и игровой тикер.
 * Пропорции макета приходят конфигом `CanvasConfig` от самой игры.
 */
export const bindEngine = (container: Container): void => {
  // Игровой тикер создаётся до PIXI-init (app.ticker появляется только внутри него);
  // GameRoot после init переводит на него рендер, и умирает он вместе с приложением
  container.bind(ENGINE_TOKENS.GameTicker).to(GameTicker)

  container
    .bind(ENGINE_TOKENS.GameRoot)
    .to(GameRoot)
    .onDeactivation((root) => root.unmount())
}

/**
 * Пул скелетов. Биндится игрой, которая рисует скелетами: состав и прогрев приходят
 * конфигом `SpinePoolConfig`.
 */
export const bindSpinePool = (container: Container): void => {
  container
    .bind(ENGINE_TOKENS.SpinePool)
    .to(SpinePool)
    .onDeactivation((pool) => pool.destroy())
}

/**
 * Синтезатор звука. Биндится игрой со звуком: громкость и категория аудиосессии приходят
 * конфигом `AudioConfig`.
 */
export const bindAudioSynth = (container: Container): void => {
  container
    .bind(ENGINE_TOKENS.AudioSynth)
    .to(AudioSynth)
    .onDeactivation((synth) => synth.destroy())
}
