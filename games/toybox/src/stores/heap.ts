import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'

import {
  CUBE_HEIGHT,
  FILL_BATCH,
  FILL_BATCH_STEPS,
  FILL_CANDIDATES,
  FILL_MAX_FAILURES,
  FILL_MAX_TILT,
  FILL_SPAWN_GAP,
  FILL_VOLUME,
  GRID_SIZE,
  HEAP_MAX_STEPS_PER_FRAME,
  HEAP_SETTLE_MAX_STEPS,
  HEAP_SETTLE_TIMEOUT_MS,
  HEAP_SNAPSHOT_VERSION,
  HEAP_STEP_MS,
  LOAD_CONTACT_GAP,
  LOAD_NORMAL_MIN,
  RELEASE_RAISE_STEP,
  PRESS_SPEED,
  TOY_ROOT_COLOR,
  TRAY_EXIT_Z,
  TRAY_ORIGIN,
  TRAY_SIZE,
} from '#src/constants'
import { HeapWorld } from '#src/physics/heap-world'
import {
  type GroundPoint,
  type HeapSnapshot,
  type ShapeKey,
  type SurfaceHit,
  type ToyAppearance,
  type ToyBody,
  type ToyId,
  type ToyPose,
  ToyState,
  type WorldPoint,
} from '#src/types'
import { shiftColor } from '#src/utils/color'
import { getSeparation, polygonsOverlap, projectPolygon } from '#src/utils/geometry'
import { getDomeHeight, pickShape, planDome } from '#src/utils/heap'
import { clamp } from '#src/utils/math'
import { lerpPose } from '#src/utils/motion'
import {
  getDepthCenter,
  getSection,
  getSectionExtent,
  getVariant,
  getVariantCount,
  getWeight,
  placeSection,
  toPlane,
} from '#src/utils/shapes'
import { isHeapSnapshot } from '#src/utils/snapshot'
import type { Random } from '@pixi-demos/core/types'

/**
 * Модель кучи игрушек: физический мир, сами игрушки и очередь призов.
 * Команды фаз меняют мир сразу; кадровый шаг продвигает симуляцию и переносит позы в игрушки.
 */
@injectable()
export class HeapStore {
  constructor() {
    makeObservable(this)
  }

  /** В куче все тела пришли в состояние покоя */
  @observable settled = true

  private world = new HeapWorld()
  private readonly bodies = new Map<ToyId, ToyBody>()
  /** Позы двух последних шагов физики у движущихся тел: между ними интерполируется видимая поза. */
  private readonly frames = new Map<ToyId, { previous: ToyPose; current: ToyPose }>()
  private readonly prizes: ToyAppearance[] = []
  private nextId = 0
  private pendingMs = 0
  private quietMs = 0
  private carried?: ToyBody
  private initialGripOffset: WorldPoint = { x: 0, y: 0, z: 0 }
  private initialAngle = 0
  private grabProgress = 0
  private reducedMotion = false

  /**
   * Восстанавливает проверенный снимок или насыпает купол из случайных форм.
   * Некорректный снимок отклоняется до изменения модели.
   */
  restore(snapshot: HeapSnapshot | undefined, random: Random): void {
    if (snapshot && !isHeapSnapshot(snapshot)) throw new Error('Invalid heap snapshot')

    // Новый мир на каждое наполнение: повторно использованный мир planck теряет детерминизм
    this.world = new HeapWorld()
    this.bodies.clear()
    this.frames.clear()
    this.prizes.length = 0
    this.carried = undefined
    this.pendingMs = 0
    this.quietMs = 0
    // `nextId` не обнуляется: id игрушки уникален на всё время жизни стора. Рендер держит по нему
    // View-компоненты; повторный id связал бы новую игрушку с прежними геометрией и цветом

    if (snapshot) {
      this.load(snapshot)
    } else {
      this.fill(random)
    }

    this.setSettled(true)
  }

  /** Верх кучи под точкой поля: на эту высоту садится клешня. */
  getSurfaceHeightAt(point: GroundPoint): number {
    return this.castDown(point).z
  }

  /** Игрушка, в которую упирается луч, пущенный вниз из точки поля. */
  getTopBodyAt(point: GroundPoint): Readonly<ToyBody> | undefined {
    return this.findTop(point)
  }

  /**
   * Суммарный вес игрушек, лежащих сверху напрямую или через другие игрушки. Касание считается по
   * геометрии сечений в общем срезе: контакты движка между спящими телами не обновляются.
   */
  getLoad(id: ToyId): number {
    const start = this.bodies.get(id)

    if (!start) return 0

    const seen = new Set<ToyId>([id])
    const queue: ToyBody[] = [start]
    let load = 0

    while (queue.length > 0) {
      const current = queue.shift() as ToyBody

      for (const other of this.bodies.values()) {
        if (seen.has(other.id) || other.state !== ToyState.free || !this.restsOn(other, current)) continue

        seen.add(other.id)
        load += getWeight(other.shape)
        queue.push(other)
      }
    }

    return load
  }

