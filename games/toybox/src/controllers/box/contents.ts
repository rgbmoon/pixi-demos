import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import {
  GRID_SIZE,
  MAX_LAYERS,
  TOY_BOUNCE_MS,
  TOY_COLLECT_MS,
  TOY_FALL_MS,
  TOY_LANDING_IMPULSE,
  TOY_LAYER_CENTER,
  TOY_PRESS_DEPTH,
  TOY_ROOT_COLOR,
  TOY_SPRING_DAMPING,
  TOY_SPRING_PERIOD_MS,
} from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type CellAddress, PhaseName, type SpringState, type WorldPoint } from '#src/types'
import { Toy } from '#src/ui/box/toy'
import { TrayWalls } from '#src/ui/box/tray-walls'
import {
  advanceSpring,
  getCellCenter,
  getDomeHeight,
  getSettleSlides,
  isReducedMotion,
  resolveDrop,
  shiftColor,
  tweenWorld,
} from '#src/utils'
import { easeInQuad } from '@pixi-demos/core/easing'
import { createAbortError, notifyError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Содержимое куба и слой его наложения: игрушки, стенки лотка и клешня сортируются одним ключом
 * глубины. Всё, у чего есть точка мира, живёт здесь прямым ребёнком и само держит свой `zIndex`.
 * На старте куча сложена куполом — по краям поля ниже, к центру выше.
 *
 * Перекладка игрушек внутри кучи идёт фоном: стопки пересчитываются сразу, а движение доигрывается
 * под собственным сигналом контроллера и цикл клешни не задерживает.
 */
@injectable()
export class ContentsController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly contexts = Toy.createContexts()
  private readonly life = new AbortController()
  /** Движения игрушек, которые идут прямо сейчас: следующее движение обрывает предыдущее. */
  private readonly motions = new Map<Toy, AbortController>()
  /** Стопки по ячейкам: `columns[col][row]` перечисляет игрушки снизу вверх. */
  private readonly columns: Toy[][][]
  /** Пружины игрушек, которые качаются прямо сейчас: прожатая под клешнёй и отскоки после посадок. */
  private readonly bounces = new Map<Toy, { state: SpringState; target: number }>()
  private target?: CellAddress
  private highlighted?: Toy
  private pressed?: Toy

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController
  ) {
    super()

    this.ticker = ticker
    this.sortableChildren = true

    this.addChild(new TrayWalls(), claw)

    this.columns = this.fill()

    this.watch(
      () => toyboxStore.targetCell,
      (cell) => {
        this.target = cell
        this.refreshHighlight()
      },
      { fireImmediately: true }
    )

    // Прожатие идёт, пока автомат держит клешню сжатой на стопке: фаза захвата начинается с касания
    this.watch(
      () => toyboxStore.phase === PhaseName.grabbing,
      (grabbing) => this.setPressed(grabbing ? claw.getCell() : undefined)
    )

    this.ticker.add(this.stepBounces)
  }

  override destroy(options?: DestroyOptions): void {
    this.life.abort(createAbortError('Contents destroyed'))
    this.ticker.remove(this.stepBounces)
    this.motions.clear()
    this.bounces.clear()
    this.contexts.plain.destroy()
    this.contexts.highlighted.destroy()

    super.destroy(options)
  }

  /** Сколько слоёв занято в ячейке: на эту высоту садится клешня. */
  getStackHeight({ col, row }: CellAddress): number {
    return this.columns[col][row].length
  }

  /** Снимает верхнюю игрушку ячейки и отдаёт её владельцу. Пустая ячейка не отдаёт ничего. */
  take({ col, row }: CellAddress): Toy | undefined {
    const toy = this.columns[col][row].pop()

    if (!toy) return undefined

    this.stopMotion(toy)
    this.clearBounce(toy)
    toy.setHighlighted(false)
    this.removeChild(toy)
    this.refreshHighlight()

    return toy
  }

  /**
   * Возвращает игрушку в куб падением в ячейку: из переполненных она отскакивает в соседние, пока
   * не осядет. Отвечает, ушла ли игрушка в лоток; само падение доигрывается фоном.
   */
  drop(toy: Toy, target: CellAddress): boolean {
    const { path, layer, collected } = resolveDrop(this.getHeights(), target, Math.random)
    const rest = path[path.length - 1]

    this.addChild(toy)

    if (!collected) this.columns[rest.col][rest.row].push(toy)

    this.refreshHighlight()

    this.play(async (signal) => {
      for (const [index, cell] of path.entries()) {
        const isLast = index === path.length - 1
        // Ячейки по дороге полны: игрушка проходит по верху их стопок
        const level = isLast ? layer : MAX_LAYERS - 1
        const fallFrom = toy.getWorld().z

        await this.moveToy(toy, this.getToyPoint(cell, level), signal)

        // Промежуточные ячейки игрушка проходит по верхам стопок — садится она только в последней
        if (isLast && !collected) this.land(toy, fallFrom - toy.getWorld().z)
      }

      if (collected) await this.sink(toy, signal)
    })

    return collected
  }

  /**
   * Осыпает кучу: там, где соседние стопки разошлись слишком сильно, верхняя игрушка высокой ячейки
   * сползает в низкую и садится на её верхний слой.
   */
  settle(): void {
    const slides: { toy: Toy; point: WorldPoint }[] = []

    for (const { from, to } of getSettleSlides(this.getHeights(), Math.random)) {
      const toy = this.columns[from.col][from.row].pop()

      if (!toy) continue

      const target = this.columns[to.col][to.row]

      target.push(toy)
      slides.push({ toy, point: this.getToyPoint(to, target.length - 1) })
    }

    if (slides.length === 0) return

    this.refreshHighlight()

    this.play(async (signal) => {
      for (const { toy, point } of slides) {
        const fallFrom = toy.getWorld().z

        await this.moveToy(toy, point, signal)
        this.land(toy, fallFrom - toy.getWorld().z)
      }
    })
  }

  /** Отпускает игрушку в лоток: она падает на дно и уходит из кучи. */
  async collect(toy: Toy, signal?: AbortSignal): Promise<void> {
    await this.sink(toy, signal)
  }

  /** Наполняет куб куполом: высоту стопки задаёт ячейка, цвет каждой игрушки — свой. */
  private fill(): Toy[][][] {
    const columns: Toy[][][] = []

    for (let col = 0; col < GRID_SIZE; col++) {
      const rows: Toy[][] = []

      for (let row = 0; row < GRID_SIZE; row++) {
        const stack: Toy[] = []
        const height = getDomeHeight({ col, row })

        for (let layer = 0; layer < height; layer++) {
          const toy = new Toy(this.contexts, shiftColor(TOY_ROOT_COLOR, Math.random))

          toy.setWorld(this.getToyPoint({ col, row }, layer))
          stack.push(toy)
          this.addChild(toy)
        }

        rows.push(stack)
      }

      columns.push(rows)
    }

    return columns
  }

  /**
   * Прожимает верхнюю игрушку ячейки под клешнёй. Без ячейки прожатие снимается сразу, без пружины:
   * на подъёме клешни игрушка просто встаёт на место.
   */
  private setPressed(cell: CellAddress | undefined): void {
    if (this.pressed) this.clearBounce(this.pressed)

    if (!cell || isReducedMotion()) return

    const toy = this.getTopToy(cell)

    if (!toy) return

    this.pressed = toy
    this.bounces.set(toy, { state: { value: 0, velocity: 0 }, target: -TOY_PRESS_DEPTH })
  }

  /** Отыгрывает посадку игрушки: она проседает тем глубже, чем выше падала, и качается обратно. */
  private land(toy: Toy, fallHeight: number): void {
    // Прожатую клешнёй игрушку толчки не трогают: её держит вес клешни
    if (isReducedMotion() || toy === this.pressed) return

    const share = Math.min(Math.max(fallHeight, 0) / MAX_LAYERS, 1)
    const bounce = this.bounces.get(toy) ?? { state: { value: 0, velocity: 0 }, target: 0 }

    bounce.state = { value: bounce.state.value, velocity: bounce.state.velocity - TOY_LANDING_IMPULSE * share }

    this.bounces.set(toy, bounce)
  }

  /** Снимает пружину игрушки и ставит её ровно на свой слой. */
  private clearBounce(toy: Toy): void {
    this.bounces.delete(toy)
    toy.setBounce(0)

    if (this.pressed === toy) this.pressed = undefined
  }

  /** Кадровый шаг пружин: отскоки гаснут и снимаются, прожатие держится у своей цели. */
  private stepBounces = (ticker: Ticker): void => {
    if (this.bounces.size === 0) return

    for (const [toy, bounce] of this.bounces) {
      bounce.state = advanceSpring(
        bounce.state,
        { target: bounce.target, periodMs: TOY_SPRING_PERIOD_MS, damping: TOY_SPRING_DAMPING },
        ticker.deltaMS
      )

      toy.setBounce(bounce.state.value)

      if (bounce.target === 0 && bounce.state.value === 0 && bounce.state.velocity === 0) this.bounces.delete(toy)
    }
  }

  /** Верхняя игрушка ячейки; у пустой стопки её нет. */
  private getTopToy({ col, row }: CellAddress): Toy | undefined {
    const stack = this.columns[col][row]

    return stack[stack.length - 1]
  }

  /** Переставляет подсветку на верхнюю игрушку целевой ячейки. */
  private refreshHighlight(): void {
    const toy = this.target && this.getTopToy(this.target)

    if (toy === this.highlighted) return

    this.highlighted?.setHighlighted(false)
    toy?.setHighlighted(true)
    this.highlighted = toy
  }

  /** Занятые слои по всем ячейкам — снимок, по которому разыгрывается падение. */
  private getHeights(): number[][] {
    return this.columns.map((rows) => rows.map((stack) => stack.length))
  }

  /** Точка, в которой стоит игрушка слоя `layer` в ячейке. */
  private getToyPoint(cell: CellAddress, layer: number): WorldPoint {
    return { ...getCellCenter(cell), z: layer + TOY_LAYER_CENTER }
  }

  /**
   * Прогоняет фоновое движение кучи. Промис никто не ждёт, поэтому ошибку движение отдаёт в шину
   * само; отмена по `life` из неё отсеивается.
   */
  private play(run: (signal: AbortSignal) => Promise<void>): void {
    void (async () => {
      try {
        await run(this.life.signal)
      } catch (error) {
        notifyError(error)
      }
    })()
  }

  /** Обрывает движение игрушки, если оно идёт. */
  private stopMotion(toy: Toy): void {
    this.motions.get(toy)?.abort(createAbortError('Toy motion replaced'))
    this.motions.delete(toy)
  }

  /** Ведёт игрушку в точку мира; чем выше падение, тем дольше ход. */
  private async moveToy(toy: Toy, to: WorldPoint, signal?: AbortSignal): Promise<void> {
    this.stopMotion(toy)

    const motion = new AbortController()

    this.motions.set(toy, motion)

    if (signal?.aborted) {
      motion.abort(signal.reason)
    } else {
      signal?.addEventListener('abort', () => motion.abort(signal.reason), { once: true })
    }

    const from = toy.getWorld()
    const durationMs = Math.max(TOY_BOUNCE_MS, TOY_FALL_MS * Math.abs(to.z - from.z))

    try {
      await tweenWorld(
        this.ticker,
        { from, to, durationMs, ease: easeInQuad, apply: (point) => toy.setWorld(point) },
        motion.signal
      )
    } finally {
      if (this.motions.get(toy) === motion) this.motions.delete(toy)
    }
  }

  /** Роняет игрушку на дно лотка и убирает её, как только она коснулась дна. */
  private async sink(toy: Toy, signal?: AbortSignal): Promise<void> {
    const from = toy.getWorld()

    this.addChild(toy)

    await tweenWorld(
      this.ticker,
      {
        from,
        to: { x: from.x, y: from.y, z: 0 },
        durationMs: TOY_COLLECT_MS,
        ease: easeInQuad,
        apply: (point) => toy.setWorld(point),
      },
      signal
    )

    this.bounces.delete(toy)
    toy.destroy()
  }
}
