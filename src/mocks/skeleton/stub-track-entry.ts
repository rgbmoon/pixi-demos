import type { StubAnimationData, StubTrackListener } from './types'

/**
 * Запись трека стаба: повторяет `TrackEntry` в объёме, который читает `SpineAnimation`.
 * Микса нет, поэтому `mixingFrom` всегда `null`.
 */
export class StubTrackEntry {
  readonly animation: StubAnimationData | null
  readonly mixingFrom = null
  listener: StubTrackListener | null = null
  /** Время внутри клипа, секунды: для петли завёрнуто, иначе ограничено длительностью. */
  trackTime = 0

  private readonly loop: boolean
  private completed = false

  constructor(animation: StubAnimationData | null, loop: boolean) {
    this.animation = animation
    this.loop = loop
  }

  /** Двигает время трека и объявляет `complete` на конце клипа; у неподвижной позы — один раз. */
  advance(deltaSeconds: number): void {
    const duration = this.animation?.duration ?? 0

    this.trackTime += deltaSeconds

    if (duration <= 0) {
      this.complete()

      return
    }

    if (this.trackTime < duration) return

    if (this.loop) {
      this.trackTime %= duration
      this.listener?.complete?.()

      return
    }

    this.trackTime = duration
    this.complete()
  }

  /** Снимает запись с трека: перезаписанный трек не должен вешать промис владельца. */
  dispose(): void {
    this.listener?.dispose?.()
  }

  private complete(): void {
    if (this.completed) return

    this.completed = true
    this.listener?.complete?.()
  }
}
