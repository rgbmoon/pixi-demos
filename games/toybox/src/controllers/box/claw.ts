import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import {
  CARRY_OFFSET,
  CART_SIZE,
  CLAW_DROP_MS,
  CLAW_LIFT_MS,
  CLAW_MAX_SPEED,
  CLAW_RAMP_SHARE,
  CLAW_REST_HEIGHT,
  CLAW_TRAVEL_SPEED,
  CUBE_HEIGHT,
  FIELD_CENTER,
  SWAY_DAMPING,
  SWAY_DRAG,
  SWAY_MAX_OFFSET,
  SWAY_PERIOD_MS,
} from '#src/constants'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { CellAddress, ClawDrop, ClawSlip, GroundPoint, ScreenPoint, SpringState, WorldPoint } from '#src/types'
import { Cart } from '#src/ui/box/cart'
import { Claw } from '#src/ui/box/claw'
import { Rope } from '#src/ui/box/rope'
import type { Toy } from '#src/ui/box/toy'
import {
  advanceSpring,
  advanceVelocity,
  clampToField,
  getCellCenter,
  getDepthOrder,
  getPathShare,
  isReducedMotion,
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

/** Пружина в покое: клешня висит под кареткой. */
const REST: SpringState = { value: 0, velocity: 0 }

/**
 * Каретка с клешнёй: держит своё положение в кубе и ведёт его на игровом тикере. Точка контроллера —
 * каретка, от неё считаются ход и ячейка под клешнёй; сама клешня висит под ней на тросе и качается.
 */
@injectable()
export class ClawController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly toyboxStore: ToyboxStore
  private readonly cart = new Cart()
  private readonly rope = new Rope()
  private readonly claw = new Claw()
  private point: WorldPoint = { ...FIELD_CENTER, z: CLAW_REST_HEIGHT }
  private velocity: GroundPoint = { x: 0, y: 0 }
  private direction: GroundPoint = { x: 0, y: 0 }
  /** Отклонение клешни от каретки по осям поля: маятник на тросе, по пружине на ось. */
  private swing: { x: SpringState; y: SpringState } = { x: REST, y: REST }
  /** Положение каретки в прошлом кадре: по нему считается её скорость, а по скорости — отклонение. */
  private previous: GroundPoint = { ...FIELD_CENTER }
  private motion?: AbortController
  private carried?: Toy

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    super()

    this.ticker = ticker
    this.toyboxStore = toyboxStore

    this.addChild(this.rope, this.cart, this.claw)
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
    this.render()
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

    await Promise.all([this.moveTo(target, signal), this.dropOnTheWay(drop.onDrop, delayMs, signal)])
  }

  /** Опускает клешню до высоты `toZ` */
  async descend(toZ: number, signal?: AbortSignal): Promise<void> {
    await this.tween({ ...this.point, z: toZ }, this.getLiftDuration(toZ, CLAW_DROP_MS), signal)
  }

  /**
   * Поднимает клешню к каретке, на длину троса в покое. Если задан `slip`, на доле подъёма `share`
   * клешня разжимается и сразу отдаёт игрушку в `onDrop`, не прерывая ход.
   */
  async ascend(slip?: ClawSlip, signal?: AbortSignal): Promise<void> {
    const to = { ...this.point, z: CLAW_REST_HEIGHT }
    const durationMs = this.getLiftDuration(CLAW_REST_HEIGHT, CLAW_LIFT_MS)

    if (!slip) {
      await this.tween(to, durationMs, signal)

      return
    }

    const delayMs = durationMs * easeTrapezoidInverse(slip.share, CLAW_RAMP_SHARE)

    await Promise.all([this.tween(to, durationMs, signal), this.dropOnTheWay(slip.onDrop, delayMs, signal)])
  }

  /** Разжимает клешню через `delayMs` после старта хода и сразу отдаёт игрушку владельцу. */
  private async dropOnTheWay(onDrop: (toy: Toy) => void, delayMs: number, signal?: AbortSignal): Promise<void> {
    await this.ticker.waitTicks(delayMs, signal)

    const toy = this.release()

    if (toy) onDrop(toy)
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

  /** Кадровый шаг: ход каретки по джойстику и качание клешни, которое идёт при любом её движении. */
  private step = (ticker: Ticker): void => {
    this.drive(ticker.deltaMS)
    this.advanceSwing(ticker.deltaMS)
  }

  /** Кадровый ход каретки по джойстику. Пока идёт движение фазы, ввод игрока не применяется. */
  private drive(deltaMs: number): void {
    if (this.motion) return

    const target = { x: this.direction.x * CLAW_MAX_SPEED, y: this.direction.y * CLAW_MAX_SPEED }

    this.velocity = advanceVelocity(this.velocity, target, deltaMs)

    if (this.velocity.x === 0 && this.velocity.y === 0) return

    const seconds = deltaMs / 1000
    const next = { x: this.point.x + this.velocity.x * seconds, y: this.point.y + this.velocity.y * seconds }
    const moved = clampToField(next, CART_SIZE / 2)

    // У стенки скорость гасится: иначе клешня копит её и отходит от стенки рывком
    if (moved.x !== next.x) this.velocity.x = 0
    if (moved.y !== next.y) this.velocity.y = 0

    this.apply({ ...moved, z: this.point.z })
  }

  /**
   * Кадровый шаг маятника: пока каретка идёт ровно, клешня стоит отклонённой против хода, а на
   * разгоне и остановке догоняет новую цель качанием. Скорость каретки берётся её смещением за кадр,
   * поэтому маятник одинаково работает и на джойстике, и на ходах автомата.
   */
  private advanceSwing(deltaMs: number): void {
    if (deltaMs <= 0) return

    const seconds = deltaMs / 1000
    const velocity = {
      x: (this.point.x - this.previous.x) / seconds,
      y: (this.point.y - this.previous.y) / seconds,
    }

    this.previous = { x: this.point.x, y: this.point.y }

    if (isReducedMotion()) return

    const x = this.advanceAxis(this.swing.x, velocity.x, deltaMs)
    const y = this.advanceAxis(this.swing.y, velocity.y, deltaMs)
    const moved = x.value !== this.swing.x.value || y.value !== this.swing.y.value

    this.swing = { x, y }

    if (moved) this.render()
  }

  /** Шаг одной оси маятника: цель тем дальше против хода, чем быстрее идёт каретка. */
  private advanceAxis(state: SpringState, velocity: number, deltaMs: number): SpringState {
    const drag = -velocity * SWAY_DRAG
    const target = Math.sign(drag) * Math.min(Math.abs(drag), SWAY_MAX_OFFSET)

    return advanceSpring(state, { target, periodMs: SWAY_PERIOD_MS, damping: SWAY_DAMPING }, deltaMs)
  }

  private apply(point: WorldPoint): void {
    this.point = point

    this.render()
    this.publishCell()
  }

  /**
   * Переносит положение на экран: каретка стоит над своей точкой верхней грани, клешня висит под ней
   * с отклонением маятника, трос их соединяет. Наложение узла считается по видимой точке клешни,
   * а ячейка под клешнёй — по каретке, поэтому подсветка цели от качания не дрожит.
   */
  private render(): void {
    const visible = { x: this.point.x + this.swing.x.value, y: this.point.y + this.swing.y.value, z: this.point.z }
    const mount = { x: this.point.x, y: this.point.y, z: CUBE_HEIGHT }

    this.zIndex = getDepthOrder(visible)

    this.cart.setWorld(mount)
    this.rope.setSpan(mount, visible)
    this.claw.setWorld(visible)
    this.carried?.setWorld({ ...visible, z: visible.z - CARRY_OFFSET })
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
