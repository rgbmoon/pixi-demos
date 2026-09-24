import { Box, Polygon, World } from 'planck'
import type { Body, Fixture } from 'planck'

import { CUBE_HEIGHT, GRID_SIZE, TRAY_ORIGIN, TRAY_SIZE, TRAY_WALL_HEIGHT } from '#src/constants'
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
  TRAY_WALL_THICKNESS,
  WAKE_MARGIN,
  WALL_THICKNESS,
} from './constants'
import type { CollisionFilter, SurfaceHit } from './types'

/**
 * Физический мир кучи на planck: плоскость `(y, z)` с креном, статика куба и лотка, тела игрушек по id.
 * Срезы глубины разводят тела битами фильтра. Единственный модуль игры, который импортирует движок planck.
 */
export class HeapWorld {
  private readonly world = new World({ gravity: { x: 0, y: -HEAP_GRAVITY } })
  private readonly bodies = new Map<ToyId, Body>()

  constructor() {
    const ground = this.world.createBody({ type: 'static' })
    const allSlabs = (1 << GRID_SIZE) - 1
    const traySlabs = ((1 << TRAY_SIZE) - 1) << TRAY_ORIGIN.x
    const wallHeight = CUBE_HEIGHT - TRAY_EXIT_Z + WALL_THICKNESS
    const wallCenter = (CUBE_HEIGHT + TRAY_EXIT_Z - WALL_THICKNESS) / 2
    const trayWallHeight = TRAY_WALL_HEIGHT - TRAY_EXIT_Z + WALL_THICKNESS
    const addStatic = (width: number, height: number, y: number, z: number, mask: number) =>
      ground.createFixture({
        shape: new Box(width / 2, height / 2, { x: y, y: z }),
        friction: TOY_FRICTION,
        filterCategoryBits: COLLISION_STATIC,
        filterMaskBits: mask,
      })

    // Пол перед шахтой лотка — во всех срезах, над шахтой — только в срезах за лотком
    addStatic(TRAY_ORIGIN.y, WALL_THICKNESS, TRAY_ORIGIN.y / 2, -WALL_THICKNESS / 2, allSlabs)
    addStatic(
      GRID_SIZE - TRAY_ORIGIN.y,
      WALL_THICKNESS,
      (GRID_SIZE + TRAY_ORIGIN.y) / 2,
      -WALL_THICKNESS / 2,
      allSlabs & ~traySlabs
    )
    addStatic(WALL_THICKNESS, wallHeight, -WALL_THICKNESS / 2, wallCenter, allSlabs)
    addStatic(WALL_THICKNESS, wallHeight, GRID_SIZE + WALL_THICKNESS / 2, wallCenter, allSlabs)
    addStatic(
      TRAY_WALL_THICKNESS,
      trayWallHeight,
      TRAY_ORIGIN.y,
      (TRAY_WALL_HEIGHT + TRAY_EXIT_Z - WALL_THICKNESS) / 2,
      traySlabs
    )
    // Дальняя стенка лотка стоит на границе срезов: в неё упирается только игрушка, занимающая оба
    addStatic(
      GRID_SIZE - TRAY_ORIGIN.y,
      TRAY_WALL_HEIGHT,
      (GRID_SIZE + TRAY_ORIGIN.y) / 2,
      TRAY_WALL_HEIGHT / 2,
      COLLISION_FAR_SPAN
    )
  }

  /** Добавляет тело игрушки в срезы от `slab` на глубину `depth`; масса тела равна весу игрушки. */
  add(
    id: ToyId,
    section: readonly SectionPoint[],
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
    const { category, mask } = HeapWorld.getFilter(slab, depth)

    body.createFixture({
      shape: new Polygon(section.map((point) => ({ x: point.y, y: point.z }))),
      density: weight / getSectionArea(section),
      friction: TOY_FRICTION,
      restitution: TOY_RESTITUTION,
      userData: id,
      filterCategoryBits: category,
      filterMaskBits: mask,
    })
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
   * Переводит тело в клешню: оно перестаёт сталкиваться и двигается только через `moveCarried`.
   * Соседей тело будит заранее по своей рамке: смена фильтра в Box2D спящие тела не будит, а контактов
   * между телами, уснувшими до первого шага, у движка ещё нет.
   */
  carry(id: ToyId): void {
    const body = this.getBody(id)
    const fixture = body.getFixtureList()

    if (fixture) {
      const { lowerBound, upperBound } = fixture.getAABB(0)

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
    }

    body.setType('kinematic')
    this.setMask(body, 0)
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
    const fixture = body.getFixtureList()
    const { category, mask } = HeapWorld.getFilter(slab, depth)

    body.setTransform({ x: y, y: z }, angle)
    body.setType('dynamic')
    fixture?.setFilterData({ groupIndex: 0, categoryBits: category, maskBits: mask })
    body.setAwake(true)
  }

  /** Тело падает без столкновений: так игрушка уходит в шахту лотка. */
  ghost(id: ToyId): void {
    const body = this.getBody(id)

    body.setType('dynamic')
    this.setMask(body, 0)
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
    const filter = HeapWorld.getFilter(slab, depth)
    let hit: SurfaceHit = { id: undefined, z: 0 }

    this.world.rayCast({ x: y, y: CUBE_HEIGHT }, { x: y, y: TRAY_EXIT_Z }, (fixture, point, _normal, fraction) => {
      if (!HeapWorld.collides(fixture, filter)) return -1

      hit = { id: HeapWorld.getToyId(fixture), z: point.y }

      return fraction
    })

    return hit
  }

  /** Игрушки срезов от `slab` на глубину `depth`, чьи рамки пересекают рамку сечения. */
  queryToys(section: readonly SectionPoint[], slab: number, depth: number): ToyId[] {
    const filter = HeapWorld.getFilter(slab, depth)
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

        if (id !== undefined && HeapWorld.collides(fixture, filter)) found.add(id)

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

  private setMask(body: Body, mask: number): void {
    const fixture = body.getFixtureList()

    fixture?.setFilterData({ groupIndex: 0, categoryBits: fixture.getFilterCategoryBits(), maskBits: mask })
  }

  /** Фильтр игрушки: биты её срезов, у игрушки в срезах 1 и 2 — ещё бит дальней стенки лотка. */
  private static getFilter(slab: number, depth: number): CollisionFilter {
    const slabs = ((1 << depth) - 1) << slab
    const farEdge = TRAY_ORIGIN.x + TRAY_SIZE
    const spansFarWall = slab < farEdge && slab + depth > farEdge

    return { category: slabs | (spansFarWall ? COLLISION_FAR_SPAN : 0), mask: slabs | COLLISION_STATIC }
  }

  /** Столкнулась бы фикстура с игрушкой такого фильтра: то же правило битов, что у движка. */
  private static collides(fixture: Fixture, { category, mask }: CollisionFilter): boolean {
    return (fixture.getFilterMaskBits() & category) !== 0 && (fixture.getFilterCategoryBits() & mask) !== 0
  }

  private static getToyId(fixture: Fixture): ToyId | undefined {
    const id = fixture.getUserData()

    return typeof id === 'number' ? id : undefined
  }
}