  /** Все игрушки кучи: их перебирает рендер. */
  getBodies(): IterableIterator<Readonly<ToyBody>> {
    return this.bodies.values()
  }

  /** Есть ли игрушка в захвате. Владение хранится только в модели. */
  get isHolding(): boolean {
    return this.carried !== undefined
  }

  /** Сколько игрушек дошло до дна лотка и ждёт показа. */
  get prizeCount(): number {
    return this.prizes.length
  }

  /** Забирает из очереди следующий приз. */
  takePrize(): ToyAppearance | undefined {
    return this.prizes.shift()
  }

  /** Снимок согласованного покоя; незавершённое движение сериализовать нельзя. */
  takeSnapshot(collected: number): HeapSnapshot {
    if (!this.settled || this.carried) throw new Error('Heap is not settled')

    return {
      version: HEAP_SNAPSHOT_VERSION,
      collected,
      bodies: [...this.bodies.values()].map(({ shape, variant, slab, pose, color }) => ({
        shape,
        variant,
        slab,
        y: pose.point.y,
        z: pose.point.z,
        angle: pose.angle,
        color,
      })),
    }
  }

  /** Снимает игрушку под точкой поля, сохраняя её видимую позу относительно мировой точки захвата. */
  lift(point: GroundPoint, grip: WorldPoint): ToyId | undefined {
    const body = this.findTop(point)

    if (!body || this.carried) return undefined

    this.frames.delete(body.id)
    this.world.carry(body.id)
    body.state = ToyState.carried
    this.carried = body
    this.initialGripOffset = {
      x: body.pose.point.x - grip.x,
      y: body.pose.point.y - grip.y,
      z: body.pose.point.z - grip.z,
    }
    this.initialAngle = body.pose.angle
    this.grabProgress = 0
    this.touch()

    return body.id
  }

  /** Отпускает игрушку из актуальной точки захвата в срезы под ней: дальше её ведёт физика. */
  release(grip: WorldPoint): void {
    const body = this.carried

    if (!body) return

    this.setGripPoint(grip)
    this.carried = undefined

    const { depth } = getVariant(body.shape, body.variant)
    const slab = clamp(Math.round(body.pose.point.x - depth / 2), 0, GRID_SIZE - depth)
    const pose = this.findFreePose(body, slab, depth)

    body.slab = slab
    body.state = ToyState.free
    body.pose.point.x = getDepthCenter(slab, depth)
    body.pose.point.y = pose.y
    body.pose.point.z = pose.z
    this.world.drop(body.id, slab, depth, pose)
    this.touch()
  }

  /** Отпускает доставленную игрушку над лотком: она падает в шахту без столкновений. */
  dropIntoTray(grip: WorldPoint): void {
    const body = this.carried

    if (!body) return

    this.setGripPoint(grip)
    this.carried = undefined
    body.state = ToyState.exiting
    this.world.ghost(body.id)
    this.touch()
  }

  /** Центрирует игрушку по X/Y и выравнивает её крен на доле анимации захвата 0–1. */
  setGrabProgress(progress: number, grip: WorldPoint): void {
    if (!this.carried) return

    this.grabProgress = progress
    this.setGripPoint(grip)
  }

  /** Обновляет удерживаемую игрушку после движения и качания клешни в этом кадре. */
  setGripPoint(grip: WorldPoint): void {
    const body = this.carried

    if (!body) return

    const remaining = 1 - this.grabProgress
    const { point } = body.pose

    point.x = grip.x + this.initialGripOffset.x * remaining
    point.y = grip.y + this.initialGripOffset.y * remaining
    point.z = grip.z + this.initialGripOffset.z
    body.pose.angle = this.initialAngle * remaining
    this.world.moveCarried(body.id, { y: point.y, z: point.z, angle: body.pose.angle })
  }

  /** Настройку доступности передаёт контроллер; модель не обращается к браузеру. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
  }

  /**
   * Прожимает игрушку под точкой поля весом промахнувшейся клешни: импульс вниз в точке касания.
   * Удар мимо центра игрушку раскачивает, соседи отвечают по физике. При уменьшенном движении не толкает.
   */
  press(point: GroundPoint): void {
    if (this.reducedMotion) return

    const { id, z } = this.castDown(point)
    const body = id === undefined ? undefined : this.bodies.get(id)

    if (!body || body.state !== ToyState.free) return

    this.world.push(body.id, { y: 0, z: -getWeight(body.shape) * PRESS_SPEED }, { y: point.y, z })
    this.touch()
  }

