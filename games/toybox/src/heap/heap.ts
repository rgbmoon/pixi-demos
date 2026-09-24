import { injectable } from 'inversify'

import { CLAW_GRAB_MS, CLAW_RAMP_SHARE, CUBE_HEIGHT, GRID_SIZE } from '#src/constants'
import type { GroundPoint, HeapSnapshotBody, ShapeKey, ToyAppearance, ToyId, ToyPose, WorldPoint } from '#src/types'
import { getSeparation, polygonsOverlap, projectPolygon } from '#src/utils/geometry'
import { clamp } from '#src/utils/math'
import { getDepthCenter, getSection, getVariant, getWeight, placeSection, toPlane } from '#src/utils/shapes'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import { easeTrapezoid } from '@pixi-demos/core/easing'

import {
  GRAB_BASE_CHANCE,
  GRAB_LOAD_PENALTY,
  GRAB_MAX_CHANCE,
  GRAB_MIN_CHANCE,
  GRAB_WEIGHT_PENALTY,
  HEAP_MAX_STEPS_PER_FRAME,
  HEAP_SETTLE_MAX_STEPS,
  HEAP_SETTLE_TIMEOUT_MS,
  HEAP_STEP_MS,
  LOAD_CONTACT_GAP,
  LOAD_NORMAL_MIN,
  PRESS_SPEED,
  RELEASE_RAISE_STEP,
  TRAY_EXIT_Z,
} from './constants'
import { HeapWorld } from './heap-world'
import { type SurfaceHit, type ToyBody, ToyState } from './types'
import { lerpPose } from './utils'

/**
 * Модель кучи игрушек: физический мир, сами игрушки и очередь призов.
 * Команды фаз меняют мир сразу; кадровый шаг продвигает симуляцию и переносит позы в игрушки.
 */
@injectable()
export class Heap {
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
  /** Время посадки игрушки в клешню с момента `lift`; не больше `CLAW_GRAB_MS`. */
  private grabMs = 0

  /**
   * Загружает кучу из поз покоя: тела создаются спящими и до первого возмущения не двигаются.
   * Позы не проверяются: снимок из хранилища проверяет стартовая фаза.
   */
  restore(bodies: readonly HeapSnapshotBody[]): void {
    // Новый мир на каждое восстановление: повторно использованный мир planck теряет детерминизм
    this.world = new HeapWorld()
    this.bodies.clear()
    this.frames.clear()
    this.prizes.length = 0
    this.carried = undefined
    this.pendingMs = 0
    this.quietMs = 0
    // `nextId` не обнуляется: id игрушки уникален на всё время жизни модели. Рендер держит по нему
    // View-компоненты; повторный id связал бы новую игрушку с прежними геометрией и цветом

    for (const { shape, variant, slab, y, z, angle, color } of bodies) {
      this.create(shape, variant, slab, { y, z, angle }, color)
    }
  }

  /** Верх кучи под точкой поля: на эту высоту садится клешня. */
  getSurfaceHeightAt(point: GroundPoint): number {
    return this.castDown(point).z
  }

  /** Игрушка, в которую упирается луч, пущенный вниз из точки поля. */
  getTopBodyAt(point: GroundPoint): Readonly<ToyBody> | undefined {
    const { id } = this.castDown(point)
    const body = id === undefined ? undefined : this.bodies.get(id)

    return body?.state === ToyState.free ? body : undefined
  }

  /** Доля успешных захватов игрушки под точкой поля: шанс снижают её вес и нагрузка сверху. Над пустым местом — 0. */
  getGrabChance(point: GroundPoint): number {
    const body = this.getTopBodyAt(point)

    if (!body) return 0

    return clamp(
      GRAB_BASE_CHANCE / (1 + GRAB_WEIGHT_PENALTY * getWeight(body.shape) + GRAB_LOAD_PENALTY * this.getLoad(body.id)),
      GRAB_MIN_CHANCE,
      GRAB_MAX_CHANCE
    )
  }

  /** Все игрушки кучи: их перебирает рендер. */
  getBodies(): IterableIterator<Readonly<ToyBody>> {
    return this.bodies.values()
  }

