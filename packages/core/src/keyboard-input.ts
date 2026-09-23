import type {
  KeyboardChange,
  KeyboardListener,
  KeyboardSubscription,
  KeyboardSubscriptionOptions,
} from './types'

/**
 * Общий источник ввода с физической клавиатуры. Сервис хранит `KeyboardEvent.code`,
 * очищает зависшие клавиши при потере фокуса и не забирает ввод у HTML-контролов.
 */
export class KeyboardInput {
  private readonly target: Window
  private readonly pressed = new Set<KeyboardEvent['code']>()
  private readonly subscriptions = new Set<KeyboardSubscription>()

  constructor(target: Window) {
    this.target = target
    target.addEventListener('keydown', this.handleKeyDown)
    target.addEventListener('keyup', this.handleKeyUp)
    target.addEventListener('blur', this.handleBlur)
  }

  isPressed(code: KeyboardEvent['code']): boolean {
    return this.pressed.has(code)
  }

  listen(
    codes: readonly KeyboardEvent['code'][],
    listener: KeyboardListener,
    options: KeyboardSubscriptionOptions = {}
  ): () => void {
    const subscription: KeyboardSubscription = {
      codes: new Set(codes),
      listener,
      preventDefault: options.preventDefault ?? false,
    }

    this.subscriptions.add(subscription)

    return () => this.subscriptions.delete(subscription)
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target.closest('button, input, textarea, select, option, a[href], [contenteditable]:not([contenteditable="false"])') !== null
    )
  }

  private notify(change: KeyboardChange): void {
    for (const subscription of this.subscriptions) {
      if (subscription.codes.has(change.code)) {
        subscription.listener(change)
      }
    }
  }

  private shouldPreventDefault(code: KeyboardEvent['code']): boolean {
    for (const subscription of this.subscriptions) {
      if (subscription.preventDefault && subscription.codes.has(code)) {
        return true
      }
    }

    return false
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || this.isInteractiveTarget(event.target)) {
      return
    }

    if (this.shouldPreventDefault(event.code)) {
      event.preventDefault()
    }

    this.pressed.add(event.code)
    this.notify({ code: event.code, pressed: true, repeat: event.repeat })
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.pressed.has(event.code)) {
      return
    }

    if (this.shouldPreventDefault(event.code)) {
      event.preventDefault()
    }

    this.pressed.delete(event.code)
    this.notify({ code: event.code, pressed: false, repeat: false })
  }

  private handleBlur = (): void => {
    for (const code of [...this.pressed]) {
      this.pressed.delete(code)
      this.notify({ code, pressed: false, repeat: false })
    }
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown)
    this.target.removeEventListener('keyup', this.handleKeyUp)
    this.target.removeEventListener('blur', this.handleBlur)
    this.pressed.clear()
    this.subscriptions.clear()
  }
}
