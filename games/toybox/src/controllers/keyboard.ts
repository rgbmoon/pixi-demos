import type { DestroyOptions } from 'pixi.js'

import { KEYBOARD_ARROW_CODES, KEYBOARD_DROP_CODES } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { KeyboardInput } from '@pixi-demos/core/keyboard-input'
import type { KeyboardChange } from '@pixi-demos/core/types'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Связывает физическую клавиатуру с экранными направлениями клешни и запросом Drop. */
export class KeyboardController extends LiveContainer {
  private readonly stopListening: () => void
  private readonly keyboard: KeyboardInput
  private readonly toyboxStore: ToyboxStore

  constructor(keyboard: KeyboardInput, toyboxStore: ToyboxStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.keyboard = keyboard
    this.toyboxStore = toyboxStore

    this.stopListening = keyboard.listen(
      [...KEYBOARD_ARROW_CODES, ...KEYBOARD_DROP_CODES],
      (change) => this.handle(change, emitter),
      { preventDefault: true }
    )
  }

  private handle(change: KeyboardChange, emitter: GameEmitter<GameEvents>): void {
    if ((KEYBOARD_DROP_CODES as readonly string[]).includes(change.code)) {
      if (change.pressed && !change.repeat && this.toyboxStore.canDrop) emitter.emit('ui:dropRequested')

      return
    }

    this.applyDirection()
  }

  /** Передаёт в стор направление зажатых стрелок; вне покоя стор возвращает нулевую команду сам. */
  private applyDirection(): void {
    const x = Number(this.keyboard.isPressed('ArrowRight')) - Number(this.keyboard.isPressed('ArrowLeft'))
    const y = Number(this.keyboard.isPressed('ArrowDown')) - Number(this.keyboard.isPressed('ArrowUp'))
    const length = Math.hypot(x, y)

    this.toyboxStore.setKeyboardDirection(length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length })
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.stopListening()
    super.destroy(options)
  }
}
