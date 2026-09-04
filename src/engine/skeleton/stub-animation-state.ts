import type { StubSkeleton } from './stub-skeleton'
import { StubTrackEntry } from './stub-track-entry'
import type { StubAnimationData } from './types'

/**
 * Треки стаб-скелета: повторяет `AnimationState` в объёме, который использует `SpineAnimation`.
 * Микса нет — новая анимация встаёт мгновенно, `mixDuration` игнорируется.
 */
export class StubAnimationState {
  readonly tracks: (StubTrackEntry | null)[] = []

  private readonly animations: Readonly<Record<string, StubAnimationData>>

  constructor(animations: Readonly<Record<string, StubAnimationData>>) {
    this.animations = animations
  }

  /** Ставит клип на трек; неизвестное имя — ошибка данных. */
  setAnimation(trackIndex: number, animationName: string, loop = true): StubTrackEntry {
    const animation = this.animations[animationName]

    if (!animation) {
      throw new Error(`Stub skeleton: no animation "${animationName}"`)
    }

    return this.replace(trackIndex, new StubTrackEntry(animation, loop))
  }

  /** Пустая анимация: запись на треке остаётся, но клипа у неё нет — поза возвращается к setup. */
  setEmptyAnimation(trackIndex: number, _mixDuration = 0): StubTrackEntry {
    return this.replace(trackIndex, new StubTrackEntry(null, false))
  }

  /** Снимает все треки: записи получают `dispose`, список пустеет. */
  clearTracks(): void {
    for (const entry of this.tracks) {
      entry?.dispose()
    }

    this.tracks.length = 0
  }

  /** Двигает время всех треков. */
  update(deltaSeconds: number): void {
    for (const entry of this.tracks) {
      entry?.advance(deltaSeconds)
    }
  }

  /** Накладывает клипы активных треков на позу скелета, от нижнего трека к верхнему. */
  apply(skeleton: StubSkeleton): void {
    for (const entry of this.tracks) {
      if (entry?.animation) skeleton.applyAnimation(entry.animation, entry.trackTime)
    }
  }

  private replace(trackIndex: number, entry: StubTrackEntry): StubTrackEntry {
    const previous = this.tracks[trackIndex] ?? null

    // Пропуски между треками остаются null: SpineAnimation обходит tracks по индексам
    for (let index = this.tracks.length; index < trackIndex; index++) {
      this.tracks[index] = null
    }

    this.tracks[trackIndex] = entry
    previous?.dispose()

    return entry
  }
}
