import { inject, injectable } from 'inversify'
import { type DestroyOptions, Sprite } from 'pixi.js'

import { HUD_SEQUENCES } from '#src/assets'
import {
  ART_PIXEL,
  KEYBOARD_CANCEL_CODES,
  KEYBOARD_CONFIRM_CODES,
  RESET_BUTTON_LABEL,
  RESET_CONFIRM_TAIL,
  RESET_HINT_LIFT,
} from '#src/constants'
import type { GameEvents } from '#src/events'
import type { Heap } from '#src/heap/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { ResetButton } from '#src/ui/hud/reset-button'
import { ResetConfirm } from '#src/ui/hud/reset-confirm'
import { TourHint } from '#src/ui/hud/tour-hint'
import { createAbortError, isAbortError, notifyError } from '@pixi-demos/core/errors/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { KeyboardInput } from '@pixi-demos/core/keyboard-input'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { KeyboardChange } from '@pixi-demos/core/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Кнопка сброса кучи: доступна только в покое и открывает диалог подтверждения; о подтверждённом сбросе сообщает
 * наверх событием. Когда в кубе не осталось игрушек, над кнопкой мигает стрелка.
 */
@injectable()
export class ResetButtonController extends LiveContainer {
  private readonly button: ResetButton
  private readonly dialog: ResetConfirm
  private readonly hint: TourHint
  private readonly life = new AbortController()
  private readonly stopListening: () => void
  private readonly toyboxStore: ToyboxStore
  private readonly heap: Heap
  private readonly emitter: GameEmitter<GameEvents>
  /** Клавиша диалога, нажатая при открытом диалоге: кнопка срабатывает при её отпускании. */
  private heldCode: string | undefined

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap,
    @inject(CORE_TOKENS.KeyboardInput) keyboard: KeyboardInput,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.toyboxStore = toyboxStore
    this.heap = heap
    this.emitter = emitter
    this.button = new ResetButton({
      label: RESET_BUTTON_LABEL,
      // Повторное нажатие закрывает открытый диалог
      onTap: () => (toyboxStore.isResetConfirmOpen ? toyboxStore.closeResetConfirm() : toyboxStore.openResetConfirm()),
    })
    this.dialog = new ResetConfirm(ticker, {
      onConfirm: () => this.confirm(),
      onCancel: () => toyboxStore.closeResetConfirm(),
    })
    this.dialog.position.set(RESET_CONFIRM_TAIL.x * ART_PIXEL, RESET_CONFIRM_TAIL.y * ART_PIXEL)

    const arrow = new Sprite()

    arrow.scale.set(ART_PIXEL)
    this.hint = new TourHint(ticker, arrow, HUD_SEQUENCES.tourDrop)
    this.hint.position.set(0, -RESET_HINT_LIFT * ART_PIXEL)

    this.addChild(this.button, this.hint, this.dialog)

    this.stopListening = keyboard.listen(
      [...KEYBOARD_CONFIRM_CODES, ...KEYBOARD_CANCEL_CODES],
      (change) => this.handleKey(change),
      { preventDefault: true }
    )

    this.watch(
      () => toyboxStore.canReset,
      (enabled) => this.button.setEnabled(enabled),
      { fireImmediately: true }
    )
    this.watch(
      () => toyboxStore.isResetConfirmOpen,
      (open) => {
        this.heldCode = undefined

        if (open) void this.openDialog()
        else this.dialog.close()
      }
    )
    // Куча меняется только вне покоя и при сбросе, поэтому стрелку достаточно сверять на этих переходах
    this.watch(
      () => toyboxStore.canDrop,
      () => this.showHint(),
      { fireImmediately: true }
    )
    this.listen(emitter, 'heap:reset', () => this.showHint())
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.life.abort(createAbortError('Reset button destroyed'))
    this.stopListening()
    super.destroy(options)
  }

  private async openDialog(): Promise<void> {
    try {
      await this.dialog.open(this.life.signal)
    } catch (error) {
      if (!isAbortError(error)) notifyError(error)
    }
  }

  private confirm(): void {
    this.toyboxStore.closeResetConfirm()
    this.emitter.emit('ui:resetRequested')
  }

  /** Клавиши нажимают кнопки диалога: кнопка срабатывает при отпускании, как при отпускании указателя. */
  private handleKey({ code, pressed, repeat }: KeyboardChange): void {
    if (!this.toyboxStore.isResetConfirmOpen || repeat) return

    const isConfirm = (KEYBOARD_CONFIRM_CODES as readonly string[]).includes(code)
    const button = isConfirm ? this.dialog.confirm : this.dialog.cancel

    if (pressed) {
      this.heldCode = code
      button.setPressed(true)

      return
    }

    // Клавиша, зажатая до открытия диалога, его не закрывает
    if (code !== this.heldCode) return

    this.heldCode = undefined
    button.setPressed(false)

    if (isConfirm) this.confirm()
    else this.toyboxStore.closeResetConfirm()
  }

  /** Стрелка к кнопке сброса видна, пока управление доступно, а куча в кубе пуста. */
  private showHint(): void {
    this.hint.setShown(this.toyboxStore.canDrop && this.heap.toyCount === 0)
  }
}
