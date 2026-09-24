import { inject, injectable } from 'inversify'
import type { Container, DestroyOptions, Ticker } from 'pixi.js'

import { CLAW_RADIUS, CONTENTS_PRIORITY, CUBE_HEIGHT, DEPTH_SORT_STEP, UNIT_HEIGHT } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { Heap } from '#src/heap/heap'
import type { ToyBody } from '#src/heap/types'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { DepthItem, ScreenPoint, ToyId, WorldPoint } from '#src/types'
import { Pillar } from '#src/ui/box/pillar'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { TrayWall } from '#src/ui/box/tray-wall'
import {
  getDepthRelation,
  getPlaneDepthItem,
  getPointDepthItem,
  getToyDepthItem,
  orderByDepth,
} from '#src/utils/depth'
import { getFaceOutline, getTrayWallOutlines } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Слой содержимого куба. Игрушки, грани стенок лотка, вертикальные рёбра и клешня лежат здесь
 * непосредственными дочерними объектами; порядок наложения задаёт попарное сравнение по глубине.
 *
 * Каждый кадр контроллер продвигает модель кучи и синхронизирует View-компоненты одним проходом.
 * Отношения пар предметов кэшируются: заново сравнивается только предмет, чей силуэт сдвинулся.
 */
@injectable()
export class ContentsController extends LiveContainer {
  /** Ключ клешни среди предметов сортировки: id игрушек начинаются с единицы, детали куба идут в минус. */
  private static readonly CLAW_KEY = 0

