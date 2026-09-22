import type { DestroyOptions } from 'pixi.js'

import { RESET_MS, WELCOME_MS } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { Marquee } from '#src/ui/box/marquee'
import { isAbortError, notifyError } from '@pixi-demos/core/errors/utils'
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
    this.listen(emitter, 'game:booted', () => this.startMessage('WELCOME', WELCOME_MS))
    this.listen(emitter, 'heap:reset', () => this.startMessage('RESET', RESET_MS))
    this.listen(emitter, 'prize:taken', ({ collected }) => {
      this.revision += 1
      this.view.setMessage(`TOYS ${collected}`)
    })
  }

  private startMessage(message: string, durationMs: number): void {
    void this.showTemporary(message, durationMs)
  }

  private async showTemporary(message: string, durationMs: number): Promise<void> {
    this.revision += 1

    const { revision } = this

    this.view.setMessage(message)

    try {
      await this.ticker.waitTicks(durationMs, this.life.signal)

      if (revision === this.revision) this.view.setMessage(`TOYS ${this.toyboxStore.collected}`)
    } catch (error) {
      if (!isAbortError(error)) notifyError(error)
    }
  }

  getMessage(): string {
    return this.view.getMessage()
  }

  override destroy(options?: DestroyOptions): void {
    this.life.abort(new DOMException('Marquee destroyed', 'AbortError'))
    super.destroy(options)
  }
}
