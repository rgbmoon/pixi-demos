import { Container } from 'pixi.js'
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

  setText(caption: string, value: string): void {
    this.caption.text = caption
    this.value.text = value

    this.layoutLabels()
  }

  setValue(value: string): void {
    this.setText(this.caption.text, value)
  }

  /** Собирает строку из подписи и значения и центрирует её по origin; без подписи зазор не нужен. */
  private layoutLabels(): void {
    const gap = this.caption.text ? GAP : 0
    const startX = -(this.caption.width + gap + this.value.width) / 2

    this.caption.position.set(startX, 0)
    this.value.position.set(startX + this.caption.width + gap, 0)
  }
}
