import { Assets, Container, Rectangle, Sprite, type Texture } from 'pixi.js'
import { CHECKBOX_BACKING, CHECKBOX_ICONS } from 'src/games/slot/assets'
import {
  CHECKBOX_FONT_SIZE,
  CHECKBOX_SIZE,
  DISABLED_ALPHA,
  ICON_RATIO,
  PANEL_BUTTON_GAP,
} from 'src/games/slot/constants'
import { LabelColor, type CheckboxOptions } from 'src/games/slot/types'

import { Label } from './label'

export class Checkbox extends Container {
  private readonly background = new Sprite()
  private readonly mark = new Sprite()
  private readonly caption: Label
  private readonly textures: { normal: Texture; active: Texture }

  constructor(options: CheckboxOptions) {
    super()

    const size = CHECKBOX_SIZE

    this.textures = { normal: Assets.get(CHECKBOX_BACKING.normal), active: Assets.get(CHECKBOX_BACKING.active) }
    this.caption = new Label({ color: LabelColor.cyan, fontSize: CHECKBOX_FONT_SIZE, text: options.label })

    const { width } = options
    const left = -width / 2

    this.background.anchor.set(0.5)
    this.background.position.set(left + size / 2, 0)

    this.mark.texture = Assets.get(CHECKBOX_ICONS.mark)
    this.mark.anchor.set(0.5)
    this.mark.setSize(size * ICON_RATIO)
    this.mark.position.copyFrom(this.background.position)

    this.caption.anchor.set(0, 0.5)
    this.caption.position.set(left + size + PANEL_BUTTON_GAP, 0)

    this.addChild(this.background, this.mark, this.caption)

    this.hitArea = new Rectangle(left, -size / 2, width, size)
    this.eventMode = 'static'
    this.cursor = 'pointer'

    // Слой доступности PIXI кладёт поверх канваса настоящий <button> с этим именем
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label

    if (options.onTap) {
      this.on('pointertap', options.onTap)
    }

    this.setChecked(false)
  }

  /** Включённый чекбокс показывает галку на active-подложке, выключенный — пустую обычную подложку. */
  setChecked(checked: boolean): void {
    this.mark.visible = checked
    this.background.texture = checked ? this.textures.active : this.textures.normal
    this.background.setSize(CHECKBOX_SIZE)
  }

  /** Включает или гасит чекбокс: снимает интерактивность и притеняет строку. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    this.accessible = enabled
  }
}
