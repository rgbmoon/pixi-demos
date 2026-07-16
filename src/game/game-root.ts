import { inject, injectable } from 'inversify'
import { Application } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { Fsm } from 'src/flow/fsm'
import type { GameTicker } from 'src/game/game-ticker'
import type { GameScene } from 'src/game/scenes/game-scene'

/**
 * Хост жизненного цикла игры: инициализирует PIXI-приложение, монтирует канвас в DOM,
 * показывает сцену и запускает автомат; при уходе со страницы уничтожает PIXI-мир.
 */
@injectable()
export class GameRoot {
  private readonly ticker: GameTicker
  private readonly scene: GameScene
  private readonly fsm: Fsm

  private app: Application | null = null
  private pending: Application | null = null

  constructor(
    @inject(TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOKENS.GameScene) scene: GameScene,
    @inject(TOKENS.Fsm) fsm: Fsm
  ) {
    this.ticker = ticker
    this.scene = scene
    this.fsm = fsm
  }

  private layout = () => {
    if (!this.app) {
      return
    }

    const { width, height } = this.app.screen

    this.scene.layout(width, height)
  }

  /**
   * Инициализирует PIXI-приложение внутри `container`, показывает сцену и запускает автомат.
   * Повторный вызов до завершения предыдущего игнорируется.
   */
  async mount(container: HTMLElement) {
    if (this.pending) {
      return
    }

    const app = new Application()

    this.pending = app

    // autoStart: false — свой тикер приложение не запускает
    await app.init({
      autoStart: false,
      background: '#475569',
      resizeTo: container,
    })

    if (this.pending !== app) {
      app.destroy(true, { children: true })

      return
    }

    // Устанавлиаем внешний тикер, далее им владеет PIXI
    app.ticker = this.ticker
    this.ticker.start()

    container.appendChild(app.canvas)

    this.app = app

    app.stage.addChild(this.scene)

    this.layout()
    app.renderer.on('resize', this.layout)

    void this.fsm.start()
  }

  /**
   * Уничтожает PIXI-приложение вместе со сценой, тикером и канвасом. Вызывается деактивацией
   * биндинга последним шагом destroyGameContainer — автомат и контроллеры уже погашены.
   */
  unmount() {
    this.pending = null

    if (this.app) {
      this.app.renderer.off('resize', this.layout)
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }
}
