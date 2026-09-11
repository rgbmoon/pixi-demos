import { Container } from 'pixi.js'
import type { GameTicker } from 'src/engine/game-ticker'
import { tweenShake } from 'src/engine/utils'
import { SHAKE_AMPLITUDE, SHAKE_MS, SHAKE_OSCILLATIONS } from 'src/games/slot/constants'
import { LabelColor } from 'src/games/slot/types'

import { Label } from './label'

const FONT_SIZE = 48
const GAP = 16

/**
 * Строка HUD «подпись + значение» в одну линию, центрированная по origin.
 * Тексты подставляет владелец: строка сама ничего не считает и не форматирует.
 */
export class ValueLabel extends Container {
  private readonly caption = new Label({ color: LabelColor.cyan, fontSize: FONT_SIZE })
  private readonly value = new Label({ color: LabelColor.white, fontSize: FONT_SIZE })

  constructor(caption = '') {
    super()

    this.caption.anchor.set(0, 0.5)
    this.value.anchor.set(0, 0.5)

    this.caption.text = caption

    this.addChild(this.caption, this.value)
  }

  /** Ставит подпись и значение; значение красится в `valueColor`, по умолчанию белый. */
  setText(caption: string, value: string, valueColor: LabelColor = LabelColor.white): void {
    this.caption.text = caption
    this.value.text = value
    this.value.setColor(valueColor)

    this.layoutLabels()
  }

  setValue(value: string): void {
    this.setText(this.caption.text, value)
  }

  /** Трясёт строку по горизонтали: знак пополнения. Промис реджектится по `signal`. */
  shake(ticker: GameTicker, signal?: AbortSignal): Promise<void> {
    return tweenShake(
      ticker,
      this,
      { amplitude: SHAKE_AMPLITUDE, durationMs: SHAKE_MS, oscillations: SHAKE_OSCILLATIONS },
      signal
    )
  }

  /** Собирает строку из подписи и значения и центрирует её по origin; без подписи зазор не нужен. */
  private layoutLabels(): void {
    const gap = this.caption.text ? GAP : 0
    const startX = -(this.caption.width + gap + this.value.width) / 2

    this.caption.position.set(startX, 0)
    this.value.position.set(startX + this.caption.width + gap, 0)
  }
}
