import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import type { ClawRig } from '#src/claw/claw-rig'
import { CLAW_RADIUS, CUBE_HEIGHT, UNIT_HEIGHT } from '#src/constants'
import type { Heap } from '#src/heap/heap'
import type { ToyBody } from '#src/heap/types'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { ToyId, WorldPoint } from '#src/types'
import { Claw } from '#src/ui/box/claw'
import { DepthLayer } from '#src/ui/box/depth-layer'
import { Floor } from '#src/ui/box/floor'
import { Frame } from '#src/ui/box/frame'
import { Pillar } from '#src/ui/box/pillar'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { TrayWall } from '#src/ui/box/tray-wall'
import { getPlaneDepthItem, getPointDepthItem, getToyDepthItem } from '#src/utils/depth'
import { getFaceOutline, getTrayWallOutlines } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Стеклянный куб автомата. Пол и верхняя грань лежат под слоем `DepthLayer`, в слое — игрушки, клешня в сборе,
 * вертикальные рёбра и стенки лотка; их порядок наложения задаёт попарное сравнение по глубине.
 *
 * Каждый кадр контроллер продвигает модели клешни и кучи, переносит их позы в View-компоненты одним проходом
 * и сортирует слой.
 */
@injectable()
export class CubeController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly heap: Heap
  private readonly toyboxStore: ToyboxStore
  private readonly rig: ClawRig
  private readonly layer = new DepthLayer()
  private readonly claw = new Claw()
  private readonly shapes = new ToyShapes()
  private readonly toys = new Map<ToyId, Toy>()
  private readonly seen = new Set<ToyId>()

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.ClawRig) rig: ClawRig
  ) {
    super()

    this.ticker = ticker
    this.heap = heap
    this.toyboxStore = toyboxStore
    this.rig = rig

    // Детали куба неподвижны: предмет сортировки каждой строится один раз
    for (const outline of getTrayWallOutlines()) {
      this.layer.place(new TrayWall(outline), { x: 0, y: 0 }, 0, () => getPlaneDepthItem(outline))
    }

    for (const corner of getFaceOutline(0)) {
      this.layer.place(new Pillar(corner), { x: 0, y: 0 }, 0, () =>
        getPlaneDepthItem([corner, { ...corner, z: CUBE_HEIGHT }])
      )
    }

    this.addChild(new Floor(), new Frame(), this.layer)

    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)
    this.toys.clear()

    super.destroy(options)
    // Общие контексты геометрии уничтожаются после игрушек, которые на них ссылаются
    this.shapes.destroy()
  }

  /** Кадр бокса: ход клешни, шаг кучи за точкой захвата, позы View-компонентов и порядок наложения. */
  private step = (ticker: Ticker): void => {
    this.rig.advance(ticker.deltaMS, this.toyboxStore.direction)

    const grip = this.rig.getGripPoint()

    this.heap.advance(ticker.deltaMS, grip)
    this.syncToys()
    this.syncClaw(grip)
    this.layer.sort()
  }

  /** Переносит позы игрушек в View-компоненты: появившиеся создаёт, ушедшие из кучи уничтожает. */
  private syncToys(): void {
    // Подсветка идёт только в покое, пока игрок ищет игрушку: цель — игрушка под кареткой
    const highlighted = this.toyboxStore.canDrop ? this.heap.getTopBodyAt(this.rig.getCartPoint())?.id : undefined

    this.seen.clear()

    for (const body of this.heap.getBodies()) {
      const toy = this.toys.get(body.id) ?? this.addToy(body)
      const { point, angle } = body.pose

      this.seen.add(body.id)
      toy.setPose(point, angle)
      toy.setHighlighted(body.id === highlighted)
      this.layer.place(toy, worldToScreen(point), getAngleStep(angle), () =>
        getToyDepthItem(body.shape, body.variant, point, angle)
      )
    }

    if (this.seen.size !== this.toys.size) this.removeGone()
  }

  /** Ставит клешню в сборе в точки модели; предмет сортировки сборки — точка захвата. */
  private syncClaw(grip: WorldPoint): void {
    this.claw.setPose(this.rig.getCartPoint(), grip)
    this.layer.place(this.claw, worldToScreen(grip), 0, () =>
      getPointDepthItem(grip, CLAW_RADIUS, CLAW_RADIUS / UNIT_HEIGHT)
    )
  }

  private addToy(body: Readonly<ToyBody>): Toy {
    const toy = new Toy(this.shapes, body.shape, body.variant, body.color)

    this.toys.set(body.id, toy)

    return toy
  }

  private removeGone(): void {
    for (const [id, toy] of this.toys) {
      if (this.seen.has(id)) continue

      this.toys.delete(id)
      this.layer.remove(toy)
      toy.destroy({ children: true })
    }
  }
}
