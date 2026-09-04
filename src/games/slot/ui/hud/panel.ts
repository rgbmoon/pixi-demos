import { Assets, Container, Sprite } from 'pixi.js'
import { PLATE_SRC } from 'src/games/slot/assets'
import { PANEL_HEIGHT, PANEL_WIDTH } from 'src/games/slot/constants'
import { LabelColor } from 'src/games/slot/types'

import { Label } from './label'

const CAPTION_SIZE = 32
const VALUE_SIZE = 40

/**
 * Плашка HUD с подписью и значением: спрайт-подложка и две строки по центру.
 * Значение подставляет владелец — панель сама ничего не считает.
 */
export class Panel extends Container {
  private readonly plate = new Sprite()
  private readonly caption: Label
  private readonly value = new Label({ color: LabelColor.white, fontSize: VALUE_SIZE })

  constructor(caption: string) {
    super()

    this.caption = new Label({ color: LabelColor.cyan, fontSize: CAPTION_SIZE, text: caption })

    this.plate.anchor.set(0.5)
    this.plate.texture = Assets.get(PLATE_SRC)
    this.plate.setSize(PANEL_WIDTH, PANEL_HEIGHT)

    this.caption.anchor.set(0.5, 0)
    this.value.anchor.set(0.5, 0)

    this.addChild(this.plate, this.caption, this.value)

    this.layoutText()
  }

  setValue(text: string): void {
    this.value.text = text

    this.layoutText()
  }

  /** Центрирует пару строк по высоте плашки: обе меряются по фактическому кеглю шрифта. */
  private layoutText(): void {
    const totalHeight = this.caption.height + this.value.height

    this.caption.position.set(0, -totalHeight / 2)
    this.value.position.set(0, -totalHeight / 2 + this.caption.height)
  }
}
