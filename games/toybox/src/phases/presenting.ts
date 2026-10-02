import { inject, injectable } from 'inversify'

import { PRIZE_EJECT_HOLD_MS, PRIZE_OPEN_HOLD_MS, PRIZE_PAUSE_MS } from '#src/constants'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import type { FloorPile } from '#src/heap/floor-pile'
import type { Heap } from '#src/heap/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Показывает следующий приз из очереди: открывает дверцу, и игрушка выпадает на пол перед автоматом. Возвращает себя,
 * пока очередь не пуста.
 */
@injectable()
export class PresentingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.presenting

  private readonly ticker: GameTicker
  private readonly output: PrizeOutputController
  private readonly heap: Heap
  private readonly floorPile: FloorPile
  private readonly toyboxStore: ToyboxStore
  private readonly emitter: GameEmitter<GameEvents>

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.PrizeOutputController) output: PrizeOutputController,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap,
    @inject(TOYBOX_TOKENS.FloorPile) floorPile: FloorPile,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    this.ticker = ticker
    this.output = output
    this.heap = heap
    this.floorPile = floorPile
    this.toyboxStore = toyboxStore
    this.emitter = emitter
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.presenting | typeof PhaseName.returning> {
    const prize = this.heap.takePrize()

    if (!prize) throw new Error('Missing prize presentation')

    // Счёт растёт перед показом каждого приза: табло читает его в момент получения
    this.toyboxStore.recordCollection()
    this.output.show(prize)
    try {
      await this.ticker.waitTicks(PRIZE_PAUSE_MS, signal)
      // Шторка открывается с толчком: стопка под окном рассыпается и освобождает место призу
      this.floorPile.nudge(Math.random)
      await this.output.open(signal)
      await this.ticker.waitTicks(PRIZE_OPEN_HOLD_MS, signal)
      // Игрушка выпадает из окна: дальше её ведёт модель пола, табло узнаёт о получении в этот же момент
      this.output.eject()
      this.floorPile.drop(prize, Math.random)
      this.emitter.emit('prize:taken')
      await this.ticker.waitTicks(PRIZE_EJECT_HOLD_MS, signal)
      await this.output.close(signal)
    } finally {
      this.output.hide()
    }

    return this.heap.prizeCount > 0 ? PhaseName.presenting : PhaseName.returning
  }
}