  /**
   * Кадровый шаг кучи: продвигает физику фиксированными шагами и засчитывает призы.
   * Видимая поза движущегося тела интерполируется между двумя последними шагами на долю остатка кадра.
   */
  advance(deltaMs: number): void {
    if (this.world.hasAwake()) {
      if (this.reducedMotion) {
        this.settleWorld(true)
        this.pendingMs = 0
      } else {
        this.pendingMs += deltaMs

        for (let step = 0; step < HEAP_MAX_STEPS_PER_FRAME && this.pendingMs >= HEAP_STEP_MS; step++) {
          this.stepWorld(true)
          this.pendingMs -= HEAP_STEP_MS
        }

        // Остаток длинного кадра отбрасывается: догонять его следующими кадрами незачем
        this.pendingMs = Math.min(this.pendingMs, HEAP_STEP_MS)
      }

      this.quietMs += deltaMs
      if (this.quietMs >= HEAP_SETTLE_TIMEOUT_MS) this.world.sleepAll()
    } else {
      this.pendingMs = 0
    }

    if (this.frames.size > 0) this.applyFrames(this.pendingMs / HEAP_STEP_MS)
    this.setSettled(!this.carried && !this.world.hasAwake())
  }

  @action private setSettled(settled: boolean): void {
    if (this.settled !== settled) this.settled = settled
  }

  /** Отмечает команду, которая сдвинула кучу: с неё отсчитывается страховка покоя. */
  private touch(): void {
    this.quietMs = 0
    this.setSettled(false)
  }

  /** Лежит ли `upper` на `lower`: игрушки делят срез, их сечения касаются, и нормаль касания смотрит вверх. */
  private restsOn(upper: ToyBody, lower: ToyBody): boolean {
    const upperDepth = getVariant(upper.shape, upper.variant).depth
    const lowerDepth = getVariant(lower.shape, lower.variant).depth

    if (upper.slab >= lower.slab + lowerDepth || lower.slab >= upper.slab + upperDepth) return false

    const top = toPlane(
      placeSection(getSection(upper.shape, upper.variant), { ...upper.pose.point, angle: upper.pose.angle })
    )
    const bottom = toPlane(
      placeSection(getSection(lower.shape, lower.variant), { ...lower.pose.point, angle: lower.pose.angle })
    )
    const { axis, gap } = getSeparation(bottom, top)

    if (gap > LOAD_CONTACT_GAP) return false

    // Ось разделения направляется от нижней игрушки к верхней по центрам их проекций
    const bottomSide = projectPolygon(bottom, axis)
    const topSide = projectPolygon(top, axis)
    const sign = topSide.min + topSide.max >= bottomSide.min + bottomSide.max ? 1 : -1

    return axis.y * sign >= LOAD_NORMAL_MIN
  }

  private castDown(point: GroundPoint): SurfaceHit {
    return this.world.castDown(point.y, clamp(Math.floor(point.x), 0, GRID_SIZE - 1), 1)
  }

  private findTop(point: GroundPoint): ToyBody | undefined {
    const { id } = this.castDown(point)
    const body = id === undefined ? undefined : this.bodies.get(id)

    return body?.state === ToyState.free ? body : undefined
  }

  private create(shape: ShapeKey, variant: number, slab: number, pose: ToyPose, color: number, awake: boolean): void {
    this.nextId += 1

    const { depth } = getVariant(shape, variant)
    const body: ToyBody = {
      id: this.nextId,
      shape,
      variant,
      color,
      slab,
      pose: { point: { x: getDepthCenter(slab, depth), y: pose.y, z: pose.z }, angle: pose.angle },
      state: ToyState.free,
    }

    this.bodies.set(body.id, body)
    this.world.add(body.id, getSection(shape, variant), getWeight(shape), slab, depth, pose, awake)
  }

  private load(snapshot: HeapSnapshot): void {
    for (const { shape, variant, slab, y, z, angle, color } of snapshot.bodies) {
      this.create(shape, variant, slab, { y, z, angle }, color, false)
    }
  }

