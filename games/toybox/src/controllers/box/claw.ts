import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import {
  CARRY_OFFSET,
  CLAW_DROP_MS,
  CLAW_LIFT_MS,
  CLAW_MAX_SPEED,
  CLAW_RAMP_SHARE,
  CLAW_TRAVEL_SPEED,
  CUBE_HEIGHT,
  FIELD_CENTER,
} from '#src/constants'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { CellAddress, ClawDrop, GroundPoint, ScreenPoint, WorldPoint } from '#src/types'
import { Claw } from '#src/ui/box/claw'
import type { Toy } from '#src/ui/box/toy'
import {
  advanceVelocity,
  clampToField,
  getCellCenter,
  getDepthOrder,
  getPathShare,
  toCell,
  toGroundDirection,
  tweenWorld,
} from '#src/utils'
import { easeTrapezoid, easeTrapezoidInverse } from '@pixi-demos/core/easing'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Минимальная длительность перемещения: нужна чтобы не допустить деление на ноль при расчете */
const MIN_TRAVEL_MS = 1

/**
 * Клешня: держит своё положение в кубе и ведёт его на игровом тикере.
 */
@injectable()
export class ClawController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly toyboxStore: ToyboxStore
  private readonly claw = new Claw()
  private point: WorldPoint = { ...FIELD_CENTER, z: CUBE_HEIGHT }
  private velocity: GroundPoint = { x: 0, y: 0 }
  private direction: GroundPoint = { x: 0, y: 0 }
  private motion?: AbortController
  private carried?: Toy

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    super()

    this.ticker = ticker
    this.toyboxStore = toyboxStore

    this.addChild(this.claw)
    this.apply(this.point)

    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.step)
    this.motion?.abort(createAbortError('Claw destroyed'))

    super.destroy(options)
  }

  /** Точка поля под клешнёй. */
  getPosition(): GroundPoint {
    return { x: this.point.x, y: this.point.y }
  }

  /** Ячейка поля под клешнёй. */
  getCell(): CellAddress {
    return toCell(this.point)
  }

  /** Несёт ли клешня игрушку. */
  isHolding(): boolean {
    return this.carried !== undefined
  }

  /** Берёт игрушку в клешню: дальше она ездит вместе с ней и рисуется под ней. */
  hold(toy: Toy): void {
    this.carried = toy

    this.addChildAt(toy, this.getChildIndex(this.claw))
    this.apply(this.point)
  }

  /** Разжимает клешню и отдаёт игрушку владельцу; с пустой клешни ничего не снимается. */
  release(): Toy | undefined {
    const toy = this.carried

    this.carried = undefined

    if (toy) this.removeChild(toy)

    return toy
  }

  /** Принимает отклонение джойстика в экранных осях: его длина задаёт долю предельной скорости. */
  setDirection(vector: ScreenPoint): void {
    this.direction = toGroundDirection(vector)
  }

  /** Ведёт клешню к точке поля, сохраняя высоту. */
  async moveTo(target: GroundPoint, signal?: AbortSignal): Promise<void> {
    await this.tween({ ...target, z: this.point.z }, this.getTravelMs(target), signal)
  }

  /**
   * Ведёт клешню к точке поля одним ходом. Если задан `drop`, над его ячейкой клешня разжимается
   * и сразу отдаёт игрушку в `onDrop`, не прерывая ход.
   */
  async carryTo(target: GroundPoint, drop: ClawDrop | undefined, signal?: AbortSignal): Promise<void> {
    if (!drop) {
      await this.moveTo(target, signal)

      return
    }

    const delayMs = this.getDropDelay(target, drop.cell)

    await Promise.all([this.moveTo(target, signal), this.dropOnTheWay(drop, delayMs, signal)])
  }

  /** Опускает клешню до высоты `toZ` */
  async descend(toZ: number, signal?: AbortSignal): Promise<void> {
    await this.tween({ ...this.point, z: toZ }, this.getLiftDuration(toZ, CLAW_DROP_MS), signal)
  }

  /** Поднимает клешню к верхней грани. */
  async ascend(signal?: AbortSignal): Promise<void> {
    await this.tween({ ...this.point, z: CUBE_HEIGHT }, this.getLiftDuration(CUBE_HEIGHT, CLAW_LIFT_MS), signal)
  }

  /** Разжимает клешню через `delayMs` после старта хода и сразу отдаёт игрушку владельцу. */
  private async dropOnTheWay(drop: ClawDrop, delayMs: number, signal?: AbortSignal): Promise<void> {
    await this.ticker.waitTicks(delayMs, signal)

    const toy = this.release()

    if (toy) drop.onDrop(toy)
  }

  /** Время до ячейки `dropAt` от начала хода в `target`: привод разгоняется, и доля пути не равна доле времени. */
  private getDropDelay(target: GroundPoint, dropAt: CellAddress): number {
    const share = getPathShare(this.getPosition(), target, getCellCenter(dropAt))

    return this.getTravelMs(target) * easeTrapezoidInverse(share, CLAW_RAMP_SHARE)
  }

  /** Сколько клешне идти до точки поля. */
  private getTravelMs(target: GroundPoint): number {
    const distance = Math.hypot(target.x - this.point.x, target.y - this.point.y)

    return Math.max((distance / CLAW_TRAVEL_SPEED) * 1000, MIN_TRAVEL_MS)
  }

  /** Время хода по высоте: `fullMs` отмеряны на полную высоту куба. */
  private getLiftDuration(toZ: number, fullMs: number): number {
    return Math.max((fullMs * Math.abs(toZ - this.point.z)) / CUBE_HEIGHT, MIN_TRAVEL_MS)
  }

  /** Кадровый ход по джойстику. Пока идёт движение фазы, ввод игрока не применяется. */
  private step = (ticker: Ticker): void => {
    if (this.motion) return

    const target = { x: this.direction.x * CLAW_MAX_SPEED, y: this.direction.y * CLAW_MAX_SPEED }

    this.velocity = advanceVelocity(this.velocity, target, ticker.deltaMS)

    if (this.velocity.x === 0 && this.velocity.y === 0) return

    const seconds = ticker.deltaMS / 1000
    const next = { x: this.point.x + this.velocity.x * seconds, y: this.point.y + this.velocity.y * seconds }
    const moved = clampToField(next)

    // У стенки скорость гасится: иначе клешня копит её и отходит от стенки рывком
    if (moved.x !== next.x) this.velocity.x = 0
    if (moved.y !== next.y) this.velocity.y = 0

    this.apply({ ...moved, z: this.point.z })
  }

  private apply(point: WorldPoint): void {
    this.point = point
    this.zIndex = getDepthOrder(point)

    this.claw.setWorld(point)
    this.carried?.setWorld({ ...point, z: point.z - CARRY_OFFSET })

    this.publishCell()
  }

  /** Публикует в стор ячейку под клешнёй, когда та сменилась. */
  private publishCell(): void {
    const cell = this.getCell()
    const current = this.toyboxStore.clawCell

    if (current && current.col === cell.col && current.row === cell.row) return

    this.toyboxStore.setClawCell(cell)
  }

  /**
   * Ведёт положение клешни к точке за `durationMs` на игровом тикере: привод коротко разгоняется,
   * идёт ровно и так же тормозит. Промис реджектится по отмене — внешнего `signal` или следующего
   * движения, которое прерывает текущее.
   */
  private async tween(to: WorldPoint, durationMs: number, signal?: AbortSignal): Promise<void> {
    this.motion?.abort(createAbortError('Claw motion replaced'))

    // Ход по джойстику обрывается: дальше клешню ведёт автомат
    this.velocity = { x: 0, y: 0 }
    this.direction = { x: 0, y: 0 }

    const motion = new AbortController()

    this.motion = motion

    if (signal?.aborted) {
      motion.abort(signal.reason)
    } else {
      signal?.addEventListener('abort', () => motion.abort(signal.reason), { once: true })
    }

    try {
      await tweenWorld(
        this.ticker,
        {
          from: this.point,
          to,
          durationMs,
          ease: (progress) => easeTrapezoid(progress, CLAW_RAMP_SHARE),
          apply: (point) => this.apply(point),
        },
        motion.signal
      )
    } finally {
      if (this.motion === motion) this.motion = undefined
    }
  }
}
