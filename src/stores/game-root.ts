import { makeAutoObservable } from 'mobx'
import { Application, type Ticker } from 'pixi.js'
import {
  fetchBalance,
  pingServer,
  sendDeposit,
  subscribeTicks,
  type Balance,
  type Pong,
  type Tick,
} from 'src/api/root-api'
import { AsyncStream } from 'src/utils/async-stream'
import { AsyncValue } from 'src/utils/async-value'

class GameRoot {
  private app: Application | null = null
  private pending: Application | null = null

  balance = new AsyncValue<Balance>()
  pong = new AsyncValue<Pong>()
  tick = new AsyncStream<Tick>()

  constructor() {
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

  // TODO выпилить примеры loadBalance deposit ping connect disconnect

  // Фетч: результат кладётся в balance.value, статус ведёт сам AsyncValue.
  loadBalance() {
    return this.balance.run(fetchBalance)
  }

  // Мутация: тот же .run, просто другой сетевой вызов; ответ обновляет balance.value.
  deposit(amount: number) {
    return this.balance.run(() => sendDeposit(amount))
  }

  // hello-world: ping → pong (pong.value.message === 'hello world').
  ping() {
    return this.pong.run(pingServer)
  }

  // Подписка на WS-поток tick: значения капают в tick.value до disconnect().
  connect() {
    this.tick.start(subscribeTicks)
  }

  disconnect() {
    this.tick.stop()
  }
}

export const gameRoot = new GameRoot()