  /**
   * Насыпает купол: каждая новая игрушка пробует несколько случайных мест и встаёт туда, где верх кучи
   * дальше всего ниже профиля купола. Между пачками появлений мир делает шаги, в конце — до сна всех тел.
   */
  private fill(random: Random): void {
    const dome = planDome(random)
    let volume = 0
    let failures = 0
    let spawned = 0

    while (volume < FILL_VOLUME && failures < FILL_MAX_FAILURES) {
      const shape = pickShape(random)
      const variant = Math.floor(random() * getVariantCount(shape))
      const { depth } = getVariant(shape, variant)
      const { halfWidth, halfHeight } = getSectionExtent(getSection(shape, variant))
      let best: { slab: number; y: number; surface: number; deficit: number } | undefined

      for (let candidate = 0; candidate < FILL_CANDIDATES; candidate++) {
        const slab = Math.floor(random() * (GRID_SIZE - depth + 1))
        // Над шахтой лотка игрушка не появляется: там нет пола
        const right = slab < TRAY_ORIGIN.x + TRAY_SIZE ? TRAY_ORIGIN.y : GRID_SIZE
        const y = halfWidth + random() * (right - 2 * halfWidth)
        const surface = Math.max(
          this.world.castDown(y - halfWidth, slab, depth).z,
          this.world.castDown(y, slab, depth).z,
          this.world.castDown(y + halfWidth, slab, depth).z
        )
        const deficit = getDomeHeight(dome, { x: getDepthCenter(slab, depth), y }) - (surface + halfHeight)

        if (!best || deficit > best.deficit) best = { slab, y, surface, deficit }
      }

      if (!best || best.deficit <= 0) {
        failures += 1
        continue
      }

      failures = 0
      this.create(
        shape,
        variant,
        best.slab,
        { y: best.y, z: best.surface + halfHeight + FILL_SPAWN_GAP, angle: (random() * 2 - 1) * FILL_MAX_TILT },
        shiftColor(TOY_ROOT_COLOR, random),
        true
      )
      volume += getWeight(shape)
      spawned += 1

      if (spawned % FILL_BATCH === 0) {
        for (let step = 0; step < FILL_BATCH_STEPS; step++) this.stepWorld(false)
      }
    }

    this.settleWorld(false)
    this.world.sleepAll()
    this.applyFrames(1)
  }

  /**
   * Поза отпускания: игрушка остаётся в точке захвата внутри куба по оси `y` и поднимается, пока её
   * сечение пересекает игрушки тех же срезов.
   */
  private findFreePose(body: ToyBody, slab: number, depth: number): ToyPose {
    const section = getSection(body.shape, body.variant)
    const { angle } = body.pose
    const turned = placeSection(section, { y: 0, z: 0, angle })
    const left = -Math.min(...turned.map(({ y }) => y))
    const right = GRID_SIZE - Math.max(...turned.map(({ y }) => y))
    const pose = { y: clamp(body.pose.point.y, left, right), z: body.pose.point.z, angle }

    while (pose.z < CUBE_HEIGHT) {
      const placed = placeSection(section, pose)
      const blocked = this.world.queryToys(placed, slab, depth).some((id) => {
        const other = this.bodies.get(id)

        return (
          other !== undefined &&
          other.state === ToyState.free &&
          polygonsOverlap(
            toPlane(placed),
            toPlane(
              placeSection(getSection(other.shape, other.variant), { ...other.pose.point, angle: other.pose.angle })
            ),
            RELEASE_RAISE_STEP / 2
          )
        )
      })

      if (!blocked) break

      pose.z += RELEASE_RAISE_STEP
    }

    return pose
  }

  /** Шаги мира до сна всех тел, не больше `HEAP_SETTLE_MAX_STEPS`. */
  private settleWorld(collect: boolean): void {
    for (let step = 0; step < HEAP_SETTLE_MAX_STEPS && this.world.hasAwake(); step++) this.stepWorld(collect)
  }

  /**
   * Один шаг мира. Позы шага запоминаются только у тел, которые двигались: у спящих видимая поза остаётся
   * прежней, у восстановленных — значением из снимка. Игрушка ниже `TRAY_EXIT_Z` уходит из кучи и при
   * `collect` становится призом.
   */
  private stepWorld(collect: boolean): void {
    const moving: ToyBody[] = []

    for (const body of this.bodies.values()) {
      if (body.state === ToyState.carried || !this.world.isAwake(body.id)) continue

      const frame = this.frames.get(body.id)

      if (frame) {
        frame.previous = frame.current
      } else {
        const pose = this.world.getPose(body.id)

        this.frames.set(body.id, { previous: pose, current: pose })
      }

      moving.push(body)
    }

    this.world.step(HEAP_STEP_MS)

    for (const body of moving) {
      const current = this.world.getPose(body.id)
      const frame = this.frames.get(body.id)

      if (frame) frame.current = current
      if (current.z > TRAY_EXIT_Z) continue

      this.world.remove(body.id)
      this.bodies.delete(body.id)
      this.frames.delete(body.id)
      if (collect) this.prizes.push({ shape: body.shape, color: body.color })
    }
  }

  /** Переносит в игрушки позы между шагами на доле `share`; уснувшее тело получает точную позу последнего шага. */
  private applyFrames(share: number): void {
    for (const [id, { previous, current }] of this.frames) {
      const body = this.bodies.get(id)

      if (!body) {
        this.frames.delete(id)
        continue
      }

      const asleep = !this.world.isAwake(id)
      const pose = asleep ? current : lerpPose(previous, current, share)

      body.pose.point.y = pose.y
      body.pose.point.z = pose.z
      body.pose.angle = pose.angle
      if (asleep) this.frames.delete(id)
    }
  }
}