  /** Куча в покое: все тела уснули и клешня пуста. */
  get settled(): boolean {
    return !this.carried && !this.world.hasAwake()
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

  /** Позы покоя игрушек для снимка; незавершённое движение сериализовать нельзя. */
  takeSnapshot(): HeapSnapshotBody[] {
    if (!this.settled) throw new Error('Heap is not settled')

    return [...this.bodies.values()].map(({ shape, variant, slab, pose, color }) => ({
      shape,
      variant,
      slab,
      y: pose.point.y,
      z: pose.point.z,
      angle: pose.angle,
      color,
    }))
  }

  /**
   * Снимает игрушку под точкой поля, сохраняя её видимую позу относительно мировой точки захвата, и начинает
   * посадку в клешню. Отвечает, снята ли игрушка.
   */
  lift(point: GroundPoint, grip: WorldPoint): boolean {
    const top = this.getTopBodyAt(point)
    const body = top && this.bodies.get(top.id)

    if (!body || this.carried) return false

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
    this.grabMs = 0
    this.touch()

    return true
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

  /**
   * Прожимает игрушку под точкой поля весом промахнувшейся клешни: импульс вниз в точке касания.
   * Удар мимо центра игрушку раскачивает, соседи отвечают по физике. При уменьшенном движении не толкает.
   */
  press(point: GroundPoint): void {
    if (isReducedMotion()) return

    const { id, z } = this.castDown(point)
    const body = id === undefined ? undefined : this.bodies.get(id)

    if (!body || body.state !== ToyState.free) return

    this.world.push(body.id, { y: 0, z: -getWeight(body.shape) * PRESS_SPEED }, { y: point.y, z })
    this.touch()
  }

  /**
   * Кадровый шаг кучи: ведёт игрушку в клешне за точкой захвата, продвигает физику фиксированными шагами и
   * засчитывает призы. Видимая поза движущегося тела интерполируется между двумя последними шагами по остатку кадра.
   */
  advance(deltaMs: number, grip: WorldPoint): void {
    if (this.carried) {
      this.grabMs = isReducedMotion() ? CLAW_GRAB_MS : Math.min(this.grabMs + deltaMs, CLAW_GRAB_MS)
      this.setGripPoint(grip)
    }

    if (this.world.hasAwake()) {
      if (isReducedMotion()) {
        this.settleWorld()
        this.pendingMs = 0
      } else {
        this.pendingMs += deltaMs

        for (let step = 0; step < HEAP_MAX_STEPS_PER_FRAME && this.pendingMs >= HEAP_STEP_MS; step++) {
          this.stepWorld()
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
  }

  /** Отмечает команду, которая сдвинула кучу: с неё отсчитывается страховка покоя. */
  private touch(): void {
    this.quietMs = 0
  }

  /**
   * Ставит удерживаемую игрушку за точкой захвата после движения и качания клешни в этом кадре. За время
   * посадки игрушка по `easeTrapezoid` центрируется под точкой захвата и выравнивает крен.
   */
  private setGripPoint(grip: WorldPoint): void {
    const body = this.carried

    if (!body) return

    const remaining = 1 - easeTrapezoid(this.grabMs / CLAW_GRAB_MS, CLAW_RAMP_SHARE)
    const { point } = body.pose

    point.x = grip.x + this.initialGripOffset.x * remaining
    point.y = grip.y + this.initialGripOffset.y * remaining
    point.z = grip.z + this.initialGripOffset.z
    body.pose.angle = this.initialAngle * remaining
    this.world.moveCarried(body.id, { y: point.y, z: point.z, angle: body.pose.angle })
  }

  /**
   * Суммарный вес игрушек, лежащих сверху напрямую или через другие игрушки. Касание считается по
   * геометрии сечений в общем срезе: контакты движка между спящими телами не обновляются.
   */
  private getLoad(id: ToyId): number {
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

  private create(shape: ShapeKey, variant: number, slab: number, pose: ToyPose, color: number): void {
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
    this.world.add(body.id, getSection(shape, variant), getWeight(shape), slab, depth, pose, false)
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
  private settleWorld(): void {
    for (let step = 0; step < HEAP_SETTLE_MAX_STEPS && this.world.hasAwake(); step++) this.stepWorld()
  }

  /**
   * Один шаг мира. Позы шага запоминаются только у тел, которые двигались: у спящих видимая поза остаётся
   * прежней, у восстановленных — позой из `restore`. Игрушка ниже `TRAY_EXIT_Z` уходит из кучи в очередь призов.
   */
  private stepWorld(): void {
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
      this.prizes.push({ shape: body.shape, color: body.color })
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
