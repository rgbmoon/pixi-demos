import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import { CONTENTS_PRIORITY, REDUCED_MOTION_QUERY } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { CellAddress, ToyBody, ToyId } from '#src/types'
import { Pillar } from '#src/ui/box/pillar'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { TrayWalls } from '#src/ui/box/tray-walls'
import { getFaceOutline } from '#src/utils/grid'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Слой содержимого куба. Игрушки, стенки лотка, вертикальные рёбра и клешня сортируются общим
 * ключом глубины и добавляются сюда непосредственными дочерними объектами.
 *
 * Каждый кадр контроллер обновляет модель кучи и синхронизирует View-компоненты одним проходом.
 */
@injectable()
export class ContentsController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly heap: HeapStore
  private readonly claw: ClawController
  private readonly shapes = new ToyShapes()
  private readonly toys = new Map<ToyId, Toy>()
  private readonly seen = new Set<ToyId>()
  private readonly reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY)
  private target?: CellAddress

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController
  ) {
    super()

    this.ticker = ticker
    this.heap = heap
    this.claw = claw
    this.sortableChildren = true

    this.addChild(new TrayWalls(), claw, ...getFaceOutline(0).map((corner) => new Pillar(corner)))

    this.watch(
      () => toyboxStore.targetCell,
      (cell) => {
        this.target = cell
      },
      { fireImmediately: true }
    )

    this.ticker.add(this.step, undefined, CONTENTS_PRIORITY)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)
    this.toys.clear()

    super.destroy(options)
    // Общие контексты геометрии уничтожаются после игрушек, которые на них ссылаются
    this.shapes.destroy()
  }

  private step = (ticker: Ticker): void => {
    this.heap.setReducedMotion(this.reducedMotion.matches)
    this.heap.setGripPoint(this.claw.getGripPoint())
    this.heap.advance(ticker.deltaMS)
    this.sync()
  }

  private sync(): void {
    const highlighted = this.target && this.heap.getTopBody(this.target)?.id

    this.seen.clear()

    for (const body of this.heap.getBodies()) {
      const toy = this.toys.get(body.id) ?? this.addToy(body)

      this.seen.add(body.id)

      toy.setFacing(body.pose.facing)
      toy.setWorld(body.pose.point, body.bounce.value)
      toy.setHighlighted(body.id === highlighted)
    }

    if (this.seen.size !== this.toys.size) this.removeGone()
  }

  private addToy(body: Readonly<ToyBody>): Toy {
    const toy = new Toy(this.shapes, body.shape, body.pose.facing, body.color)

    this.toys.set(body.id, toy)
    this.addChild(toy)

    return toy
  }

  private removeGone(): void {
    for (const [id, toy] of this.toys) {
      if (this.seen.has(id)) continue

      this.toys.delete(id)
      toy.destroy({ children: true })
    }
  }
}
