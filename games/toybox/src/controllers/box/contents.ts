import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type CellAddress, PhaseName, type ToyBody, type ToyId, ToyState } from '#src/types'
import { GlassMask } from '#src/ui/box/glass-mask'
import { Pillar } from '#src/ui/box/pillar'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { TrayWalls } from '#src/ui/box/tray-walls'
import { getFaceOutline } from '#src/utils/projection'
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
  // TODO маска на каждый ToyId это странно. Уверен там можно обойтись одной
  private readonly glassMasks = new Map<ToyId, GlassMask>()
  private readonly seen = new Set<ToyId>()
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

    // Фаза захвата начинается после касания и заканчивается перед подъёмом клешни
    this.watch(
      () => toyboxStore.phase === PhaseName.grabbing,
      (grabbing) => heap.setPressed(grabbing ? claw.getCell() : undefined)
    )

    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.step)
    this.toys.clear()
    this.glassMasks.clear()
    this.shapes.destroy()

    super.destroy(options)
  }

  private step = (ticker: Ticker): void => {
    this.heap.setCarryPoint(this.claw.getCarryPoint())
    this.heap.advance(ticker.deltaMS)
    this.sync()
  }

  private sync(): void {
    const highlighted = this.target && this.heap.getTopBody(this.target)?.id

    this.seen.clear()

    for (const body of this.heap.getBodies()) {
      const toy = this.toys.get(body.id) ?? this.addToy(body)

      this.seen.add(body.id)

      toy.setTurn(body.facing, body.turn)
      toy.setWorld(body.point, body.bounce.value)
      toy.setDepth(body.depth)
      toy.setHighlighted(body.id === highlighted)
      toy.setClippingMask(body.state === ToyState.fallingIntoTray ? this.getGlassMask(body.id) : null)
    }

    if (this.seen.size !== this.toys.size) this.removeGone()
  }

  private addToy(body: Readonly<ToyBody>): Toy {
    const toy = new Toy(this.shapes, body.shape, body.facing, body.color)

    this.toys.set(body.id, toy)
    this.addChild(toy)

    return toy
  }

  private getGlassMask(id: ToyId): GlassMask {
    const known = this.glassMasks.get(id)

    if (known) return known

    const mask = new GlassMask()

    this.glassMasks.set(id, mask)
    this.addChild(mask)

    return mask
  }

  private removeGone(): void {
    for (const [id, toy] of this.toys) {
      if (this.seen.has(id)) continue

      this.toys.delete(id)
      toy.destroy()

      const mask = this.glassMasks.get(id)

      if (mask) {
        this.glassMasks.delete(id)
        mask.destroy()
      }
    }
  }
}
