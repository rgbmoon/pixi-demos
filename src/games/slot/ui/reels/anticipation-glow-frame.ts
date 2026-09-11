import { Container, type DestroyOptions, Graphics, type Ticker } from 'pixi.js'
import { PALETTE } from 'src/core/palette'
import type { GameTicker } from 'src/engine/game-ticker'
import {
  ANTICIPATION_GLOW_FADE_MS,
  ANTICIPATION_GLOW_FILL_ALPHA,
  ANTICIPATION_GLOW_PULSE_MIN,
  ANTICIPATION_GLOW_PULSE_MS,
  ANTICIPATION_GLOW_THICKNESS,
  CELL_HEIGHT,
  CELL_WIDTH,
  REELS_COUNT,
  REELS_ZONE_HEIGHT,
} from 'src/games/slot/constants'

/**
 * Подсветка барабанов на паузе anticipation: колонка на каждый барабан. Включённая колонка
 * проявляется и пульсирует на игровом тикере, при `prefers-reduced-motion` горит ровно.
 */
export class AnticipationGlowFrame extends Container {
  private readonly ticker: GameTicker
  private readonly columns: Graphics[]
  /** Сколько миллисекунд горит каждая колонка. */
  private readonly elapsed: number[]
  private isStill = false
  private isTicking = false

  constructor(ticker: GameTicker) {
    super()

    this.ticker = ticker

    const inset = ANTICIPATION_GLOW_THICKNESS / 2

    // Обводка центрирована на контуре: контур отступает на её половину, чтобы она не вышла за колонку
    this.columns = Array.from({ length: REELS_COUNT }, (_, reel) => {
      const column = new Graphics()
        .rect(
          -CELL_WIDTH / 2 + inset,
          -CELL_HEIGHT / 2 + inset,
          CELL_WIDTH - ANTICIPATION_GLOW_THICKNESS,
          REELS_ZONE_HEIGHT - ANTICIPATION_GLOW_THICKNESS
        )
        .fill({ color: PALETTE.red, alpha: ANTICIPATION_GLOW_FILL_ALPHA })
        .stroke({ width: ANTICIPATION_GLOW_THICKNESS, color: PALETTE.red })

      column.x = CELL_WIDTH * reel
      column.visible = false

      return column
    })
    this.elapsed = this.columns.map(() => 0)

    this.addChild(...this.columns)
  }

  override destroy(options?: DestroyOptions): void {
    this.setTicking(false)

    super.destroy(options)
  }

  show(reel: number): void {
    const column = this.columns[reel]

    if (!column) return

    this.isStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.elapsed[reel] = 0

    column.alpha = this.isStill ? 1 : 0
    column.visible = true

    this.setTicking(!this.isStill)
  }

  hide(reel: number): void {
    const column = this.columns[reel]

    if (column) column.visible = false

    if (!this.columns.some((other) => other.visible)) this.setTicking(false)
  }

  hideAll(): void {
    for (const column of this.columns) {
      column.visible = false
    }

    this.setTicking(false)
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
    this.columns.forEach((column, reel) => {
      if (!column.visible) return

      this.elapsed[reel] += ticker.deltaMS

      column.alpha = this.getAlpha(this.elapsed[reel])
    })
  }

  /** Непрозрачность колонки: проявление с нуля, умноженное на пульс косинусом от полной яркости. */
  private getAlpha(elapsed: number): number {
    const fade = Math.min(elapsed / ANTICIPATION_GLOW_FADE_MS, 1)
    const pulse = 0.5 + 0.5 * Math.cos((2 * Math.PI * elapsed) / ANTICIPATION_GLOW_PULSE_MS)

    return fade * (ANTICIPATION_GLOW_PULSE_MIN + (1 - ANTICIPATION_GLOW_PULSE_MIN) * pulse)
  }
}
