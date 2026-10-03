import type { HeapSnapshotBody, ToyId, ToyPose } from '#src/types'
import { getContactSection, getDepth, getSection, getWeight } from '#src/utils/shapes'
import { isReducedMotion } from '@pixi-demos/core/accessibility'

import { HEAP_MAX_STEPS_PER_FRAME, HEAP_SETTLE_MAX_STEPS, HEAP_SETTLE_TIMEOUT_MS, HEAP_STEP_MS } from './constants'
import { HeapWorld } from './heap-world'
import { type ToyBody, ToyState, type WorldStatics } from './types'
import { lerpPose } from './utils'

/**
 * Куча игрушек на физике: мир planck, игрушки и их видимые позы. Общая часть кучи в кубе и кучи призов на полу.
 * Команды наследников меняют мир сразу; кадровый шаг продвигает симуляцию и переносит позы в игрушки.
 */
export abstract class ToyPile {
  protected world: HeapWorld
  protected readonly bodies = new Map<ToyId, ToyBody>()
  /** Позы двух последних шагов физики у движущихся тел: между ними интерполируется видимая поза. */
  protected readonly frames = new Map<ToyId, { previous: ToyPose; current: ToyPose }>()
  private readonly statics: WorldStatics
  private nextId = 0
  private pendingMs = 0
  private quietMs = 0

  protected constructor(statics: WorldStatics) {
    this.statics = statics
    this.world = new HeapWorld(statics)
  }

  /**
   * Загружает кучу из поз покоя: тела создаются спящими и до первого возмущения не двигаются.
   * Позы не проверяются: снимок из хранилища проверяет стартовая фаза.
   */
  restore(bodies: readonly HeapSnapshotBody[]): void {
    // Новый мир на каждое восстановление: повторно использованный мир не подходит - planck теряет детерминизм
    this.world = new HeapWorld(this.statics)
    this.bodies.clear()
    this.frames.clear()
    this.pendingMs = 0
    this.quietMs = 0
    // `nextId` не обнуляется: id игрушки уникален на всё время жизни модели. Рендер держит по нему
    // View-компоненты; повторный id связал бы новую игрушку с прежними геометрией и цветом, что вызовет визуальные баги.

    for (const body of bodies) this.create(body, false)
  }

  /** Все игрушки кучи: их перебирает рендер. */
  getBodies(): IterableIterator<Readonly<ToyBody>> {
    return this.bodies.values()
  }

  /** Число игрушек в куче. */
  get toyCount(): number {
    return this.bodies.size
  }

  /** Куча в покое: все тела уснули. */
  get settled(): boolean {
    return !this.world.hasAwake()
  }

  /** Позы покоя игрушек для снимка; незавершённое движение сериализовать нельзя. */
  takeSnapshot(): HeapSnapshotBody[] {
    if (!this.settled) throw new Error('Heap is not settled')

    return [...this.bodies.values()].map(({ slab, pose, toy, hasLamp }) => ({
      slab,
      y: pose.point.y,
      z: pose.point.z,
      angle: pose.angle,
      toy,
      hasLamp,
    }))
  }

  /** Мировая координата `x` центра игрушки, занимающей срезы от `slab` на глубину `depth`. */
  protected abstract getDepthX(slab: number, depth: number): number

  /** Разбирает позу движущегося тела после шага физики: так наследник убирает тела, покинувшие кучу. */
  protected onStepped(_body: ToyBody, _pose: ToyPose): void {}

  /** Добавляет игрушку в срезы от `slab`: спящей в позе покоя или падающей. */
  protected create(
    { slab, y, z, angle, toy, hasLamp }: Readonly<HeapSnapshotBody>,
    awake: boolean
  ): ToyBody {
    this.nextId += 1

    const depth = getDepth(toy)
    const body: ToyBody = {
      id: this.nextId,
      toy,
      hasLamp,
      slab,
      pose: { point: { x: this.getDepthX(slab, depth), y, z }, angle },
      state: ToyState.free,
    }

    this.bodies.set(body.id, body)
    this.world.add(body.id, getSection(toy), getContactSection(toy), getWeight(toy), slab, depth, { y, z, angle }, awake)

    return body
  }

  /** Убирает игрушку из мира и из кучи. */
  protected remove(id: ToyId): void {
    this.world.remove(id)
    this.bodies.delete(id)
    this.frames.delete(id)
  }

  /** Отмечает команду, которая сдвинула кучу: с неё отсчитывается страховка покоя. */
  protected touch(): void {
    this.quietMs = 0
  }

  /**
   * Продвигает физику фиксированными шагами. Видимая поза движущегося тела интерполируется между двумя последними
   * шагами по остатку кадра; при уменьшенном движении куча приходит в покой за один кадр.
   */
  protected advanceWorld(deltaMs: number): void {
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

  /** Шаги мира до сна всех тел, не больше `HEAP_SETTLE_MAX_STEPS`. */
  private settleWorld(): void {
    for (let step = 0; step < HEAP_SETTLE_MAX_STEPS && this.world.hasAwake(); step++) this.stepWorld()
  }

  /**
   * Один шаг мира. Позы шага запоминаются только у тел, которые двигались: у спящих видимая поза остаётся
   * прежней, у восстановленных — позой из `restore`.
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
      this.onStepped(body, current)
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
