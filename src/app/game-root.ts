import { type Container, inject, injectable } from 'inversify'
import { Application } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsController } from 'src/game/controllers/reels-controller'
import type { SpinButton } from 'src/game/controllers/spin-button'

/**
 * Хост жизненного цикла игры: создаёт PIXI-приложение, монтирует канвас в DOM-элемент,
 * собирает игровой граф из child-контейнера и разбирает всё при уходе со страницы.
 */
@injectable()
export class GameRoot {
  private readonly createGameContainer: (app: Application) => Container

  private app: Application | null = null
  private pending: Application | null = null
  private container: Container | null = null
  private reels: ReelsController | null = null
  private spinButton: SpinButton | null = null

  constructor(@inject(TOKENS.GameContainerFactory) createGameContainer: (app: Application) => Container) {
    this.createGameContainer = createGameContainer
  }

  private layout = () => {
    if (!this.app) {
      return
    }

    const { width, height } = this.app.screen

    this.reels?.layout(width, height)
    this.spinButton?.layout(width, height)
  }

  /**
   * Инициализирует PIXI-приложение внутри `container`, собирает игровой граф
   * и запускает автомат. Повторный вызов до завершения предыдущего игнорируется.
   */
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

    const di = this.createGameContainer(app)

    this.container = di

    const reels = di.get(TOKENS.ReelsController)
    const spinButton = di.get(TOKENS.SpinButton)

    app.stage.addChild(reels, spinButton)

    this.reels = reels
    this.spinButton = spinButton

    this.layout()
    app.renderer.on('resize', this.layout)

    const fsm = di.get(TOKENS.Fsm)

    void fsm.start()
  }

  /** Разбирает игру: останавливает автомат, уничтожает контроллеры и PIXI-приложение. Порядок шагов фиксирован. */
  unmount() {
    this.pending = null

    if (this.app) {
      this.app.renderer.off('resize', this.layout)
    }

    // Деактивации биндингов вызывают dispose/destroy; автомат гасится раньше контроллеров
    if (this.container) {
      this.container.unbind(TOKENS.Fsm)
      this.container.unbind(TOKENS.ReelsController)
      this.container.unbind(TOKENS.SpinButton)
      this.container = null
    }

    this.reels = null
    this.spinButton = null

    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }
}
