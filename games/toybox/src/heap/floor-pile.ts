import { injectable } from 'inversify'

import { CABINET_BOTTOM_Z, CABINET_FRONT_X, PRIZE_NICHE_FLOOR } from '#src/constants'
import type { HeapSnapshotBody, Prize, ToyId } from '#src/types'
import { lerp } from '#src/utils/math'
import { getDepth, getDepthCenter, getPrizeSeat, getSection, getSectionExtent } from '#src/utils/shapes'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import type { Random } from '@pixi-demos/core/types'

import {
  FLOOR_DROP_SIDE_MAX_SPEED,
  FLOOR_DROP_SIDE_MIN_SPEED,
  FLOOR_DROP_SPEED,
  FLOOR_DROP_SPIN_OFFSET,
  FLOOR_EJECT_MS,
  FLOOR_NUDGE_AXIS_TOLERANCE,
  FLOOR_NUDGE_REACH,
  FLOOR_NUDGE_REST_TOLERANCE,
  FLOOR_NUDGE_SPEED,
  FLOOR_PILE_DEPTH,
} from './constants'
import { ToyPile } from './toy-pile'
import { getFloorStatics } from './utils'

/** Модель кучи выигранных игрушек на полу перед автоматом: приз выпадает из окна выдачи и падает в кучу по физике. */
@injectable()
export class FloorPile extends ToyPile {
  /** Игрушки в полёте от фасада тумбы к своим срезам: координата `x` цели и время с начала полёта. */
  private readonly flights = new Map<ToyId, { target: number; elapsedMs: number }>()

  constructor() {
    super(getFloorStatics())
  }

  override restore(bodies: readonly HeapSnapshotBody[]): void {
    this.flights.clear()
    super.restore(bodies)
  }

  /** Куча в покое: все тела уснули, и ни одна игрушка не летит к своим срезам. */
  override get settled(): boolean {
    return this.flights.size === 0 && super.settled
  }

  /**
   * Роняет приз из окна выдачи: игрушка получает толчок вниз и влево или вправо и летит вперёд в случайные срезы пола.
   * Падая, она расталкивает игрушки, которые уже лежат на полу.
   */
  drop({ toy, hasLamp }: Prize, random: Random): void {
    const depth = getDepth(toy)
    const slab = Math.floor(random() * (FLOOR_PILE_DEPTH - depth + 1))
    const { x, y, z } = getPrizeSeat(toy)
    const body = this.create({ slab, y, z, angle: 0, toy, hasLamp }, true)
    const { halfWidth } = getSectionExtent(getSection(toy))
    // Знак броска задаёт сторону, модуль — скорость в диапазоне
    const side = random() * 2 - 1
    const sideSpeed = (side < 0 ? -1 : 1) * lerp(FLOOR_DROP_SIDE_MIN_SPEED, FLOOR_DROP_SIDE_MAX_SPEED, Math.abs(side))

    this.flights.set(body.id, { target: body.pose.point.x, elapsedMs: 0 })
    body.pose.point.x = x
    this.world.push(
      body.id,
      { y: sideSpeed, z: -FLOOR_DROP_SPEED },
      { y: y + (random() * 2 - 1) * FLOOR_DROP_SPIN_OFFSET * halfWidth, z }
    )
    this.touch()
  }

  /**
   * Роняет стопку под окном выдачи: игрушки на других игрушках получают у верха толчок вбок от оси окна. Игрушки на
   * полу толчок не двигает; игрушке на оси сторону задаёт бросок; при уменьшенном движении толчка нет.
   */
  nudge(random: Random): void {
    if (isReducedMotion()) return

    for (const body of this.bodies.values()) {
      const { y } = body.pose.point
      const offset = y - PRIZE_NICHE_FLOOR.y
      const heights = this.getPlacedSection(body).map((point) => point.z)
      const isOnFloor = Math.min(...heights) < CABINET_BOTTOM_Z + FLOOR_NUDGE_REST_TOLERANCE

      if (isOnFloor || Math.abs(offset) > FLOOR_NUDGE_REACH) continue

      const side = Math.abs(offset) < FLOOR_NUDGE_AXIS_TOLERANCE ? (random() < 0.5 ? -1 : 1) : Math.sign(offset)

      this.world.push(body.id, { y: side * FLOOR_NUDGE_SPEED, z: 0 }, { y, z: Math.max(...heights) })
    }
    this.touch()
  }

  /** Кадровый шаг пола: ведёт выпавшие игрушки от фасада к их срезам и продвигает физику. */
  advance(deltaMs: number): void {
    for (const [id, flight] of this.flights) {
      const body = this.bodies.get(id)

      flight.elapsedMs = isReducedMotion() ? FLOOR_EJECT_MS : Math.min(flight.elapsedMs + deltaMs, FLOOR_EJECT_MS)
      if (body) body.pose.point.x = lerp(PRIZE_NICHE_FLOOR.x, flight.target, flight.elapsedMs / FLOOR_EJECT_MS)
      if (!body || flight.elapsedMs === FLOOR_EJECT_MS) this.flights.delete(id)
    }

    this.advanceWorld(deltaMs)
  }

  /** Срез 0 прилегает к фасаду тумбы, срезы идут к игроку. */
  protected override getDepthX(slab: number, depth: number): number {
    return CABINET_FRONT_X - getDepthCenter(slab, depth)
  }
}
