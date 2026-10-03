import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import { TOY_TWITCH_SEED } from '#src/constants'
import type { FloorPile } from '#src/heap/floor-pile'
import type { ToyBody } from '#src/heap/types'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { ToyId } from '#src/types'
import { DepthLayer } from '#src/ui/box/depth-layer'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { getToyDepthItem } from '#src/utils/depth'
import { worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Выигранные игрушки на полу перед автоматом. Каждый кадр контроллер продвигает модель пола, переносит позы игрушек в
 * View-компоненты и сортирует их слой. Игрушки на полу время от времени дёргаются.
 */
@injectable()
export class FloorPileController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly pile: FloorPile
  private readonly layer = new DepthLayer()
  private readonly shapes = new ToyShapes()
  private readonly toys = new Map<ToyId, Toy>()
  private readonly seen = new Set<ToyId>()
  /** Генератор пауз между тиками: тики не тратят `Math.random` игры. */
  private readonly random = createRandom(TOY_TWITCH_SEED)

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.FloorPile) pile: FloorPile
  ) {
    super()

    this.ticker = ticker
    this.pile = pile

    this.addChild(this.layer)
    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)
    this.toys.clear()

    super.destroy(options)
    // Общие контексты геометрии уничтожаются после игрушек, которые на них ссылаются
    this.shapes.destroy()
  }

  /** Кадр пола: шаг модели, позы View-компонентов и порядок наложения. */
  private step = (ticker: Ticker): void => {
    this.pile.advance(ticker.deltaMS)
    this.syncToys()
    this.layer.sort()
  }

  /** Переносит позы игрушек в View-компоненты: появившиеся создаёт, ушедшие с пола уничтожает. */
  private syncToys(): void {
    this.seen.clear()

    for (const body of this.pile.getBodies()) {
      const toy = this.toys.get(body.id) ?? this.addToy(body)
      const { point, angle } = body.pose

      this.seen.add(body.id)
      toy.setPose(point, angle)
      this.layer.place(toy, worldToScreen(point), getAngleStep(angle), () =>
        getToyDepthItem(body.shape, body.variant, point, angle)
      )
    }

    if (this.seen.size !== this.toys.size) this.removeGone()
  }

  private addToy(body: Readonly<ToyBody>): Toy {
    const toy = new Toy(this.ticker, this.shapes, body.shape, body.variant, body.color)

    toy.startTwitching(this.random)
    this.toys.set(body.id, toy)

    return toy
  }

  private removeGone(): void {
    for (const [id, toy] of this.toys) {
      if (this.seen.has(id)) continue

      this.toys.delete(id)
      this.layer.remove(toy)
      toy.destroy({ children: true })
    }
  }
}
