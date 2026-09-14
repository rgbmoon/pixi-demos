import { inject, injectable } from 'inversify'

import { BUTTON_ICONS } from '#src/assets'
import { SPIN_ICON_RATIO, STOP_ICON_RATIO, TURBO_ICON_RATIO } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { SpinButtonMode } from '#src/types'
import { SpinButton } from '#src/ui/hud/spin-button'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { PALETTE } from '@pixi-demos/core/palette'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Кнопка спина. Тап в покое объявляет `ui:spinRequested`, тап во вращении обычного режима —
 * `ui:stopRequested`. В турбо-режиме удержание зажимает спин в сторе и запускает турбо-серию,
 * отпускание её отпускает. Иконка и подпись следуют за режимом и фазой.
 */
@injectable()
export class SpinButtonController extends LiveContainer {
  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly button: SpinButton

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore
  ) {
    super()

    this.emitter = emitter
    this.slotStore = slotStore

    this.button = new SpinButton(ticker, {
      icon: BUTTON_ICONS.spin,
      label: 'Spin',
      iconRatio: SPIN_ICON_RATIO,
      onTap: this.handleTap,
      onHoldStart: this.handleHoldStart,
      onRelease: this.handleRelease,
    })

    this.addChild(this.button)

    this.watch(
      () => this.getMode(),
      (mode) => this.setMode(mode),
      { fireImmediately: true }
    )

    // Зажатая кнопка обязана остаться доступной: иначе она не услышит отпускание
    this.watch(
      () => slotStore.canSpin || slotStore.canStop || slotStore.isSpinHeld,
      (enabled) => this.button.setEnabled(enabled),
      { fireImmediately: true }
    )

    this.watch(
      () => slotStore.canHoldSpin,
      (enabled) => this.button.setHoldEnabled(enabled),
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }

  // Серия держит молнию и между спинами, пока идёт показ результата
  private getMode(): SpinButtonMode {
    if (this.slotStore.isTurboSeries) return SpinButtonMode.turbo

    if (!this.slotStore.isSpinning) return SpinButtonMode.spin

    return this.slotStore.isTurboEnabled ? SpinButtonMode.turbo : SpinButtonMode.stop
  }

  private setMode(mode: SpinButtonMode): void {
    switch (mode) {
      case SpinButtonMode.stop:
        this.button.setIcon(BUTTON_ICONS.stop, STOP_ICON_RATIO, PALETTE.red)
        this.button.setLabel('Stop')

        return
      case SpinButtonMode.turbo:
        this.button.setIcon(BUTTON_ICONS.turbo, TURBO_ICON_RATIO, PALETTE.cyan)
        this.button.setLabel('Turbo spin')

        return
      default:
        this.button.setIcon(BUTTON_ICONS.spin, SPIN_ICON_RATIO)
        this.button.setLabel('Spin')
    }
  }

  private handleTap = (): void => {
    this.emitter.emit(this.slotStore.canStop ? 'ui:stopRequested' : 'ui:spinRequested')
    this.emitter.emit('ui:buttonTapped')
  }

  /** Зажимает спин в сторе и запускает серию; стор отказывает, если удержание уже недоступно. */
  private handleHoldStart = (): boolean => {
    this.slotStore.holdSpin()

    if (!this.slotStore.isSpinHeld) return false

    this.emitter.emit('ui:spinRequested')

    return true
  }

  private handleRelease = (): void => {
    if (this.slotStore.isSpinHeld) this.slotStore.releaseSpin()
  }
}
