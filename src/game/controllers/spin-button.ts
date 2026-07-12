import { reaction } from 'mobx'
import { Container, type DestroyOptions, Graphics, Text } from 'pixi.js'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { spinStore } from 'src/stores/spin-store'

const BUTTON_WIDTH = 180
const BUTTON_HEIGHT = 56

export class SpinButton extends Container {
  private readonly emitter: GameEmitter<GameEvents>
  private readonly background: Graphics
  private readonly disposers: Array<() => void> = []

  constructor(emitter: GameEmitter<GameEvents>) {
    super()

    this.emitter = emitter

    this.background = new Graphics().roundRect(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 12).fill('#a98fc3')

    const label = new Text({
      text: 'SPIN',
      style: { fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', fill: '#1e293b' },
    })

    label.anchor.set(0.5)
    label.position.set(BUTTON_WIDTH / 2, BUTTON_HEIGHT / 2)

    this.addChild(this.background, label)

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.on('pointertap', this.handleTap)

    this.disposers.push(
      reaction(
        () => spinStore.canSpin,
        (canSpin) => this.setEnabled(canSpin),
        { fireImmediately: true }
      )
    )
  }

  private handleTap = () => {
    this.emitter.emit('ui:spinRequested', { bet: spinStore.bet })
  }

  private setEnabled(enabled: boolean) {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.background.alpha = enabled ? 1 : 0.4
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.position.set((screenWidth - BUTTON_WIDTH) / 2, screenHeight / 2 + BUTTON_HEIGHT)
  }

  override destroy(options?: DestroyOptions): void {
    this.off('pointertap', this.handleTap)

    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.length = 0

    super.destroy(options)
  }
}
