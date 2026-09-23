import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'

import {
  GRID_SIZE,
  FACINGS,
  HEAP_SNAPSHOT_VERSION,
  HOLE_MAX_WAVES,
  MAX_LAYERS,
  TRAY_CENTER,
  TRAY_EXIT_Z,
  TRAY_SLIDE_DELAY_MS,
  TOY_LANDING_IMPULSE,
  TOY_PRESS_DEPTH,
  TOY_ROOT_COLOR,
  TOY_SPRING_DAMPING,
  TOY_SPRING_PERIOD_MS,
} from '#src/constants'
import {
  type CellAddress,
  type HeapSnapshot,
  type Hole,
  type Placement,
  type ShapeKey,
  type ToyBody,
  type ReleaseOutcome,
  type ToyId,
  ToyState,
  type VolumeCell,
  type WorldPoint,
} from '#src/types'
import { shiftColor } from '#src/utils/color'
import {
  canPlace,
  createBody,
  createOccupancy,
  findHoles,
  findLanding,
  findSlide,
  getHoleFillChance,
  pickFillShapes,
  planDomeProfile,
  getImpact,
  getTouchingCells,
  isFullySupported,
  isSupported,
  planLanding,
  shuffle,
  shouldSlideIntoTray,
} from '#src/utils/heap'
import { lerp } from '#src/utils/math'
import { advanceSpring, getMotionMs } from '#src/utils/motion'
import { isTrayCell, toCell } from '#src/utils/projection'
import { getBodyCenter, getPlacementCells, getWeight } from '#src/utils/shapes'
import { isHeapSnapshot } from '#src/utils/snapshot'
import { easeInQuad } from '@pixi-demos/core/easing'
import type { Random } from '@pixi-demos/core/types'

/**
 * Модель кучи игрушек: занятость объёма куба, сами игрушки и их покадровое движение.
 * Размещение резервируется при команде; текущая поза изменяется кадровым шагом.
 */
@injectable()
export class HeapStore {
  constructor() {
    makeObservable(this)

    this.cells = createOccupancy()
  }

  /** В куче завершились движение, осыпание и пружины; удержание проверяется отдельно. */
  @observable settled = true

  /** Результат единственного отпускания текущего цикла. */
  @observable.ref releaseOutcome: ReleaseOutcome = { status: 'none' }

  private readonly cells: (ToyId | undefined)[][][]
  private readonly bodies = new Map<ToyId, ToyBody>()
  private readonly moving = new Set<ToyBody>()
  private readonly springs = new Set<ToyBody>()
  private dirty = false
  private waves = 0
  private nextId = 0
  private random: Random = Math.random
  private carried?: ToyBody
  private initialGripOffset: WorldPoint = { x: 0, y: 0, z: 0 }
  private grabProgress = 0
  private reducedMotion = false
  private pressed?: ToyBody

