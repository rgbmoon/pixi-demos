import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'

import {
  GRID_SIZE,
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
  type ToyAppearance,
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
  FACINGS,
  findHoles,
  findLanding,
  findSlide,
  getBodyCenter,
  getBodyDepth,
  getHoleFillChance,
  pickFillShapes,
  planDomeProfile,
  getImpact,
  getPlacementCells,
  getSlideChance,
  getSlideDrop,
  getTouchingCells,
  getWeight,
  isFullySupported,
  isSupported,
  planLanding,
  shuffle,
  shouldSlideIntoTray,
} from '#src/utils/heap'
import { lerp } from '#src/utils/math'
import { advanceSpring, getMotionMs, isReducedMotion } from '#src/utils/motion'
import { getDepthOrder, isTrayCell } from '#src/utils/projection'
import { easeInQuad } from '@pixi-demos/core/easing'
import type { Random } from '@pixi-demos/core/types'

/**
 * Модель кучи игрушек: занятость объёма куба, сами игрушки и их покадровое движение.
 * observable поля, реакции и тд нужно вводить осторожно, так как можно неожиданно увеличить затраты на рендер
 */
@injectable()
export class HeapStore {
  constructor() {
    makeObservable(this)

    this.cells = createOccupancy()
  }

  /** Куча пришла в покой: в этот момент снимок можно сохранять. */
  @observable settled = true

  /** Номер наполнения куба: растёт только в `restore`, то есть раз на всю кучу. */
  @observable generation = 0

  private readonly cells: (ToyId | undefined)[][][]
  private readonly bodies = new Map<ToyId, ToyBody>()
  private readonly moving = new Set<ToyBody>()
  private readonly springs = new Set<ToyBody>()
  private readonly onCollected = new Map<ToyId, (appearance: ToyAppearance) => void>()
  private dirty = false
  private waves = 0
  private nextId = 0
  private random: Random = Math.random
  private carried?: ToyBody
  private carryPoint?: WorldPoint
  private pressed?: ToyBody

