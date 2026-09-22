import type { DestroyOptions } from 'pixi.js'

import { KEYBOARD_ARROW_CODES, KEYBOARD_DROP_CODES } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { KeyboardInput } from '@pixi-demos/core/keyboard-input'
import type { KeyboardChange } from '@pixi-demos/core/types'
import { LiveContainer } from '@pixi-demos/engine/live-container'

// TODO точно нужен этот контроллер? Кажется сервис клавиатуры можно просто подключить к ClawController
/** Связывает физическую клавиатуру с экранными направлениями клешни и запросом Drop. */
export class KeyboardController extends LiveContainer {
  private readonly stopListening: () => void
  private readonly keyboard: KeyboardInput
  private readonly claw: ClawController
  private readonly toyboxStore: ToyboxStore

  constructor(
    keyboard: KeyboardInput,
    claw: ClawController,
    toyboxStore: ToyboxStore,
    emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.keyboard = keyboard
    this.claw = claw
    this.toyboxStore = toyboxStore

    this.stopListening = keyboard.listen(
      [...KEYBOARD_ARROW_CODES, ...KEYBOARD_DROP_CODES],
      (change) => this.handle(change, emitter),
      { preventDefault: true }
    )

    this.watch(
      () => toyboxStore.canDrop,
      () => this.applyDirection(),
      { fireImmediately: true }
    )
  }

  private handle(change: KeyboardChange, emitter: GameEmitter<GameEvents>): void {
    if ((KEYBOARD_DROP_CODES as readonly string[]).includes(change.code)) {
      if (change.pressed && !change.repeat && this.toyboxStore.canDrop) emitter.emit('ui:dropRequested')

      return
    }

    this.applyDirection()
  }

  private applyDirection(): void {
    if (!this.toyboxStore.canDrop) {
      this.claw.setDirection({ x: 0, y: 0 })

      return
    }

    const x = Number(this.keyboard.isPressed('ArrowRight')) - Number(this.keyboard.isPressed('ArrowLeft'))
    const y = Number(this.keyboard.isPressed('ArrowDown')) - Number(this.keyboard.isPressed('ArrowUp'))
    const length = Math.hypot(x, y)

    this.claw.setDirection(length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length })
  }

  override destroy(options?: DestroyOptions): void {
    this.stopListening()
    this.claw.setDirection({ x: 0, y: 0 })
    super.destroy(options)
  }
}
