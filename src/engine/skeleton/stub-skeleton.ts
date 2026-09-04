import { Assets, Sprite } from 'pixi.js'

import type { StubAnimationData, StubSkeletonData } from './types'
import { applyProperty, applySetupPose, sampleKeys } from './utils'

/**
 * Поза стаб-скелета: спрайты слотов из данных и запись в них значений клипа.
 * Все слоты отцентрованы (`anchor` 0.5) — origin скелета совпадает с центром арта.
 */
export class StubSkeleton {
  /** Спрайты слотов в порядке отрисовки: их добавляет к себе владелец. */
  readonly slots: Sprite[] = []

  private readonly data: StubSkeletonData
  private readonly byName = new Map<string, Sprite>()

  constructor(data: StubSkeletonData) {
    this.data = data

    for (const slot of data.slots) {
      // Текстуры уже в кэше: манифест грузит их до сборки графа
      const sprite = new Sprite(Assets.get(slot.texture))

      sprite.anchor.set(0.5)
      sprite.label = slot.name

      this.slots.push(sprite)
      this.byName.set(slot.name, sprite)
    }

    this.setToSetupPose()
  }

  /** Возвращает все слоты в позу из данных. */
  setToSetupPose(): void {
    for (const slot of this.data.slots) {
      const sprite = this.byName.get(slot.name)

      if (sprite) applySetupPose(sprite, slot)
    }
  }

  /** Накладывает клип на текущую позу: по дорожке на свойство слота. */
  applyAnimation(animation: StubAnimationData, time: number): void {
    for (const timeline of animation.timelines) {
      const sprite = this.byName.get(timeline.slot)

      if (!sprite) continue

      applyProperty(sprite, timeline.property, sampleKeys(timeline.keys, time, timeline.property === 'visible'))
    }
  }
}