  /**
   * Наполняет куб: из снэпшота, если тот есть, иначе куполом из случайных форм.
   * Источник случайности приходит параметром — им же тесты делают кучу воспроизводимой.
   */
  restore(snapshot: HeapSnapshot | undefined, random: Random): void {
    this.random = random
    this.bodies.clear()
    this.moving.clear()
    this.springs.clear()
    this.onCollected.clear()
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
    this.bumpGeneration()
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

  /** Внешний вид игрушки для отдельной презентации в окне выдачи. */
  getAppearance(id: ToyId): ToyAppearance | undefined {
    const body = this.bodies.get(id)

    return body ? { shape: body.shape, color: body.color } : undefined
  }

  /** Снимок для хранилища: только расположение и фигуры, без непрерывного состояния. */
  takeSnapshot(collected: number): HeapSnapshot {
    const committed = [...this.bodies.values()].filter(
      (body) => body.state === ToyState.slidingToTray || body.state === ToyState.fallingIntoTray
    ).length

    return {
      version: HEAP_SNAPSHOT_VERSION,
      collected: collected + committed,
      bodies: [...this.bodies.values()]
        .filter((body) => body.state !== ToyState.slidingToTray && body.state !== ToyState.fallingIntoTray)
        .map(({ shape, facing, anchor, layer, color }) => ({
          shape,
          facing,
          anchor: { ...anchor },
          layer,
          color,
        })),
    }
  }

  /** Снимает игрушку из ячейки в клешню. Освободившийся объём обваливается следующим шагом. */
  lift(cell: CellAddress): ToyId | undefined {
    const body = this.getTop(cell)

    if (!body) return undefined

    this.vacate(body)
    this.moving.delete(body)
    this.clearSpring(body)

    body.state = ToyState.carried
    this.carried = body
    this.dirty = true

    return body.id
  }

  /**
   * Возвращает игрушку в кучу или запускает её уход в лоток после посадки у стенки.
   */
  release(id: ToyId, cell: CellAddress, onCollected: (appearance: ToyAppearance) => void): void {
    const body = this.bodies.get(id)

    if (!body) return

    if (this.carried === body) this.carried = undefined

    if (this.carryPoint) body.point = { ...this.carryPoint }

    if (isTrayCell(cell)) {
      this.onCollected.set(body.id, onCollected)
      this.startTrayFall(body)

      return
    }

    const landing = planLanding(body.shape, body.facing, cell, this.isOccupied)

    if (!landing) {
      this.onCollected.set(body.id, onCollected)
      this.startTraySlide(body)

      return
    }

    const cells = getPlacementCells(body.shape, landing.facing, landing.anchor, landing.layer)
    const state = shouldSlideIntoTray(cells, this.random) ? ToyState.landingBeforeTray : ToyState.falling

    if (state === ToyState.landingBeforeTray) this.onCollected.set(body.id, onCollected)

    this.moveTo(body, landing, state)
    this.dirty = true
  }

  /** Отпускает доставленную игрушку над лотком и возвращает рассчитанное время падения. */
  dropIntoTray(id: ToyId, onCollected?: (appearance: ToyAppearance) => void): number {
    const body = this.bodies.get(id)

    if (!body) return 0

    if (this.carried === body) this.carried = undefined

    if (this.carryPoint) body.point = { ...this.carryPoint }

    if (onCollected) this.onCollected.set(body.id, onCollected)

    return this.startTrayFall(body)
  }

  /** Принимает точку клешни: игрушку в ней ведёт клешня, а не кадровый шаг кучи. */
  setCarryPoint(point: WorldPoint | undefined): void {
    this.carryPoint = point
  }

  /** Прожимает верхнюю игрушку ячейки под весом клешни; без ячейки прожатие снимается. */
  setPressed(cell: CellAddress | undefined): void {
    if (this.pressed) {
      this.clearSpring(this.pressed)
      this.pressed = undefined
    }

    if (!cell || isReducedMotion()) return

    const body = this.getTop(cell)

    if (!body) return

    this.pressed = body
    this.springs.add(body)
  }

  /** Кадровый шаг всей кучи: ведёт движение, разбирает его последствия и гасит пружины. */
  advance(deltaMs: number): void {
    const carry = this.carryPoint

    if (this.carried && carry) this.place(this.carried, carry.x, carry.y, carry.z)

    if (this.moving.size > 0) this.stepMoving(deltaMs)
    if (this.dirty) this.resolve()
    if (this.springs.size > 0) this.stepSprings(deltaMs)
  }

  @action private setSettled(settled: boolean): void {
    if (this.settled !== settled) this.settled = settled
  }

  @action private bumpGeneration(): void {
    this.generation += 1
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
    return getPlacementCells(body.shape, body.facing, body.anchor, body.layer)
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
      if (!canPlace(getPlacementCells(shape, facing, anchor, layer), this.isOccupied)) continue

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

    const turned = body.facing !== facing

    body.anchor = anchor
    body.facing = facing
    body.layer = layer
    this.occupy(body)

    this.startMotion(body, state, getBodyCenter(body.shape, facing, anchor, layer), turned)
  }

  private startTrayFall(body: ToyBody): number {
    this.vacate(body)
    this.clearSpring(body)
    this.dirty = true

    return this.startMotion(
      body,
      ToyState.fallingIntoTray,
      { x: body.point.x, y: body.point.y, z: TRAY_EXIT_Z },
      false
    )
  }

  private startTraySlide(body: ToyBody): void {
    this.vacate(body)
    this.clearSpring(body)
    this.dirty = true
    this.startMotion(body, ToyState.slidingToTray, { ...TRAY_CENTER, z: body.point.z }, false)
  }

  /**
   * Начинает движение к `target`. Длительность учитывает вертикальный и горизонтальный пути.
   * Доворот использует ту же длительность.
   */
  private startMotion(body: ToyBody, state: ToyState, target: WorldPoint, turned: boolean, durationMs?: number): number {
    body.state = state
    body.from = { ...body.point }
    body.target = target
    body.elapsed = 0
    body.durationMs = durationMs ?? getMotionMs(getWeight(body.shape), body.point, target)
    body.turn = turned && !isReducedMotion() ? 0 : 1

    if (isReducedMotion()) {
      this.arrive(body)

      return body.durationMs
    }

    this.moving.add(body)

    return body.durationMs
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

      if (body.turn < 1) body.turn = progress

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
    body.turn = 1
    this.dirty = true

    if (body.state === ToyState.landingBeforeTray) {
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
      this.onCollected.get(body.id)?.(appearance)
      this.onCollected.delete(body.id)

      return
    }

    body.state = ToyState.resting
    this.land(body, fallHeight)
  }

  private waitForTraySlide(body: ToyBody): void {
    body.state = ToyState.waitingForTraySlide
    body.from = { ...body.point }
    body.target = { ...body.point }
    body.elapsed = 0
    body.durationMs = TRAY_SLIDE_DELAY_MS
    body.turn = 1
    body.depth = getBodyDepth(body.shape, body.facing, body.anchor, body.layer)
    this.moving.add(body)
  }

  private land(body: ToyBody, fallHeight: number): void {
    if (isReducedMotion() || body === this.pressed) return

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

    const target = findSlide(body.shape, this.getBodyCells(body), body.layer, this.isOccupied)

    this.occupy(body)

    return target
  }

  private resolve(): void {
    this.dirty = false

    this.collapse()
    this.slide()
    // `dirty` сохраняет активное состояние между проходами засыпки
    this.setSettled(this.moving.size === 0 && !this.dirty)
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

    const layer = findLanding(body.shape, body.facing, body.anchor, body.layer, this.isOccupied)

    this.occupy(body)

    if (layer !== undefined && layer < body.layer) {
      this.moveTo(body, { anchor: body.anchor, facing: body.facing, layer }, ToyState.falling)

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
   * Возвращает большую из вероятностей сползания по склону и засыпки соседней дыры.
   */
  private getSlideChanceOf(body: ToyBody, holes: readonly Hole[]): number {
    const weight = getWeight(body.shape)
    const drop = getSlideDrop(this.getBodyCells(body), body.layer, this.getSurfaceHeight)
    const hole = this.findBorderedHole(body, holes)
    const holeFill = hole ? getHoleFillChance(weight, hole) : 0

    return Math.max(getSlideChance(weight, drop), holeFill)
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
      if (hole.floor >= body.layer) continue
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

  /**
   * Ставит игрушку в точку мира и пересчитывает её ключ наложения. Покоящаяся игрушка сортируется
   * по ближней клетке своего места, летящая — по собственной точке: решётки под ней ещё нет.
   */
  private place(body: ToyBody, x: number, y: number, z: number): void {
    body.point.x = x
    body.point.y = y
    body.point.z = z
    body.depth =
      body.state === ToyState.resting || body.state === ToyState.waitingForTraySlide
        ? getBodyDepth(body.shape, body.facing, body.anchor, body.layer)
        : getDepthOrder(body.point)
  }
}