  private readonly ticker: GameTicker
  private readonly heap: Heap
  private readonly claw: ClawController
  private readonly shapes = new ToyShapes()
  private readonly toys = new Map<ToyId, Toy>()
  private readonly seen = new Set<ToyId>()
  /** Предметы сортировки по ключу и экранная точка с шагом крена, при которых предмет последний раз сравнивался. */
  private readonly entries = new Map<number, { view: Container; item: DepthItem; anchor: ScreenPoint; step: number }>()
  /** Отношения пар предметов: `relations.get(a).get(b)` — ближе ли `a`, чем `b`. */
  private readonly relations = new Map<number, Map<number, number>>()
  /** Предметы, которые сдвинулись с последней сортировки. */
  private readonly changed = new Set<number>()
  private orderChanged = false
  private canDrop = false

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController
  ) {
    super()

    this.ticker = ticker
    this.heap = heap
    this.claw = claw
    this.sortableChildren = true

    const fixtures = [
      ...getTrayWallOutlines().map((outline) => ({ view: new TrayWall(outline), item: getPlaneDepthItem(outline) })),
      ...getFaceOutline(0).map((corner) => ({
        view: new Pillar(corner),
        item: getPlaneDepthItem([corner, { ...corner, z: CUBE_HEIGHT }]),
      })),
    ]

    fixtures.forEach(({ view, item }, index) => {
      this.entries.set(-(index + 1), { view, item, anchor: { x: 0, y: 0 }, step: 0 })
      this.changed.add(-(index + 1))
    })

    this.addChild(claw, ...fixtures.map(({ view }) => view))

    this.watch(
      () => toyboxStore.canDrop,
      (canDrop) => {
        this.canDrop = canDrop
      },
      { fireImmediately: true }
    )

    this.ticker.add(this.step, undefined, CONTENTS_PRIORITY)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)
    this.toys.clear()
    this.entries.clear()
    this.relations.clear()

    super.destroy(options)
    // Общие контексты геометрии уничтожаются после игрушек, которые на них ссылаются
    this.shapes.destroy()
  }

  private step = (ticker: Ticker): void => {
    this.heap.setGripPoint(this.claw.getGripPoint())
    this.heap.advance(ticker.deltaMS)
    this.sync()
  }

  private sync(): void {
    // Подсветка идёт только в покое, пока игрок ищет игрушку: цель — игрушка под кареткой
    const highlighted = this.canDrop ? this.heap.getTopBodyAt(this.claw.getCartPoint())?.id : undefined

    this.seen.clear()

    for (const body of this.heap.getBodies()) {
      const toy = this.toys.get(body.id) ?? this.addToy(body)

      this.seen.add(body.id)
      toy.setPose(body.pose.point, body.pose.angle)
      toy.setHighlighted(body.id === highlighted)
      this.trackToy(body, toy)
    }

    if (this.seen.size !== this.toys.size) this.removeGone()

    this.trackClaw(this.claw.getGripPoint())

    if (this.changed.size > 0 || this.orderChanged) this.sortLayer()
  }

  /** Обновляет предмет сортировки игрушки, если её силуэт сдвинулся на `DEPTH_SORT_STEP` или сменил шаг крена. */
  private trackToy(body: Readonly<ToyBody>, toy: Toy): void {
    const { point } = body.pose
    const anchor = worldToScreen(point)
    const step = getAngleStep(body.pose.angle)
    const entry = this.entries.get(body.id)

    if (entry && entry.step === step && !ContentsController.isShifted(entry.anchor, anchor)) return

    this.entries.set(body.id, {
      view: toy,
      item: getToyDepthItem(body.shape, body.variant, point, body.pose.angle),
      anchor,
      step,
    })
    this.changed.add(body.id)
  }

  private trackClaw(grip: WorldPoint): void {
    const anchor = worldToScreen(grip)
    const entry = this.entries.get(ContentsController.CLAW_KEY)

    if (entry && !ContentsController.isShifted(entry.anchor, anchor)) return

    this.entries.set(ContentsController.CLAW_KEY, {
      view: this.claw,
      item: getPointDepthItem(grip, CLAW_RADIUS, CLAW_RADIUS / UNIT_HEIGHT),
      anchor,
      step: 0,
    })
    this.changed.add(ContentsController.CLAW_KEY)
  }

  /**
   * Выставляет `zIndex` по порядку наложения. Сдвинувшиеся предметы сравниваются с соседями заново,
   * остальные пары берутся из кэша. Значение пишется только при смене, иначе слой сортируется каждый кадр.
   */
  private sortLayer(): void {
    for (const key of this.changed) this.forget(key)

    this.changed.clear()
    this.orderChanged = false

    const keys: number[] = []
    const items: DepthItem[] = []

    for (const [key, { item }] of this.entries) {
      keys.push(key)
      items.push(item)
    }

    orderByDepth(items, (first, second) => this.relate(keys[first], keys[second], items[first], items[second])).forEach(
      (index, rank) => {
        const entry = this.entries.get(keys[index])

        if (entry && entry.view.zIndex !== rank) entry.view.zIndex = rank
      }
    )
  }

  /** Отношение пары из кэша; при промахе считается и запоминается для обоих порядков. */
  private relate(first: number, second: number, firstItem: DepthItem, secondItem: DepthItem): number {
    const known = this.relations.get(first)?.get(second)

    if (known !== undefined) return known

    const relation = getDepthRelation(firstItem, secondItem)

    this.remember(first, second, relation)
    this.remember(second, first, -relation)

    return relation
  }

  private remember(first: number, second: number, relation: number): void {
    const row = this.relations.get(first) ?? new Map<number, number>()

    row.set(second, relation)
    this.relations.set(first, row)
  }

  /** Сбрасывает кэшированные отношения предмета со всеми соседями. */
  private forget(key: number): void {
    const row = this.relations.get(key)

    if (!row) return

    for (const other of row.keys()) this.relations.get(other)?.delete(key)
    this.relations.delete(key)
  }

  private addToy(body: Readonly<ToyBody>): Toy {
    const toy = new Toy(this.shapes, body.shape, body.variant, body.color)

    this.toys.set(body.id, toy)
    this.addChild(toy)

    return toy
  }

  private removeGone(): void {
    for (const [id, toy] of this.toys) {
      if (this.seen.has(id)) continue

      this.toys.delete(id)
      this.entries.delete(id)
      this.forget(id)
      this.orderChanged = true
      toy.destroy({ children: true })
    }
  }

  /** Сдвинулась ли экранная точка на `DEPTH_SORT_STEP` по любой из осей. */
  private static isShifted(from: ScreenPoint, to: ScreenPoint): boolean {
    return Math.abs(from.x - to.x) >= DEPTH_SORT_STEP || Math.abs(from.y - to.y) >= DEPTH_SORT_STEP
  }
}
