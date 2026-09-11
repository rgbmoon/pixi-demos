import { Assets, Container, Rectangle, Sprite, type Texture } from 'pixi.js'
import { PALETTE } from 'src/core/palette'
import { BUTTON_BACKINGS } from 'src/games/slot/assets'
import { BUTTON_SIZE_UNITS, ICON_RATIO, DISABLED_ALPHA } from 'src/games/slot/constants'
import type { ButtonOptions } from 'src/games/slot/types'

/**
 * Кнопка сцены: спрайт-подложка с обычным и active-состоянием, SVG-иконка по центру.
 * Размер задаётся пресетом, арт берётся из манифеста игры.
 */
export class Button extends Container {
  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  readonly sizeUnits: number

  private readonly background = new Sprite()
  private readonly icon = new Sprite()
  private readonly textures: { normal: Texture; active: Texture }
  private isActive = false

  constructor(options: ButtonOptions) {
    super()

    const sizeUnits = BUTTON_SIZE_UNITS[options.size]
    const backing = BUTTON_BACKINGS[options.size][options.variant]

    this.sizeUnits = sizeUnits
    this.boundsArea = new Rectangle(0, 0, sizeUnits, sizeUnits)

    this.icon.anchor.set(0.5)
    this.icon.position.set(sizeUnits / 2, sizeUnits / 2)

    this.addChild(this.background, this.icon)

    this.eventMode = 'static'
    this.cursor = 'pointer'

    // Слой доступности PIXI кладёт поверх канваса настоящий <button> с этим именем и транслирует его click в pointertap
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label

    if (options.onTap) {
      this.on('pointertap', options.onTap)
    }

    if (options.onPress) {
      this.on('pointerdown', options.onPress)
    }

    const { onRelease } = options

    if (onRelease) {
      this.on('pointerup', () => onRelease(true))
      this.on('pointerupoutside', () => onRelease(false))
    }

    this.textures = { normal: Assets.get(backing.normal), active: Assets.get(backing.active) }
    this.applyBackground()
    this.setIcon(options.icon, options.iconRatio)
  }

  /** Переключает подложку между обычным и active-состоянием. */
  get active(): boolean {
    return this.isActive
  }

  set active(value: boolean) {
    if (this.isActive === value) return

    this.isActive = value
    this.applyBackground()
  }

  /** Включает или гасит кнопку: снимает интерактивность и притеняет подложку. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    // Недоступность кнопки должна быть видна и снаружи канваса
    this.accessible = enabled
  }

  /** Меняет иконку кнопки из кэша Assets; `tint` красит белую иконку, по умолчанию она остаётся белой. */
  setIcon(src: string, iconRatio?: number, tint: string = PALETTE.white): void {
    this.icon.texture = Assets.get(src)
    this.icon.tint = tint
    this.icon.setSize(this.sizeUnits * (iconRatio ?? ICON_RATIO))
  }

  /** Меняет имя кнопки в слое доступности. */
  setLabel(label: string): void {
    this.accessibleHint = label
    // PIXI пишет aria-label только при создании DOM-кнопки, у живой кнопки имя обновляем сами
    this._accessibleDiv?.setAttribute('aria-label', label)
  }

  private applyBackground(): void {
    this.background.texture = this.isActive ? this.textures.active : this.textures.normal
    this.background.setSize(this.sizeUnits, this.sizeUnits)
  }
}
