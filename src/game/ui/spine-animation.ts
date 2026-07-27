import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Container } from 'pixi.js'

export class SpineAnimation {
  readonly view = new Container()
  protected spine: Spine | null = null

  /** Синхронная сборка скелета из кэша Assets. Ассеты предзагружены. */
  protected attach(skeletonUrl: string, atlasUrl: string): void {
    if (this.view.destroyed) return

    this.spine?.destroy()
    this.spine = Spine.from({ skeleton: skeletonUrl, atlas: atlasUrl })

    this.view.addChild(this.spine)
  }

  protected play(track: number, name: string, loop = true): void {
    this.spine?.state.setAnimation(track, name, loop)
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
    })
  }

  protected clearTrack(track: number, mixDuration = 0): void {
    this.spine?.state.setEmptyAnimation(track, mixDuration)
  }
}
