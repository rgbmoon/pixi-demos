import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Assets, Container, type Ticker } from 'pixi.js'

import type { GameTicker } from '../game-ticker'

/** База Spine-анимаций: грузит скелет с атласом, гоняет Spine от игрового тикера, оборачивает треки промисами. */
export class SpineAnimation {
  readonly view = new Container()

  protected spine: Spine | null = null

  private readonly ticker: GameTicker

  // Spine.update принимает секунды; autoUpdate выключен — иначе Spine подписался бы на Ticker.shared и шёл в свёрнутой вкладке
  private readonly tick = (ticker: Ticker) => this.spine?.update(ticker.deltaMS / 1000)

  constructor(ticker: GameTicker) {
    this.ticker = ticker
  }

  /** Грузит скелет и атлас, создаёт Spine-инстанс и подключает его к игровому тикеру. */
  protected async load(skeletonUrl: string, atlasUrl: string): Promise<void> {
    await Assets.load([skeletonUrl, atlasUrl])

    if (this.view.destroyed) return

    this.spine = Spine.from({ skeleton: skeletonUrl, atlas: atlasUrl, autoUpdate: false })
    this.view.addChild(this.spine)

    this.ticker.add(this.tick)
    // при разборке всего приложения тикер умирает раньше сцены — снимать колбэк уже не с чего
    this.view.once('destroyed', () => {
      if (!this.ticker.destroyed) this.ticker.remove(this.tick)
    })

    this.onLoaded()
  }

  /** Хук наследника: вызывается после создания Spine-инстанса. */
  protected onLoaded(): void {}

  /** Запускает анимацию на треке; до окончания загрузки — no-op. */
  protected play(track: number, name: string, loop = true): void {
    this.spine?.state.setAnimation(track, name, loop)
  }

  /** Проигрывает анимацию один раз; промис резолвится по завершении, отменяется через `signal`. */
  protected playOnce(track: number, name: string, signal?: AbortSignal): Promise<void> {
    const { spine } = this

    if (!spine) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      const settle = (finish: () => void) => {
        signal?.removeEventListener('abort', handleAbort)

        finish()
      }

      const handleAbort = () => {
        spine.state.setEmptyAnimation(track, 0)
        settle(() => reject(signal?.reason as Error))
      }

      const entry = spine.state.setAnimation(track, name, false)

      // dispose тоже резолвит: перезаписанный другим вызовом трек не должен вешать промис фазы
      entry.listener = { complete: () => settle(resolve), dispose: () => settle(resolve) }

      signal?.addEventListener('abort', handleAbort, { once: true })
    })
  }

  /** Снимает анимацию с трека, смешивая к setup-позе за `mixDuration` секунд. */
  protected clearTrack(track: number, mixDuration = 0): void {
    this.spine?.state.setEmptyAnimation(track, mixDuration)
  }
}
