import { Box, Polygon, World } from 'planck'
import type { Body, Fixture } from 'planck'

import { CUBE_HEIGHT } from '#src/constants'
import type { SectionPoint, ToyId, ToyPose } from '#src/types'
import { getSectionArea } from '#src/utils/shapes'

import {
  COLLISION_FAR_SPAN,
  COLLISION_STATIC,
  HEAP_GRAVITY,
  TOY_ANGULAR_DAMPING,
  TOY_FRICTION,
  TOY_LINEAR_DAMPING,
  TOY_RESTITUTION,
  TRAY_EXIT_Z,
  WAKE_MARGIN,
} from './constants'
import type { CollisionFilter, SurfaceHit, WorldStatics } from './types'

/**
 * Физический мир кучи на planck: плоскость `(y, z)` с креном, статика из конфига, тела игрушек по id.
 * Срезы глубины разводят тела битами фильтра. У тела две фикстуры: полное сечение сталкивается со статикой и задаёт
 * массу, сечение касания — с другими игрушками. Единственный модуль игры, который может импортировать движок planck, потребители физики идут через него.
 */
export class HeapWorld {
  private readonly world = new World({ gravity: { x: 0, y: -HEAP_GRAVITY } })
  private readonly bodies = new Map<ToyId, Body>()
  private readonly spanEdge: number | undefined

  constructor({ boxes, spanEdge }: WorldStatics) {
    const ground = this.world.createBody({ type: 'static' })

    this.spanEdge = spanEdge

    for (const { y, z, width, height, mask } of boxes) {
      ground.createFixture({
        shape: new Box(width / 2, height / 2, { x: y, y: z }),
        friction: TOY_FRICTION,
        filterCategoryBits: COLLISION_STATIC,
        filterMaskBits: mask,
      })
    }
  }

  /** Добавляет тело игрушки в срезы от `slab` на глубину `depth`; масса тела равна весу игрушки. */
  add(
    id: ToyId,
    section: readonly SectionPoint[],
    contact: readonly SectionPoint[],
    weight: number,
    slab: number,
    depth: number,
    { y, z, angle }: ToyPose,
    awake: boolean
  ): void {
    const body = this.world.createBody({
      type: 'dynamic',
      position: { x: y, y: z },
      angle,
      linearDamping: TOY_LINEAR_DAMPING,
      angularDamping: TOY_ANGULAR_DAMPING,
      awake,
      userData: id,
    })

    body.createFixture({
      shape: new Polygon(contact.map((point) => ({ x: point.y, y: point.z }))),
      density: 0,
      friction: TOY_FRICTION,
      restitution: TOY_RESTITUTION,
    })
    // Id несёт только полное сечение: лучи и запросы видят игрушку по нему
    body.createFixture({
      shape: new Polygon(section.map((point) => ({ x: point.y, y: point.z }))),
      density: weight / getSectionArea(section),
      friction: TOY_FRICTION,
      restitution: TOY_RESTITUTION,
      userData: id,
    })
    this.setFilters(body, slab, depth)
    this.bodies.set(id, body)
  }

  /** Убирает тело игрушки из мира. */
  remove(id: ToyId): void {
    const body = this.bodies.get(id)

    if (!body) return

    this.bodies.delete(id)
    this.world.destroyBody(body)
  }

  /** Поза тела: центр в плоскости сечения и крен. */
  getPose(id: ToyId): ToyPose {
    const body = this.getBody(id)
    const { x, y } = body.getPosition()

    return { y: x, z: y, angle: body.getAngle() }
  }

  /**
   * Забирает игрушку в клешню: она перестаёт сталкиваться и двигается только через `moveCarried`.
   * Игрушки вокруг неё будятся заранее, чтобы лежавшие сверху упали. Сам planck будит соседей только через
   * контакты, а у игрушек, которые не двигались с загрузки кучи, контактов ещё нет.
   */
  carry(id: ToyId): void {
    const body = this.getBody(id)
    const { lowerBound, upperBound } = HeapWorld.getHull(body).getAABB(0)

    this.world.queryAABB(
      {
        lowerBound: { x: lowerBound.x - WAKE_MARGIN, y: lowerBound.y - WAKE_MARGIN },
        upperBound: { x: upperBound.x + WAKE_MARGIN, y: upperBound.y + WAKE_MARGIN },
      },
      (other) => {
        if (other.getBody() !== body && other.getBody().isDynamic()) other.getBody().setAwake(true)

        return true
      }
    )

    body.setType('kinematic')
    HeapWorld.disableCollisions(body)
    body.setLinearVelocity({ x: 0, y: 0 })
    body.setAngularVelocity(0)
  }

  /** Ставит тело в клешне в позу. */
  moveCarried(id: ToyId, { y, z, angle }: ToyPose): void {
    this.getBody(id).setTransform({ x: y, y: z }, angle)
  }

  /** Отпускает тело в срезы от `slab` на глубину `depth`: оно снова падает и сталкивается. */
  drop(id: ToyId, slab: number, depth: number, { y, z, angle }: ToyPose): void {
    const body = this.getBody(id)

    body.setTransform({ x: y, y: z }, angle)
    body.setType('dynamic')
    this.setFilters(body, slab, depth)
    body.setAwake(true)
  }

