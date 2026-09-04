import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { createStubSkeleton } from 'src/mocks/skeleton/create-stub-skeleton'

import { SPINE_WARM_UP } from './constants'
import type { GameTicker } from './game-ticker'
import type { SkeletonLike } from './types'

/**
 * Склад готовых скелетов по именам: единственное место в проекте, где скелеты
 * создаются и уничтожаются. Прогревается в конструкторе по `SPINE_WARM_UP`.
 */
@injectable()
export class SpinePool {
  private readonly ticker: GameTicker
  private readonly free = new Map<string, SkeletonLike[]>()

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker) {
    this.ticker = ticker

    // Ассеты уже в кэше Assets: прогрев идёт синхронно вместе со сборкой графа
    for (const { skeleton, count } of SPINE_WARM_UP) {
      const instances = this.instancesOf(skeleton)

      for (let i = 0; i < count; i++) {
        instances.push(this.create(skeleton))
      }
    }
  }

  /** Скелет, готовый к показу: свободный из пула либо новый. */
  acquire(skeleton: string): SkeletonLike {
    const spine = this.instancesOf(skeleton).pop() ?? this.create(skeleton)

    spine.autoUpdate = true

    return spine
  }

  /** Возвращает скелет в пул: снимает со сцены и с тикера, сбрасывает позу, треки и слот-объекты. */
  release(skeleton: string, spine: SkeletonLike): void {
    if (spine.destroyed) return

    spine.removeFromParent()
    spine.autoUpdate = false
    // Владелец мог вписывать скелет в ячейку: без сброса трансформ достанется следующему
    spine.position.set(0, 0)
    spine.scale.set(1)
    // Без сброса слот-объектов следующий владелец получит вставленные предыдущим контейнеры
    spine.removeSlotObjects()
    spine.state.clearTracks()
    spine.skeleton.setToSetupPose()

    this.instancesOf(skeleton).push(spine)
  }

  /** Уничтожает свободные скелеты; занятые уничтожает каскад destroy их владельцев. */
  destroy(): void {
    for (const instances of this.free.values()) {
      for (const spine of instances) {
        if (!spine.destroyed) spine.destroy()
      }
    }

    this.free.clear()
  }

  private create(skeleton: string): SkeletonLike {
    // Spine-ассетов в репозитории нет, скелеты рисует стаб из mocks/. Возврат на Spine —
    // правка этой строки на `Spine.from` с адресами `.json` и `.atlas` этого скелета
    return createStubSkeleton(skeleton, this.ticker)
  }

  private instancesOf(skeleton: string): SkeletonLike[] {
    const instances = this.free.get(skeleton)

    if (instances) return instances

    const created: SkeletonLike[] = []

    this.free.set(skeleton, created)

    return created
  }
}
