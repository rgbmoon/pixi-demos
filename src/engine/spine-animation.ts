import { Container } from 'pixi.js'

import type { SpinePool } from './spine-pool'
import type { SkeletonLike } from './types'

/**
 * База визуальных классов на скелете: держит скелет из пула и даёт методы работы с треками.
 * Сам по себе — контейнер сцены, поэтому владелец добавляет его как обычного ребёнка.
 */
export class SpineAnimation extends Container {
  protected spine: SkeletonLike | null = null

  private readonly pool: SpinePool
  private skeletonName: string | null = null

  constructor(pool: SpinePool) {
    super()

    this.pool = pool
  }

  /** Ставит скелет из пула; предыдущий возвращает туда же. Ассеты предзагружены. */
  protected attach(skeleton: string): void {
    if (this.destroyed) return

    if (this.spine && this.skeletonName) this.pool.release(this.skeletonName, this.spine)

    this.skeletonName = skeleton
    this.spine = this.pool.acquire(skeleton)

    this.addChild(this.spine)

    this.syncTicking()
  }

  /** Возвращает текущий скелет в пул: поза, собранная без Spine, скелет не занимает. */
  protected detach(): void {
    if (!this.spine || !this.skeletonName) return

    this.pool.release(this.skeletonName, this.spine)

    this.spine = null
    this.skeletonName = null
  }

  protected play(track: number, name: string, loop = true): void {
    this.spine?.state.setAnimation(track, name, loop)

    this.syncTicking()
  }

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

      // После назначения слушателя: у анимации нулевой длительности `complete` придёт из update(0)
      this.syncTicking()
    })
  }

  protected clearTrack(track: number, mixDuration = 0): void {
    this.spine?.state.setEmptyAnimation(track, mixDuration)

    this.syncTicking()
  }

  /**
   * Держит скелет на тикере, только пока есть что обновлять. Анимация нулевой длительности —
   * неподвижная поза: по ней Spine не пересчитывает ни кости, ни вершины, остаётся трансформ
   * контейнера.
   */
  private syncTicking(): void {
    const { spine } = this

    if (!spine) return

    // Новое состояние применяем сразу: снятый с тикера скелет сам больше не обновится
    spine.update(0)

    const { tracks } = spine.state

    for (let index = 0; index < tracks.length; index++) {
      const entry = tracks[index]

      if (entry !== null && ((entry.animation?.duration ?? 0) > 0 || entry.mixingFrom !== null)) {
        spine.autoUpdate = true

        return
      }
    }

    spine.autoUpdate = false
  }
}
