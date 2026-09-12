import { Container, type DestroyOptions, type Ticker } from 'pixi.js'
import { easeOutBack } from 'src/core/easing'
import type { GameTicker } from 'src/engine/game-ticker'
import {
  CASCADE_MULTIPLIER_FONT_SIZE,
  CASCADE_MULTIPLIER_POP_BACK,
  CASCADE_MULTIPLIER_POP_MS,
  CASCADE_MULTIPLIER_POP_SCALE,
  CASCADE_MULTIPLIER_STROKE,
  CELL_HEIGHT,
  CELL_WIDTH,
  REELS_COUNT,
} from 'src/games/slot/constants'
import { LabelColor } from 'src/games/slot/types'
import { Label } from 'src/games/slot/ui/hud/label'

/**
 * Множитель каскада на верхней кромке зоны символов. Новое значение появляется толчком масштаба
 * на игровом тикере, при `prefers-reduced-motion` — сразу.
 */
export class CascadeMultiplier extends Container {
  private readonly ticker: GameTicker
  private readonly valueLabel = new Label({ color: LabelColor.red, fontSize: CASCADE_MULTIPLIER_FONT_SIZE })
  private elapsed = CASCADE_MULTIPLIER_POP_MS
  private isTicking = false

  constructor(ticker: GameTicker) {
    super()

    this.ticker = ticker

    this.valueLabel.anchor.set(0.5)
    this.valueLabel.style.stroke = { color: 0x000000, width: CASCADE_MULTIPLIER_STROKE }

    // Начало координат оверлея — центр левой верхней ячейки: середина кромки над средним барабаном
    this.position.set((CELL_WIDTH * (REELS_COUNT - 1)) / 2, -CELL_HEIGHT / 2)
    this.visible = false

    this.addChild(this.valueLabel)
  }

  override destroy(options?: DestroyOptions): void {
    this.setTicking(false)

    super.destroy(options)
  }

  /** Показывает множитель; повторный вызов с тем же значением ничего не меняет. */
  show(multiplier: number): void {
    const text = `x${multiplier}`

    if (this.visible && this.valueLabel.text === text) return

    this.valueLabel.text = text
    this.visible = true

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.valueLabel.scale.set(1)

      return
    }

    this.elapsed = 0
    this.valueLabel.scale.set(CASCADE_MULTIPLIER_POP_SCALE)
    this.setTicking(true)
  }

  hide(): void {
    this.visible = false

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
    this.elapsed = Math.min(this.elapsed + ticker.deltaMS, CASCADE_MULTIPLIER_POP_MS)

    const progress = easeOutBack(this.elapsed / CASCADE_MULTIPLIER_POP_MS, CASCADE_MULTIPLIER_POP_BACK)

    this.valueLabel.scale.set(CASCADE_MULTIPLIER_POP_SCALE + (1 - CASCADE_MULTIPLIER_POP_SCALE) * progress)

    if (this.elapsed >= CASCADE_MULTIPLIER_POP_MS) this.setTicking(false)
  }
}
