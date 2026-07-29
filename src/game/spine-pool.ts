import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'

import { SPINE_WARM_UP, type SpineAsset } from './assets'
import type { GameTicker } from './game-ticker'

/**
 * Склад готовых `Spine` по ассетам: единственное место в проекте, где скелеты
 * создаются и уничтожаются. Прогревается в конструкторе по `SPINE_WARM_UP`.
 */
@injectable()
export class SpinePool {
  private readonly ticker: GameTicker
  private readonly free = new Map<SpineAsset, Spine[]>()

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker) {
    this.ticker = ticker

    // Ассеты уже в кэше Assets: прогрев идёт синхронно вместе со сборкой графа
    for (const { asset, count } of SPINE_WARM_UP) {
      const instances = this.instancesOf(asset)

      for (let i = 0; i < count; i++) {
        instances.push(this.create(asset))
      }
    }
  }

  /** Скелет, готовый к показу: свободный из пула либо новый. */
  acquire(asset: SpineAsset): Spine {
    const spine = this.instancesOf(asset).pop() ?? this.create(asset)

    spine.autoUpdate = true

    return spine
  }

  /** Возвращает скелет в пул: снимает со сцены и с тикера, сбрасывает позу, треки и слот-объекты. */
  release(asset: SpineAsset, spine: Spine): void {
    if (spine.destroyed) return

    spine.removeFromParent()
    spine.autoUpdate = false
    // Без сброса слот-объектов следующий владелец получит вставленные предыдущим контейнеры
    spine.removeSlotObjects()
    spine.state.clearTracks()
    spine.skeleton.setToSetupPose()

    this.instancesOf(asset).push(spine)
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

  private create(asset: SpineAsset): Spine {
    // autoUpdate выключен: пока скелет лежит в пуле, тикать ему незачем
    return Spine.from({
      skeleton: asset.skeletonUrl,
      atlas: asset.atlasUrl,
      autoUpdate: false,
      ticker: this.ticker,
    })
  }

  private instancesOf(asset: SpineAsset): Spine[] {
    const instances = this.free.get(asset)

    if (instances) return instances

    const created: Spine[] = []

    this.free.set(asset, created)

    return created
  }
}
