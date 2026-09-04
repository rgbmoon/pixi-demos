import { inject, injectable } from 'inversify'
import { createStubSkeleton } from 'src/engine/skeleton/create-stub-skeleton'
import { ENGINE_TOKENS } from 'src/engine/tokens'

import type { GameTicker } from './game-ticker'
import type { SkeletonLike, SpinePoolConfig } from './types'

/**
 * Склад готовых скелетов по именам: единственное место в проекте, где скелеты
 * создаются и уничтожаются. Состав и прогрев приходят конфигом от игры.
 */
@injectable()
export class SpinePool {
  private readonly ticker: GameTicker
  private readonly config: SpinePoolConfig
  private readonly free = new Map<string, SkeletonLike[]>()

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(ENGINE_TOKENS.SpinePoolConfig) config: SpinePoolConfig
  ) {
    this.ticker = ticker
    this.config = config

    // Ассеты уже в кэше Assets: прогрев идёт синхронно вместе со сборкой графа
    for (const { skeleton, count } of config.warmUp) {
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
    const data = this.config.skeletons.get(skeleton)

    if (!data) {
      throw new Error(`SpinePool: no description for skeleton "${skeleton}"`)
    }

    // Spine-ассетов в репозитории нет, скелеты рисует стаб. Возврат на Spine —
    // правка этой строки на `Spine.from` с адресами `.json` и `.atlas` этого скелета
    return createStubSkeleton(data, this.ticker)
  }

  private instancesOf(skeleton: string): SkeletonLike[] {
    const instances = this.free.get(skeleton)

    if (instances) return instances

    const created: SkeletonLike[] = []

    this.free.set(skeleton, created)

    return created
  }
}
