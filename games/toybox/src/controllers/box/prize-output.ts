import { inject, injectable } from 'inversify'
import type { DestroyOptions } from 'pixi.js'

import { PRIZE_DOOR_MS, PRIZE_TAKE_MS } from '#src/constants'
import type { ToyAppearance } from '#src/types'
import { PrizeOutput } from '#src/ui/box/prize-output'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'
import { tweenProgress } from '@pixi-demos/engine/utils'

/** Контроллер для окна выдача игрушки. Свзяывает View окна выдачи с тикером и предоставляет API для вызова в фазе FSM */
@injectable()
export class PrizeOutputController extends LiveContainer {
  private readonly view = new PrizeOutput()
  private readonly life = new AbortController()
  private readonly ticker: GameTicker

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker) {
    super()
    this.ticker = ticker
    this.addChild(this.view)
    this.view.hide()
  }

  /** Показывает приз за закрытой дверцей. */
  show(appearance: ToyAppearance): void {
    this.view.show(appearance)
  }

  /** Открывает дверцу до конца или отмены. */
  async open(signal: AbortSignal): Promise<void> {
    await tweenProgress(
      this.ticker,
      { durationMs: PRIZE_DOOR_MS, apply: (value) => this.view.setDoorProgress(value) },
      AbortSignal.any([signal, this.life.signal])
    )
  }

  /** Проигрывает визуальное получение приза. */
  async take(signal: AbortSignal): Promise<void> {
    await tweenProgress(
      this.ticker,
      { durationMs: PRIZE_TAKE_MS, apply: (value) => this.view.setTakeProgress(value) },
      AbortSignal.any([signal, this.life.signal])
    )
  }

  /** Закрывает дверцу до конца или отмены. */
  async close(signal: AbortSignal): Promise<void> {
    await tweenProgress(
      this.ticker,
      { durationMs: PRIZE_DOOR_MS, apply: (value) => this.view.setDoorProgress(1 - value) },
      AbortSignal.any([signal, this.life.signal])
    )
  }

  /** Скрывает приз и возвращает дверцу в исходное состояние. */
  hide(): void {
    if (!this.destroyed) this.view.hide()
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.life.abort(createAbortError('Prize output destroyed'))
    super.destroy(options)
  }
}
