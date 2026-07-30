import { SymbolKey } from 'src/types/game'

import { SYMBOL_ASSETS } from '../assets'
import { SpineAnimation } from '../ui/spine-animation'

const TRACK_MAIN = 0

export class SymbolAnimation extends SpineAnimation {
  private key: SymbolKey | null = null

  private get isScatter(): boolean {
    return this.key === SymbolKey.S
  }

  setKey(key: SymbolKey): void {
    if (key === this.key) return

    this.key = key

    this.attach(SYMBOL_ASSETS[key])
  }

  blur(): void {
    this.play(TRACK_MAIN, 'blur')
  }

  idle(): void {
    this.play(TRACK_MAIN, this.isScatter ? 'idle_1' : 'idle')
  }

  win(): void {
    this.play(TRACK_MAIN, this.isScatter ? 'win_1' : 'win')
  }

  /** Скаттер: простой с надписью free games. У остальных символов ничего не делает. */
  idleFreeGames(): void {
    if (!this.isScatter) return

    this.play(TRACK_MAIN, 'idle_2')
  }

  /** Скаттер: переход во free games один раз, дальше — `winFreeGamesLoop`. У остальных символов ничего не делает. */
  winToFreeGames(signal?: AbortSignal): Promise<void> {
    if (!this.isScatter) return Promise.resolve()

    return this.playOnce(TRACK_MAIN, 'win_2', signal)
  }

  /** Скаттер: циклическая выигрышная анимация во free games. У остальных символов ничего не делает. */
  winFreeGamesLoop(): void {
    if (!this.isScatter) return

    this.play(TRACK_MAIN, 'win_3')
  }
}