  /**
   * Восстанавливает проверенный снимок или создаёт купол из случайных форм.
   * Некорректный снимок отклоняется до изменения модели.
   */
  restore(snapshot: HeapSnapshot | undefined, random: Random): void {
    if (snapshot && !isHeapSnapshot(snapshot)) throw new Error('Invalid heap snapshot')

    this.random = random
    this.bodies.clear()
    this.moving.clear()
    this.springs.clear()
    this.setReleaseOutcome({ status: 'none' })
    this.carried = undefined
    this.pressed = undefined
    // `nextId` не обнуляется: id игрушки уникален на всё время жизни стора. Рендер держит по нему
    // View-компоненты; повторный id связал бы новую игрушку с прежними геометрией и цветом

    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        this.cells[col][row].fill(undefined)
      }
    }

    if (snapshot) {
      this.load(snapshot)
    } else {
      this.fill()
    }

    this.dirty = false
    this.waves = 0
    this.setSettled(true)
  }

  /**
   * Верх занятости ячейки: на эту высоту садится клешня.
   * Поле-стрелка, а не метод: ссылку на него забирают чистые функции для планирования движения.
   */
  getSurfaceHeight = ({ col, row }: CellAddress): number => {
    const column = this.cells[col][row]

    for (let layer = MAX_LAYERS - 1; layer >= 0; layer--) {
      if (column[layer] !== undefined) return layer + 1
    }

    return 0
  }

  /** Игрушка в верхней занятой клетке столбца. */
  getTopBody(cell: CellAddress): Readonly<ToyBody> | undefined {
    return this.getTop(cell)
  }

  /** Суммарный вес игрушек, лежащих сверху напрямую или через другие игрушки. */
  getLoad(id: ToyId): number {
    const start = this.bodies.get(id)

    if (!start) return 0

    const seen = new Set<ToyId>([id])
    const queue: ToyBody[] = [start]
    let load = 0

    while (queue.length > 0) {
      const current = queue.shift() as ToyBody

      for (const { col, row, layer } of this.getBodyCells(current)) {
        const above = layer + 1 < MAX_LAYERS ? this.cells[col][row][layer + 1] : undefined
        const body = above === undefined || seen.has(above) ? undefined : this.bodies.get(above)

        if (!body) continue

        seen.add(body.id)
        load += getWeight(body.shape)
        queue.push(body)
      }
    }

    return load
  }

  /** Все игрушки кучи: их перебирает рендер. */
  getBodies(): IterableIterator<Readonly<ToyBody>> {
    return this.bodies.values()
  }

  /** Начинает новый цикл после завершения предыдущего. */
  beginCycle(): void {
    this.setReleaseOutcome({ status: 'none' })
  }

  /** Есть ли игрушка в захвате. Владение хранится только в модели. */
  get isHolding(): boolean {
    return this.carried !== undefined
  }

  /** Снимок согласованного покоя; незавершённое движение сериализовать нельзя. */
  takeSnapshot(collected: number): HeapSnapshot {
    if (!this.settled || this.carried) throw new Error('Heap is not settled')

    return {
      version: HEAP_SNAPSHOT_VERSION,
      collected,
      bodies: [...this.bodies.values()].map(({ shape, placement, color }) => ({
        shape,
        ...placement,
        anchor: { ...placement.anchor },
        color,
      })),
    }
  }

  /** Снимает верхнюю игрушку, сохраняя её видимую позу относительно мировой точки захвата. */
  lift(cell: CellAddress, grip: WorldPoint): ToyId | undefined {
    const body = this.getTop(cell)

    if (!body || this.carried || body.state !== ToyState.resting) return undefined

    this.vacate(body)
    body.pose.point.z += body.bounce.value
    this.clearSpring(body)
    if (this.pressed === body) this.pressed = undefined
    body.state = ToyState.carried
    this.carried = body
    this.initialGripOffset = {
      x: body.pose.point.x - grip.x,
      y: body.pose.point.y - grip.y,
      z: body.pose.point.z - grip.z,
    }
    this.grabProgress = 0
    this.dirty = true
    this.setSettled(false)
    this.setReleaseOutcome({ status: 'none' })

    return body.id
  }

  /** Рассчитывает посадку из текущей позы до освобождения захвата. При отсутствии места удержание сохраняется. */
  release(grip: WorldPoint): boolean {
    const body = this.carried

    if (!body) return false

    this.setGripPoint(grip)

    const overTray = isTrayCell(toCell(body.pose.point))
    const landing = overTray ? undefined : planLanding(body.shape, body.pose.facing, body.pose.point, this.isOccupied)

    if (!overTray && !landing) return false

    this.carried = undefined
    this.setReleaseOutcome({ status: 'pending', id: body.id })

    if (landing) {
      const cells = getPlacementCells(body.shape, landing.facing, landing.anchor, landing.layer)
      const state = shouldSlideIntoTray(cells, this.random) ? ToyState.landingBeforeTray : ToyState.falling

      this.moveTo(body, landing, state)
    } else {
      this.startTrayFall(body)
    }

    this.dirty = true

    return true
  }

  /** Отпускает доставленную игрушку из актуальной мировой точки захвата. */
  dropIntoTray(grip: WorldPoint): void {
    const body = this.carried

    if (!body) return

    this.setGripPoint(grip)
    this.carried = undefined
    this.setReleaseOutcome({ status: 'pending', id: body.id })
    this.startTrayFall(body)
  }

  /** Центрирует игрушку по X/Y на доле анимации захвата 0–1, сохраняя высотный отступ. */
  setGrabProgress(progress: number, grip: WorldPoint): void {
    if (!this.carried) return

    this.grabProgress = progress
    this.setGripPoint(grip)
  }

  /** Обновляет удерживаемую игрушку после движения и качания клешни в этом кадре. */
  setGripPoint(grip: WorldPoint): void {
    if (!this.carried) return

    const remaining = 1 - this.grabProgress

    this.place(
      this.carried,
      grip.x + this.initialGripOffset.x * remaining,
      grip.y + this.initialGripOffset.y * remaining,
      grip.z + this.initialGripOffset.z
    )
  }

  /** Настройку доступности передаёт контроллер; модель не обращается к браузеру. */
  setReducedMotion(reduced: boolean): void {
    if (this.reducedMotion === reduced) return

    this.reducedMotion = reduced
    if (reduced) {
      for (const body of this.springs) this.clearSpring(body)
    }
  }

  /** Прожимает верхнюю игрушку ячейки под весом клешни; без ячейки прожатие снимается. */
  setPressed(cell: CellAddress | undefined): void {
    if (this.pressed) {
      this.clearSpring(this.pressed)
      this.pressed = undefined
    }

    if (!cell || this.reducedMotion) return

    const body = this.getTop(cell)

    if (!body) return

    this.pressed = body
    this.springs.add(body)
  }

  /** Кадровый шаг всей кучи: ведёт движение, разбирает его последствия и гасит пружины. */
  advance(deltaMs: number): void {
    if (this.moving.size > 0) this.stepMoving(deltaMs)
    if (this.dirty) this.resolve()
    if (this.springs.size > 0) this.stepSprings(deltaMs)
    this.setSettled(!this.dirty && this.moving.size === 0 && this.springs.size === 0)
  }

  @action private setSettled(settled: boolean): void {
    if (this.settled !== settled) this.settled = settled
  }

  @action private setReleaseOutcome(outcome: ReleaseOutcome): void {
    this.releaseOutcome = outcome
  }

  /** Занята ли клетка. Клетка вне куба занятой не считается — её отсекает `isBoxCell`. */
  private isOccupied = ({ col, row, layer }: VolumeCell): boolean => this.cells[col]?.[row]?.[layer] !== undefined

  /** Игрушка верхней занятой клетки ячейки, как она лежит в модели. */
  private getTop({ col, row }: CellAddress): ToyBody | undefined {
    const column = this.cells[col][row]

    for (let layer = MAX_LAYERS - 1; layer >= 0; layer--) {
      const id = column[layer]

      if (id !== undefined) return this.bodies.get(id)
    }

    return undefined
  }

  private getBodyCells(body: ToyBody): VolumeCell[] {
    return getPlacementCells(body.shape, body.placement.facing, body.placement.anchor, body.placement.layer)
  }

  private occupy(body: ToyBody): void {
    for (const { col, row, layer } of this.getBodyCells(body)) {
      this.cells[col][row][layer] = body.id
    }
  }

  private vacate(body: ToyBody): void {
    for (const { col, row, layer } of this.getBodyCells(body)) {
      if (this.cells[col][row][layer] === body.id) this.cells[col][row][layer] = undefined
    }
  }

  private create(shape: ShapeKey, placement: Placement, color: number): ToyBody {
    this.nextId += 1

    const body = createBody(this.nextId, shape, placement, color)

    this.bodies.set(body.id, body)
    this.occupy(body)

    return body
  }

  private load(snapshot: HeapSnapshot): void {
    for (const { shape, facing, anchor, layer, color } of snapshot.bodies) {
      this.create(shape, { anchor, facing, layer }, color)
    }
  }

  /**
   * Создаёт куполообразную раскладку со случайным порядком ячеек, форм и ориентаций.
   */
  private fill(): void {
    // Первый этап резервирует место составным формам; второй заполняет оставшиеся одиночными
    const profile = planDomeProfile(this.random)

    this.fillPasses(profile, false)
    this.fillPasses(profile, true)
  }

  private fillPasses(profile: number[][], allowSingle: boolean): void {
    for (let pass = 0; pass < MAX_LAYERS * GRID_SIZE; pass++) {
      let placed = false
      const anchors = Array.from({ length: GRID_SIZE }, (_, col) =>
        Array.from({ length: GRID_SIZE }, (_, row) => ({ col, row }))
      ).flat()

      for (const anchor of shuffle(anchors, this.random)) {
        if (this.fillCell(profile, anchor, allowSingle)) placed = true
      }

      if (!placed) return
    }
  }

  private fillCell(profile: number[][], anchor: CellAddress, allowSingle: boolean): boolean {
    const layer = this.getSurfaceHeight(anchor)

    if (layer >= profile[anchor.col][anchor.row]) return false

    for (const shape of pickFillShapes(this.random, allowSingle)) {
      for (const facing of shuffle(FACINGS, this.random)) {
        const cells = getPlacementCells(shape, facing, anchor, layer)

        if (!canPlace(cells, this.isOccupied)) continue
        // Начальная раскладка требует опору под каждой нижней клеткой
        if (!isFullySupported(cells, this.isOccupied)) continue
        // Каждая клетка формы должна оставаться ниже профиля своей ячейки
        if (cells.some((cell) => cell.layer >= profile[cell.col][cell.row])) continue

        this.create(shape, { anchor, facing, layer }, shiftColor(TOY_ROOT_COLOR, this.random))

        return true
      }
    }

    return false
  }

  private moveTo(body: ToyBody, { anchor, facing, layer }: Placement, state: ToyState): void {
    this.vacate(body)

    body.placement.anchor = anchor
    body.placement.facing = facing
    body.placement.layer = layer
    this.occupy(body)

    this.startMotion(body, state, getBodyCenter(body.shape, facing, anchor, layer))
  }

  private startTrayFall(body: ToyBody): void {
    this.vacate(body)
    this.clearSpring(body)
    this.dirty = true

    this.startMotion(body, ToyState.fallingIntoTray, { x: body.pose.point.x, y: body.pose.point.y, z: TRAY_EXIT_Z })
  }

  private startTraySlide(body: ToyBody): void {
    this.vacate(body)
    this.clearSpring(body)
    this.dirty = true
    this.startMotion(body, ToyState.slidingToTray, { ...TRAY_CENTER, z: body.pose.point.z })
  }

  /**
   * Начинает движение к `target`. Длительность учитывает вертикальный и горизонтальный пути.
   */
  private startMotion(body: ToyBody, state: ToyState, target: WorldPoint): void {
    body.state = state
    body.from = { ...body.pose.point }
    body.target = target
    body.elapsed = 0
    body.durationMs = getMotionMs(getWeight(body.shape), body.pose.point, target)
    this.setSettled(false)

    if (this.reducedMotion) {
      this.arrive(body)

      return
    }

    this.moving.add(body)
  }

  /**
   * Обновляет положение по `easeInQuad`; задержка перед лотком изменяет только прошедшее время.
   */
  private stepMoving(deltaMs: number): void {
    for (const body of [...this.moving]) {
      body.elapsed += deltaMs

      const progress = Math.min(body.elapsed / body.durationMs, 1)

      if (progress === 1) {
        this.arrive(body)

        continue
      }

      if (body.state === ToyState.waitingForTraySlide) continue

      const eased = easeInQuad(progress)

      this.place(
        body,
        lerp(body.from.x, body.target.x, eased),
        lerp(body.from.y, body.target.y, eased),
        lerp(body.from.z, body.target.z, eased)
      )
    }
  }

  private arrive(body: ToyBody): void {
    const fallHeight = body.from.z - body.target.z

    this.moving.delete(body)
    this.place(body, body.target.x, body.target.y, body.target.z)
    body.elapsed = body.durationMs
    this.dirty = true

    if (body.state === ToyState.landingBeforeTray) {
      body.pose.facing = body.placement.facing
      this.waitForTraySlide(body)
      this.land(body, fallHeight)

      return
    }

    if (body.state === ToyState.waitingForTraySlide) {
      this.startTraySlide(body)

      return
    }

    if (body.state === ToyState.slidingToTray) {
      this.startTrayFall(body)

      return
    }

    if (body.state === ToyState.fallingIntoTray) {
      const appearance = { shape: body.shape, color: body.color }

      this.springs.delete(body)
      this.bodies.delete(body.id)
      this.setReleaseOutcome({ status: 'collected', appearance })

      return
    }

    body.pose.facing = body.placement.facing
    body.state = ToyState.resting
    if (this.releaseOutcome.status === 'pending' && this.releaseOutcome.id === body.id) {
      this.setReleaseOutcome({ status: 'returned' })
    }
    this.land(body, fallHeight)
  }

  private waitForTraySlide(body: ToyBody): void {
    body.state = ToyState.waitingForTraySlide
    body.from = { ...body.pose.point }
    body.target = { ...body.pose.point }
    body.elapsed = 0
    body.durationMs = TRAY_SLIDE_DELAY_MS
    this.moving.add(body)
  }

  private land(body: ToyBody, fallHeight: number): void {
    if (this.reducedMotion || body === this.pressed) return

    const share = Math.min(Math.max(fallHeight, 0) / MAX_LAYERS, 1)

    this.push(body, TOY_LANDING_IMPULSE * share)

    for (const neighbour of this.getNeighbourBodies(body)) {
      this.push(neighbour, getImpact(getWeight(body.shape), 1) * share)
    }
  }

  private push(body: ToyBody, impulse: number): void {
    body.bounce = { value: body.bounce.value, velocity: body.bounce.velocity - impulse }
    this.springs.add(body)
  }

  private getNeighbourBodies(body: ToyBody): ToyBody[] {
    const found = new Map<ToyId, ToyBody>()

    for (const { col, row, layer } of getTouchingCells(this.getBodyCells(body))) {
      const id = layer < 0 ? undefined : this.cells[col][row][layer]
      const neighbour = id === undefined ? undefined : this.bodies.get(id)

      if (neighbour && neighbour !== body) found.set(neighbour.id, neighbour)
    }

    return [...found.values()]
  }

  private planSlide(body: ToyBody): Placement | undefined {
    this.vacate(body)

    const target = findSlide(body.shape, this.getBodyCells(body), body.placement.layer, this.isOccupied)

    this.occupy(body)

    return target
  }

  private resolve(): void {
    this.dirty = false

    this.collapse()
    this.slide()
  }

  /**
   * Обвал: игрушка без опоры падает до ближайшего места, где опора есть, а если прямо вниз не
   * пройти — заваливается набок. Проход повторяется, потому что упавшая уводит опору из-под
   * следующей. Число проходов ограничено числом игрушек.
   */
  private collapse(): void {
    for (let pass = 0; pass < this.bodies.size; pass++) {
      let moved = false

      for (const body of this.bodies.values()) {
        if (body.state !== ToyState.resting) continue
        if (isSupported(this.getBodyCells(body), this.isOccupied)) continue
        if (this.drop(body)) moved = true
      }

      if (!moved) return
    }
  }

  private drop(body: ToyBody): boolean {
    this.vacate(body)

    const layer = findLanding(body.shape, body.placement.facing, body.placement.anchor, body.placement.layer, this.isOccupied)

    this.occupy(body)

    if (layer !== undefined && layer < body.placement.layer) {
      this.moveTo(body, { anchor: body.placement.anchor, facing: body.placement.facing, layer }, ToyState.falling)

      return true
    }

    const topple = this.planSlide(body)

    if (!topple) return false

    this.moveTo(body, topple, ToyState.falling)

    return true
  }

  /** Осыпание: вероятность сползания с края растёт с глубиной провала и уменьшается с весом. */
  private slide(): void {
    const holes = findHoles(this.getSurfaceHeight)
    let slid = false

    for (const body of [...this.bodies.values()]) {
      if (body.state !== ToyState.resting) continue

      const chance = this.getSlideChanceOf(body, holes)

      if (chance <= 0 || this.random() >= chance) continue

      const target = this.planSlide(body)

      if (!target) continue

      this.moveTo(body, target, ToyState.sliding)
      slid = true
    }

    this.keepFilling(holes, slid)
  }

  /**
   * Повторяет засыпку дыры до перемещения игрушки или достижения предела проходов.
   */
  private keepFilling(holes: readonly Hole[], slid: boolean): void {
    if (slid) this.waves = 0

    const alive = holes.some((hole) => getHoleFillChance(1, hole) > 0)

    if (!alive || this.waves >= HOLE_MAX_WAVES) {
      this.waves = 0

      return
    }

    this.waves += 1
    this.dirty = true
  }

  /**
   * Вероятность засыпки соседнего провала с учётом веса игрушки.
   */
  private getSlideChanceOf(body: ToyBody, holes: readonly Hole[]): number {
    const weight = getWeight(body.shape)
    const hole = this.findBorderedHole(body, holes)

    return hole ? getHoleFillChance(weight, hole) : 0
  }

  /** Самая глубокая дыра, к краю которой примыкает игрушка. */
  private findBorderedHole(body: ToyBody, holes: readonly Hole[]): Hole | undefined {
    const own = new Set(this.getBodyCells(body).map(({ col, row }) => `${col}:${row}`))
    const touching = new Set(
      getTouchingCells(this.getBodyCells(body))
        .map(({ col, row }) => `${col}:${row}`)
        .filter((key) => !own.has(key))
    )

    let deepest: Hole | undefined

    for (const hole of holes) {
      if (!hole.cells.some(({ col, row }) => touching.has(`${col}:${row}`))) continue
      if (hole.floor >= body.placement.layer) continue
      if (deepest && hole.depth <= deepest.depth) continue

      deepest = hole
    }

    return deepest
  }

  private stepSprings(deltaMs: number): void {
    for (const body of this.springs) {
      const target = body === this.pressed ? -TOY_PRESS_DEPTH : 0

      body.bounce = advanceSpring(
        body.bounce,
        { target, periodMs: TOY_SPRING_PERIOD_MS, damping: TOY_SPRING_DAMPING },
        deltaMs
      )

      const bouncing = target !== 0 || body.bounce.value !== 0 || body.bounce.velocity !== 0

      if (!bouncing) this.springs.delete(body)
    }
  }

  private clearSpring(body: ToyBody): void {
    this.springs.delete(body)
    body.bounce = { value: 0, velocity: 0 }
  }

  /** Ставит центр игрушки в мировую точку без изменения зарезервированного места. */
  private place(body: ToyBody, x: number, y: number, z: number): void {
    body.pose.point.x = x
    body.pose.point.y = y
    body.pose.point.z = z
  }
}
