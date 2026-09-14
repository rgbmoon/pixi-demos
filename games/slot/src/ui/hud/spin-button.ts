import { Container, type DestroyOptions } from 'pixi.js'

import { HOLD_MS } from '#src/constants'
import { ButtonSize, ButtonVariant, type SpinButtonOptions } from '#src/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { Button } from './button'

/**
 * Кнопка спина: распознаёт тап и удержание дольше `HOLD_MS`. Удержание распознаётся, только пока оно
 * включено `setHoldEnabled`; тап, пришедший вслед за принятым удержанием, не объявляется.
 */
export class SpinButton extends Container {
  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  readonly sizeUnits: number

  private readonly ticker: GameTicker
  private readonly button: Button
  private readonly options: SpinButtonOptions
  private isHoldEnabled = false
  /** Отсчёт порога удержания: жив, пока кнопка нажата и удержание ещё не распознано. */
  private holdAbort?: AbortController
  /** Удержание принято: тап, который придёт вслед за отпусканием, не объявляется. */
  private isTapSuppressed = false

  constructor(ticker: GameTicker, options: SpinButtonOptions) {
    super()

    this.ticker = ticker
    this.options = options
    this.button = new Button({
      variant: ButtonVariant.circle,
      size: ButtonSize.lg,
      icon: options.icon,
      label: options.label,
      iconRatio: options.iconRatio,
      onTap: this.handleTap,
      onPress: this.handlePress,
      onRelease: this.handleRelease,
    })
    this.sizeUnits = this.button.sizeUnits

    this.addChild(this.button)
  }

  override destroy(options?: DestroyOptions): void {
    this.holdAbort?.abort()

    super.destroy(options)
  }

  /** Включает распознавание удержания; выключенное удержание оставляет долгое нажатие тапом. */
  setHoldEnabled(enabled: boolean): void {
    this.isHoldEnabled = enabled
  }

  setEnabled(enabled: boolean): void {
    this.button.setEnabled(enabled)
  }

  setIcon(src: string, iconRatio?: number, tint?: string): void {
    this.button.setIcon(src, iconRatio, tint)
  }

  setLabel(label: string): void {
    this.button.setLabel(label)
  }

  private handleTap = (): void => {
    if (this.isTapSuppressed) {
      this.isTapSuppressed = false

      return
    }

    this.options.onTap()
  }

  private handlePress = (): void => {
    this.isTapSuppressed = false

    if (!this.isHoldEnabled) return

    const abort = new AbortController()

    this.holdAbort = abort

    void this.awaitHold(abort.signal)
  }

  private handleRelease = (inside: boolean): void => {
    this.holdAbort?.abort()
    this.holdAbort = undefined

    this.options.onRelease()

    // Отпущенная за пределами кнопка tap не порождает: проглатывать нечего
    if (!inside) this.isTapSuppressed = false
  }

  /** Ждёт порог удержания и, если кнопку не отпустили, объявляет удержание. */
  private async awaitHold(signal: AbortSignal): Promise<void> {
    try {
      await this.ticker.waitTicks(HOLD_MS, signal)
    } catch {
      // waitTicks реджектится только отменой: кнопку отпустили раньше порога, это тап
      return
    }

    this.holdAbort = undefined

    if (this.options.onHoldStart()) this.isTapSuppressed = true
  }
}
