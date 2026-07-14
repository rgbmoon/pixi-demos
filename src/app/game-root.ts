import { Application } from 'pixi.js'
import { gameEmitter } from 'src/events/game-emitter'
import type { Fsm } from 'src/flow/fsm'
import { createGameFsm } from 'src/flow/helpers'
import { ReelsController } from 'src/game/controllers/reels-controller'
import { SpinButton } from 'src/game/controllers/spin-button'
import { spinStore } from 'src/stores/spin-store'

/**
 * Композиционный корень игры: единственное место, знающее про все слои сразу: PIXI-Application, контроллеры, автомат, сторы и тд.
 */
export class GameRoot {
  private app: Application | null = null
  private pending: Application | null = null
  private fsm: Fsm | null = null
  private reels: ReelsController | null = null
  private spinButton: SpinButton | null = null

  private layout = () => {
    if (!this.app) {
      return
    }

    const { width, height } = this.app.screen

    this.reels?.layout(width, height)
    this.spinButton?.layout(width, height)
  }

  async mount(container: HTMLElement) {
    if (this.pending) {
      return
    }

    const app = new Application()

    this.pending = app

    await app.init({
      background: '#475569',
      resizeTo: container,
    })

    if (this.pending !== app) {
      app.destroy(true, { children: true })

      return
    }

    container.appendChild(app.canvas)

    this.app = app

    const reels = new ReelsController(app.ticker, gameEmitter)
    const spinButton = new SpinButton(gameEmitter)

    app.stage.addChild(reels, spinButton)

    this.reels = reels
    this.spinButton = spinButton

    this.layout()
    app.renderer.on('resize', this.layout)

    const fsm = createGameFsm({
      context: { emitter: gameEmitter, ticker: app.ticker, reels },
      onPhaseChange: (phase) => spinStore.setPhase(phase),
      onError: (error) => spinStore.setFatalError(error),
    })

    this.fsm = fsm

    void fsm.start()
  }

  unmount() {
    this.pending = null

    this.fsm?.dispose()
    this.fsm = null

    if (this.app) {
      this.app.renderer.off('resize', this.layout)
    }

    this.reels?.destroy({ children: true })
    this.reels = null

    this.spinButton?.destroy({ children: true })
    this.spinButton = null

    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }
}
