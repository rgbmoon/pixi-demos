import { Container, type DestroyOptions } from 'pixi.js'

import { DEPTH_SORT_STEP } from '#src/constants'
import type { DepthItem, ScreenPoint } from '#src/types'
import { getDepthRelation, orderByDepth } from '#src/utils/depth'

/**
 * Сортируемый слой: `zIndex` дочерних объектов задаёт попарное сравнение их предметов сортировки по глубине.
 * Отношения пар кэшируются по ссылке на объект: заново сравнивается только объект, чей предмет перестроен.
 */
export class DepthLayer extends Container {
  /** Предмет сортировки объекта и экранная точка с шагом крена, при которых он построен. */
  private readonly entries = new Map<Container, { item: DepthItem; anchor: ScreenPoint; step: number }>()
  /** Отношения пар объектов: `relations.get(a).get(b)` — ближе ли `a`, чем `b`. */
  private readonly relations = new Map<Container, Map<Container, number>>()
  /** Объекты, чьи предметы перестроены с последней сортировки. */
  private readonly changed = new Set<Container>()
  private orderChanged = false

  constructor() {
    super()

    this.sortableChildren = true
  }

  /**
   * Добавляет объект в слой или обновляет его предмет сортировки. `build` вызывается для нового объекта и для
   * объекта, чья экранная точка `anchor` сдвинулась на `DEPTH_SORT_STEP` или шаг крена `step` сменился.
   */
  place(view: Container, anchor: ScreenPoint, step: number, build: () => DepthItem): void {
    const entry = this.entries.get(view)

    if (entry && entry.step === step && !DepthLayer.isShifted(entry.anchor, anchor)) return
    if (!entry) this.addChild(view)

    this.entries.set(view, { item: build(), anchor, step })
    this.changed.add(view)
  }

  /** Убирает объект из слоя и забывает отношения его пар; сам объект не уничтожается. */
  remove(view: Container): void {
    if (!this.entries.delete(view)) return

    this.changed.delete(view)
    this.forget(view)
    this.removeChild(view)
    this.orderChanged = true
  }

  /**
   * Выставляет `zIndex` по порядку наложения, если предметы перестроены или состав слоя изменился. Перестроенные
   * предметы сравниваются с соседями заново, остальные пары берутся из кэша. Значение пишется только при смене,
   * иначе слой сортируется каждый кадр.
   */
  sort(): void {
    if (this.changed.size === 0 && !this.orderChanged) return

    for (const view of this.changed) this.forget(view)

    this.changed.clear()
    this.orderChanged = false

    const views: Container[] = []
    const items: DepthItem[] = []

    for (const [view, { item }] of this.entries) {
      views.push(view)
      items.push(item)
    }

    const order = orderByDepth(items, (first, second) =>
      this.relate(views[first], views[second], items[first], items[second])
    )

    order.forEach((index, rank) => {
      const view = views[index]

      if (view.zIndex !== rank) view.zIndex = rank
    })
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.entries.clear()
    this.relations.clear()
    this.changed.clear()

    super.destroy(options)
  }

  /** Отношение пары из кэша; при промахе считается и запоминается для обоих порядков. */
  private relate(first: Container, second: Container, firstItem: DepthItem, secondItem: DepthItem): number {
    const known = this.relations.get(first)?.get(second)

    if (known !== undefined) return known

    const relation = getDepthRelation(firstItem, secondItem)

    this.remember(first, second, relation)
    this.remember(second, first, -relation)

    return relation
  }

  private remember(first: Container, second: Container, relation: number): void {
    const row = this.relations.get(first) ?? new Map<Container, number>()

    row.set(second, relation)
    this.relations.set(first, row)
  }

  /** Сбрасывает кэшированные отношения объекта со всеми соседями. */
  private forget(view: Container): void {
    const row = this.relations.get(view)

    if (!row) return

    for (const other of row.keys()) this.relations.get(other)?.delete(view)
    this.relations.delete(view)
  }

  /** Сдвинулась ли экранная точка на `DEPTH_SORT_STEP` по любой из осей. */
  private static isShifted(from: ScreenPoint, to: ScreenPoint): boolean {
    return Math.abs(from.x - to.x) >= DEPTH_SORT_STEP || Math.abs(from.y - to.y) >= DEPTH_SORT_STEP
  }
}
