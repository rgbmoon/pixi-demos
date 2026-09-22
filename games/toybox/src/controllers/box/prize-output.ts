import { inject, injectable } from 'inversify'
import type { DestroyOptions } from 'pixi.js'

import { PRIZE_DOOR_MS, PRIZE_OPEN_HOLD_MS, PRIZE_PAUSE_MS, PRIZE_TAKE_MS } from '#src/constants'
import type { GameEvents } from '#src/events'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { PrizePresentationRequest, ToyAppearance } from '#src/types'
import { PrizeOutput } from '#src/ui/box/prize-output'
import { tweenProgress } from '#src/utils/motion'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Последовательно проигрывает выдачи через одно окно и один объект игрушки. */
@injectable()
export class PrizeOutputController extends LiveContainer {
  private readonly view = new PrizeOutput()
  private readonly queue: PrizePresentationRequest[] = []
  private readonly life = new AbortController()
  private readonly ticker: GameTicker
  private readonly emitter: GameEmitter<GameEvents>
  private running = false

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()
    this.ticker = ticker
    this.emitter = emitter
    this.addChild(this.view)
  }

  present(appearance: ToyAppearance, collected: number): Promise<void> {
    if (this.life.signal.aborted) return Promise.reject(this.life.signal.reason as Error)

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ appearance, collected, resolve, reject })
      void this.drain()
    })
  }

  private async drain(): Promise<void> {
    if (this.running) return

    this.running = true

    while (this.queue.length > 0 && !this.life.signal.aborted) {
      const request = this.queue.shift() as PrizePresentationRequest

      try {
        await this.play(request)
        request.resolve()
      } catch (error) {
        if (!this.view.destroyed) this.view.hide()
        request.reject(error)
      }
    }

    this.running = false
  }

  // TODO это кажется должно быть разбито на отдельные методы, а само проигрывание вызываться в соответствующей фазе игры
  private async play({ appearance, collected }: PrizePresentationRequest): Promise<void> {
    const { signal } = this.life

    this.view.show(appearance)
    await this.ticker.waitTicks(PRIZE_PAUSE_MS, signal)
    await tweenProgress(
      this.ticker,
      { durationMs: PRIZE_DOOR_MS, apply: (value) => this.view.setDoorProgress(value) },
      signal
    )
    await this.ticker.waitTicks(PRIZE_OPEN_HOLD_MS, signal)
    await tweenProgress(
      this.ticker,
      { durationMs: PRIZE_TAKE_MS, apply: (value) => this.view.setTakeProgress(value) },
      signal
    )
    this.emitter.emit('prize:taken', { collected })
    await tweenProgress(
      this.ticker,
      { durationMs: PRIZE_DOOR_MS, apply: (value) => this.view.setDoorProgress(1 - value) },
      signal
    )
    this.view.hide()
  }

  override destroy(options?: DestroyOptions): void {
    const reason = createAbortError('Prize output destroyed')

    this.life.abort(reason)

    for (const request of this.queue.splice(0)) request.reject(reason)

    super.destroy(options)
  }
}
