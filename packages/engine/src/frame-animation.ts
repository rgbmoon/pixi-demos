import { Container, type DestroyOptions, type Sprite, type Texture, type Ticker, type TilingSprite } from 'pixi.js'

import { isReducedMotion } from '@pixi-demos/core/accessibility'

import type { GameTicker } from './game-ticker'
import type { FrameSequence } from './types'

/**
 * База классов покадровых анимаций: меняет текстуру спрайта по кадрам последовательности на игровом тикере.
 */
export class FrameAnimation<TCarrier extends Sprite | TilingSprite = Sprite> extends Container {
  /** Спрайт, которому база меняет текстуру. */
  protected readonly carrier: TCarrier
  protected readonly ticker: GameTicker

  private playback: FrameSequence | null = null
  private isLooped = false
  /** Время от начала последовательности, у цикла — от начала текущего круга. */
  private elapsedMs = 0
  private durationMs = 0
  private resolvePlayOnce: (() => void) | null = null

  constructor(ticker: GameTicker, carrier: TCarrier) {
    super()

    this.ticker = ticker
    this.carrier = carrier

    this.addChild(carrier)
  }

  override destroy(options?: DestroyOptions): void {
    this.stop()

    super.destroy(options)
  }

  /** Ставит неподвижный кадр последовательности. */
  protected showFrame(sequence: FrameSequence, frame: number): void {
    this.stop()
    this.applyFrame(sequence.frames[frame])
  }

  /** Крутит последовательность по кругу с первого кадра; при уменьшенном движении показывает первый кадр. */
  protected play(sequence: FrameSequence): void {
    if (isReducedMotion()) {
      this.showFrame(sequence, 0)

      return
    }

    this.startPlayback(sequence, true)
  }

  /**
   * Проигрывает последовательность один раз: промис резолвится в конце последнего кадра, кадр остаётся на экране.
   * Реджектится по `signal`. При уменьшенном движении сразу ставит последний кадр.
   */
  protected playOnce(sequence: FrameSequence, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      // Уничтоженная анимация не подписывается на тикер, поэтому её промис резолвится сразу
      if (isReducedMotion() || this.destroyed) {
        this.showFrame(sequence, sequence.frames.length - 1)
        resolve()

        return
      }

      const handleAbort = () => {
        this.resolvePlayOnce = null
        this.stop()
        reject(signal?.reason as Error)
      }

      this.startPlayback(sequence, false)

      signal?.addEventListener('abort', handleAbort, { once: true })

      // Промис, прерванный новым вызовом, `stop` или `destroy`, резолвится: ждущая его фаза не зависает
      this.resolvePlayOnce = () => {
        signal?.removeEventListener('abort', handleAbort)
        resolve()
      }
    })
  }

  /** Останавливает анимацию на текущем кадре. */
  protected stop(): void {
    this.ticker.remove(this.tick)
    this.playback = null

    const { resolvePlayOnce } = this

    this.resolvePlayOnce = null
    resolvePlayOnce?.()
  }

  private startPlayback(sequence: FrameSequence, isLooped: boolean): void {
    this.stop()

    if (this.destroyed) return

    const { frames, durations } = sequence

    // Число кадров задаёт атлас, число длительностей — константы игры: после пересборки атласа они могут не совпасть
    if (frames.length === 0 || frames.length !== durations.length) {
      throw new Error(`Frame sequence has ${frames.length} frames and ${durations.length} durations`)
    }

    this.playback = sequence
    this.isLooped = isLooped
    this.elapsedMs = 0
    this.durationMs = durations.reduce((sum, ms) => sum + ms, 0)

    this.applyFrame(frames[0])
    this.ticker.add(this.tick)
  }

  private tick = (ticker: Ticker): void => {
    const { playback } = this

    if (!playback) return

    this.elapsedMs += ticker.deltaMS

    if (this.elapsedMs >= this.durationMs) {
      if (!this.isLooped) {
        this.applyFrame(playback.frames.at(-1))
        this.stop()

        return
      }

      this.elapsedMs %= this.durationMs
    }

    this.applyFrame(playback.frames[this.getFrameIndex(playback.durations)])
  }

  /** Индекс кадра, который идёт в момент `elapsedMs`. */
  private getFrameIndex(durations: readonly number[]): number {
    let endMs = 0

    for (let index = 0; index < durations.length; index++) {
      endMs += durations[index]

      if (this.elapsedMs < endMs) return index
    }

    return durations.length - 1
  }

  private applyFrame(texture: Texture | undefined): void {
    if (!texture || this.destroyed) return

    this.carrier.texture = texture

    // Sprite читает якорь текстуры только в конструкторе, а у кадров одной последовательности якоря бывают разные
    if (texture.defaultAnchor) this.carrier.anchor.copyFrom(texture.defaultAnchor)
  }
}
