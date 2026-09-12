import { Container, type DestroyOptions, Graphics, type Ticker } from 'pixi.js'
import { PALETTE } from 'src/core/palette'
import type { GameTicker } from 'src/engine/game-ticker'
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  HELD_FRAME_CROSS_ALPHA,
  HELD_FRAME_CROSS_THICKNESS,
  HELD_FRAME_FADE_MS,
  HELD_FRAME_FILL_ALPHA,
  HELD_FRAME_THICKNESS,
  REELS_COUNT,
  REELS_ZONE_HEIGHT,
} from 'src/games/slot/constants'

/**
 * Подсветка удержанных барабанов: колонка с рамкой и крестом из диагоналей на каждый барабан.
 * Новая колонка проявляется на игровом тикере, при `prefers-reduced-motion` появляется сразу; снятая гаснет сразу.
 */
export class HeldFrame extends Container {
  private readonly ticker: GameTicker
  private readonly columns: Graphics[]
  /** Сколько миллисекунд проявляется каждая колонка. */
  private readonly elapsed: number[]
  private isTicking = false

  constructor(ticker: GameTicker) {
    super()

    this.ticker = ticker

    const inset = HELD_FRAME_THICKNESS / 2
    const left = -CELL_WIDTH / 2 + inset
    const top = -CELL_HEIGHT / 2 + inset
    const right = left + CELL_WIDTH - HELD_FRAME_THICKNESS
    const bottom = top + REELS_ZONE_HEIGHT - HELD_FRAME_THICKNESS

    // Обводка центрирована на контуре: контур отступает на её половину, чтобы она не вышла за колонку.
    // Диагонали соединяют углы контура и отличают удержанный барабан от прочих подсветок
    this.columns = Array.from({ length: REELS_COUNT }, (_, reel) => {
      const column = new Graphics()
        .rect(left, top, right - left, bottom - top)
        .fill({ color: PALETTE.cyan, alpha: HELD_FRAME_FILL_ALPHA })
        .stroke({ width: HELD_FRAME_THICKNESS, color: PALETTE.cyan })
        .moveTo(left, top)
        .lineTo(right, bottom)
        .moveTo(right, top)
        .lineTo(left, bottom)
        .stroke({ width: HELD_FRAME_CROSS_THICKNESS, color: PALETTE.cyan, alpha: HELD_FRAME_CROSS_ALPHA })

      column.x = CELL_WIDTH * reel
      column.visible = false

      return column
    })
    this.elapsed = this.columns.map(() => HELD_FRAME_FADE_MS)

    this.addChild(...this.columns)
  }

  override destroy(options?: DestroyOptions): void {
    this.setTicking(false)

    super.destroy(options)
  }

  /** Подсвечивает барабаны из списка; повторный вызов с теми же барабанами ничего не меняет. */
  setHeld(reels: readonly number[]): void {
    const isStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.columns.forEach((column, reel) => {
      const isHeld = reels.includes(reel)

      if (isHeld && !column.visible) {
        this.elapsed[reel] = isStill ? HELD_FRAME_FADE_MS : 0
        column.alpha = isStill ? 1 : 0
      }

      column.visible = isHeld
    })

    this.setTicking(this.columns.some((column, reel) => column.visible && this.elapsed[reel] < HELD_FRAME_FADE_MS))
  }

  /** Ставит `step` на тикер и снимает его; повторный вызов с тем же значением ничего не делает. */
  private setTicking(value: boolean): void {
    if (value === this.isTicking) return

    this.isTicking = value

    // Тикер PIXI добавляет одну и ту же функцию повторно, поэтому подписку ведёт флаг
    if (value) this.ticker.add(this.step)
    else this.ticker.remove(this.step)
  }

  private step = (ticker: Ticker): void => {
    let isFading = false

    this.columns.forEach((column, reel) => {
      if (!column.visible || this.elapsed[reel] >= HELD_FRAME_FADE_MS) return

      this.elapsed[reel] = Math.min(this.elapsed[reel] + ticker.deltaMS, HELD_FRAME_FADE_MS)
      column.alpha = this.elapsed[reel] / HELD_FRAME_FADE_MS

      isFading ||= this.elapsed[reel] < HELD_FRAME_FADE_MS
    })

    if (!isFading) this.setTicking(false)
  }
}
