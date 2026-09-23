import type { DestroyOptions } from 'pixi.js'

import { RESET_MS, WELCOME_MS } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { Marquee } from '#src/ui/box/marquee'
import { createAbortError, isAbortError, notifyError } from '@pixi-demos/core/errors/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Управляет временными сообщениями табло и визуальным моментом обновления счётчика. */
export class MarqueeController extends LiveContainer {
  private readonly view = new Marquee()
  private readonly life = new AbortController()
  private readonly ticker: GameTicker
  private readonly toyboxStore: ToyboxStore
  private revision = 0

  constructor(ticker: GameTicker, toyboxStore: ToyboxStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.ticker = ticker
    this.toyboxStore = toyboxStore

    this.addChild(this.view)
    this.listen(emitter, 'game:booted', () => void this.showTemporary('WELCOME', WELCOME_MS))
    this.listen(emitter, 'heap:reset', () => void this.showTemporary('RESET', RESET_MS))
    this.listen(emitter, 'prize:taken', () => {
      this.revision += 1
      this.showCount()
    })
  }

  /** Текст, который табло показывает сейчас. */
  getMessage(): string {
    return this.view.getMessage()
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.life.abort(createAbortError('Marquee destroyed'))
    super.destroy(options)
  }

  /** Показывает сообщение на `durationMs`; более позднее сообщение или получение приза отменяют возврат к счёту. */
  private async showTemporary(message: string, durationMs: number): Promise<void> {
    this.revision += 1

    const { revision } = this

    this.view.setMessage(message)

    try {
      await this.ticker.waitTicks(durationMs, this.life.signal)

      if (revision === this.revision) this.showCount()
    } catch (error) {
      if (!isAbortError(error)) notifyError(error)
    }
  }

  private showCount(): void {
    this.view.setMessage(`TOYS ${this.toyboxStore.collected}`)
  }
}
