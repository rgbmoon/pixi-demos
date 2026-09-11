import { inject, injectable } from 'inversify'
import type { DestroyOptions } from 'pixi.js'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { PALETTE } from 'src/core/palette'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import { HOLD_MS, SPIN_ICON_RATIO, STOP_ICON_RATIO, TURBO_ICON_RATIO } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ButtonSize, ButtonVariant, SpinButtonMode } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'

/**
 * Кнопка спина. Тап в покое объявляет `ui:spinRequested`, тап во вращении обычного режима —
 * `ui:stopRequested`. В турбо-режиме удержание дольше `HOLD_MS` зажимает спин в сторе и запускает
 * турбо-серию, отпускание её отпускает. Вид следует за режимом и фазой.
 */
@injectable()
export class SpinButtonController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly button: Button
  /** Отсчёт порога удержания: жив, пока кнопка нажата и серия ещё не началась. */
  private holdAbort?: AbortController
  /** Удержание уже запустило спин: tap, который придёт вслед за отпусканием, второй спин не просит. */
  private isTapSuppressed = false

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore
  ) {
    super()

    this.ticker = ticker
    this.emitter = emitter
    this.slotStore = slotStore

    this.button = new Button({
      variant: ButtonVariant.circle,
      size: ButtonSize.lg,
      icon: BUTTON_ICONS.spin,
      label: 'Spin',
      iconRatio: SPIN_ICON_RATIO,
      onTap: this.handleTap,
      onPress: this.handlePress,
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
  }

  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }

  override destroy(options?: DestroyOptions): void {
    this.holdAbort?.abort()

    super.destroy(options)
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
    if (this.isTapSuppressed) {
      this.isTapSuppressed = false

      return
    }

    this.emitter.emit(this.slotStore.canStop ? 'ui:stopRequested' : 'ui:spinRequested')
    this.emitter.emit('ui:buttonTapped')
  }

  private handlePress = (): void => {
    this.isTapSuppressed = false

    if (!this.slotStore.canHoldSpin) return

    const abort = new AbortController()

    this.holdAbort = abort

    void this.awaitHold(abort.signal)
  }

  private handleRelease = (inside: boolean): void => {
    this.holdAbort?.abort()
    this.holdAbort = undefined

    if (this.slotStore.isSpinHeld) this.slotStore.releaseSpin()

    // Отпущенная за пределами кнопка tap не порождает: проглатывать нечего
    if (!inside) this.isTapSuppressed = false
  }

  /** Ждёт порог удержания и, если кнопку не отпустили, зажимает спин и запускает серию. */
  private async awaitHold(signal: AbortSignal): Promise<void> {
    try {
      await this.ticker.waitTicks(HOLD_MS, signal)
    } catch {
      // waitTicks реджектится только отменой: кнопку отпустили раньше порога, это тап
      return
    }

    this.holdAbort = undefined
    this.slotStore.holdSpin()

    if (!this.slotStore.isSpinHeld) return

    this.isTapSuppressed = true
    this.emitter.emit('ui:spinRequested')
  }
}
