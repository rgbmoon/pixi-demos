import { inject, injectable } from 'inversify'
import { Application } from 'pixi.js'

import type { GameTicker } from '#src/game-ticker'
import { ENGINE_TOKENS } from '#src/tokens'
import type { CanvasConfig, SceneLike } from '#src/types'
import { notifyFatal } from '@pixi-demos/core/errors/utils'
import type { Fsm } from '@pixi-demos/core/fsm/fsm'
import { PALETTE } from '@pixi-demos/core/palette'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'

import { MAX_RESOLUTION } from './constants'
import { connectDevtools, getCanvasSize } from './utils'

/**
 * Хост жизненного цикла игры: инициализирует PIXI-приложение, монтирует канвас в DOM,
 * показывает сцену и запускает автомат; при уходе со страницы уничтожает PIXI-мир.
 */
@injectable()
export class GameRoot {
  private readonly ticker: GameTicker
  private readonly scene: SceneLike
  private readonly fsm: Fsm
  private readonly canvasConfig: CanvasConfig

  private app: Application | null = null
  private pending: Application | null = null
  private resizeObserver: ResizeObserver | null = null

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(ENGINE_TOKENS.Scene) scene: SceneLike,
    @inject(CORE_TOKENS.Fsm) fsm: Fsm,
    @inject(ENGINE_TOKENS.CanvasConfig) canvasConfig: CanvasConfig
  ) {
    this.ticker = ticker
    this.scene = scene
    this.fsm = fsm
    this.canvasConfig = canvasConfig
  }

  private layout() {
    if (!this.app) {
      return
    }

    const { width, height } = this.app.screen

    this.scene.layout(width, height)
  }

  /**
   * Приводит канвас к текущему размеру контейнера и пересчитывает раскладку сцены.
   * Нулевой и неизменившийся размер пропускаются: `renderer.resize` пересоздаёт буфер.
   */
  private resize(container: HTMLElement) {
    if (!this.app) {
      return
    }

    const { width, height } = getCanvasSize(container.clientWidth, container.clientHeight, this.canvasConfig)

    if (this.canvasConfig.designSize) {
      this.setCanvasDisplaySize(width, height)

      return
    }

    if (width <= 0 || height <= 0 || (width === this.app.screen.width && height === this.app.screen.height)) {
      return
    }

    this.app.renderer.resize(width, height)

    this.layout()
  }

  // Потеря контекста останавливает отрисовку насовсем: восстановление сцены не реализовано, показываем оверлей
  private handleContextLost = () => {
    this.ticker.stop()

    notifyFatal(new Error('WebGL context lost'), 'Rendering has stopped, please reload the page')
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

    // Стартовый размер; последующие изменения отслеживает ResizeObserver контейнера
    const displaySize = getCanvasSize(container.clientWidth, container.clientHeight, this.canvasConfig)
    const renderSize = this.canvasConfig.designSize ?? displaySize

    try {
      // autoStart: false — свой тикер приложение не запускает
      await app.init({
        autoStart: false,
        background: PALETTE.background,
        width: renderSize.width,
        height: renderSize.height,
        resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
        autoDensity: true,
        antialias: this.canvasConfig.antialias,
        roundPixels: this.canvasConfig.roundPixels,
      })
    } catch (error) {
      // Без сброса pending повторный mount молча ничего не сделает
      if (this.pending === app) {
        this.pending = null
      }

      throw error
    }

    if (this.pending !== app) {
      app.destroy(true, { children: true })

      return
    }

    // Устанавлиаем внешний тикер, далее им владеет PIXI
    app.ticker = this.ticker
    this.ticker.start()

    container.appendChild(app.canvas)
    this.setCanvasDisplaySize(displaySize.width, displaySize.height, app)
    app.canvas.addEventListener('webglcontextlost', this.handleContextLost)
    app.renderer.accessibility.setAccessibilityEnabled(true)

    this.app = app

    void connectDevtools(app)

    app.stage.addChild(this.scene)

    this.layout()

    // observe вызывает колбэк сразу, с уже установленным размером: проверка в resize его отсечёт
    this.resizeObserver = new ResizeObserver(() => this.resize(container))
    this.resizeObserver.observe(container)

    void this.fsm.start()
  }

  // TODO проверить что эта правка не аффектит вторую игру и что она вообще необходима и не может быть написана на уровне самой игры, если она требуется только одной игре
  /** Меняет только CSS-размер: логическая система координат фиксированного макета остаётся неизменной. */
  private setCanvasDisplaySize(width: number, height: number, app = this.app): void {
    if (!app || !this.canvasConfig.designSize || width <= 0 || height <= 0) {
      return
    }

    app.canvas.style.width = `${width}px`
    app.canvas.style.height = `${height}px`

    if (this.canvasConfig.pixelated) {
      app.canvas.style.imageRendering = 'pixelated'
    }
  }

  /**
   * Уничтожает PIXI-приложение вместе со сценой, тикером и канвасом. Вызывается деактивацией
   * биндинга последним шагом destroyGameContainer — автомат и контроллеры уже погашены.
   */
  unmount() {
    this.pending = null

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.app) {
      void connectDevtools(null)

      this.app.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }
}