  /** Тело падает без столкновений: так игрушка уходит в шахту лотка. */
  ghost(id: ToyId): void {
    const body = this.getBody(id)

    body.setType('dynamic')
    HeapWorld.disableCollisions(body)
    body.setLinearVelocity({ x: 0, y: 0 })
    body.setAngularVelocity(0)
    body.setAwake(true)
  }

  /** Толкает тело импульсом `impulse`, приложенным в точке `point` плоскости сечения. */
  push(id: ToyId, impulse: SectionPoint, point: SectionPoint): void {
    this.getBody(id).applyLinearImpulse({ x: impulse.y, y: impulse.z }, { x: point.y, y: point.z }, true)
  }

  /** Шаг симуляции на `ms` миллисекунд. */
  step(ms: number): void {
    this.world.step(ms / 1000)
  }

  /** Двигается ли тело: не уснуло или удерживается клешнёй. */
  isAwake(id: ToyId): boolean {
    return this.getBody(id).isAwake()
  }

  /** Есть ли подвижное тело, которое ещё не уснуло. */
  hasAwake(): boolean {
    for (const body of this.bodies.values()) {
      if (body.isDynamic() && body.isAwake()) return true
    }

    return false
  }

  /** Усыпляет все подвижные тела. */
  sleepAll(): void {
    for (const body of this.bodies.values()) {
      if (body.isDynamic()) body.setAwake(false)
    }
  }

  /**
   * Верх кучи под точкой `y` в срезах от `slab` на глубину `depth`: луч сверху упирается в первое тело
   * или статику, с которыми столкнулась бы игрушка этих срезов. Без попадания верх равен полу.
   */
  castDown(y: number, slab: number, depth: number): SurfaceHit {
    const { category } = this.getFilters(slab, depth).hull
    let hit: SurfaceHit = { id: undefined, z: 0 }

    this.world.rayCast({ x: y, y: CUBE_HEIGHT }, { x: y, y: TRAY_EXIT_Z }, (fixture, point, _normal, fraction) => {
      if (!HeapWorld.blocks(fixture, category)) return -1

      hit = { id: HeapWorld.getToyId(fixture), z: point.y }

      return fraction
    })

    return hit
  }

  /** Игрушки срезов от `slab` на глубину `depth`, чьи рамки пересекают рамку сечения. */
  queryToys(section: readonly SectionPoint[], slab: number, depth: number): ToyId[] {
    const { category } = this.getFilters(slab, depth).hull
    const found = new Set<ToyId>()
    const ys = section.map(({ y }) => y)
    const zs = section.map(({ z }) => z)

    this.world.queryAABB(
      {
        lowerBound: { x: Math.min(...ys), y: Math.min(...zs) },
        upperBound: { x: Math.max(...ys), y: Math.max(...zs) },
      },
      (fixture) => {
        const id = HeapWorld.getToyId(fixture)

        if (id !== undefined && HeapWorld.blocks(fixture, category)) found.add(id)

        return true
      }
    )

    return [...found]
  }

  private getBody(id: ToyId): Body {
    const body = this.bodies.get(id)

    if (!body) throw new Error(`Unknown toy ${id}`)

    return body
  }

  private setFilters(body: Body, slab: number, depth: number): void {
    const { hull, contact } = this.getFilters(slab, depth)

    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
      const { category, mask } = HeapWorld.getToyId(fixture) === undefined ? contact : hull

      fixture.setFilterData({ groupIndex: 0, categoryBits: category, maskBits: mask })
    }
  }

  /**
   * Фильтры фикстур игрушки. Полное сечение несёт биты срезов, у игрушки по обе стороны от `spanEdge` — ещё бит стенки
   * на этой границе, и сталкивается только со статикой. Сечение касания сталкивается только с игрушками общих срезов.
   */
  private getFilters(slab: number, depth: number): { hull: CollisionFilter; contact: CollisionFilter } {
    const slabs = ((1 << depth) - 1) << slab
    const { spanEdge } = this
    const spansEdge = spanEdge !== undefined && slab < spanEdge && slab + depth > spanEdge

    return {
      hull: { category: slabs | (spansEdge ? COLLISION_FAR_SPAN : 0), mask: COLLISION_STATIC },
      contact: { category: slabs, mask: slabs },
    }
  }

  private static disableCollisions(body: Body): void {
    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
      fixture.setFilterData({ groupIndex: 0, categoryBits: fixture.getFilterCategoryBits(), maskBits: 0 })
    }
  }

  /**
   * Преграда для полного сечения игрушки с битами `category`: статика, в которую оно упрётся, или полное сечение
   * игрушки общих срезов. Игрушка в клешне и падающая в шахту преградой не служат.
   */
  private static blocks(fixture: Fixture, category: number): boolean {
    if (fixture.getBody().isStatic()) return (fixture.getFilterMaskBits() & category) !== 0

    return (
      HeapWorld.getToyId(fixture) !== undefined &&
      fixture.getFilterMaskBits() !== 0 &&
      (fixture.getFilterCategoryBits() & category) !== 0
    )
  }

  /** Фикстура полного сечения тела. */
  private static getHull(body: Body): Fixture {
    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
      if (HeapWorld.getToyId(fixture) !== undefined) return fixture
    }

    throw new Error('Toy body without a hull fixture')
  }

  private static getToyId(fixture: Fixture): ToyId | undefined {
    const id = fixture.getUserData()

    return typeof id === 'number' ? id : undefined
  }
}
