import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import type { ClawRig } from '#src/claw/claw-rig'
import { CLAW_PRIORITY } from '#src/constants'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { Cart } from '#src/ui/box/cart'
import { Claw } from '#src/ui/box/claw'
import { Rope } from '#src/ui/box/rope'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Продвигает модель клешни на игровом тикере перед шагом модели кучи и ставит каретку, трос и клешню в её точки. */
@injectable()
export class ClawController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly toyboxStore: ToyboxStore
  private readonly rig: ClawRig
  private readonly cart = new Cart()
  private readonly rope = new Rope()
  private readonly claw = new Claw()

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.ClawRig) rig: ClawRig
  ) {
    super()

    this.ticker = ticker
    this.toyboxStore = toyboxStore
    this.rig = rig

    this.addChild(this.rope, this.cart, this.claw)
    this.render()

    this.ticker.add(this.step, undefined, CLAW_PRIORITY)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)

    super.destroy(options)
  }

  private step = (ticker: Ticker): void => {
    this.rig.advance(ticker.deltaMS, this.toyboxStore.direction)
    this.render()
  }

  /**
   * Переносит положение на экран: каретка стоит над своей точкой верхней грани, клешня висит под ней
   * с отклонением маятника, трос их соединяет. Порядок наложения узла выставляет слой содержимого.
   */
  private render(): void {
    const visible = this.rig.getGripPoint()
    const mount = this.rig.getCartPoint()

    this.cart.setWorld(mount)
    this.rope.setSpan(mount, visible)
    this.claw.setWorld(visible)
  }
}
