import { makeAutoObservable } from 'mobx'
import { Application, type Ticker } from 'pixi.js'

class GameRoot {
  private app: Application | null = null
  private pending: Application | null = null

  constructor() {
    // Тяжёлые PIXI-поля исключаем из наблюдения — observable оборачивает только
    // будущее игровое состояние, но не сам Application.
    makeAutoObservable<this, 'app' | 'pending'>(this, {
      app: false,
      pending: false,
    })
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

    // За время `await` эффект мог размонтироваться (StrictMode / уход со страницы) —
    // тогда `pending` уже другой или null. Этот app лишний: уничтожаем и выходим.
    if (this.pending !== app) {
      app.destroy(true, { children: true })

      return
    }

    container.appendChild(app.canvas)

    this.app = app

    app.ticker.add(this.gameLoop)
  }

  unmount() {
    this.pending = null

    if (this.app) {
      this.app.ticker.remove(this.gameLoop)
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }

  private gameLoop = (_ticker: Ticker) => {}
}

export const gameRoot = new GameRoot()
