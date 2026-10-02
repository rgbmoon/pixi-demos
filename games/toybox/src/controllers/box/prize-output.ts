import { inject, injectable } from 'inversify'
import type { DestroyOptions } from 'pixi.js'

import type { ToyAppearance } from '#src/types'
import { PrizeOutput } from '#src/ui/box/prize-output'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Контроллер для окна выдача игрушки. Свзяывает View окна выдачи с тикером и предоставляет API для вызова в фазе FSM */
@injectable()
export class PrizeOutputController extends LiveContainer {
  private readonly view: PrizeOutput
  private readonly life = new AbortController()

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker) {
    super()
    this.view = new PrizeOutput(ticker)
    this.addChild(this.view)
    this.view.hide()
  }

  /** Показывает приз в тёмной нише за закрытой шторкой. */
  show(appearance: ToyAppearance): void {
    this.view.show(appearance)
  }

  /** Открывает шторку и зажигает свет в нише до конца или отмены. */
  async open(signal: AbortSignal): Promise<void> {
    await this.view.open(AbortSignal.any([signal, this.life.signal]))
  }

  /** Выводит реплику приза до конца или отмены. */
  async speak(speech: string, signal: AbortSignal): Promise<void> {
    await this.view.speak(speech, AbortSignal.any([signal, this.life.signal]))
  }

  /** Убирает приз из окна: игрушка выпала на пол, шторка остаётся открытой. */
  eject(): void {
    this.view.eject()
  }

  /** Закрывает шторку до конца или отмены. */
  async close(signal: AbortSignal): Promise<void> {
    await this.view.close(AbortSignal.any([signal, this.life.signal]))
  }

  /** Скрывает приз, гасит свет и закрывает шторку. */
  hide(): void {
    if (!this.destroyed) this.view.hide()
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.life.abort(createAbortError('Prize output destroyed'))
    super.destroy(options)
  }
}
