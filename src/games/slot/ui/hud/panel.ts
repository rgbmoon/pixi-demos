import { Assets, Container, Sprite } from 'pixi.js'
import { PLATE_SRC } from 'src/games/slot/assets'
import { PANEL_HEIGHT, PANEL_WIDTH } from 'src/games/slot/constants'

import { ValueLabel } from './value-label'

/**
 * Плашка HUD с подписью и значением: спрайт-подложка и строка по центру.
 * Значение подставляет владелец — панель сама ничего не считает.
 */
export class Panel extends Container {
  private readonly plate = new Sprite()
  private readonly row: ValueLabel

  constructor(caption: string) {
    super()

    this.row = new ValueLabel(caption)

    this.plate.anchor.set(0.5)
    this.plate.texture = Assets.get(PLATE_SRC)
    this.plate.setSize(PANEL_WIDTH, PANEL_HEIGHT)

    this.addChild(this.plate, this.row)

    // Строка выстраивается только в setValue, поэтому до первой подписки центрируем пустым значением
    this.row.setValue('')
  }

  setValue(text: string): void {
    this.row.setValue(text)
  }
}
