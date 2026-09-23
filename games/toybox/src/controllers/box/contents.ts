import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import { CONTENTS_PRIORITY } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type CellAddress, PhaseName, type ToyBody, type ToyId, type ReleaseOutcome } from '#src/types'
import { Pillar } from '#src/ui/box/pillar'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { TrayWalls } from '#src/ui/box/tray-walls'
import { isReducedMotion } from '#src/utils/animation'
import { getFaceOutline } from '#src/utils/projection'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Слой содержимого куба. Игрушки, стенки лотка, вертикальные рёбра и клешня сортируются общим
 * ключом глубины и добавляются сюда непосредственными дочерними объектами.
 *
 * Каждый кадр контроллер обновляет модель кучи и синхронизирует View-компоненты одним проходом.
 */
@injectable()
export class ContentsController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly heap: HeapStore
  private readonly claw: ClawController
  private readonly shapes = new ToyShapes()
  private readonly toys = new Map<ToyId, Toy>()
  private readonly life = new AbortController()
  private readonly waiting = new Set<() => void>()
  private readonly seen = new Set<ToyId>()
  private target?: CellAddress

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController
  ) {
    super()

    this.ticker = ticker
    this.heap = heap
    this.claw = claw
    this.sortableChildren = true

    this.addChild(new TrayWalls(), claw, ...getFaceOutline(0).map((corner) => new Pillar(corner)))

    this.watch(
      () => toyboxStore.targetCell,
      (cell) => {
        this.target = cell
      },
      { fireImmediately: true }
    )

    // Фаза захвата начинается после касания и заканчивается перед подъёмом клешни
    this.watch(
      () => toyboxStore.phase === PhaseName.grabbing,
      (grabbing) => heap.setPressed(grabbing ? claw.getCell() : undefined)
    )

    this.watch(
      () => [heap.settled, heap.releaseOutcome],
      () => {
        for (const check of this.waiting) check()
      }
    )
    this.ticker.add(this.step, undefined, CONTENTS_PRIORITY)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.life.abort(createAbortError('Contents destroyed'))
    this.ticker.remove(this.step)
    this.toys.clear()
    this.shapes.destroy()

    super.destroy(options)
  }

  /** Ждёт фактический результат отпускания модели, включая промежуточную посадку у лотка. */
  async waitForRelease(signal: AbortSignal): Promise<ReleaseOutcome> {
    await this.waitFor(() => this.heap.releaseOutcome.status !== 'pending', signal)

    return this.heap.releaseOutcome
  }

  /** Ждёт завершения движения, осыпания и пружин перед публикацией снимка. */
  async waitForSettled(signal: AbortSignal): Promise<void> {
    await this.waitFor(() => this.heap.settled, signal)
  }

  private waitFor(ready: () => boolean, signal: AbortSignal): Promise<void> {
    const combined = AbortSignal.any([signal, this.life.signal])

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.waiting.delete(check)
        combined.removeEventListener('abort', abort)
      }
      const abort = () => {
        cleanup()
        reject(combined.reason as Error)
      }
      const check = () => {
        if (!ready()) return
        cleanup()
        resolve()
      }

      if (combined.aborted) {
        abort()
        return
      }
      this.waiting.add(check)
      combined.addEventListener('abort', abort, { once: true })
      check()
    })
  }

  private step = (ticker: Ticker): void => {
    this.heap.setReducedMotion(isReducedMotion())
    this.heap.setGripPoint(this.claw.getGripPoint())
    this.heap.advance(ticker.deltaMS)
    this.sync()
  }

  private sync(): void {
    const highlighted = this.target && this.heap.getTopBody(this.target)?.id

    this.seen.clear()

    for (const body of this.heap.getBodies()) {
      const toy = this.toys.get(body.id) ?? this.addToy(body)

      this.seen.add(body.id)

      toy.setFacing(body.pose.facing)
      toy.setWorld(body.pose.point, body.bounce.value)
      toy.setHighlighted(body.id === highlighted)
    }

    if (this.seen.size !== this.toys.size) this.removeGone()
  }

  private addToy(body: Readonly<ToyBody>): Toy {
    const toy = new Toy(this.shapes, body.shape, body.pose.facing, body.color)

    this.toys.set(body.id, toy)
    this.addChild(toy)

    return toy
  }

  private removeGone(): void {
    for (const [id, toy] of this.toys) {
      if (this.seen.has(id)) continue

      this.toys.delete(id)
      toy.destroy({ children: true })
    }
  }
}
